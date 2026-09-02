import React from 'react';
import { ActivityType, TransportMethod } from '../types';

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
  transportMethod,
  customImageUrl,
  className = '',
  size = 230,
}) => {
  if (customImageUrl) {
    return (
      <div
        className={`relative inline-flex items-center justify-center select-none ${className}`}
        style={{ width: size, height: size }}
      >
        <div className={`w-full h-full flex items-center justify-center ${
          activity === 'nap'
            ? 'rotate-[-10deg] translate-y-3 opacity-95'
            : activity === 'transit'
            ? 'animate-bounce'
            : activity === 'snacking'
            ? 'animate-pulse'
            : 'hover:scale-105 transition duration-200'
        }`}>
          <img
            src={customImageUrl}
            alt="けんちこ"
            className="max-w-full max-h-full object-contain filter drop-shadow-[0_4px_12px_rgba(46,40,36,0.15)]"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 240"
        className="w-full h-full drop-shadow-sm overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Transit Props */}
        {activity === 'transit' && transportMethod === 'bicycle' && (
          <g className="animate-bounce" style={{ animationDuration: '0.6s' }}>
            <circle cx="45" cy="195" r="22" stroke="#2E2824" strokeWidth="3" />
            <circle cx="155" cy="195" r="22" stroke="#2E2824" strokeWidth="3" />
            <circle cx="45" cy="195" r="4" fill="#2E2824" />
            <circle cx="155" cy="195" r="4" fill="#2E2824" />
            <line x1="45" y1="173" x2="45" y2="217" stroke="#7A726A" strokeWidth="1.2" />
            <line x1="23" y1="195" x2="67" y2="195" stroke="#7A726A" strokeWidth="1.2" />
            <line x1="155" y1="173" x2="155" y2="217" stroke="#7A726A" strokeWidth="1.2" />
            <line x1="133" y1="195" x2="177" y2="195" stroke="#7A726A" strokeWidth="1.2" />
            <path d="M45 195 L88 195 L130 150 L75 150 Z" stroke="#2E2824" strokeWidth="3.2" strokeLinejoin="round" />
            <path d="M88 195 L82 144" stroke="#2E2824" strokeWidth="3.2" />
            <path d="M72 144 Q82 140 94 144" stroke="#2E2824" strokeWidth="5" strokeLinecap="round" />
            <path d="M130 150 L140 125 L130 122 M140 125 L152 123" stroke="#2E2824" strokeWidth="3.2" strokeLinecap="round" />
          </g>
        )}

        {/* Nap / Sleep Scene */}
        {activity === 'nap' ? (
          <g transform="translate(10, 30)">
            <rect x="20" y="130" width="140" height="34" rx="8" fill="#F0ECE4" stroke="#1F2429" strokeWidth="2.8" />
            <rect x="24" y="108" width="40" height="24" rx="7" fill="#FFFFFF" stroke="#1F2429" strokeWidth="2.6" />
            
            {/* Head resting */}
            <path
              d="M30 102 C30 84 70 84 70 102 C70 116 30 116 30 102 Z"
              fill="#FFFDF7"
              stroke="#1F2429"
              strokeWidth="2.8"
            />
            {/* Hair */}
            <path
              d="M30 96 C29 80 70 80 70 95 C64 88 54 93 47 88 C40 93 35 90 30 96 Z"
              fill="#1F2429"
              stroke="#1F2429"
              strokeWidth="1.5"
            />
            {/* Closed eyes & blush */}
            <path d="M38 104 Q44 108 50 104" stroke="#1F2429" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d="M46 112 Q50 114 54 112" stroke="#1F2429" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="36" cy="108" r="3.5" fill="#F4A99B" opacity="0.6" />

            {/* Glasses folded on side */}
            <rect x="80" y="112" width="18" height="12" rx="4" fill="none" stroke="#1F2429" strokeWidth="2.2" />
            <line x1="98" y1="118" x2="104" y2="118" stroke="#1F2429" strokeWidth="2.2" />
            <rect x="104" y="112" width="18" height="12" rx="4" fill="none" stroke="#1F2429" strokeWidth="2.2" />

            <g className="animate-bounce" style={{ animationDuration: '2.5s' }}>
              <text x="92" y="70" fontSize="14" fontWeight="bold" fill="#6A625A" className="font-handwriting">
                すやぁ...
              </text>
              <text x="144" y="52" fontSize="18" fontWeight="bold" fill="#3E3833" className="font-handwriting">
                z
              </text>
            </g>
          </g>
        ) : (
          /* Standing Character matching the exact uploaded image */
          <g transform={activity === 'transit' && transportMethod === 'bicycle' ? 'translate(0, -18)' : 'translate(0, 0)'}>
            {/* Ground Shadow */}
            <ellipse cx="100" cy="226" rx="46" ry="6" fill="#E2DDD5" opacity="0.8" />

            {/* Khaki Pants / Legs */}
            <path
              d="M84 175 L82 216 M116 175 L118 216"
              stroke="#1F2429"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Pants Shape Fill */}
            <path
              d="M80 174 L84 216 L98 216 L100 185 L102 216 L116 216 L120 174 Z"
              fill="#C4B499"
              stroke="#1F2429"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />

            {/* Brown Shoes with Soles */}
            <ellipse cx="90" cy="218" rx="10" ry="5.5" fill="#9E8D7A" stroke="#1F2429" strokeWidth="2.4" />
            <ellipse cx="110" cy="218" rx="10" ry="5.5" fill="#9E8D7A" stroke="#1F2429" strokeWidth="2.4" />

            {/* White T-shirt under jacket */}
            <path
              d="M90 120 L110 120 L110 176 L90 176 Z"
              fill="#FFFFFF"
              stroke="#1F2429"
              strokeWidth="2.4"
            />

            {/* Denim Blue Jacket */}
            <path
              d="M68 122 C68 116 80 114 100 114 C120 114 132 116 132 122 L136 174 L114 174 L114 126 L100 134 L86 126 L86 174 L64 174 Z"
              fill="#52799C"
              stroke="#1F2429"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            {/* Denim Jacket details (Collar, pockets, seams) */}
            <path d="M86 122 L76 138 L86 142" stroke="#1F2429" strokeWidth="2.4" fill="#436686" />
            <path d="M114 122 L124 138 L114 142" stroke="#1F2429" strokeWidth="2.4" fill="#436686" />
            <rect x="70" y="145" width="12" height="11" rx="1.5" fill="#436686" stroke="#1F2429" strokeWidth="1.8" />
            <rect x="118" y="145" width="12" height="11" rx="1.5" fill="#436686" stroke="#1F2429" strokeWidth="1.8" />

            {/* Arms */}
            {activity === 'snacking' ? (
              <g>
                <path d="M68 124 Q60 148 78 152" stroke="#1F2429" strokeWidth="2.8" fill="#52799C" />
                <path d="M132 124 Q140 148 122 152" stroke="#1F2429" strokeWidth="2.8" fill="#52799C" />
                {/* Coffee Cup */}
                <path d="M93 148 L96 168 L104 168 L107 148 Z" fill="#FFFDF7" stroke="#1F2429" strokeWidth="2" />
                <ellipse cx="100" cy="148" rx="7" ry="2.5" fill="#D9CCBA" stroke="#1F2429" strokeWidth="2" />
                <text x="115" y="152" fontSize="10" fontWeight="bold" fill="#6A625A" className="font-handwriting">
                  ほっ
                </text>
              </g>
            ) : (
              <g>
                {/* Left Arm & Hand */}
                <path d="M68 124 L60 166 L68 172 L74 132" fill="#52799C" stroke="#1F2429" strokeWidth="2.6" strokeLinejoin="round" />
                <path d="M60 166 C56 172 62 186 68 184 C72 182 72 174 68 172" fill="#FFFDF7" stroke="#1F2429" strokeWidth="2.2" strokeLinejoin="round" />
                {/* Right Arm & Hand */}
                <path d="M132 124 L140 166 L132 172 L126 132" fill="#52799C" stroke="#1F2429" strokeWidth="2.6" strokeLinejoin="round" />
                <path d="M140 166 C144 172 138 186 132 184 C128 182 128 174 132 172" fill="#FFFDF7" stroke="#1F2429" strokeWidth="2.2" strokeLinejoin="round" />
              </g>
            )}

            {/* Neck */}
            <rect x="94" y="108" width="12" height="10" fill="#FFFDF7" stroke="#1F2429" strokeWidth="2.2" />

            {/* Head Shape */}
            <path
              d="M62 68 C62 38 78 30 100 30 C122 30 138 38 138 68 C138 96 122 112 100 112 C78 112 62 96 62 68 Z"
              fill="#FFFDF7"
              stroke="#1F2429"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />

            {/* Soft pink blush */}
            <ellipse cx="68" cy="77" rx="5.5" ry="4" fill="#F4A99B" opacity="0.65" />
            <ellipse cx="132" cy="77" rx="5.5" ry="4" fill="#F4A99B" opacity="0.65" />

            {/* Distinctive Droopy 八の字 (Hachinoji) Eyebrows */}
            {/* Left Brow: starts low on outside, arcs up towards nose */}
            <path d="M69 57 C73 49 82 45 93 47" stroke="#1F2429" strokeWidth="3.2" strokeLinecap="round" fill="none" />
            {/* Right Brow: arcs down towards outside */}
            <path d="M107 47 C118 45 127 49 131 57" stroke="#1F2429" strokeWidth="3.2" strokeLinecap="round" fill="none" />

            {/* Cute Dot Eyes (点目) */}
            <g>
              {/* Left Dot Eye */}
              <circle cx="82" cy="65" r="3.4" fill="#1F2429" />
              {/* Right Dot Eye */}
              <circle cx="118" cy="65" r="3.4" fill="#1F2429" />
            </g>

            {/* Black Rounded Rectangular Glasses with Thick Frames - angled slightly to match droop */}
            <g>
              <rect x="67" y="53" width="31" height="25" rx="9" fill="none" stroke="#1F2429" strokeWidth="3.6" />
              <rect x="102" y="53" width="31" height="25" rx="9" fill="none" stroke="#1F2429" strokeWidth="3.6" />
              <line x1="98" y1="65" x2="102" y2="65" stroke="#1F2429" strokeWidth="3.8" strokeLinecap="round" />
              <line x1="61" y1="65" x2="67" y2="65" stroke="#1F2429" strokeWidth="3.4" strokeLinecap="round" />
              <line x1="133" y1="65" x2="139" y2="65" stroke="#1F2429" strokeWidth="3.4" strokeLinecap="round" />
            </g>

            {/* Gentle Calm Smile */}
            <path d="M91 87 Q100 94 109 87" stroke="#1F2429" strokeWidth="2.8" strokeLinecap="round" fill="none" />

            {/* Black Hair with Side-Swept Bangs */}
            <path
              d="M58 64 C56 30 76 16 100 16 C124 16 144 30 142 64 C136 50 128 40 118 41 C108 42 98 34 86 38 C74 42 66 52 58 64 Z"
              fill="#1F2429"
              stroke="#1F2429"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            {/* Curving fringe */}
            <path
              d="M74 34 C90 46 116 38 136 52 C126 38 106 32 74 34 Z"
              fill="#1F2429"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
