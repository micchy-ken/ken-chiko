import React from 'react';

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
  if (imageUrl) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#FAF8F4] border-1.5 border-[#2E2824] shadow-sm select-none ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={imageUrl}
          alt="けんちこ"
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden bg-[#FAF8F4] border-1.5 border-[#2E2824] shadow-sm select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Paper texture base */}
        <rect width="100" height="100" fill="#FAF8F4" />

        {/* Denim Jacket & White Shirt Collar */}
        <path
          d="M14 100 C16 80 26 76 40 74 L60 74 C74 76 84 80 86 100 Z"
          fill="#4B6B8A"
          stroke="#1F2429"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Inner white tee */}
        <path d="M40 74 L50 90 L60 74" fill="#FFFFFF" stroke="#1F2429" strokeWidth="2.2" strokeLinecap="round" />

        {/* Face Outline */}
        <path
          d="M20 50 C20 30 33 24 50 24 C67 24 80 30 80 50 C80 69 67 76 50 76 C33 76 20 69 20 50 Z"
          fill="#FFFDF7"
          stroke="#1F2429"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cheeks soft pink blush */}
        <ellipse cx="26" cy="55" rx="4.5" ry="3" fill="#F4A99B" opacity="0.65" />
        <ellipse cx="74" cy="55" rx="4.5" ry="3" fill="#F4A99B" opacity="0.65" />

        {/* Distinctive Droopy 八の字 (Hachinoji) Eyebrows */}
        <path d="M27 42 C30 36 36 34 43 35" stroke="#1F2429" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        <path d="M57 35 C64 34 70 36 73 42" stroke="#1F2429" strokeWidth="2.8" strokeLinecap="round" fill="none" />

        {/* Cute Dot Eyes (点目) */}
        <circle cx="36" cy="48" r="2.6" fill="#1F2429" />
        <circle cx="64" cy="48" r="2.6" fill="#1F2429" />

        {/* Black Rounded Rectangular Glasses */}
        <rect x="23" y="37" width="25" height="19" rx="6" fill="none" stroke="#1F2429" strokeWidth="3.2" />
        <rect x="52" y="37" width="25" height="19" rx="6" fill="none" stroke="#1F2429" strokeWidth="3.2" />
        <line x1="48" y1="46" x2="52" y2="46" stroke="#1F2429" strokeWidth="3.4" strokeLinecap="round" />

        {/* Gentle upward curved smile */}
        <path d="M43 63 Q50 67 57 63" stroke="#1F2429" strokeWidth="2.4" strokeLinecap="round" fill="none" />

        {/* Black Hair with Side-Swept Bangs */}
        <path
          d="M16 48 C14 24 30 14 50 14 C70 14 86 24 84 48 C80 36 74 28 64 29 C54 30 46 25 36 29 C26 33 20 38 16 48 Z"
          fill="#1F2429"
          stroke="#1F2429"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        {/* Sweeping fringe bangs */}
        <path
          d="M32 26 C45 35 65 31 78 40 C70 30 55 24 32 26 Z"
          fill="#1F2429"
        />
      </svg>
    </div>
  );
};
