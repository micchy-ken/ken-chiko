import React from 'react';
import { NyanCharacter } from '../types';
import { getNyanComposition } from '../utils/nyanAssetComposer';

interface NyanIllustrationProps {
  nyan: NyanCharacter;
  size?: number;
  className?: string;
  isDiscovered?: boolean;
  showCaption?: boolean;
}

export const NyanIllustration: React.FC<NyanIllustrationProps> = ({
  nyan,
  size = 130,
  className = '',
  isDiscovered = true,
  showCaption = false,
}) => {
  // If user uploaded custom external image
  if (nyan.customImageUrl && isDiscovered) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden border border-[#2E2824] bg-[#FAF8F4] shadow-sm ${className}`}
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

  // Undiscovered Silhouette (Hand-drawn question mark outline on paper)
  if (!isDiscovered) {
    return (
      <div
        className={`relative inline-flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-dashed border-[#C4BCAB] bg-[#EFECE4] ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-3/4 h-3/4 opacity-30"
          fill="#3E3833"
          style={{ filter: 'url(#pencil-jitter)' }}
        >
          <path d="M25 80 L25 45 L35 25 L45 42 Q50 40 55 40 Q60 40 65 42 L75 25 L85 45 L85 80 Q55 85 25 80 Z" />
          <circle cx="85" cy="75" r="8" />
        </svg>
        <span className="font-bold text-[#8A8177] text-sm mt-1 font-handwriting">未発見</span>
      </div>
    );
  }

  // Dynamic modular parts composition based on 「きほんのにゃんこ」
  const config = getNyanComposition(nyan);
  const { coat, pose, headProp, handProp, soundEffect } = config;

  // Coat color palettes in hand-drawn washi pencil aesthetic
  const coatFills: Record<string, { body: string; stroke: string; patch?: string; earInner: string }> = {
    white: { body: '#FFFDF9', stroke: '#2E2824', earInner: '#D8C3BA' },
    black: { body: '#3E3833', stroke: '#1F1B18', patch: '#2E2824', earInner: '#5A524A' },
    gray: { body: '#D5D0C5', stroke: '#2E2824', patch: '#BCB6AA', earInner: '#C4ABA5' },
    calico: { body: '#FFFDF9', stroke: '#2E2824', patch: '#D97543', earInner: '#D8C3BA' },
    tabby: { body: '#E5CBA8', stroke: '#2E2824', patch: '#9A5B32', earInner: '#D4A892' },
    tuxedo: { body: '#3E3833', stroke: '#1F1B18', patch: '#FFFDF9', earInner: '#5A524A' },
  };

  const currentCoat = coatFills[coat] || coatFills.white;
  const isDarkCoat = coat === 'black' || coat === 'tuxedo';
  const mainLineColor = '#2E2824';

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: size }}
    >
      <div className="relative w-full aspect-square flex items-center justify-center">
        <svg
          viewBox="0 0 160 170"
          className="w-full h-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: 'url(#pencil-jitter)' }}
        >
          {/* Ground Shadow - Organic Hand-drawn Pencil Hatch Lines (From 「きほんのにゃんこ」) */}
          <g opacity="0.8">
            <ellipse cx="80" cy="148" rx="36" ry="4.5" fill="#E5DFD4" />
            <line x1="52" y1="147" x2="108" y2="147" stroke={mainLineColor} strokeWidth="1.6" strokeLinecap="round" />
            <line x1="58" y1="149" x2="102" y2="149" stroke={mainLineColor} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="64" y1="151" x2="96" y2="151" stroke={mainLineColor} strokeWidth="0.8" strokeLinecap="round" />
          </g>

          {/* BACKGROUND SOUND EFFECT / ONOMATOPOEIA */}
          {soundEffect && (
            <text
              x={headProp === 'antenna' ? '106' : '102'}
              y="38"
              fontSize="11"
              fontWeight="bold"
              fill="#5A524A"
              className="font-handwriting select-none"
              letterSpacing="1"
            >
              {soundEffect}
            </text>
          )}

          {/* 1. TAIL - Curved elegantly to the right (From 「きほんのにゃんこ」) */}
          <path
            d="M 102 128 C 122 132 134 120 128 104 C 124 94 116 98 112 105 C 108 112 101 120 97 122"
            fill={currentCoat.body}
            stroke={mainLineColor}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. BODY & SHORT STUBBY LEGS (Chubby upright two-legged stance) */}
          <path
            d={`
              M 64 68
              C 48 78 44 98 46 120
              C 47 130 50 140 56 146
              C 60 150 65 149 67 144
              C 70 137 72 131 80 131
              C 88 131 90 137 93 144
              C 95 149 100 150 104 146
              C 110 140 113 130 114 120
              C 116 98 112 78 96 68
              Z
            `}
            fill={currentCoat.body}
            stroke={mainLineColor}
            strokeWidth="3.0"
            strokeLinejoin="round"
          />

          {/* Belly & Chin Shading */}
          <path
            d="M 62 74 Q 80 84 98 74 Q 80 90 62 74 Z"
            fill={mainLineColor}
            opacity="0.08"
          />
          <path
            d="M 70 131 Q 80 136 90 131"
            stroke={mainLineColor}
            strokeWidth="1.0"
            strokeLinecap="round"
            opacity="0.4"
          />

          {/* Coat Patterns (Calico / Tabby / Tuxedo markings) */}
          {coat === 'calico' && (
            <g>
              <path d="M 50 88 C 46 102 54 115 62 110 C 65 98 58 88 50 88 Z" fill="#D97543" opacity="0.9" />
              <path d="M 98 94 C 108 100 112 114 106 122 C 98 118 96 106 98 94 Z" fill="#3E3833" opacity="0.9" />
            </g>
          )}
          {coat === 'tabby' && (
            <g opacity="0.7">
              <path d="M 52 92 Q 62 94 58 100 M 104 92 Q 94 94 98 100 M 54 108 Q 66 110 62 116 M 102 108 Q 90 110 94 116" stroke="#9A5B32" strokeWidth="2.0" strokeLinecap="round" />
            </g>
          )}
          {coat === 'tuxedo' && (
            // White chest patch on tuxedo cat
            <path d="M 72 72 L 80 102 L 88 72 Z" fill="#FFFDF9" stroke={mainLineColor} strokeWidth="1.4" />
          )}

          {/* Left Arm resting by side */}
          <path
            d="M 50 96 C 47 106 47 115 52 123 C 54 125 57 123 57 120 C 57 112 55 104 59 96"
            fill={currentCoat.body}
            stroke={mainLineColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Arm resting by side */}
          <path
            d="M 110 96 C 113 106 113 115 108 123 C 106 125 103 123 103 120 C 103 112 105 104 101 96"
            fill={currentCoat.body}
            stroke={mainLineColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 3. HEAD (Wide chubby contour from 「きほんのにゃんこ」) */}
          <path
            d={`
              M 54 48
              C 48 36 52 22 56 18
              C 60 14 66 22 72 28
              C 77 26 83 26 88 28
              C 94 22 100 14 104 18
              C 108 22 112 36 106 48
              C 114 58 112 74 102 81
              C 92 86 68 86 58 81
              C 48 74 46 58 54 48
              Z
            `}
            fill={currentCoat.body}
            stroke={mainLineColor}
            strokeWidth="3.0"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Calico / Tabby head markings */}
          {coat === 'calico' && (
            <path d="M 54 42 C 50 28 56 18 60 22 C 68 28 62 46 54 42 Z" fill="#D97543" opacity="0.9" />
          )}
          {coat === 'tabby' && (
            <g opacity="0.7">
              <path d="M 76 25 L 76 33 M 84 25 L 84 33 M 80 23 L 80 34" stroke="#9A5B32" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          )}

          {/* Inner Ear Pencil Texture strokes */}
          <path d="M 58 24 L 60 34" stroke={currentCoat.earInner} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M 102 24 L 100 34" stroke={currentCoat.earInner} strokeWidth="1.6" strokeLinecap="round" />

          {/* 4. HEAD PROPS (Customised for each 〇〇にゃん) */}
          {/* Antenna (えーあいにゃん) */}
          {headProp === 'antenna' && (
            <g>
              <line x1="80" y1="22" x2="80" y2="8" stroke={mainLineColor} strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="80" cy="7" r="4.0" fill="#E85D54" stroke={mainLineColor} strokeWidth="2" />
              <path d="M 73 3 Q 76 0 78 3" stroke="#7A726A" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M 82 3 Q 84 0 87 3" stroke="#7A726A" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="80" y1="1" x2="80" y2="-2" stroke="#7A726A" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          )}

          {/* Triangular Hanpen (おでんにゃん) */}
          {headProp === 'hanpen' && (
            <polygon
              points="80,4 66,20 94,20"
              fill="#FFFDF9"
              stroke={mainLineColor}
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          )}

          {/* Headband (寿司・職人・ラーメン) */}
          {headProp === 'headband' && (
            <g>
              <path d="M 58 32 Q 80 28 102 32" stroke={mainLineColor} strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="104" cy="32" r="3.2" fill="#D9433B" />
            </g>
          )}

          {/* Glasses (JINSにゃん) */}
          {headProp === 'glasses' && (
            <g>
              <circle cx="68" cy="51" r="7.5" fill="none" stroke={mainLineColor} strokeWidth="2.4" />
              <circle cx="92" cy="51" r="7.5" fill="none" stroke={mainLineColor} strokeWidth="2.4" />
              <line x1="75.5" y1="51" x2="84.5" y2="51" stroke={mainLineColor} strokeWidth="2.4" />
            </g>
          )}

          {/* Ribbon */}
          {headProp === 'ribbon' && (
            <g transform="translate(98, 26)">
              <circle cx="0" cy="0" r="3" fill="#E86E84" stroke={mainLineColor} strokeWidth="1.8" />
              <ellipse cx="-5" cy="-2" rx="4" ry="2.5" fill="#E86E84" stroke={mainLineColor} strokeWidth="1.8" />
              <ellipse cx="5" cy="2" rx="4" ry="2.5" fill="#E86E84" stroke={mainLineColor} strokeWidth="1.8" />
            </g>
          )}

          {/* Scarf (寒波にゃん) */}
          {headProp === 'scarf' && (
            <g>
              <path d="M 58 66 Q 80 72 102 66" stroke="#68A5C7" strokeWidth="8" strokeLinecap="round" />
              <path d="M 58 66 Q 80 72 102 66" stroke={mainLineColor} strokeWidth="2.2" fill="none" />
              <path d="M 90 68 L 96 86 L 86 86 Z" fill="#68A5C7" stroke={mainLineColor} strokeWidth="1.8" />
            </g>
          )}

          {/* Straw Hat */}
          {headProp === 'straw_hat' && (
            <g transform="translate(80, 16)">
              <ellipse cx="0" cy="4" rx="22" ry="6" fill="#E8CF86" stroke={mainLineColor} strokeWidth="2.2" />
              <path d="M -12 4 C -12 -6 12 -6 12 4 Z" fill="#E8CF86" stroke={mainLineColor} strokeWidth="2.2" />
              <line x1="-12" y1="2" x2="12" y2="2" stroke="#D9534F" strokeWidth="2" />
            </g>
          )}

          {/* Party Hat */}
          {headProp === 'party_hat' && (
            <g transform="translate(80, 8)">
              <polygon points="0,-10 -10,12 10,12" fill="#F2C044" stroke={mainLineColor} strokeWidth="2" />
              <circle cx="0" cy="-10" r="2.5" fill="#E85D54" />
            </g>
          )}

          {/* 5. EYES - Iconic Deadpan Half-Open Slit Eyes (ジト目 from 「きほんのにゃんこ」) */}
          <g>
            {/* Left Eye: Flat upper line + dark half-pupil underneath */}
            <line x1="61" y1="51" x2="74" y2="51" stroke={isDarkCoat ? '#FFFDF9' : mainLineColor} strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 64 52 C 64 57 71 57 71 52 Z" fill={isDarkCoat ? '#FFFDF9' : mainLineColor} />

            {/* Right Eye: Flat upper line + dark half-pupil underneath */}
            <line x1="86" y1="51" x2="99" y2="51" stroke={isDarkCoat ? '#FFFDF9' : mainLineColor} strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 89 52 C 89 57 96 57 96 52 Z" fill={isDarkCoat ? '#FFFDF9' : mainLineColor} />
          </g>

          {/* 6. MOUTH - Iconic Inverted 'T' Line (from 「きほんのにゃんこ」) */}
          <g>
            <line x1="80" y1="56" x2="80" y2="62" stroke={isDarkCoat ? '#FFFDF9' : mainLineColor} strokeWidth="2.4" strokeLinecap="round" />
            <line x1="74" y1="62" x2="86" y2="62" stroke={isDarkCoat ? '#FFFDF9' : mainLineColor} strokeWidth="2.4" strokeLinecap="round" />
          </g>

          {/* 7. WHISKERS - Two delicate pencil strokes on each cheek */}
          <g opacity="0.9">
            <path d="M 52 56 L 36 54" stroke={mainLineColor} strokeWidth="2.0" strokeLinecap="round" />
            <path d="M 53 63 L 38 66" stroke={mainLineColor} strokeWidth="2.0" strokeLinecap="round" />
            <path d="M 108 56 L 124 54" stroke={mainLineColor} strokeWidth="2.0" strokeLinecap="round" />
            <path d="M 107 63 L 122 66" stroke={mainLineColor} strokeWidth="2.0" strokeLinecap="round" />
          </g>

          {/* 8. HAND / FOREGROUND PROPS */}
          {/* Laptop with "カタカタ" (えーあいにゃん) */}
          {handProp === 'laptop' && (
            <g transform="translate(32, 92)">
              <polygon points="14,38 52,38 44,24 8,24" fill="#FAF8F5" stroke={mainLineColor} strokeWidth="2.4" strokeLinejoin="round" />
              <line x1="14" y1="28" x2="46" y2="28" stroke={mainLineColor} strokeWidth="1.2" />
              <line x1="17" y1="33" x2="49" y2="33" stroke={mainLineColor} strokeWidth="1.2" />
              <polygon points="8,24 2,0 30,-4 36,20" fill="#FFFDF9" stroke={mainLineColor} strokeWidth="2.4" strokeLinejoin="round" />
              <ellipse cx="16" cy="8" rx="4" ry="3.5" fill="#EAF5EC" stroke="#488A58" strokeWidth="1.3" />
              <path d="M6 2 L22 -1" stroke="#488A58" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M6 14 L20 12" stroke="#488A58" strokeWidth="1.3" strokeLinecap="round" />
              <text x="44" y="6" fontSize="10" fontWeight="900" fill="#3E3833" className="font-handwriting select-none">カタ</text>
              <text x="54" y="17" fontSize="10" fontWeight="900" fill="#3E3833" className="font-handwriting select-none">カタ</text>
            </g>
          )}

          {/* Pino Ice Cream Box */}
          {handProp === 'pino_box' && (
            <g transform="translate(66, 102)">
              <rect x="0" y="0" width="28" height="18" rx="3" fill="#D9433B" stroke={mainLineColor} strokeWidth="2.2" />
              <text x="4" y="12" fontSize="8" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">
                pino
              </text>
            </g>
          )}

          {/* Sushi Plate */}
          {handProp === 'sushi_plate' && (
            <g transform="translate(62, 108)">
              <ellipse cx="18" cy="12" rx="18" ry="7" fill="#F4F1EA" stroke={mainLineColor} strokeWidth="2.2" />
              <ellipse cx="18" cy="9" rx="11" ry="5" fill="#D9433B" stroke={mainLineColor} strokeWidth="1.8" />
              <rect x="14" y="5" width="8" height="8" fill="#2E2824" />
            </g>
          )}

          {/* Coffee Mug */}
          {handProp === 'coffee' && (
            <g transform="translate(86, 104)">
              <rect x="0" y="0" width="14" height="16" rx="3" fill="#FFFDF9" stroke={mainLineColor} strokeWidth="2" />
              <path d="M14 4 Q20 8 14 12" stroke={mainLineColor} strokeWidth="1.8" fill="none" />
              <path d="M5 -4 Q7 -8 9 -4" stroke="#7A726A" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}

          {/* Beer Mug */}
          {handProp === 'beer' && (
            <g transform="translate(84, 100)">
              <rect x="0" y="6" width="16" height="20" rx="3" fill="#F2C044" stroke={mainLineColor} strokeWidth="2.2" />
              <rect x="0" y="0" width="16" height="8" rx="4" fill="#FFFFFF" stroke={mainLineColor} strokeWidth="2" />
              <path d="M16 8 Q22 14 16 20" stroke={mainLineColor} strokeWidth="2" fill="none" />
            </g>
          )}

          {/* Ramen Bowl */}
          {handProp === 'ramen' && (
            <g transform="translate(62, 102)">
              <path d="M4 8 Q18 24 32 8 Z" fill="#D9534F" stroke={mainLineColor} strokeWidth="2.2" />
              <ellipse cx="18" cy="8" rx="14" ry="5" fill="#FFF2D6" stroke={mainLineColor} strokeWidth="1.8" />
              <line x1="22" y1="2" x2="36" y2="-4" stroke="#8C4E28" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          )}

          {/* Book */}
          {handProp === 'book' && (
            <g transform="translate(68, 106)">
              <polygon points="0,4 12,0 24,4 24,18 12,14 0,18" fill="#5C8299" stroke={mainLineColor} strokeWidth="2.2" />
              <line x1="12" y1="0" x2="12" y2="14" stroke={mainLineColor} strokeWidth="1.8" />
            </g>
          )}

          {/* Onigiri */}
          {handProp === 'onigiri' && (
            <g transform="translate(70, 104)">
              <polygon points="10,0 0,18 20,18" fill="#FFFDF9" stroke={mainLineColor} strokeWidth="2" strokeLinejoin="round" />
              <rect x="6" y="10" width="8" height="8" fill="#2E2824" />
            </g>
          )}

          {/* Shopping Bag */}
          {handProp === 'shopping_bag' && (
            <g transform="translate(86, 106)">
              <rect x="0" y="4" width="16" height="18" rx="2" fill="#E88B84" stroke={mainLineColor} strokeWidth="2" />
              <path d="M4 4 Q8 -2 12 4" stroke={mainLineColor} strokeWidth="1.8" fill="none" />
            </g>
          )}
        </svg>
      </div>

      {/* Hand-drawn hiragana caption (like "きほんのにゃんこ" in reference) */}
      {showCaption && (
        <p className="mt-1 text-center font-handwriting text-sm font-bold text-[#3E3833] tracking-wider select-none">
          {nyan.name}
        </p>
      )}
    </div>
  );
};

