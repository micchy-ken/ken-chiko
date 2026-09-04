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
  const activeImage = imageUrl || loadLocalKenchikoImage() || '/images/kihon-nyan-square.jpg' || '/images/base-nyanko-square.jpg';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#FAF8F4] border border-[#2E2824]/40 shadow-sm select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={activeImage}
        alt="けんちこ"
        className="w-full h-full object-cover object-[center_36%]"
      />
    </div>
  );
};
