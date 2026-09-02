import React from 'react';
import { loadLocalKenchikoImage } from '../services/imageCompression';

interface KenchikoAvatarProps {
  size?: number;
  imageUrl?: string;
  className?: string;
}

export const KenchikoAvatar: React.FC<KenchikoAvatarProps> = ({
  size = 40,
  imageUrl,
  className = '',
}) => {
  const activeImage = imageUrl || loadLocalKenchikoImage() || '';

  if (activeImage) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#FAF8F4] border-1.5 border-[#2E2824] shadow-sm select-none ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={activeImage}
          alt="けんちこ"
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  // Pure clean minimal placeholder if no image is set yet
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#EAE5D9] border-1.5 border-[#2E2824] shadow-sm select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="flex flex-col items-center justify-center text-center p-1">
        <span className="text-[10px] font-bold text-[#6B6259] font-handwriting">けんちこ</span>
      </div>
    </div>
  );
};

