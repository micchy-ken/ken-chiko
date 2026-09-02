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
  onUpdateKenchikoImage?: (imageUrl: string) => void;
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
  onUpdateKenchikoImage,
}) => {
  const [pettingEffect, setPettingEffect] = useState(false);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateKenchikoImage) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onUpdateKenchikoImage(result);
          setShowImageUploader(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim() && onUpdateKenchikoImage) {
      onUpdateKenchikoImage(urlInput.trim());
      setUrlInput('');
      setShowImageUploader(false);
    }
  };

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
      colors: ['#D4736A', '#E8CEAA', '#5C7E6B'],
    });
    onPet();
    setTimeout(() => setPettingEffect(false), 1200);
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
                {kenchiko.currentActivity === 'transit' ? 'いどう中' : 'げんざいち'}
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
              {/* Little framed picture on wall */}
              <rect x="40" y="40" width="50" height="40" rx="3" />
              <circle cx="65" cy="60" r="10" />
              {/* Potted plant doodle */}
              <path d="M480 260 L495 280 L465 280 Z" />
              <path d="M480 260 Q460 230 475 220 Q480 250 480 260" fill="#789A82" opacity="0.4" />
              <path d="M480 260 Q500 230 485 220 Q480 250 480 260" fill="#789A82" opacity="0.4" />
            </g>
          </svg>
        </div>

        {/* Kenchiko Monologue Speech Bubble (Hand-drawn talk box) */}
        <div className="relative z-10 w-full max-w-lg mb-2">
          <button
            onClick={onManualMonologue}
            title="タップでけんちこのつぶやきを聞く"
            className="w-full group bg-[#FFFDF9] sketch-card-subtle px-4 py-3 text-left transition hover:-translate-y-0.5 active:translate-y-0 flex items-start gap-3"
          >
            <div className="shrink-0 mt-0.5">
              <KenchikoAvatar size={36} imageUrl={kenchiko.customImageUrl} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px] text-[#7A726A] font-bold mb-0.5 font-handwriting">
                <span>けんちこの心のこえ</span>
                <span className="text-[#487560] group-hover:underline flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> つぶやき更新
                </span>
              </div>
              <p className="text-sm font-bold text-[#2E2824] leading-snug font-handwriting">
                「{kenchiko.monologue}」
              </p>
            </div>
          </button>
        </div>

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
                <div className="absolute -top-9 text-[#C85A53] font-bold text-sm animate-bounce flex items-center gap-1 bg-[#FFFDF9] px-3 py-0.5 sketch-tag shadow-sm font-handwriting z-20">
                  <Heart className="w-4 h-4 fill-[#C85A53]" /> なでなで！
                </div>
              )}
              <KenchikoFigure
                activity={kenchiko.currentActivity}
                transportMethod={kenchiko.transportMethod}
                customImageUrl={kenchiko.customImageUrl}
                mood={kenchiko.mood}
                size={185}
              />
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <div className="bg-[#FAF8F4] text-[#2E2824] text-xs font-bold px-3 py-0.5 sketch-tag shadow-sm flex items-center gap-1 font-handwriting">
                <span>けんちこ</span>
                <span className="text-[10px] text-[#8C5A3E] font-normal">
                  ({kenchiko.currentActivity === 'nap' ? '睡眠中' : kenchiko.currentActivity === 'snacking' ? 'カフェ休憩' : '活動中'})
                </span>
              </div>

              {onUpdateKenchikoImage && (
                <label
                  title="けんちこの画像をアップロード・変更"
                  className="cursor-pointer p-1 bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] sketch-tag shadow-sm transition"
                >
                  <Camera className="w-3.5 h-3.5 text-[#487560]" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {kenchiko.customImageUrl && onUpdateKenchikoImage && (
                <button
                  onClick={() => onUpdateKenchikoImage('')}
                  title="デフォルトイラストに戻す"
                  className="text-[10px] text-[#C85A53] hover:underline font-bold px-1"
                >
                  リセット
                </button>
              )}
            </div>
          </div>

          {/* Visiting ◯◯にゃん Companion (Exact "えーあいにゃん" style) */}
          {companionNyan && (
            <div
              onClick={() => onSelectNyan(companionNyan)}
              className="cursor-pointer group flex flex-col items-center transition transform hover:scale-105 active:scale-95 animate-fadeIn"
              title="図鑑を見る / 一緒に遊ぶ"
            >
              <div className="mb-1 bg-[#FFFDF9] text-[#487560] text-[11px] font-bold px-2.5 py-0.5 sketch-tag shadow-sm flex items-center gap-1 font-handwriting animate-pulse">
                <span>🐾 あそび中</span>
              </div>
              <NyanIllustration
                nyan={companionNyan}
                size={135}
                isDiscovered={true}
              />
              <div className="bg-[#FAF8F4] text-[#2E2824] text-xs font-bold px-3 py-0.5 sketch-tag mt-1 shadow-sm flex items-center gap-1 font-handwriting">
                <span>{companionNyan.name}</span>
                <span className="text-[10px] text-[#C85A53] font-bold">Lv.{companionNyan.friendshipLevel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Activity Progress Bar Bottom (Pencil Line Progress) */}
        <div className="relative z-10 w-full max-w-lg mt-2 bg-[#FFFDF9] text-[#2E2824] sketch-card-subtle px-4 py-2.5">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5 font-handwriting">
            <span className="text-[#3E3833] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#487560] animate-ping" />
              {kenchiko.currentActivityTitle}
            </span>
            <span className="font-mono text-[#7A726A] text-[11px]">
              {Math.floor(progressPercent)}% 完了
            </span>
          </div>
          <div className="w-full bg-[#EAE6DC] rounded-full h-2 overflow-hidden border border-[#3E3833]">
            <div
              className="bg-[#487560] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-[#ECE7DC] px-4 py-3 border-t-1.5 border-[#3E3833] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGiftModal}
            className="flex items-center gap-1.5 bg-[#D97543] hover:bg-[#C46332] text-white font-bold text-xs px-3.5 py-2 sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting"
          >
            <Gift className="w-4 h-4 text-white" />
            <span>プレゼント</span>
          </button>

          <button
            onClick={handlePetClick}
            className="flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-white text-[#2E2824] font-bold text-xs px-3.5 py-2 sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting"
          >
            <Hand className="w-4 h-4 text-[#487560]" />
            <span>なでる</span>
          </button>

          <button
            onClick={onOpenTravelModal}
            className="flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-white text-[#2E2824] font-bold text-xs px-3.5 py-2 sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting"
          >
            <Compass className="w-4 h-4 text-[#3C5C7A]" />
            <span>おでかけ提案</span>
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
