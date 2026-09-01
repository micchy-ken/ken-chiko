import React, { useState } from 'react';
import { KenchikoState, NyanCharacter, GiftItem, LocationId } from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';
import { KenchikoFigure } from './KenchikoFigure';
import { KenchikoAvatar } from './KenchikoAvatar';
import { NyanIllustration } from './NyanIllustration';
import {
  MapPin,
  Clock,
  Heart,
  Gift,
  Hand,
  Compass,
  MessageCircle,
  Footprints,
  Sparkles,
  Camera,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface KenchikoStageProps {
  kenchiko: KenchikoState;
  companionNyan: NyanCharacter | null;
  remainingTimeSec: number;
  timeSpeed: number;
  onPet: () => void;
  onOpenGiftModal: () => void;
  onOpenTravelModal: () => void;
  onSelectNyan: (nyan: NyanCharacter) => void;
  onManualMonologue: () => void;
  onTakeSnapshot: () => void;
}

export const KenchikoStage: React.FC<KenchikoStageProps> = ({
  kenchiko,
  companionNyan,
  remainingTimeSec,
  timeSpeed,
  onPet,
  onOpenGiftModal,
  onOpenTravelModal,
  onSelectNyan,
  onManualMonologue,
  onTakeSnapshot,
}) => {
  const [pettingEffect, setPettingEffect] = useState(false);

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

  const totalDuration = Math.max(1, kenchiko.activityDurationSec);
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - remainingTimeSec) / totalDuration) * 100));

  const handlePetClick = () => {
    setPettingEffect(true);
    confetti({
      particleCount: 20,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#f43f5e', '#fbbf24', '#38bdf8'],
    });
    onPet();
    setTimeout(() => setPettingEffect(false), 1200);
  };

  return (
    <div className="flex flex-col bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_4px_16px_rgba(74,68,63,0.06)] overflow-hidden">
      {/* Top Location & Status Header */}
      <div className="bg-[#4A443F] text-[#FAF8F5] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#3A342F]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#728C7E] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            {kenchiko.currentActivity === 'transit' ? <Footprints className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#D4B996] font-bold tracking-wider">
                {kenchiko.currentActivity === 'transit' ? 'いどう中' : 'げんざいち'}
              </span>
              {timeSpeed > 1 && (
                <span className="bg-[#5C7366] text-[#EAF0EC] text-[10px] px-2 py-0.5 rounded-full border border-[#8FA89B]/50 font-bold">
                  {timeSpeed}x そくど
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              {kenchiko.currentActivity === 'transit' && targetLocInfo
                ? `${targetLocInfo.name} へ移動中 (${transportInfo?.name || 'とほ'})`
                : locInfo.name}
            </h2>
          </div>
        </div>

        {/* Activity & Timer Pill */}
        <div className="flex items-center gap-2.5 bg-[#3A342F] px-3.5 py-1.5 rounded-full border border-[#5A524A]">
          <Clock className="w-4 h-4 text-[#D4B996] animate-spin" style={{ animationDuration: '6s' }} />
          <div className="text-xs font-medium">
            <span className="text-[#CCC4B2] mr-1.5 font-bold">のこり:</span>
            <span className="font-mono font-bold text-[#FAF8F5] text-sm">
              {formatTime(remainingTimeSec)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Illustration Stage Area */}
      <div className="relative min-h-[340px] md:min-h-[380px] bg-gradient-to-b from-[#F5F2EA] via-[#EFECE4] to-[#EBE6DC] p-6 flex flex-col items-center justify-between overflow-hidden">
        {/* Background Environment Elements */}
        <div className="absolute inset-0 pointer-events-none opacity-25">
          {kenchiko.currentLocation === 'beginner_forest' || kenchiko.currentLocation === 'camp' ? (
            <div className="absolute bottom-4 left-6 right-6 flex justify-between text-[#5C7366] text-6xl">
              <span>🌲</span>
              <span>🏕️</span>
              <span>🌳</span>
            </div>
          ) : kenchiko.currentLocation === 'hotspring' ? (
            <div className="absolute bottom-6 left-10 right-10 flex justify-around text-[#C8744E] text-5xl">
              <span>♨️</span>
              <span>🪨</span>
              <span>♨️</span>
            </div>
          ) : kenchiko.currentLocation === 'office' ? (
            <div className="absolute bottom-6 left-12 right-12 flex justify-between text-[#627584] text-5xl">
              <span>💻</span>
              <span>🏢</span>
              <span>📑</span>
            </div>
          ) : (
            <div className="absolute bottom-6 left-10 right-10 flex justify-between text-[#8C837A] text-5xl">
              <span>🛋️</span>
              <span>☕</span>
              <span>🪴</span>
            </div>
          )}
        </div>

        {/* Kenchiko Monologue Speech Bubble */}
        <div className="relative z-10 w-full max-w-lg mb-2">
          <button
            onClick={onManualMonologue}
            title="タップでけんちこのつぶやきを聞く"
            className="w-full group bg-[#FAF8F5]/95 backdrop-blur border border-[#DDD7C8] rounded-2xl px-4 py-3 shadow-[0_2px_8px_rgba(74,68,63,0.05)] text-left transition hover:-translate-y-0.5 active:translate-y-0 flex items-start gap-3"
          >
            <div className="shrink-0 mt-0.5">
              <KenchikoAvatar size={34} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px] text-[#7D756D] font-bold mb-0.5">
                <span>けんちこの心のこえ</span>
                <span className="text-[#728C7E] group-hover:underline flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> つぶやき更新
                </span>
              </div>
              <p className="text-sm font-bold text-[#3A342F] leading-snug">
                「{kenchiko.monologue}」
              </p>
            </div>
          </button>
        </div>

        {/* Central Characters Interaction Area */}
        <div className="relative z-10 w-full flex items-end justify-center gap-4 md:gap-10 my-2">
          {/* Kenchiko Figure */}
          <div
            onClick={handlePetClick}
            className="cursor-pointer group flex flex-col items-center transition transform hover:scale-105 active:scale-95"
            title="けんちこをタップしてなでる"
          >
            {pettingEffect && (
              <div className="absolute -top-8 text-[#D4736A] font-extrabold text-sm animate-bounce flex items-center gap-1 bg-white px-2.5 py-0.5 rounded-full border border-[#EAAFA9] shadow-sm">
                <Heart className="w-4 h-4 fill-[#D4736A]" /> なでなで！
              </div>
            )}
            <KenchikoFigure
              activity={kenchiko.currentActivity}
              transportMethod={kenchiko.transportMethod}
              mood={kenchiko.mood}
              size={180}
            />
            <div className="bg-[#4A443F] text-[#FAF8F5] text-xs font-bold px-3.5 py-1 rounded-full mt-1 shadow-sm border border-[#3A342F] flex items-center gap-1">
              <span>けんちこ</span>
              <span className="text-[10px] text-[#D4B996] font-normal">
                ({kenchiko.currentActivity === 'nap' ? '睡眠中' : kenchiko.currentActivity === 'snacking' ? 'おやつ中' : '活動中'})
              </span>
            </div>
          </div>

          {/* Visiting ◯◯にゃん Companion (if present!) */}
          {companionNyan && (
            <div
              onClick={() => onSelectNyan(companionNyan)}
              className="cursor-pointer group flex flex-col items-center transition transform hover:scale-105 active:scale-95 animate-fadeIn"
              title="図鑑を見る / 一緒に遊ぶ"
            >
              <div className="mb-1 bg-[#EAF0EC] text-[#3D5447] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-[#C6D8CD] shadow-sm flex items-center gap-1 animate-pulse">
                <span>🐾 あそび中</span>
              </div>
              <NyanIllustration
                nyan={companionNyan}
                size={130}
                isDiscovered={true}
              />
              <div className="bg-[#FAF8F5] text-[#3A342F] text-xs font-bold px-3.5 py-1 rounded-full mt-1 border border-[#DDD7C8] shadow-sm flex items-center gap-1">
                <span>{companionNyan.name}</span>
                <span className="text-[10px] text-[#C8744E] font-bold">Lv.{companionNyan.friendshipLevel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Activity Progress Bar Bottom */}
        <div className="relative z-10 w-full max-w-lg mt-2 bg-[#4A443F] text-[#FAF8F5] rounded-2xl px-4 py-2.5 border border-[#3A342F] shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-[#D4B996] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#728C7E] animate-ping" />
              {kenchiko.currentActivityTitle}
            </span>
            <span className="font-mono text-[#CCC4B2] text-[11px]">
              {Math.floor(progressPercent)}% 完了
            </span>
          </div>
          <div className="w-full bg-[#3A342F] rounded-full h-2 overflow-hidden border border-[#5A524A]">
            <div
              className="bg-[#728C7E] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-[#FAF8F5] px-4 py-3 border-t border-[#DDD7C8] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGiftModal}
            className="flex items-center gap-1.5 bg-[#D9825B] hover:bg-[#C8744E] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition active:translate-y-0.5"
          >
            <Gift className="w-4 h-4 text-white" />
            <span>プレゼント</span>
          </button>

          <button
            onClick={handlePetClick}
            className="flex items-center gap-1.5 bg-[#EAF0EC] hover:bg-[#D8E4DC] text-[#3D5447] font-bold text-xs px-4 py-2 rounded-xl border border-[#C6D8CD] shadow-sm transition active:translate-y-0.5"
          >
            <Hand className="w-4 h-4 text-[#5C7366]" />
            <span>なでる</span>
          </button>

          <button
            onClick={onOpenTravelModal}
            className="flex items-center gap-1.5 bg-[#EAF0F4] hover:bg-[#D5E2EC] text-[#2F495E] font-bold text-xs px-4 py-2 rounded-xl border border-[#C2D3DF] shadow-sm transition active:translate-y-0.5"
          >
            <Compass className="w-4 h-4 text-[#4B6882]" />
            <span>おでかけ先を提案</span>
          </button>
        </div>

        <button
          onClick={onTakeSnapshot}
          className="flex items-center gap-1.5 bg-[#F5F2EA] hover:bg-[#EFECE4] text-[#4A443F] font-bold text-xs px-3.5 py-2 rounded-xl border border-[#DDD7C8] shadow-sm transition active:translate-y-0.5"
        >
          <Camera className="w-4 h-4 text-[#7D756D]" />
          <span>絵日記に残す</span>
        </button>
      </div>
    </div>
  );
};
