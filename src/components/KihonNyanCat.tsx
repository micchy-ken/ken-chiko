import React from 'react';
import { ActivityType } from '../types';

interface KihonNyanCatProps {
  activity?: ActivityType;
  mood?: string;
  isPetting?: boolean;
  className?: string;
  size?: number;
}

/**
 * 「きほんのにゃんこ」
 * ユーザー様のオリジナル手描きイラスト（和紙・鉛筆・ジト目・二足立ち姿）を
 * 忠実に反映した公式基本キャラクターコンポーネント。
 */
export const KihonNyanCat: React.FC<KihonNyanCatProps> = ({
  activity = 'relaxing',
  isPetting = false,
  className = '',
  size = 230,
}) => {
  const isSleeping = activity === 'nap';
  const isWalking = activity === 'transit';
  const isSnacking = activity === 'snacking';

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: size }}
    >
      <div
        className={`relative w-full aspect-square rounded-3xl overflow-hidden shadow-sm border border-[#C4BCAB]/40 transition-all duration-300 ${
          isSleeping
            ? 'rotate-[-4deg] brightness-95'
            : isWalking
            ? 'animate-bounce'
            : isSnacking
            ? 'animate-pulse'
            : isPetting
            ? 'scale-105 shadow-md'
            : 'hover:scale-[1.02]'
        }`}
      >
        <img
          src="/images/base-nyanko-square.jpg"
          alt="きほんのにゃんこ"
          className="w-full h-full object-cover select-none pointer-events-none"
        />

        {/* Playful mood/activity overlay particles if active */}
        {isSleeping && (
          <div className="absolute top-4 right-6 font-handwriting text-base font-black text-[#5A524A] animate-pulse">
            zzz...
          </div>
        )}
        {isSnacking && (
          <div className="absolute top-4 right-6 font-handwriting text-sm font-bold text-[#D97543] animate-bounce">
            もぐもぐ♪
          </div>
        )}
        {isPetting && (
          <div className="absolute top-3 right-6 text-xl animate-ping">
            ✨
          </div>
        )}
      </div>

      <p className="mt-2 text-center font-handwriting text-sm font-bold text-[#3E3833] tracking-widest select-none">
        きほんのにゃんこ
      </p>
    </div>
  );
};
