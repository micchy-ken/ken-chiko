import React from 'react';
import { ActivityType, TransportMethod } from '../types';
import { loadLocalKenchikoImage } from '../services/imageCompression';

interface KenchikoFigureProps {
  activity: ActivityType;
  transportMethod: TransportMethod | null;
  customImageUrl?: string;
  mood?: string;
  className?: string;
  size?: number;
}

export const KenchikoFigure: React.FC<KenchikoFigureProps> = ({
  activity,
  customImageUrl,
  className = '',
  size = 230,
}) => {
  const activeImage = customImageUrl || loadLocalKenchikoImage() || '';

  if (activeImage) {
    return (
      <div
        className={`relative inline-flex items-center justify-center select-none ${className}`}
        style={{ width: size, height: size * 1.08 }}
      >
        <div
          className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
            activity === 'nap'
              ? 'rotate-[-12deg] translate-y-4 opacity-90 scale-95'
              : activity === 'transit'
              ? 'animate-bounce'
              : activity === 'snacking'
              ? 'animate-pulse'
              : 'hover:scale-105'
          }`}
        >
          <img
            src={activeImage}
            alt="けんちこ"
            className="max-w-full max-h-full object-contain filter drop-shadow-[0_6px_16px_rgba(46,40,36,0.18)]"
          />
        </div>
      </div>
    );
  }

  // Pure clean frame if no image uploaded yet (Prompting upload in Settings)
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-3xl overflow-hidden bg-[#FAF8F4] border-2 border-dashed border-[#DDD7C8] p-6 text-center select-none shadow-xs ${className}`}
      style={{ width: size, height: size * 0.95 }}
    >
      <div className="flex flex-col items-center justify-center space-y-2">
        <span className="text-2xl">🎨</span>
        <p className="text-xs font-bold text-[#6B6259] font-handwriting">
          けんちこのイラスト画像未登録
        </p>
        <span className="text-[10px] text-[#9E958C]">
          「設定」からイラスト画像をアップロードしてください
        </span>
      </div>
    </div>
  );
};
