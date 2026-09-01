import React from 'react';

interface KenchikoAvatarProps {
  size?: number;
  className?: string;
}

export const KenchikoAvatar: React.FC<KenchikoAvatarProps> = ({
  size = 40,
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#FFF2EB] border border-[#CCC4B2] shadow-sm select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="avatarSweater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9BD5F0" />
            <stop offset="100%" stopColor="#78B9DC" />
          </linearGradient>
        </defs>

        {/* Background / Sky Blue Sweater at bottom */}
        <path d="M10 100 Q10 80 30 78 L70 78 Q90 80 90 100 Z" fill="url(#avatarSweater)" stroke="#1F2937" strokeWidth="2.5" />
        <path d="M40 78 Q50 85 60 78" stroke="#1F2937" strokeWidth="2" fill="#E0F2FE" />

        {/* Head */}
        <ellipse cx="50" cy="52" rx="33" ry="34" fill="#FFF2EB" stroke="#1F2937" strokeWidth="3" />

        {/* Cheeks Blush */}
        <ellipse cx="25" cy="62" rx="6" ry="4" fill="#FCA5A5" opacity="0.6" />
        <ellipse cx="75" cy="62" rx="6" ry="4" fill="#FCA5A5" opacity="0.6" />

        {/* Droopy Eyebrows */}
        <path d="M26 31 Q33 35 40 37" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M60 37 Q67 35 74 31" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />

        {/* Droopy Eyes */}
        {/* Left Eye */}
        <path d="M26 44 C29 40 38 43 42 48" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" />
        <ellipse cx="34" cy="48" rx="4" ry="4.5" fill="#181B22" />
        <circle cx="32.5" cy="46.5" r="1.2" fill="#FFFFFF" />
        <path d="M27 52 Q34 55 41 51" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />

        {/* Right Eye */}
        <path d="M58 48 C62 43 71 40 74 44" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" />
        <ellipse cx="66" cy="48" rx="4" ry="4.5" fill="#181B22" />
        <circle cx="64.5" cy="46.5" r="1.2" fill="#FFFFFF" />
        <path d="M59 51 Q66 55 73 52" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />

        {/* Dark Rectangular Eyeglasses */}
        <rect x="22" y="36" width="23" height="20" rx="4.5" stroke="#1A202C" strokeWidth="3" fill="none" />
        <rect x="55" y="36" width="23" height="20" rx="4.5" stroke="#1A202C" strokeWidth="3" fill="none" />
        <line x1="45" y1="44" x2="55" y2="44" stroke="#1A202C" strokeWidth="3" strokeLinecap="round" />
        <line x1="16" y1="44" x2="22" y2="44" stroke="#1A202C" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="78" y1="44" x2="84" y2="44" stroke="#1A202C" strokeWidth="2.5" strokeLinecap="round" />

        {/* Nose */}
        <ellipse cx="50" cy="55" rx="3" ry="2.5" fill="#F87171" opacity="0.6" />
        <path d="M48 56 Q50 58 52 56" stroke="#1F2937" strokeWidth="1.8" strokeLinecap="round" />

        {/* Wavy Pout Lips */}
        <path
          d="M43 65 Q46.5 62.5 50 65 Q53.5 67.5 57 65"
          stroke="#1F2937"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Straight Dark Bangs Hair */}
        <path
          d="M16 42 C15 22 85 22 84 42 C80 36 72 40 66 33 C60 38 52 34 46 38 C40 33 32 39 26 35 C20 40 16 42 16 42 Z"
          fill="#181B22"
          stroke="#181B22"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M30 27 Q50 23 70 27" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
};
