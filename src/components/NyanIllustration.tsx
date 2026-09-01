import React from 'react';
import { NyanCharacter } from '../types';

interface NyanIllustrationProps {
  nyan: NyanCharacter;
  size?: number;
  className?: string;
  isDiscovered?: boolean;
}

export const NyanIllustration: React.FC<NyanIllustrationProps> = ({
  nyan,
  size = 120,
  className = '',
  isDiscovered = true,
}) => {
  // If user provided custom image (via prompt generation / upload)
  if (nyan.customImageUrl && isDiscovered) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden border-2 border-stone-800 bg-white shadow-sm ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={nyan.customImageUrl}
          alt={nyan.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // If undiscovered, render mystery silhouette
  if (!isDiscovered) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-2xl border-2 border-dashed border-stone-400 bg-stone-100 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-3/4 h-3/4 opacity-30 drop-shadow-sm"
          fill="#525252"
        >
          {/* Cat silhouette */}
          <path d="M25 80 L25 45 L35 25 L45 42 Q50 40 55 40 Q60 40 65 42 L75 25 L85 45 L85 80 Q55 85 25 80 Z" />
          <circle cx="85" cy="75" r="10" />
        </svg>
        <span className="absolute font-bold text-stone-500 text-lg">?</span>
      </div>
    );
  }

  // Minimalist Pen-line Art SVG illustration generator
  const no = nyan.no;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft shadow */}
        <ellipse cx="60" cy="108" rx="28" ry="5" fill="#e7e5e4" />

        {/* Cat Tail */}
        <path
          d={no === 87 ? "M85 80 L95 65 L88 60 L102 45" : "M85 85 Q105 80 100 65 Q95 55 90 60"}
          stroke={no === 87 ? "#eab308" : "#262626"}
          strokeWidth={no === 87 ? "4" : "3.5"}
          strokeLinecap="round"
          fill="none"
        />

        {/* Tail Tag for Michiko-nyan (#53) */}
        {no === 53 && (
          <circle cx="98" cy="60" r="4.5" fill="#f43f5e" stroke="#262626" strokeWidth="1.5" />
        )}

        {/* Cat Body */}
        <path
          d="M32 95 Q28 65 40 60 Q50 56 70 56 Q82 65 78 95 Q55 102 32 95 Z"
          fill={no === 9 ? '#eff6ff' : no === 57 ? '#bae6fd' : no === 87 || no === 88 ? '#374151' : '#ffffff'}
          stroke="#262626"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Cat Paws Bottom */}
        <ellipse cx="44" cy="98" rx="6" ry="3.5" fill="#ffffff" stroke="#262626" strokeWidth="2.5" />
        <ellipse cx="66" cy="98" rx="6" ry="3.5" fill="#ffffff" stroke="#262626" strokeWidth="2.5" />

        {/* Head */}
        <ellipse
          cx="60"
          cy="48"
          rx="26"
          ry="23"
          fill={no === 9 ? '#eff6ff' : no === 57 ? '#bae6fd' : no === 87 || no === 88 ? '#374151' : '#ffffff'}
          stroke="#262626"
          strokeWidth="3.5"
        />

        {/* Ears */}
        <path
          d="M38 36 L30 18 L48 27 Z"
          fill={no === 87 || no === 88 ? '#374151' : '#ffffff'}
          stroke="#262626"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d="M82 36 L90 18 L72 27 Z"
          fill={no === 87 || no === 88 ? '#374151' : '#ffffff'}
          stroke="#262626"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Inner ear lines */}
        <path d="M36 28 L34 22 L42 27" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" />
        <path d="M84 28 L86 22 L78 27" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" />

        {/* Deadpan Dot Eyes */}
        <circle cx="51" cy="46" r="2.8" fill={no === 87 || no === 88 ? '#ffffff' : '#262626'} />
        <circle cx="69" cy="46" r="2.8" fill={no === 87 || no === 88 ? '#ffffff' : '#262626'} />

        {/* Nose & Mouth (Cat stoic dot or inverted Y) */}
        <circle cx="60" cy="51" r="1.5" fill="#f43f5e" />
        <path d="M57 55 Q60 57 63 55" stroke="#262626" strokeWidth="2" strokeLinecap="round" />

        {/* Whiskers */}
        <path d="M35 48 L22 47 M35 52 L23 54" stroke="#262626" strokeWidth="2" strokeLinecap="round" />
        <path d="M85 48 L98 47 M85 52 L97 54" stroke="#262626" strokeWidth="2" strokeLinecap="round" />

        {/* Distinctive Accessories based on No. */}
        {/* #1 Hebi-nyan: BBQ tongs */}
        {no === 1 && (
          <g>
            <path d="M72 75 L88 68 L86 64 M88 68 L84 72" stroke="#737373" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="90" cy="67" rx="3" ry="2" fill="#ef4444" />
          </g>
        )}

        {/* #2 Kyoto Tachibana-nyan: Orange uniform */}
        {no === 2 && (
          <g>
            <path d="M40 65 L70 65 L68 85 L42 85 Z" fill="#f97316" stroke="#262626" strokeWidth="2" />
            <path d="M68 70 L82 65 L84 60" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}

        {/* #4 Oden-nyan: Triangular Hanpen on head */}
        {no === 4 && (
          <polygon
            points="60,12 46,28 74,28"
            fill="#fff"
            stroke="#262626"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        )}

        {/* #5 Snow-nyan / Pino-nyan: Holding Pino box */}
        {no === 5 && (
          <g>
            <rect x="48" y="65" width="24" height="15" rx="3" fill="#dc2626" stroke="#262626" strokeWidth="2" />
            <text x="51" y="76" fontSize="7" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">
              pino
            </text>
          </g>
        )}

        {/* #6 Influ-nyan: Cooling patch & thermometer */}
        {no === 6 && (
          <g>
            <rect x="48" y="32" width="24" height="8" rx="2" fill="#67e8f9" stroke="#262626" strokeWidth="1.5" />
            <line x1="58" y1="53" x2="44" y2="58" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {/* #7 Yataizushi-nyan: Tuna sushi & headband */}
        {no === 7 && (
          <g>
            <line x1="38" y1="36" x2="82" y2="36" stroke="#262626" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="60" cy="74" rx="14" ry="7" fill="#ef4444" stroke="#262626" strokeWidth="2" />
            <rect x="56" y="70" width="8" height="8" fill="#262626" />
          </g>
        )}

        {/* #9 Kanpa-nyan: Oversized blue scarf */}
        {no === 9 && (
          <g>
            <rect x="36" y="56" width="48" height="12" rx="6" fill="#38bdf8" stroke="#262626" strokeWidth="2.5" />
            <path d="M68 64 L74 84 L64 84 Z" fill="#38bdf8" stroke="#262626" strokeWidth="2" />
          </g>
        )}

        {/* #17 Kenchiki-nyan: Fried chicken bucket hat */}
        {no === 17 && (
          <g>
            <path d="M46 26 L74 26 L70 12 L50 12 Z" fill="#dc2626" stroke="#262626" strokeWidth="2.5" />
            <line x1="56" y1="12" x2="56" y2="26" stroke="#fff" strokeWidth="3" />
            <ellipse cx="78" cy="68" rx="6" ry="4" fill="#d97706" stroke="#262626" strokeWidth="1.5" />
          </g>
        )}

        {/* #22 Shinkansen-nyan: Train Hat */}
        {no === 22 && (
          <g>
            <rect x="42" y="10" width="36" height="18" rx="4" fill="#ffffff" stroke="#262626" strokeWidth="2.5" />
            <line x1="42" y1="20" x2="78" y2="20" stroke="#2563eb" strokeWidth="3" />
            <circle cx="78" cy="72" r="5" fill="#f59e0b" stroke="#262626" strokeWidth="1.5" />
          </g>
        )}

        {/* #47 Jins-nyan: Big Black Glasses */}
        {no === 47 && (
          <g>
            <circle cx="49" cy="46" r="8" fill="none" stroke="#262626" strokeWidth="2.5" />
            <circle cx="71" cy="46" r="8" fill="none" stroke="#262626" strokeWidth="2.5" />
            <line x1="57" y1="46" x2="63" y2="46" stroke="#262626" strokeWidth="2.5" />
          </g>
        )}

        {/* #53 Michiko-nyan: Reading Glasses & Tags */}
        {no === 53 && (
          <g>
            <circle cx="49" cy="47" r="6" fill="none" stroke="#b45309" strokeWidth="2" />
            <circle cx="71" cy="47" r="6" fill="none" stroke="#b45309" strokeWidth="2" />
            <line x1="55" y1="47" x2="65" y2="47" stroke="#b45309" strokeWidth="2" />
            {/* Tag on neck */}
            <circle cx="60" cy="65" r="4.5" fill="#10b981" stroke="#262626" strokeWidth="1.5" />
          </g>
        )}

        {/* #67 Jinbei-nyan: Jinbei Pattern */}
        {no === 67 && (
          <g>
            <path d="M38 62 L82 62 L78 90 L42 90 Z" fill="#1e3a8a" stroke="#262626" strokeWidth="2.5" />
            <path d="M50 62 L60 76 L70 62" stroke="#ffffff" strokeWidth="2" />
            {/* Uchiwa fan */}
            <ellipse cx="84" cy="72" rx="9" ry="8" fill="#fef08a" stroke="#262626" strokeWidth="2" />
            <line x1="84" y1="80" x2="84" y2="92" stroke="#262626" strokeWidth="2" />
          </g>
        )}

        {/* #78 Mario-nyan: Red Cap */}
        {no === 78 && (
          <g>
            <path d="M40 28 Q60 14 80 28 Q84 32 60 32 Q36 32 40 28 Z" fill="#ef4444" stroke="#262626" strokeWidth="2.5" />
            <circle cx="60" cy="24" r="4" fill="#ffffff" />
            <text x="58" y="27" fontSize="5" fontWeight="bold" fill="#ef4444">M</text>
          </g>
        )}

        {/* #86 AI-nyan: Antenna & Laptop */}
        {no === 86 && (
          <g>
            <line x1="60" y1="26" x2="60" y2="12" stroke="#262626" strokeWidth="2.5" />
            <circle cx="60" cy="10" r="3" fill="#3b82f6" stroke="#262626" strokeWidth="1.5" />
            <rect x="48" y="68" width="24" height="14" rx="2" fill="#94a3b8" stroke="#262626" strokeWidth="2" />
          </g>
        )}

        {/* #87 Kaminari-nyan: Little Lightning Horn & Sparks */}
        {no === 87 && (
          <g>
            <polygon points="60,14 55,26 65,26" fill="#eab308" stroke="#262626" strokeWidth="2" />
            <path d="M25 40 L28 44 L24 46 L30 52" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
            <path d="M95 40 L92 44 L96 46 L90 52" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* #88 Homura-nyan: Parfait & Spoon */}
        {no === 88 && (
          <g>
            <path d="M26 60 Q18 55 24 48 Q32 54 28 62" fill="#18181b" stroke="#262626" strokeWidth="1.5" />
            <path d="M94 60 Q102 55 96 48 Q88 54 92 62" fill="#18181b" stroke="#262626" strokeWidth="1.5" />
            <ellipse cx="60" cy="74" rx="10" ry="6" fill="#ec4899" stroke="#262626" strokeWidth="1.5" />
            <line x1="72" y1="68" x2="80" y2="60" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
};
