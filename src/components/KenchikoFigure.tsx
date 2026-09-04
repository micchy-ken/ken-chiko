import React from 'react';
import { ActivityType, TransportMethod } from '../types';
import { loadLocalKenchikoImage } from '../services/imageCompression';
import { KihonNyanCat } from './KihonNyanCat';
import { getAssetUrl, handleImageError } from '../utils/assetPath';

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
  mood,
  className = '',
  size = 230,
}) => {
  const rawImage = customImageUrl || loadLocalKenchikoImage() || '';
  const activeImage = getAssetUrl(rawImage);

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
            onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
            className="max-w-full max-h-full object-contain filter drop-shadow-[0_6px_16px_rgba(46,40,36,0.18)]"
          />
        </div>
      </div>
    );
  }

  // Official default: 「きほんのにゃんこ」
  return (
    <KihonNyanCat
      activity={activity}
      mood={mood}
      size={size}
      className={className}
    />
  );
};
