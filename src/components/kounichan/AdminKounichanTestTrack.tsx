import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  KounichanSettings,
  KounichanVehicleConfig,
  KounichanVehicleId,
  DEFAULT_KOUNICHAN_VEHICLES,
} from '../../types/kounichan';
import { NyanCharacter } from '../../types';
import { KounichanVehicleIllustration } from './KounichanVehicleIllustration';
import { getAssetUrl } from '../../utils/assetPath';
import confetti from 'canvas-confetti';
import {
  Play,
  RotateCcw,
  Zap,
  Gift,
  Sparkles,
  Heart,
  Maximize2,
  Check,
  ExternalLink,
} from 'lucide-react';

interface AdminKounichanTestTrackProps {
  settings: KounichanSettings;
  activeVehicleId: KounichanVehicleId;
  onSelectVehicle: (id: KounichanVehicleId) => void;
  undiscoveredCats: NyanCharacter[];
  onClaimGift?: (type: 'points' | 'cat', cat?: NyanCharacter) => void;
  onUpdateStats?: (updater: (prev: KounichanSettings['stats']) => KounichanSettings['stats']) => void;
}

interface TestBubble {
  id: number;
  text: string;
  imgUrl?: string;
  xPercent: number;
  yPx: number;
}

const VEHICLE_LIST: KounichanVehicleId[] = [
  'tricycle_turbo',
  'koyumi_2',
  'four_wheeler',
  'dendrobium',
  'space_trike',
  'aqua_yakkun',
];

export const AdminKounichanTestTrack: React.FC<AdminKounichanTestTrackProps> = ({
  settings,
  activeVehicleId,
  onSelectVehicle,
  undiscoveredCats,
  onClaimGift,
  onUpdateStats,
}) => {
  // Current vehicle being tested
  const vehicle = settings.vehicles[activeVehicleId] || DEFAULT_KOUNICHAN_VEHICLES[activeVehicleId];

  // Track state
  const [isRunning, setIsRunning] = useState(false);
  const [isDashing, setIsDashing] = useState(false);
  const [progress, setProgress] = useState(108); // 108 down to -12% (Right to Left)
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('rtl');
  const [bubbles, setBubbles] = useState<TestBubble[]>([]);
  const [droppedGift, setDroppedGift] = useState<{
    id: number;
    xPercent: number;
  } | null>(null);

  // Result popup
  const [giftResultModal, setGiftResultModal] = useState<{
    type: 'points' | 'cat';
    cat?: NyanCharacter;
    points?: number;
  } | null>(null);

  // Fullscreen top-layer overlay mode
  const [isScreenOverlayRunning, setIsScreenOverlayRunning] = useState(false);
  const [overlayProgress, setOverlayProgress] = useState(112);
  const [overlayDashing, setOverlayDashing] = useState(false);
  const [overlayBubbles, setOverlayBubbles] = useState<TestBubble[]>([]);
  const [overlayGift, setOverlayGift] = useState<{ id: number; xPercent: number } | null>(null);

  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const bubbleTimerRef = useRef<number>(0);

  const overlayAnimRef = useRef<number | null>(null);
  const overlayLastTimeRef = useRef<number>(0);
  const overlayBubbleTimerRef = useRef<number>(0);

  // --- Start / Stop In-Track Test ---
  const handleStartTest = () => {
    const dir = settings?.direction || 'rtl';
    setDirection(dir);
    setProgress(dir === 'ltr' ? -12 : 108);
    setIsDashing(false);
    setBubbles([]);
    setDroppedGift(null);
    setIsRunning(true);
    lastTimeRef.current = performance.now();
    bubbleTimerRef.current = 0;
  };

  const handleResetTest = () => {
    const dir = settings?.direction || 'rtl';
    setIsRunning(false);
    setIsDashing(false);
    setProgress(dir === 'ltr' ? -12 : 108);
    setBubbles([]);
    setDroppedGift(null);
  };

  // Listen to global test_run event to auto-start this in-admin track
  useEffect(() => {
    const onTestEvent = (e: CustomEvent<{ vehicleId?: KounichanVehicleId }>) => {
      if (e.detail?.vehicleId) {
        onSelectVehicle(e.detail.vehicleId);
      }
      handleStartTest();
    };
    window.addEventListener('kounichan:test_run' as any, onTestEvent);
    return () => {
      window.removeEventListener('kounichan:test_run' as any, onTestEvent);
    };
  }, [onSelectVehicle]);

  // --- Tap on vehicle to dash ---
  const handleTapVehicle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isRunning || isDashing) return;

    setIsDashing(true);
    try {
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#E05B48', '#F59E0B', '#3B82F6', '#10B981'],
      });
    } catch (_e) {}

    // Drop gift box on track
    setDroppedGift({
      id: Date.now(),
      xPercent: Math.max(10, Math.min(85, progress)),
    });

    if (onUpdateStats) {
      onUpdateStats((prev) => ({
        ...prev,
        totalTapped: (prev.totalTapped || 0) + 1,
      }));
    }
  };

  // --- Animation loop for In-Track test ---
  useEffect(() => {
    if (!isRunning) return;

    const baseSec = vehicle.baseSpeedSec || 9;
    const dashSec = vehicle.dashSpeedSec || 2.4;
    const currentDuration = isDashing ? dashSec : baseSec;
    // Total distance is 120% (-10% to 110%)
    const speedPerSec = 120 / currentDuration;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      setProgress((prev) => {
        let next: number;
        if (direction === 'ltr') {
          next = prev + speedPerSec * dt;
          if (next >= 112) {
            setIsRunning(false);
            return 112;
          }
        } else {
          next = prev - speedPerSec * dt;
          if (next <= -12) {
            setIsRunning(false);
            return -12;
          }
        }
        return next;
      });

      // Spawn onomatopoeia bubbles
      bubbleTimerRef.current += dt;
      const interval = isDashing ? 0.25 : 0.8;
      if (bubbleTimerRef.current >= interval) {
        bubbleTimerRef.current = 0;
        const text = isDashing
          ? vehicle.turboOnomatopoeia
          : Math.random() > 0.4
          ? vehicle.onomatopoeia
          : vehicle.subOnomatopoeia || vehicle.onomatopoeia;

        const newBubble: TestBubble = {
          id: Date.now() + Math.random(),
          text,
          imgUrl: vehicle.customOnomatopoeiaImageUrl,
          xPercent: progress + (direction === 'ltr' ? -6 : 6),
          yPx: Math.random() * 12 - 6,
        };
        setBubbles((prev) => [...prev.slice(-3), newBubble]);
      }

      animRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, isDashing, direction, vehicle, progress]);

  // Clean up bubbles
  useEffect(() => {
    if (bubbles.length === 0) return;
    const t = setTimeout(() => setBubbles((prev) => prev.slice(1)), 1300);
    return () => clearTimeout(t);
  }, [bubbles]);

  // --- Handle opening gift ---
  const handleOpenGift = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!droppedGift && !overlayGift) return;

    try {
      confetti({
        particleCount: 50,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#F59E0B', '#E05B48', '#EC4899', '#8B5CF6'],
      });
    } catch (_e) {}

    const shouldGiftCat = undiscoveredCats.length > 0 && Math.random() < 0.5;
    if (shouldGiftCat) {
      const luckyCat = undiscoveredCats[Math.floor(Math.random() * undiscoveredCats.length)];
      setGiftResultModal({
        type: 'cat',
        cat: luckyCat,
      });
      if (onClaimGift) onClaimGift('cat', luckyCat);
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
      if (onClaimGift) onClaimGift('points');
      if (onUpdateStats) {
        onUpdateStats((prev) => ({
          ...prev,
          pointsGifted: (prev.pointsGifted || 0) + 10,
        }));
      }
    }

    setDroppedGift(null);
    setOverlayGift(null);
  };

  // --- Top-Level Screen Overlay Test Mode (z-[99999]) ---
  const handleStartScreenOverlay = () => {
    setIsScreenOverlayRunning(true);
    setOverlayProgress(112);
    setOverlayDashing(false);
    setOverlayBubbles([]);
    setOverlayGift(null);
    overlayLastTimeRef.current = performance.now();
    overlayBubbleTimerRef.current = 0;

    try {
      confetti({
        particleCount: 30,
        spread: 70,
        origin: { y: 0.9 },
        colors: ['#E05B48', '#F59E0B', '#3B82F6'],
      });
    } catch (_e) {}
  };

  useEffect(() => {
    if (!isScreenOverlayRunning) return;

    const baseSec = vehicle.baseSpeedSec || 8.5;
    const dashSec = vehicle.dashSpeedSec || 2.2;
    const currentDuration = overlayDashing ? dashSec : baseSec;
    const speedPerSec = 125 / currentDuration;

    const tickOverlay = (now: number) => {
      const dt = Math.min((now - overlayLastTimeRef.current) / 1000, 0.1);
      overlayLastTimeRef.current = now;

      setOverlayProgress((prev) => {
        const next = prev - speedPerSec * dt;
        if (next <= -15) {
          setIsScreenOverlayRunning(false);
          return -15;
        }
        return next;
      });

      overlayBubbleTimerRef.current += dt;
      const interval = overlayDashing ? 0.22 : 0.75;
      if (overlayBubbleTimerRef.current >= interval) {
        overlayBubbleTimerRef.current = 0;
        const text = overlayDashing
          ? vehicle.turboOnomatopoeia
          : Math.random() > 0.4
          ? vehicle.onomatopoeia
          : vehicle.subOnomatopoeia || vehicle.onomatopoeia;

        const newBubble: TestBubble = {
          id: Date.now() + Math.random(),
          text,
          imgUrl: vehicle.customOnomatopoeiaImageUrl,
          xPercent: overlayProgress + 6,
          yPx: Math.random() * 14 - 7,
        };
        setOverlayBubbles((prev) => [...prev.slice(-3), newBubble]);
      }

      overlayAnimRef.current = requestAnimationFrame(tickOverlay);
    };

    overlayLastTimeRef.current = performance.now();
    overlayAnimRef.current = requestAnimationFrame(tickOverlay);

    return () => {
      if (overlayAnimRef.current) cancelAnimationFrame(overlayAnimRef.current);
    };
  }, [isScreenOverlayRunning, overlayDashing, vehicle, overlayProgress]);

  useEffect(() => {
    if (overlayBubbles.length === 0) return;
    const t = setTimeout(() => setOverlayBubbles((prev) => prev.slice(1)), 1200);
    return () => clearTimeout(t);
  }, [overlayBubbles]);

  const handleTapOverlayVehicle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isScreenOverlayRunning || overlayDashing) return;
    setOverlayDashing(true);
    setOverlayGift({
      id: Date.now(),
      xPercent: Math.max(10, Math.min(85, overlayProgress)),
    });
    try {
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    } catch (_e) {}
    if (onUpdateStats) {
      onUpdateStats((prev) => ({
        ...prev,
        totalTapped: (prev.totalTapped || 0) + 1,
      }));
    }
  };

  return (
    <div className="bg-[#FFFDF9] p-4 sm:p-5 rounded-2xl border-2 border-[#DDD7C8] shadow-sm space-y-3.5">
      {/* Track Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#EAE5D9]">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚦</span>
          <div>
            <h4 className="text-sm sm:text-base font-black text-[#2E2824] font-handwriting flex items-center gap-2">
              <span>リアルタイム走行テストコース</span>
              <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full font-bold border border-[#A5D6A7]">
                画面内でそのまま検証可能
              </span>
            </h4>
            <p className="text-xs text-[#7A726A] font-handwriting">
              管理画面を閉じる必要なし！ここで走行アニメーション・加速タップ・プレゼントを直接テストできます。
            </p>
          </div>
        </div>

        {/* Global Screen Overlay Test Button */}
        <button
          type="button"
          onClick={handleStartScreenOverlay}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#487560] hover:bg-[#3B624E] text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
          title="管理画面や他のモーダルの影に隠れず、画面全体の最前面で横切らせます"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>🚀 最前面・全画面オーバーレイ走行</span>
        </button>
      </div>

      {/* Vehicle Quick Switcher Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
        <span className="text-xs font-bold text-[#7A6B63] shrink-0 mr-1 font-handwriting">
          のりもの切替:
        </span>
        {VEHICLE_LIST.map((id) => {
          const v = settings.vehicles[id] || DEFAULT_KOUNICHAN_VEHICLES[id];
          const isSelected = activeVehicleId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSelectVehicle(id);
                // If stopped, keep it ready; if running, let it continue with new vehicle
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 border shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#C8744E] text-white border-[#C8744E] shadow-xs'
                  : 'bg-[#FAF8F5] text-[#5C544D] border-[#DDD7C8] hover:bg-[#F2ECE4]'
              }`}
            >
              <span>{v.name.split('（')[0]}</span>
              {v.customImageUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* --- LIVE STAGE COURSE RUNWAY --- */}
      <div className="relative w-full h-44 sm:h-48 rounded-2xl border-2 border-[#2E2824] overflow-hidden bg-gradient-to-b from-[#EBF5FB] via-[#FAF8F4] to-[#E5E0D5] shadow-inner select-none">
        {/* Background Sketch Scenery (Clouds, Telephone Poles, Trees) */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {/* Distant Hills */}
            <path
              d="M0 80 Q120 50 250 75 T500 70 T750 85 T1000 65 L1000 120 L0 120 Z"
              fill="#D4E6D9"
            />
            {/* Fluffy Clouds */}
            <circle cx="80" cy="30" r="16" fill="#FFFFFF" />
            <circle cx="100" cy="26" r="20" fill="#FFFFFF" />
            <circle cx="120" cy="30" r="16" fill="#FFFFFF" />
            <circle cx="450" cy="25" r="14" fill="#FFFFFF" />
            <circle cx="470" cy="22" r="18" fill="#FFFFFF" />
            <circle cx="490" cy="25" r="14" fill="#FFFFFF" />
          </svg>
        </div>

        {/* Street Road Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-18 bg-[#423C38] border-t-2 border-[#2E2824]">
          {/* Road Curb Grass */}
          <div className="absolute -top-2 left-0 right-0 h-2 bg-[#8FAF7E] border-b border-[#2E2824]" />

          {/* Dashed White Street Centerline */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 border-t-2 border-dashed border-[#FFFDF9]/60" />

          {/* Distance Track Markers */}
          <div className="absolute top-1.5 right-4 text-[9px] font-mono font-bold text-[#DDD7C8]/70">
            🏁 START（右）
          </div>
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-[#DDD7C8]/70">
            50m
          </div>
          <div className="absolute top-1.5 left-4 text-[9px] font-mono font-bold text-[#DDD7C8]/70">
            （左）GOAL 🏁
          </div>
        </div>

        {/* Dropped Gift Box on the Track */}
        {droppedGift && (
          <div
            onClick={handleOpenGift}
            style={{ left: `${droppedGift.xPercent}%`, bottom: '26px' }}
            className="absolute z-25 -translate-x-1/2 cursor-pointer group flex flex-col items-center animate-bounce pointer-events-auto"
            title="落とし物をタップして受け取る！"
          >
            <div className="p-2 bg-gradient-to-tr from-[#E05B48] to-[#F59E0B] rounded-xl shadow-lg border-2 border-[#FFFDF9] transform group-hover:scale-110 active:scale-95 transition-all">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <span className="mt-0.5 bg-white text-[#2E2824] px-1.5 py-0.2 rounded-full text-[9px] font-black border border-[#2E2824] shadow-2xs">
              🎁 タップ！
            </span>
          </div>
        )}

        {/* Onomatopoeia Sound Effect Bubbles */}
        {bubbles.map((b) => (
          <div
            key={b.id}
            style={{
              left: `${b.xPercent}%`,
              bottom: `${58 + b.yPx}px`,
            }}
            className="absolute z-20 pointer-events-none -translate-x-1/2 animate-floatFade text-center"
          >
            {b.imgUrl ? (
              <img
                src={getAssetUrl(b.imgUrl)}
                alt={b.text}
                className="max-h-7 max-w-[90px] object-contain drop-shadow-sm"
              />
            ) : (
              <div className="px-2.5 py-0.5 bg-white/95 border-1.5 border-[#2E2824] rounded-full shadow-sm text-xs font-black font-handwriting text-[#2E2824] whitespace-nowrap transform rotate-[-2deg]">
                {b.text}
              </div>
            )}
          </div>
        ))}

        {/* Moving Kouni-chan Vehicle */}
        <div
          onClick={handleTapVehicle}
          style={{
            left: isRunning ? `${progress}%` : '50%',
            bottom: '18px',
          }}
          className={`absolute z-20 -translate-x-1/2 cursor-pointer transition-transform duration-75 ${
            isDashing ? 'scale-110' : 'hover:scale-105 active:scale-95'
          }`}
          title="走行中のこうにちゃんをタップしてターボ加速！"
        >
          {/* Turbo Spark Badge */}
          {isDashing && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#E05B48] text-white text-[10px] font-black px-2 py-0.2 rounded-full shadow-md font-handwriting animate-pulse whitespace-nowrap flex items-center gap-0.5">
              <Zap className="w-3 h-3 text-yellow-300" />
              <span>{vehicle.turboOnomatopoeia}</span>
            </div>
          )}

          <KounichanVehicleIllustration
            vehicle={vehicle}
            size={110}
            isDashing={isDashing}
            direction={direction}
          />
        </div>

        {/* Idle Overlay Hint when not running */}
        {!isRunning && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full border border-[#DDD7C8] shadow-xs text-xs font-handwriting font-bold text-[#5C544D] flex items-center gap-1.5">
            <span>👇 下のボタンを押してテスト走行を開始</span>
          </div>
        )}
      </div>

      {/* Track Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={() => handleStartTest()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C8744E] hover:bg-[#B3623D] text-white text-xs font-black rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>▶️ 走行スタート（{(settings.direction || 'rtl') === 'rtl' ? '右から左へ' : '左から右へ'}）</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleTapVehicle()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E05B48] hover:bg-[#C94B39] text-white text-xs font-black rounded-xl shadow-xs transition active:scale-95 cursor-pointer animate-pulse"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ タップ加速テスト</span>
              </button>
              <button
                type="button"
                onClick={handleResetTest}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF8F5] hover:bg-[#EAE5D9] text-[#5C544D] text-xs font-bold rounded-xl border border-[#DDD7C8] transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>リセット</span>
              </button>
            </>
          )}
        </div>

        {/* Real-time Status Pills */}
        <div className="flex items-center gap-2 text-[11px] font-handwriting text-[#7A6B63]">
          <span className="bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#EAE5D9]">
            選択中: <strong>{vehicle.name.split('（')[0]}</strong>
          </span>
          <span className="bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#EAE5D9]">
            方向: <strong className="text-[#C8744E]">{(settings.direction || 'rtl') === 'rtl' ? '右→左（DB設定）' : '左→右（DB設定）'}</strong>
          </span>
          <span className="bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#EAE5D9]">
            状態:{' '}
            <strong className={isDashing ? 'text-red-600' : isRunning ? 'text-emerald-700' : ''}>
              {isDashing ? '⚡ターボダッシュ中' : isRunning ? '🚗 走行中' : '停止中'}
            </strong>
          </span>
        </div>
      </div>

      {/* --- REWARD POPUP RESULT MODAL --- */}
      {giftResultModal && (
        <div
          onClick={() => setGiftResultModal(null)}
          className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
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
                <span className="text-base font-black text-[#C8744E] font-handwriting">
                  🐱 No.{giftResultModal.cat.no} {giftResultModal.cat.name}
                </span>
                {giftResultModal.cat.dialogue && (
                  <p className="text-xs font-handwriting text-[#5A4032] italic mt-2">
                    {giftResultModal.cat.dialogue}
                  </p>
                )}
              </div>
            )}

            {giftResultModal.type === 'points' && (
              <div className="my-4 p-4 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0]">
                <span className="text-3xl font-black text-[#15803D] font-mono">+10 pt</span>
                <p className="text-xs text-[#166534] font-bold mt-1 font-handwriting">
                  おこづかいを10ポイントもらったよ！（テスト検証）
                </p>
              </div>
            )}

            <button
              onClick={() => setGiftResultModal(null)}
              className="w-full py-2.5 bg-[#2E2824] hover:bg-[#423932] text-white font-bold rounded-xl font-handwriting text-sm transition shadow-sm cursor-pointer"
            >
              ありがとう！
            </button>
          </div>
        </div>
      )}

      {/* --- TOP-LAYER SCREEN OVERLAY RUNNER (z-[99999] mounted to body via Portal) --- */}
      {typeof document !== 'undefined' &&
        isScreenOverlayRunning &&
        createPortal(
          <div className="fixed bottom-6 left-0 right-0 z-[99999] pointer-events-none select-none">
            {/* Overlay Notification Pill */}
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-[#2E2824]/90 text-white text-xs font-handwriting font-bold px-4 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-2 pointer-events-auto">
              <span>🛵 最前面オーバーレイ走行中（タップで加速＆プレゼント）</span>
              <button
                type="button"
                onClick={() => setIsScreenOverlayRunning(false)}
                className="ml-2 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            </div>

            {/* Dropped gift on overlay */}
            {overlayGift && (
              <div
                onClick={handleOpenGift}
                style={{ left: `${overlayGift.xPercent}%`, bottom: '16px' }}
                className="absolute z-30 -translate-x-1/2 cursor-pointer group flex flex-col items-center animate-bounce pointer-events-auto"
              >
                <div className="p-2.5 bg-gradient-to-tr from-[#E05B48] to-[#F59E0B] rounded-2xl shadow-xl border-2 border-white">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div className="mt-1 bg-white text-[#2E2824] px-2 py-0.5 rounded-full text-[10px] font-black border border-[#2E2824] shadow-sm whitespace-nowrap">
                  🎁 タップで受け取る！
                </div>
              </div>
            )}

            {/* Overlay Bubbles */}
            {overlayBubbles.map((b) => (
              <div
                key={b.id}
                style={{ left: `${b.xPercent}%`, bottom: `${50 + b.yPx}px` }}
                className="absolute z-20 pointer-events-none -translate-x-1/2 animate-floatFade text-center"
              >
                {b.imgUrl ? (
                  <img
                    src={getAssetUrl(b.imgUrl)}
                    alt={b.text}
                    className="max-h-8 max-w-[100px] object-contain drop-shadow-md"
                  />
                ) : (
                  <div className="px-3 py-1 bg-white/95 border-2 border-[#2E2824] rounded-full shadow-md text-xs font-black font-handwriting text-[#2E2824] whitespace-nowrap">
                    {b.text}
                  </div>
                )}
              </div>
            ))}

            {/* Overlay Vehicle */}
            <div
              onClick={handleTapOverlayVehicle}
              style={{ left: `${overlayProgress}%`, bottom: '8px' }}
              className={`absolute z-20 -translate-x-1/2 cursor-pointer pointer-events-auto transition-transform ${
                overlayDashing ? 'scale-115' : 'hover:scale-105 active:scale-95'
              }`}
            >
              {overlayDashing && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#E05B48] text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-lg font-handwriting animate-pulse whitespace-nowrap flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-300" />
                  <span>{vehicle.turboOnomatopoeia}</span>
                </div>
              )}
              <KounichanVehicleIllustration
                vehicle={vehicle}
                size={135}
                isDashing={overlayDashing}
                direction="rtl"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
