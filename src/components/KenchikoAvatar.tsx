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

  // Official default: 「きほんのにゃんこ」 Face Avatar
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#FAF8F4] border-1.5 border-[#2E2824] shadow-sm select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full p-1"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cat Head */}
        <ellipse cx="50" cy="54" rx="38" ry="32" fill="#FFFDF9" stroke="#2E2824" strokeWidth="4" />
        {/* Ears */}
        <polygon points="20,40 12,14 36,26" fill="#FFFDF9" stroke="#2E2824" strokeWidth="4" strokeLinejoin="round" />
        <polygon points="80,40 88,14 64,26" fill="#FFFDF9" stroke="#2E2824" strokeWidth="4" strokeLinejoin="round" />
        {/* Inner ear strokes */}
        <line x1="24" y1="28" x2="26" y2="35" stroke="#2E2824" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="76" y1="28" x2="74" y2="35" stroke="#2E2824" strokeWidth="2.5" strokeLinecap="round" />
        {/* Deadpan Eyes */}
        <line x1="28" y1="50" x2="42" y2="50" stroke="#2E2824" strokeWidth="4" strokeLinecap="round" />
        <path d="M31 51 C31 56 39 56 39 51 Z" fill="#2E2824" />
        <line x1="58" y1="50" x2="72" y2="50" stroke="#2E2824" strokeWidth="4" strokeLinecap="round" />
        <path d="M61 51 C61 56 69 56 69 51 Z" fill="#2E2824" />
        {/* Inverted T Mouth */}
        <line x1="50" y1="56" x2="50" y2="62" stroke="#2E2824" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="43" y1="62" x2="57" y2="62" stroke="#2E2824" strokeWidth="3.5" strokeLinecap="round" />
        {/* Whiskers */}
        <line x1="18" y1="53" x2="4" y2="51" stroke="#2E2824" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="18" y1="60" x2="5" y2="63" stroke="#2E2824" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="82" y1="53" x2="96" y2="51" stroke="#2E2824" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="82" y1="60" x2="95" y2="63" stroke="#2E2824" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};

