import React, { useState, useRef, useEffect, useMemo } from 'react';
import { KenchikoState, NyanCharacter, GiftItem, LocationId } from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';
import { KenchikoFigure } from './KenchikoFigure';
import { KenchikoAvatar } from './KenchikoAvatar';
import { NyanIllustration } from './NyanIllustration';
import { LocationIllustration } from './LocationIllustration';
import { TransitVehicleView } from './TransitVehicleView';
import { KounichanCrossStage } from './kounichan/KounichanCrossStage';
import { KounichanSettings } from '../types/kounichan';
import { splitDialogueIntoPages, getDialogueFontSizeClass } from '../utils/textPaging';
import {
  MapPin,
  Clock,
  Heart,
  Hand,
  Compass,
  Footprints,
  Sparkles,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import confetti from '../utils/confetti';

interface KenchikoStageProps {
  kenchiko: KenchikoState;
  companionNyan: NyanCharacter | null;
  characters?: NyanCharacter[];
  remainingTimeSec: number;
  timeSpeed: number;
  kounichanSettings?: KounichanSettings;
  onClaimKounichanGift?: (type: 'points' | 'cat', cat?: NyanCharacter) => void;
  onUpdateKounichanStats?: (updater: (prev: KounichanSettings['stats']) => KounichanSettings['stats']) => void;
  onPet: () => void;
  onOpenOuenModal?: () => void;
  onCheerMore?: () => void;
  onCheerDone?: () => void;
  onOpenGiftModal?: () => void;
  onStartRandomTravel: () => void;
  onOpenTravelModal?: () => void;
  onSelectNyan: (nyan: NyanCharacter) => void;
  onManualMonologue: () => void;
  onTakeSnapshot: () => void;
}

export const KenchikoStage: React.FC<KenchikoStageProps> = ({
  kenchiko,
  companionNyan,
  characters = [],
  remainingTimeSec,
  timeSpeed,
  kounichanSettings,
  onClaimKounichanGift,
  onUpdateKounichanStats,
  onPet,
  onOpenOuenModal,
  onCheerMore,
  onCheerDone,
  onOpenGiftModal,
  onStartRandomTravel,
  onOpenTravelModal,
  onSelectNyan,
  onManualMonologue,
  onTakeSnapshot,
}) => {
  const [pettingEffect, setPettingEffect] = useState(false);
  const petTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // RPG / Novel style monologue paging for mobile screens
  const [monologuePage, setMonologuePage] = useState(0);

  // Break monologue into 28-36 char pages suitable for smartphone speech bubbles
  const monologuePages = useMemo(() => {
    return splitDialogueIntoPages(kenchiko.monologue || '', 34);
  }, [kenchiko.monologue]);

  const isMultiPage = monologuePages.length > 1;
  const hasNextPage = monologuePage < monologuePages.length - 1;
  const hasPrevPage = monologuePage > 0;
  const currentPageText = monologuePages[monologuePage] || kenchiko.monologue || '';
  const fontSizeClass = getDialogueFontSizeClass(currentPageText.length);

  // Reset page to 0 whenever monologue content updates
  useEffect(() => {
    setMonologuePage(0);
  }, [kenchiko.monologue]);

  const handleMonologueBoxClick = () => {
    if (hasNextPage) {
      setMonologuePage((prev) => prev + 1);
    } else {
      onManualMonologue();
    }
  };

  const handlePrevPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrevPage) {
      setMonologuePage((prev) => prev - 1);
    }
  };

  const handleRefreshMonologue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onManualMonologue();
  };

  useEffect(() => {
    return () => {
      if (petTimeoutRef.current) {
        clearTimeout(petTimeoutRef.current);
      }
    };
  }, []);

  const locInfo = LOCATIONS[kenchiko.currentLocation] || LOCATIONS.living;
  const targetLocInfo = kenchiko.targetLocation ? LOCATIONS[kenchiko.targetLocation] : null;
  const transportInfo = kenchiko.transportMethod
    ? TRANSPORT_METHODS.find((t) => t.id === kenchiko.transportMethod)
    : null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}時間${remMins}分`;
    }
    return `${mins}分${secs < 10 ? '0' : ''}${secs}秒`;
  };

  const isTransit = kenchiko.currentActivity === 'transit';
  const effectiveTotalDuration = isTransit ? 20 : Math.max(1, kenchiko.activityDurationSec);
  const effectiveRemainingTimeSec = isTransit
    ? Math.min(20, Math.max(0, remainingTimeSec))
    : Math.max(0, remainingTimeSec);
  const progressPercent = Math.min(
    100,
    Math.max(0, ((effectiveTotalDuration - effectiveRemainingTimeSec) / effectiveTotalDuration) * 100)
  );

  // Movement & Arrival Cooldown State Check (2 minutes = 120 seconds lock)
  const isCheering = kenchiko.currentActivity === 'cheering';
  const now = Date.now();
  const elapsedSinceArrivalSec = kenchiko.lastArrivedAt
    ? Math.floor((now - kenchiko.lastArrivedAt) / 1000)
    : 9999;
  const isArrivalCooldown = !isTransit && elapsedSinceArrivalSec < 120;
  const arrivalCooldownRemainingSec = isArrivalCooldown
    ? Math.max(1, 120 - elapsedSinceArrivalSec)
    : 0;
  const canTravel = !isTransit && !isArrivalCooldown;

  // Gauge Visual Distinction Colors
  const progressBarColor = isTransit
    ? 'bg-[#3C5C7A]'
    : isCheering
    ? 'bg-[#D4736A]'
    : isArrivalCooldown
    ? 'bg-[#D97706]'
    : 'bg-[#487560]';

  const progressDotColor = isTransit
    ? 'bg-[#3C5C7A]'
    : isCheering
    ? 'bg-[#D4736A]'
    : isArrivalCooldown
    ? 'bg-[#D97706]'
    : 'bg-[#487560]';

  const handlePetClick = () => {
    setPettingEffect(true);
    confetti({
      particleCount: 20,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#D4736A', '#E8CEAA', '#5C7E6B'],
    });
    onPet();
    if (petTimeoutRef.current) {
      clearTimeout(petTimeoutRef.current);
    }
    petTimeoutRef.current = setTimeout(() => setPettingEffect(false), 1800);
  };

  return (
    <div className="flex flex-col sketch-card overflow-hidden bg-[#FAF8F4] relative">
      {/* Top Location & Status Header in Sketchbook Style */}
      <div className="bg-[#ECE7DC] text-[#3E3833] px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b-1.5 border-[#3E3833]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#3E3833] text-[#FAF8F4] flex items-center justify-center font-bold text-sm shadow-sm border border-[#2E2824]">
            {kenchiko.currentActivity === 'transit' ? <Footprints className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#7A726A] font-bold font-handwriting tracking-wider">
                {kenchiko.currentActivity === 'transit' ? 'いどう中' : kenchiko.currentActivity === 'arrived' ? 'とうちゃく！' : 'げんざいち'}
              </span>
              {timeSpeed > 1 && (
                <span className="bg-[#487560] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {timeSpeed}x そくど
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[#2E2824] font-handwriting tracking-wide">
              {kenchiko.currentActivity === 'transit' && targetLocInfo
                ? `${targetLocInfo.name} へ移動中 (${transportInfo?.name || 'とほ'})`
                : locInfo.name}
            </h2>
          </div>
        </div>

        {/* Activity & Timer Pill (Handwritten Note Style) */}
        <div className="flex items-center gap-2 bg-[#FAF8F4] px-3.5 py-1.5 sketch-tag text-xs font-medium">
          <Clock className="w-3.5 h-3.5 text-[#8C5A3E]" />
          <span className="text-[#6A625A] font-handwriting text-xs font-bold">のこり:</span>
          <span className="font-mono font-bold text-[#2E2824] text-sm">
            {formatTime(remainingTimeSec)}
          </span>
        </div>
      </div>

      {/* Main Illustration Stage Area (Sketchbook Page) */}
      <div className="relative min-h-[350px] md:min-h-[390px] bg-[#FAF8F4] p-6 flex flex-col items-center justify-between overflow-hidden">
        {/* Sketchy Pencil Background Props */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg className="w-full h-full" style={{ filter: 'url(#pencil-jitter)' }}>
            <g stroke="#3E3833" strokeWidth="1.2" fill="none">
              {/* Background Wall Doodles */}
              <line x1="20" y1="280" x2="600" y2="280" strokeDasharray="6 6" />
              {/* Potted plant doodle */}
              <path d="M480 260 L495 280 L465 280 Z" />
              <path d="M480 260 Q460 230 475 220 Q480 250 480 260" fill="#789A82" opacity="0.4" />
              <path d="M480 260 Q500 230 485 220 Q480 250 480 260" fill="#789A82" opacity="0.4" />
            </g>
          </svg>
        </div>

        {/* Kenchiko Monologue Speech Bubble (Hand-drawn talk box with RPG/Novel paging) */}
        <div className="relative z-20 w-full max-w-lg mb-2">
          <div
            onClick={handleMonologueBoxClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMonologueBoxClick();
              }
            }}
            title={
              hasNextPage
                ? 'タップで続きを読む'
                : 'タップでつぶやきを聞く / 次のお話へ'
            }
            className="w-full group bg-[#FFFDF9] sketch-card-subtle px-3.5 sm:px-4 py-2.5 sm:py-3 text-left transition hover:-translate-y-0.5 active:translate-y-0 flex items-start gap-3 relative z-20 shadow-xs cursor-pointer select-none"
          >
            <div className="shrink-0 mt-0.5 relative">
              <KenchikoAvatar size={36} imageUrl={kenchiko.customImageUrl} />
              {isMultiPage && (
                <span
                  title={`ページ ${monologuePage + 1} / ${monologuePages.length}`}
                  className="absolute -bottom-1 -right-1 bg-[#487560] text-white text-[9px] font-bold px-1 py-0.2 rounded-full shadow-2xs font-mono"
                >
                  {monologuePage + 1}/{monologuePages.length}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-[#7A726A] font-bold mb-0.5 font-handwriting">
                <span className="text-[#3E3833] flex items-center gap-1.5 truncate max-w-[200px] sm:max-w-[280px]">
                  <span className="w-2 h-2 rounded-full bg-[#487560] shrink-0" />
                  {kenchiko.currentActivityTitle || 'まったり中'}
                </span>
                <button
                  type="button"
                  onClick={handleRefreshMonologue}
                  title="新しいたいくつぶやきに更新する"
                  className="text-[#487560] hover:underline flex items-center gap-1 shrink-0 px-1 py-0.5 rounded hover:bg-[#FAF8F4] transition ml-2"
                >
                  <Sparkles className="w-3 h-3" /> つぶやき更新
                </button>
              </div>

              {/* Dialogue Text Container */}
              <div className="min-h-[38px] flex items-center">
                <p
                  key={`${kenchiko.monologue}_${monologuePage}`}
                  className={`font-bold text-[#2E2824] leading-snug font-handwriting ${fontSizeClass} animate-fadeIn transition-opacity duration-150 line-clamp-2`}
                >
                  「{currentPageText}」
                </p>
              </div>

              {/* RPG-style Paging / Next Prompt Indicator */}
              {isMultiPage && (
                <div className="mt-1 flex items-center justify-between pt-1 border-t border-[#F0EBE0] text-[10px] text-[#7A726A] font-handwriting">
                  <div className="flex items-center gap-1">
                    {hasPrevPage && (
                      <button
                        type="button"
                        onClick={handlePrevPage}
                        title="前のセリフに戻る"
                        className="text-[#5C544D] hover:text-[#2E2824] flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#F4EFE6] hover:bg-[#EAE5D9] transition font-bold"
                      >
                        <ChevronLeft className="w-2.5 h-2.5" /> 戻る
                      </button>
                    )}
                    <span className="text-[#8C847B] text-[9px] font-mono font-bold">
                      {monologuePage + 1} / {monologuePages.length}
                    </span>
                  </div>

                  {hasNextPage ? (
                    <div className="flex items-center gap-1 text-[#487560] font-bold animate-pulse">
                      <span>タップで続き</span>
                      <span className="text-[11px] animate-bounce">▼</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[#8C847B] font-bold">
                      <span>タップでつぎのお話</span>
                      <span className="text-[10px]">💬</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scenic Location Postcard / Sketch Pin on Left Wall */}
        {kenchiko.currentActivity !== 'transit' && (
          <div
            className="absolute top-20 sm:top-14 left-1.5 sm:left-5 z-0 sm:z-10 select-none group pointer-events-auto cursor-default animate-fadeIn"
            title={`現在地: ${locInfo.name} (${locInfo.reading}) - ${locInfo.description}`}
          >
            {/* Cute Washi Tape Strip */}
            <div className="w-10 sm:w-14 h-3 sm:h-3.5 bg-[#E4D9C5]/90 border-t border-b border-[#C9BFAD] mx-auto -mb-1 shadow-2xs rotate-[-4deg] relative z-10" />

            {/* Polaroid / Postcard Frame */}
            <div className="bg-white p-1 sm:p-1.5 rounded-xl border border-[#D5CCBC] shadow-sm transform -rotate-2 group-hover:rotate-0 group-hover:scale-105 transition-all duration-200 w-20 sm:w-28 md:w-32">
              <div className="w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#EAE5D9] bg-[#FAF8F4]">
                <LocationIllustration
                  locationId={kenchiko.currentLocation}
                  variant="card"
                  className="w-full h-full"
                />
              </div>
              <div className="mt-1 flex items-center justify-center gap-0.5 text-[9px] sm:text-[11px] font-bold text-[#4A423B] font-handwriting truncate px-0.5">
                <MapPin className="w-2.5 h-2.5 text-[#D4736A] shrink-0" />
                <span className="truncate">{locInfo.name}</span>
              </div>
            </div>
          </div>
        )}

        {/* Central Characters Interaction Area */}
        <div className="relative z-10 w-full flex items-end justify-center gap-4 md:gap-10 my-2">
          {/* Kenchiko Figure (Photo-based sketch drawing) */}
          <div className="flex flex-col items-center">
            <div
              onClick={handlePetClick}
              className="cursor-pointer group flex flex-col items-center transition transform hover:scale-105 active:scale-95 relative"
              title="けんちこをタップしてなでる"
            >
              {pettingEffect && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 animate-bounce pointer-events-none">
                  <div className="relative bg-[#FFFDF9] border border-[#3E3833] text-[#2E2824] px-3 py-1 rounded-2xl shadow-sm text-xs sm:text-sm font-bold font-handwriting flex items-center gap-1 whitespace-nowrap">
                    <span>うふふ♪</span>
                    {/* Speech bubble downward triangle pointer */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#3E3833]" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#FFFDF9]" />
                  </div>
                </div>
              )}
              {kenchiko.currentActivity === 'transit' ? (
                <TransitVehicleView
                  transportMethod={kenchiko.transportMethod}
                  kenchikoImageUrl={kenchiko.customImageUrl}
                  characters={characters}
                  targetLocationName={targetLocInfo?.name}
                  size={270}
                />
              ) : (
                <KenchikoFigure
                  activity={kenchiko.currentActivity}
                  transportMethod={kenchiko.transportMethod}
                  customImageUrl={kenchiko.customImageUrl}
                  mood={kenchiko.mood}
                  size={185}
                />
              )}

              {/* '気がすんだ' (Satisfied) button placed on the opposite (left) side during cheering */}
              {isCheering && onCheerDone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheerDone();
                  }}
                  className="absolute top-[48%] -left-10 sm:-left-12 z-30 group/done flex items-center gap-1.5 bg-[#4F8655] hover:bg-[#3D6942] active:scale-95 text-white font-bold font-handwriting text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg border-2 border-[#FAF8F4] transition-all transform hover:scale-110"
                  title="気がすんだので次の行動へ進む"
                >
                  <Check className="w-3.5 h-3.5 text-[#E8F5E9]" />
                  <span>気がすんだ</span>
                </button>
              )}

              {/* 'もっと！' (More!) button placed at Kenchiko's waist area during cheering */}
              {isCheering && onCheerMore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheerMore();
                  }}
                  className="absolute top-[48%] -right-8 sm:-right-10 z-30 group/more flex items-center gap-1.5 bg-[#D4736A] hover:bg-[#B94E45] active:scale-95 text-white font-bold font-handwriting text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg border-2 border-[#FAF8F4] animate-bounce transition-all transform hover:scale-110"
                  title="新しい応援メッセージを表示してさらに15秒待つ"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FFEBE8]" />
                  <span>もっと！</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <div className="bg-[#FAF8F4] text-[#2E2824] text-xs font-bold px-3 py-0.5 sketch-tag shadow-sm flex items-center gap-1 font-handwriting">
                <span>けんちこ</span>
                <span className="text-[10px] text-[#8C5A3E] font-normal">
                  ({kenchiko.currentActivity === 'nap'
                    ? '睡眠中'
                    : kenchiko.currentActivity === 'snacking'
                    ? 'カフェ休憩'
                    : kenchiko.currentActivity === 'transit'
                    ? `${transportInfo?.name || 'とほ'}で移動中`
                    : kenchiko.currentActivity === 'arrived'
                    ? '到着！見回し中'
                    : '活動中'})
                </span>
              </div>
            </div>
          </div>

          {/* Visiting ◯◯にゃん Companion (Exact "えーあいにゃん" style with dialogue display) */}
          {companionNyan && (
            <div
              onClick={() => onSelectNyan(companionNyan)}
              className="cursor-pointer group flex flex-col items-center transition transform hover:scale-105 active:scale-95 animate-fadeIn max-w-[240px] sm:max-w-[280px]"
              title="図鑑を見る / 一緒に遊ぶ"
            >
              {/* Cat Speech Bubble (I列: セリフ, J列: 意味) */}
              {(companionNyan.dialogue || companionNyan.dialogueMeaning) ? (
                <div className="relative mb-2 bg-[#FFFDF9] sketch-card-subtle px-3.5 py-2 shadow-sm text-center animate-fadeIn max-w-[230px] sm:max-w-[260px]">
                  {companionNyan.dialogue && (
                    <p className="text-xs sm:text-sm font-bold text-[#2E2824] leading-snug font-handwriting break-words line-clamp-3">
                      {companionNyan.dialogue.startsWith('「') && companionNyan.dialogue.endsWith('」')
                        ? companionNyan.dialogue
                        : `「${companionNyan.dialogue}」`}
                    </p>
                  )}
                  {companionNyan.dialogueMeaning && (
                    <p className="text-xs sm:text-[13px] text-[#3E3833] font-bold leading-snug font-handwriting mt-1 border-t border-[#EAE5D9] pt-1 break-words line-clamp-3">
                      {companionNyan.dialogueMeaning}
                    </p>
                  )}
                  {/* Small speech balloon pointer triangle */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#3E3833]" />
                </div>
              ) : (
                <div className="mb-1 bg-[#FFFDF9] text-[#487560] text-[11px] font-bold px-2.5 py-0.5 sketch-tag shadow-sm flex items-center gap-1 font-handwriting animate-pulse">
                  <span>🐾 あそび中</span>
                </div>
              )}

              <NyanIllustration
                nyan={companionNyan}
                size={135}
                isDiscovered={true}
                transparent={true}
              />
              <div className="bg-[#FAF8F4] text-[#2E2824] text-xs font-bold px-3 py-0.5 sketch-tag mt-1 shadow-sm flex items-center gap-1 font-handwriting">
                <span>{companionNyan.name}</span>
                <span className="text-[10px] text-[#C85A53] font-bold">Lv.{companionNyan.friendshipLevel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Kouni-chan on Vehicle Crossing the Stage (when no companion cat is present) */}
        <KounichanCrossStage
          settings={kounichanSettings}
          isCompanionPresent={!!companionNyan}
          isTransit={kenchiko.currentActivity === 'transit'}
          undiscoveredCats={characters.filter((c) => !c.isDiscovered)}
          onClaimGift={(type, cat) => {
            if (onClaimKounichanGift) {
              onClaimKounichanGift(type, cat);
            }
          }}
          onUpdateStats={onUpdateKounichanStats}
        />

        {/* Activity Progress Bar Bottom (Pencil Line Progress) */}
        <div className="relative z-10 w-full max-w-lg mt-2 bg-[#FFFDF9] text-[#2E2824] sketch-card-subtle px-4 py-2.5">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5 font-handwriting">
            <span className="text-[#3E3833] flex items-center gap-1.5 truncate max-w-[250px]">
              <span className={`w-2 h-2 rounded-full ${progressDotColor} animate-ping shrink-0`} />
              <span className="truncate">{kenchiko.currentActivityTitle}</span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {isTransit ? (
                <span className="text-[10px] bg-[#E8EEF5] text-[#2A4D69] px-2 py-0.5 rounded-full font-bold border border-[#BDD6EE] flex items-center gap-1">
                  <Footprints className="w-3 h-3" /> 移動中 ({effectiveRemainingTimeSec}s)
                </span>
              ) : isCheering ? (
                <span className="text-[10px] bg-[#FFF2F0] text-[#D4736A] px-2 py-0.5 rounded-full font-bold border border-[#FAD6D2] flex items-center gap-1 animate-pulse">
                  <Heart className="w-3 h-3 fill-current" /> 応援中 ({remainingTimeSec}s)
                </span>
              ) : isArrivalCooldown ? (
                <span className="text-[10px] bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-full font-bold border border-[#FCD34D] flex items-center gap-1 animate-pulse">
                  <span>🔒 滞在中・移動不可 (あと{arrivalCooldownRemainingSec}s)</span>
                </span>
              ) : (
                <span className="text-[10px] bg-[#EBF4EE] text-[#2C6E49] px-2 py-0.5 rounded-full font-bold border border-[#BDE0C7] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> お出かけ可能
                </span>
              )}
              <span className="font-mono text-[#7A726A] text-[11px]">
                {Math.floor(progressPercent)}%
              </span>
            </div>
          </div>
          <div className="w-full bg-[#EAE6DC] rounded-full h-2.5 overflow-hidden border border-[#3E3833]">
            <div
              className={`${progressBarColor} h-full rounded-full transition-all duration-300 ease-out`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-[#ECE7DC] px-4 py-3 border-t-1.5 border-[#3E3833] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePetClick}
            className="flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-white text-[#2E2824] font-bold text-xs px-3.5 py-2 sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting"
          >
            <Hand className="w-4 h-4 text-[#487560]" />
            <span>なでる</span>
          </button>

          <button
            onClick={onOpenOuenModal}
            className="flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-white text-[#2E2824] font-bold text-xs px-3.5 py-2 sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting"
            title="けんちこに応援してもらう（15秒間）"
          >
            <Heart className="w-4 h-4 text-[#D4736A]" />
            <span>応援して</span>
          </button>

          <button
            onClick={() => {
              if (!canTravel) return;
              if (onOpenTravelModal) {
                onOpenTravelModal();
              } else {
                onStartRandomTravel();
              }
            }}
            disabled={!canTravel}
            className={`flex items-center gap-1.5 font-bold text-xs px-3.5 py-2 sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting ${
              !canTravel
                ? 'bg-[#EAE6DC] text-[#9E958C] cursor-not-allowed opacity-75'
                : 'bg-[#FAF8F4] hover:bg-white text-[#2E2824]'
            }`}
            title={
              isTransit
                ? '現在移動中です（20秒）'
                : isArrivalCooldown
                ? `到着後2分間は滞在・散策中のため移動できません（残り${arrivalCooldownRemainingSec}秒）`
                : '3つの候補からお出かけ先を選びます（移動時間20秒）'
            }
          >
            <Compass className={`w-4 h-4 ${!canTravel ? 'text-[#9E958C]' : 'text-[#3C5C7A]'}`} />
            <span>
              {isTransit
                ? '移動中…'
                : isArrivalCooldown
                ? `滞在中 (${arrivalCooldownRemainingSec}s)`
                : 'お出かけ'}
            </span>
          </button>
        </div>

        <button
          onClick={onTakeSnapshot}
          className="flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-white text-[#2E2824] font-bold text-xs px-3.5 py-2 sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting"
        >
          <Camera className="w-4 h-4 text-[#7A726A]" />
          <span>絵日記に残す</span>
        </button>
      </div>
    </div>
  );
};
