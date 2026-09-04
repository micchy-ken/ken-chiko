import React from 'react';
import { ActivityType } from '../types';
import { loadLocalKihonNyanImage } from '../services/imageCompression';
import { getAssetUrl, ASSET_PATHS, handleImageError } from '../utils/assetPath';

interface KihonNyanCatProps {
  activity?: ActivityType;
  mood?: string;
  isPetting?: boolean;
  className?: string;
  size?: number;
  customImageUrl?: string;
  showLabel?: boolean;
}

/**
 * 「きほんのにゃんこ」
 * ユーザー様のオリジナル手描きイラスト（和紙・鉛筆・ジト目・二足立ち姿）を
 * 忠実に反映した公式基本キャラクターコンポーネント。
 * 背景透過処理済みの画像がある場合は余分な枠線をなくし、自然にステージに佇みます。
 */
export const KihonNyanCat: React.FC<KihonNyanCatProps> = ({
  activity = 'relaxing',
  isPetting = false,
  className = '',
  size = 230,
  customImageUrl,
  showLabel = false,
}) => {
  const isSleeping = activity === 'nap';
  const isWalking = activity === 'transit';
  const isSnacking = activity === 'snacking';

  const rawImage = customImageUrl || loadLocalKihonNyanImage() || ASSET_PATHS.KIHON_NYAN_SQUARE;
  const activeImage = getAssetUrl(rawImage);
  const hasCustomTransparent = Boolean(customImageUrl || loadLocalKihonNyanImage());

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: size }}
    >
      <div
        className={`relative w-full aspect-square flex items-center justify-center transition-all duration-300 ${
          hasCustomTransparent
            ? ''
            : 'rounded-3xl overflow-hidden shadow-sm border border-[#C4BCAB]/40 bg-[#FAF8F5]'
        } ${
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
          src={activeImage}
          alt="きほんのにゃんこ"
          onError={(e) => handleImageError(e, 'images/kihon-nyan-square.jpg')}
          className={`max-w-full max-h-full select-none pointer-events-none ${
            hasCustomTransparent
              ? 'object-contain filter drop-shadow-[0_4px_12px_rgba(46,40,36,0.15)]'
              : 'w-full h-full object-cover'
          }`}
        />

        {/* Playful mood/activity overlay particles if active */}
        {isSleeping && (
          <div className="absolute top-2 right-4 font-handwriting text-base font-black text-[#5A524A] animate-pulse">
            zzz...
          </div>
        )}
        {isSnacking && (
          <div className="absolute top-2 right-4 font-handwriting text-sm font-bold text-[#D97543] animate-bounce">
            もぐもぐ♪
          </div>
        )}
        {isPetting && (
          <div className="absolute top-1 right-4 text-xl animate-ping">
            ✨
          </div>
        )}
      </div>

      {showLabel && (
        <p className="mt-2 text-center font-handwriting text-sm font-bold text-[#3E3833] tracking-widest select-none">
          きほんのにゃんこ
        </p>
      )}
    </div>
  );
};
