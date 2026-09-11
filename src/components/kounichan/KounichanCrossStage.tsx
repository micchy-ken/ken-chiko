import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KounichanSettings, KounichanVehicleConfig, KounichanVehicleId } from '../../types/kounichan';
import { NyanCharacter } from '../../types';
import { KounichanVehicleIllustration } from './KounichanVehicleIllustration';
import { Gift, Sparkles, Heart, Zap, Star } from 'lucide-react';
import confetti from '../../utils/confetti';
import { getAssetUrl } from '../../utils/assetPath';

interface KounichanCrossStageProps {
  settings?: KounichanSettings;
  isCompanionPresent: boolean;
  isTransit: boolean;
  undiscoveredCats: NyanCharacter[];
  onClaimGift: (type: 'points' | 'cat', cat?: NyanCharacter) => void;
  onUpdateStats?: (updater: (prev: KounichanSettings['stats']) => KounichanSettings['stats']) => void;
}

interface ActiveBubble {
  id: number;
  text: string;
  imgUrl?: string;
  xPercent: number; // 0 - 100 relative to stage
  yPx: number;
}

interface DroppedGift {
  id: number;
  xPercent: number;
  yPx: number;
  vehicleName: string;
}

export const KounichanCrossStage: React.FC<KounichanCrossStageProps> = ({
  settings,
  isCompanionPresent,
  isTransit,
  undiscoveredCats,
  onClaimGift,
  onUpdateStats,
}) => {
  const isEnabled = settings ? settings.enabled !== false : true;
  const frequency = settings?.frequency || 'normal';

  // Active run state
  const [isRunning, setIsRunning] = useState(false);
  const [activeVehicle, setActiveVehicle] = useState<KounichanVehicleConfig | null>(null);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('rtl');
  const [isDashing, setIsDashing] = useState(false);
  const [progress, setProgress] = useState(115); // 115 down to -20 (Right to Left)
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);
  const [droppedGift, setDroppedGift] = useState<DroppedGift | null>(null);
  const [giftResultModal, setGiftResultModal] = useState<{
    type: 'points' | 'cat';
    cat?: NyanCharacter;
    points?: number;
  } | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const bubbleTimerRef = useRef<number>(0);
  const nextSpawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Available vehicles
  const enabledVehicles = useMemo(() => {
    if (!settings?.vehicles) return [];
    return (Object.values(settings.vehicles) as KounichanVehicleConfig[]).filter((v) => v.enabled);
  }, [settings]);

  // Calculate next spawn delay based on frequency
  const getNextSpawnDelayMs = () => {
    switch (frequency) {
      case 'test':
        return Math.random() * 6000 + 8000; // 8 - 14 sec
      case 'often':
        return Math.random() * 25000 + 25000; // 25 - 50 sec
      case 'rare':
        return Math.random() * 120000 + 180000; // 3 - 5 min
      case 'normal':
      default:
        return Math.random() * 60000 + 60000; // 1 - 2 min
    }
  };

  // Launch a crossing run
  const triggerCrossing = (forcedVehicleId?: KounichanVehicleId) => {
    if (isRunning) return;

    let selectedVehicle: KounichanVehicleConfig;
    if (forcedVehicleId && settings?.vehicles[forcedVehicleId]) {
      selectedVehicle = settings.vehicles[forcedVehicleId];
    } else if (enabledVehicles.length > 0) {
      const idx = Math.floor(Math.random() * enabledVehicles.length);
      selectedVehicle = enabledVehicles[idx];
    } else if (settings?.vehicles) {
      selectedVehicle = (Object.values(settings.vehicles) as KounichanVehicleConfig[])[0];
    } else {
      return;
    }

    // Direction is loaded from database settings (defaults to 'rtl': right to left)
    const dir: 'ltr' | 'rtl' = settings?.direction || 'rtl';
    setDirection(dir);
    setActiveVehicle(selectedVehicle);
    setIsDashing(false);
    setProgress(dir === 'ltr' ? -15 : 115);
    setBubbles([]);
    setIsRunning(true);
    lastTimeRef.current = performance.now();
    bubbleTimerRef.current = 0;

    if (onUpdateStats) {
      onUpdateStats((prev) => ({
        ...prev,
        totalSpotted: (prev.totalSpotted || 0) + 1,
        lastSpottedAt: Date.now(),
      }));
    }
  };

  // Expose global listener so Admin can trigger a test run instantly
  useEffect(() => {
    const handleTestEvent = (e: CustomEvent<{ vehicleId?: KounichanVehicleId }>) => {
      triggerCrossing(e.detail?.vehicleId);
    };
    window.addEventListener('kounichan:test_run' as any, handleTestEvent);
    return () => {
      window.removeEventListener('kounichan:test_run' as any, handleTestEvent);
    };
  }, [enabledVehicles, isRunning]);

  // Scheduler for spontaneous crossing when cat is absent
  useEffect(() => {
    if (!isEnabled || isCompanionPresent || isTransit) {
      if (nextSpawnTimerRef.current) {
        clearTimeout(nextSpawnTimerRef.current);
      }
      return;
    }

    const scheduleNext = () => {
      const delay = getNextSpawnDelayMs();
      nextSpawnTimerRef.current = setTimeout(() => {
        if (!isCompanionPresent && !isTransit && !isRunning) {
          triggerCrossing();
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (nextSpawnTimerRef.current) {
        clearTimeout(nextSpawnTimerRef.current);
      }
    };
  }, [isEnabled, isCompanionPresent, isTransit, isRunning, frequency]);

  // Main animation loop
  useEffect(() => {
    if (!isRunning || !activeVehicle) return;

    const baseSec = activeVehicle.baseSpeedSec || 10;
    const dashSec = activeVehicle.dashSpeedSec || 2.2;
    const currentDurationSec = isDashing ? dashSec : baseSec;
    // Speed in percent per second: Total distance is 130% (-15 to 115)
    const speedPercentPerSec = (130 / currentDurationSec);

    const updateFrame = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      setProgress((prev) => {
        let next: number;
        if (direction === 'ltr') {
          next = prev + speedPercentPerSec * dt;
          if (next >= 120) {
            setIsRunning(false);
            return 120;
          }
        } else {
          next = prev - speedPercentPerSec * dt;
          if (next <= -20) {
            setIsRunning(false);
            return -20;
          }
        }
        return next;
      });

      // Spawn onomatopoeia bubbles rhythmically while cruising (only when enabled)
      if (settings?.showOnomatopoeia) {
        bubbleTimerRef.current += dt;
        const bubbleInterval = isDashing ? 0.22 : 0.85;
        if (bubbleTimerRef.current >= bubbleInterval) {
          bubbleTimerRef.current = 0;
          const bubbleText = isDashing
            ? activeVehicle.turboOnomatopoeia
            : Math.random() > 0.4
            ? activeVehicle.onomatopoeia
            : activeVehicle.subOnomatopoeia || activeVehicle.onomatopoeia;

          const newBubble: ActiveBubble = {
            id: Date.now() + Math.random(),
            text: bubbleText,
            imgUrl: activeVehicle.customOnomatopoeiaImageUrl,
            xPercent: progress + (direction === 'ltr' ? -12 : 12),
            yPx: Math.random() * 12 - 6,
          };

          setBubbles((prev) => [...prev.slice(-4), newBubble]);
        }
      }

      animFrameRef.current = requestAnimationFrame(updateFrame);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRunning, activeVehicle, isDashing, direction, progress]);

  // Clean up expired bubbles
  useEffect(() => {
    if (bubbles.length === 0) return;
    const timer = setTimeout(() => {
      setBubbles((prev) => prev.slice(1));
    }, 1400);
    return () => clearTimeout(timer);
  }, [bubbles]);

  // Handle user tapping Kouni-chan!
  const handleTapKounichan = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRunning || isDashing || !activeVehicle) return;

    // Trigger Dash!
    setIsDashing(true);

    try {
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#E05B48', '#F59E0B', '#3B82F6', '#10B981'],
      });
    } catch (e) {}

    // Drop a gift box right on the stage floor!
    setDroppedGift({
      id: Date.now(),
      xPercent: Math.max(10, Math.min(85, progress)),
      yPx: 25,
      vehicleName: activeVehicle.name,
    });

    if (onUpdateStats) {
      onUpdateStats((prev) => ({
        ...prev,
        totalTapped: (prev.totalTapped || 0) + 1,
      }));
    }
  };

  // Handle opening the dropped gift box
  const handleOpenGift = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!droppedGift) return;

    try {
      confetti({
        particleCount: 50,
        spread: 90,
        origin: { y: 0.65 },
        colors: ['#F59E0B', '#E05B48', '#EC4899', '#8B5CF6'],
      });
    } catch (e) {}

    // 50% chance of bringing an undiscovered cat (if available), otherwise 10 points
    const shouldGiftCat = undiscoveredCats.length > 0 && Math.random() < 0.55;

    if (shouldGiftCat) {
      const luckyCat = undiscoveredCats[Math.floor(Math.random() * undiscoveredCats.length)];
      setGiftResultModal({
        type: 'cat',
        cat: luckyCat,
      });
      onClaimGift('cat', luckyCat);
      if (onUpdateStats) {
        onUpdateStats((prev) => ({
          ...prev,
          catsGifted: (prev.catsGifted || 0) + 1,
        }));
      }
    } else {
      setGiftResultModal({
        type: 'points',
        points: 10,
      });
      onClaimGift('points');
      if (onUpdateStats) {
        onUpdateStats((prev) => ({
          ...prev,
          pointsGifted: (prev.pointsGifted || 0) + 10,
        }));
      }
    }

    setDroppedGift(null);
  };

  // Only hide when not enabled AND not running a test or showing gifts/modals
  if (!isEnabled && !isRunning && !droppedGift && !giftResultModal) {
    return null;
  }

  return (
    <>
      {/* 1. Dropped Gift Box resting on the ground */}
      {droppedGift && (
        <div
          onClick={handleOpenGift}
          style={{ left: `${droppedGift.xPercent}%`, bottom: '26px' }}
          className="absolute z-25 -translate-x-1/2 cursor-pointer group flex flex-col items-center animate-bounce"
          title="こうにちゃんが落としていったプレゼントをタップして開ける！"
        >
          <div className="relative p-2.5 bg-gradient-to-tr from-[#E05B48] to-[#F59E0B] rounded-2xl shadow-lg border-2 border-[#FFFDF9] transform group-hover:scale-115 active:scale-95 transition-all">
            <Gift className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFE58F] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFD700]"></span>
            </span>
          </div>
          <div className="mt-1 bg-[#FFFDF9] border border-[#2E2824] px-2 py-0.5 rounded-full text-[10px] font-bold font-handwriting shadow-xs text-[#2E2824] whitespace-nowrap">
            🎁 タップで受け取る！
          </div>
        </div>
      )}

      {/* 2. Floating Onomatopoeia bubbles (only when enabled) */}
      {settings?.showOnomatopoeia &&
        bubbles.map((b) => (
          <div
            key={b.id}
            style={{
              left: `${b.xPercent}%`,
              bottom: `${115 + b.yPx}px`,
            }}
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-4 animate-floatFade text-center select-none"
          >
            {b.imgUrl ? (
              <img
                src={getAssetUrl(b.imgUrl)}
                alt={b.text}
                className="max-h-8 max-w-[100px] object-contain filter drop-shadow-sm"
              />
            ) : (
              <div className="px-2.5 py-1 bg-[#FFFDF9]/95 border-1.5 border-[#3E3833] rounded-full shadow-sm text-xs font-black font-handwriting text-[#2E2824] whitespace-nowrap transform rotate-[-3deg]">
                {b.text}
              </div>
            )}
          </div>
        ))}

      {/* 3. Kouni-chan on Vehicle Moving Across the Stage */}
      {isRunning && activeVehicle && (
        <div
          onClick={handleTapKounichan}
          style={{
            left: `${progress}%`,
            bottom: '18px',
          }}
          className={`absolute z-22 -translate-x-1/2 cursor-pointer group transition-transform ${
            isDashing ? 'scale-110' : 'hover:scale-105 active:scale-95'
          }`}
          title="こうにちゃんをタップ！"
        >
          {/* Dash Turbo FX */}
          {isDashing && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#E05B48] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md font-handwriting animate-pulse whitespace-nowrap flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-300" />
              <span>{activeVehicle.turboOnomatopoeia}</span>
            </div>
          )}

          <KounichanVehicleIllustration
            vehicle={activeVehicle}
            size={120}
            isDashing={isDashing}
            direction={direction}
          />
        </div>
      )}

      {/* 4. Gift Result Pop-up Modal */}
      {giftResultModal && (
        <div
          onClick={() => setGiftResultModal(null)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FFFDF9] border-3 border-[#2E2824] rounded-3xl p-6 max-w-sm w-full text-center shadow-[6px_6px_0px_#2E2824] relative animate-scaleUp"
          >
            <div className="w-16 h-16 mx-auto -mt-10 mb-3 bg-gradient-to-tr from-[#FFD54F] to-[#FFA000] rounded-2xl border-2 border-[#2E2824] flex items-center justify-center shadow-md">
              {giftResultModal.type === 'cat' ? (
                <Heart className="w-9 h-9 text-[#D32F2F] fill-current" />
              ) : (
                <Sparkles className="w-9 h-9 text-[#2E2824]" />
              )}
            </div>

            <h3 className="text-lg font-black text-[#2E2824] font-handwriting mb-1">
              {giftResultModal.type === 'cat'
                ? 'こうにちゃんからの贈り物！'
                : 'こうにちゃんからのおこづかい！'}
            </h3>

            {giftResultModal.type === 'cat' && giftResultModal.cat && (
              <div className="my-4 p-3.5 bg-[#FAF2EB] rounded-2xl border border-[#F0D5C3]">
                <p className="text-xs text-[#874A2E] font-bold mb-2">
                  こうにちゃんが新しいお友達を連れてきてくれたよ！
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-base font-black text-[#C8744E] font-handwriting">
                    🐱 No.{giftResultModal.cat.no} {giftResultModal.cat.name}
                  </span>
                </div>
                {giftResultModal.cat.dialogue && (
                  <p className="text-xs font-handwriting text-[#5A4032] italic mt-2">
                    {giftResultModal.cat.dialogue}
                  </p>
                )}
              </div>
            )}

            {giftResultModal.type === 'points' && (
              <div className="my-4 p-4 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0]">
                <span className="text-3xl font-black text-[#15803D] font-mono">
                  +10 pt
                </span>
                <p className="text-xs text-[#166534] font-bold mt-1 font-handwriting">
                  おこづかいを10ポイントもらったよ！
                </p>
              </div>
            )}

            <button
              onClick={() => setGiftResultModal(null)}
              className="w-full py-2.5 bg-[#2E2824] hover:bg-[#423932] text-white font-bold rounded-xl font-handwriting text-sm transition shadow-sm active:translate-y-0.5"
            >
              ありがとう！
            </button>
          </div>
        </div>
      )}
    </>
  );
};
