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
        <span className="font-bold text-[#8A8177] text-sm mt-1">未発見</span>
      </div>
    );
  }

  // Dynamic modular parts composition
  const config = getNyanComposition(nyan);
  const { coat, pose, headProp, handProp, soundEffect } = config;

  // Coat color mappings in soft pencil & watercolor aesthetic
  const coatFills: Record<string, { body: string; patch?: string }> = {
    white: { body: '#FFFDF9' },
    black: { body: '#3A3430', patch: '#2E2824' },
    gray: { body: '#D8D4CC', patch: '#BDB7AB' },
    calico: { body: '#FFFDF9', patch: '#D97543' },
    tabby: { body: '#E8CEAA', patch: '#9A5B32' },
    tuxedo: { body: '#3A3430', patch: '#FFFDF9' },
  };

  const currentCoat = coatFills[coat] || coatFills.white;

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: size }}
    >
      <div className="relative w-full aspect-square flex items-center justify-center">
        <svg
          viewBox="0 0 140 140"
          className="w-full h-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ filter: 'url(#pencil-jitter)' }}
        >
          {/* Ground Shadow - Organic Pencil Hatch Lines (Identical to reference drawing) */}
          <g opacity="0.75">
            <ellipse cx="70" cy="116" rx="38" ry="6" fill="#E2DDD5" />
            <line x1="38" y1="116" x2="102" y2="116" stroke="#2E2824" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="48" y1="119" x2="92" y2="119" stroke="#2E2824" strokeWidth="0.9" strokeLinecap="round" />
            <line x1="56" y1="121" x2="84" y2="121" stroke="#2E2824" strokeWidth="0.6" strokeLinecap="round" />
          </g>

          {/* BACKGROUND PROPS (Behind Cat Body) */}
          {/* Sound / Onomatopoeia Text (Handwritten sketchy font) */}
          {soundEffect && (
            <text
              x={pose === 'typing' ? '92' : '98'}
              y="42"
              fontSize="11"
              fontWeight="bold"
              fill="#5A524A"
              className="font-handwriting select-none"
              letterSpacing="1"
            >
              {soundEffect}
            </text>
          )}

          {/* TAIL */}
          {pose === 'sleeping' ? (
            <path d="M96 102 Q108 98 104 88 Q100 82 92 86" stroke="#2E2824" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          ) : (
            <path
              d="M92 92 Q116 84 110 66 Q104 54 96 60"
              stroke="#2E2824"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* MAIN CAT BODY (Hand-drawn organic curve) */}
          {pose === 'sleeping' ? (
            // Loaf / Sleeping curled body
            <path
              d="M34 110 C28 88 50 78 76 78 C102 78 114 88 108 110 C96 116 46 116 34 110 Z"
              fill={currentCoat.body}
              stroke="#2E2824"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          ) : (
            // Sitting / Typing plump cat body
            <path
              d="M42 104 C34 72 48 66 70 66 C92 66 100 76 96 104 C88 112 52 112 42 104 Z"
              fill={currentCoat.body}
              stroke="#2E2824"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          )}

          {/* Coat Patterns (Calico / Tabby / Tuxedo markings) */}
          {coat === 'calico' && (
            <path d="M78 68 C88 74 94 88 90 98 C84 92 80 80 78 68 Z" fill="#D97543" opacity="0.85" />
          )}
          {coat === 'tabby' && (
            <g opacity="0.6">
              <path d="M48 76 Q56 78 52 86 M86 76 Q80 78 84 86" stroke="#8C4E28" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
          {coat === 'tuxedo' && (
            <path d="M62 68 L70 88 L78 68 Z" fill="#FFFDF9" stroke="#2E2824" strokeWidth="1.5" />
          )}

          {/* FRONT PAWS / LEGS */}
          {pose === 'typing' ? (
            <g>
              {/* Typing Paws over Keyboard */}
              <path d="M52 82 Q46 88 50 94 Q54 96 57 90" fill={currentCoat.body} stroke="#2E2824" strokeWidth="2.4" />
              <path d="M64 82 Q60 88 64 94 Q68 96 71 90" fill={currentCoat.body} stroke="#2E2824" strokeWidth="2.4" />
            </g>
          ) : pose === 'standing' ? (
            <g>
              <ellipse cx="54" cy="108" rx="6" ry="4" fill={currentCoat.body} stroke="#2E2824" strokeWidth="2.4" />
              <ellipse cx="78" cy="108" rx="6" ry="4" fill={currentCoat.body} stroke="#2E2824" strokeWidth="2.4" />
            </g>
          ) : (
            <g>
              {/* Cute resting paws */}
              <ellipse cx="54" cy="105" rx="6" ry="4" fill={currentCoat.body} stroke="#2E2824" strokeWidth="2.4" />
              <ellipse cx="78" cy="105" rx="6" ry="4" fill={currentCoat.body} stroke="#2E2824" strokeWidth="2.4" />
            </g>
          )}

          {/* CAT HEAD (Round Hand-Drawn Contour) */}
          <ellipse
            cx="68"
            cy="50"
            rx="27"
            ry="24"
            fill={currentCoat.body}
            stroke="#2E2824"
            strokeWidth="2.8"
          />

          {/* Calico / Tabby head patch */}
          {coat === 'calico' && (
            <path d="M44 38 L38 22 L54 30 Z" fill="#D97543" opacity="0.85" />
          )}

          {/* EARS */}
          {/* Left Ear */}
          <path
            d="M46 40 L38 20 L56 28 Z"
            fill={currentCoat.body}
            stroke="#2E2824"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          {/* Right Ear */}
          <path
            d="M90 40 L98 20 L80 28 Z"
            fill={currentCoat.body}
            stroke="#2E2824"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />

          {/* Inner Ear Pencil Lines */}
          <path d="M44 32 L42 25 L48 30" stroke="#D49B95" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M92 32 L94 25 L88 30" stroke="#D49B95" strokeWidth="1.8" strokeLinecap="round" />

          {/* HEAD PROPS (Antenna, Hanpen, Glasses, Ribbon, etc.) */}
          {/* 1. Antenna with Red Light (AI-Nyan exact replica) */}
          {headProp === 'antenna' && (
            <g>
              <line x1="68" y1="26" x2="68" y2="13" stroke="#2E2824" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="68" cy="11" r="3.8" fill="#E85D54" stroke="#2E2824" strokeWidth="2" />
              {/* Radio Wave Radiance */}
              <path d="M61 7 Q64 4 66 7" stroke="#7A726A" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M70 7 Q72 4 75 7" stroke="#7A726A" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="68" y1="5" x2="68" y2="2" stroke="#7A726A" strokeWidth="1.3" strokeLinecap="round" />
            </g>
          )}

          {/* 2. Triangular Hanpen (Oden-nyan) */}
          {headProp === 'hanpen' && (
            <polygon
              points="68,8 52,26 84,26"
              fill="#FFFDF9"
              stroke="#2E2824"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          )}

          {/* 3. Headband (Chef / Sushi / Ramen) */}
          {headProp === 'headband' && (
            <g>
              <path d="M44 38 Q68 34 92 38" stroke="#2E2824" strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="94" cy="38" r="3" fill="#D9433B" />
            </g>
          )}

          {/* 4. Glasses (JINS-nyan) */}
          {headProp === 'glasses' && (
            <g>
              <circle cx="56" cy="46" r="7.5" fill="none" stroke="#2E2824" strokeWidth="2.4" />
              <circle cx="78" cy="46" r="7.5" fill="none" stroke="#2E2824" strokeWidth="2.4" />
              <line x1="63.5" y1="46" x2="70.5" y2="46" stroke="#2E2824" strokeWidth="2.4" />
            </g>
          )}

          {/* 5. Ribbon */}
          {headProp === 'ribbon' && (
            <g transform="translate(82, 28)">
              <circle cx="0" cy="0" r="3" fill="#E86E84" stroke="#2E2824" strokeWidth="1.8" />
              <ellipse cx="-5" cy="-2" rx="4" ry="2.5" fill="#E86E84" stroke="#2E2824" strokeWidth="1.8" />
              <ellipse cx="5" cy="2" rx="4" ry="2.5" fill="#E86E84" stroke="#2E2824" strokeWidth="1.8" />
            </g>
          )}

          {/* 6. Scarf (Kanpa-nyan) */}
          {headProp === 'scarf' && (
            <g>
              <path d="M44 60 Q68 64 90 60" stroke="#68A5C7" strokeWidth="7" strokeLinecap="round" />
              <path d="M44 60 Q68 64 90 60" stroke="#2E2824" strokeWidth="2.2" fill="none" />
              <path d="M78 62 L84 78 L74 78 Z" fill="#68A5C7" stroke="#2E2824" strokeWidth="1.8" />
            </g>
          )}

          {/* EYES - Iconic Deadpan Half-Open Slit / Flat-Top Eyes */}
          {pose === 'sleeping' ? (
            // Curved sleeping eyes
            <g>
              <path d="M52 48 Q56 53 60 48" stroke="#2E2824" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M74 48 Q78 53 82 48" stroke="#2E2824" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              {/* Left Eye: Flat top eyebrow + half square pupil */}
              <line x1="52" y1="46" x2="62" y2="46" stroke="#2E2824" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M54 47 C54 51 60 51 60 47" fill="#2E2824" stroke="#2E2824" strokeWidth="1.2" />

              {/* Right Eye: Flat top eyebrow + half square pupil */}
              <line x1="73" y1="46" x2="83" y2="46" stroke="#2E2824" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M75 47 C75 51 81 51 81 47" fill="#2E2824" stroke="#2E2824" strokeWidth="1.2" />
            </g>
          )}

          {/* MOUTH - Iconic Inverted 'T' Stoic Cat Expression */}
          <path d="M68 51 L68 57 M63 57 L73 57" stroke="#2E2824" strokeWidth="2.4" strokeLinecap="round" />

          {/* WHISKERS - Delicate Pencil Strokes */}
          <path d="M42 50 L28 49 M42 56 L30 58" stroke="#2E2824" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M94 50 L108 49 M94 56 L106 58" stroke="#2E2824" strokeWidth="1.8" strokeLinecap="round" />

          {/* HAND / FOREGROUND PROPS */}
          {/* 1. Laptop with "カタカタ" (AI-Nyan) */}
          {handProp === 'laptop' && (
            <g transform="translate(20, 72)">
              {/* Keyboard base */}
              <polygon points="14,38 52,38 44,24 8,24" fill="#FAF8F5" stroke="#2E2824" strokeWidth="2.4" strokeLinejoin="round" />
              {/* Keyboard Grid */}
              <line x1="14" y1="28" x2="46" y2="28" stroke="#2E2824" strokeWidth="1.2" />
              <line x1="17" y1="33" x2="49" y2="33" stroke="#2E2824" strokeWidth="1.2" />
              <line x1="22" y1="24" x2="25" y2="38" stroke="#2E2824" strokeWidth="1" />
              <line x1="32" y1="24" x2="35" y2="38" stroke="#2E2824" strokeWidth="1" />
              
              {/* Screen tilted */}
              <polygon points="8,24 2,0 30,-4 36,20" fill="#FFFDF9" stroke="#2E2824" strokeWidth="2.4" strokeLinejoin="round" />
              {/* Glowing Logo & Code lines */}
              <ellipse cx="16" cy="8" rx="4" ry="3.5" fill="#EAF5EC" stroke="#488A58" strokeWidth="1.3" />
              <path d="M6 2 L22 -1" stroke="#488A58" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M6 14 L20 12" stroke="#488A58" strokeWidth="1.3" strokeLinecap="round" />

              {/* Typing Sound "カタカタ" (Exact match to reference) */}
              <text x="36" y="7" fontSize="10" fontWeight="900" fill="#3E3833" className="font-handwriting select-none">
                カタ
              </text>
              <text x="46" y="18" fontSize="10" fontWeight="900" fill="#3E3833" className="font-handwriting select-none">
                カタ
              </text>
            </g>
          )}

          {/* 2. Pino Ice Cream Box */}
          {handProp === 'pino_box' && (
            <g transform="translate(54, 82)">
              <rect x="0" y="0" width="28" height="18" rx="3" fill="#D9433B" stroke="#2E2824" strokeWidth="2.2" />
              <text x="4" y="12" fontSize="8" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">
                pino
              </text>
            </g>
          )}

          {/* 3. Sushi Plate */}
          {handProp === 'sushi_plate' && (
            <g transform="translate(50, 88)">
              <ellipse cx="18" cy="12" rx="18" ry="7" fill="#F4F1EA" stroke="#2E2824" strokeWidth="2.2" />
              <ellipse cx="18" cy="9" rx="11" ry="5" fill="#D9433B" stroke="#2E2824" strokeWidth="1.8" />
              <rect x="14" y="5" width="8" height="8" fill="#2E2824" />
            </g>
          )}

          {/* 4. Coffee Mug */}
          {handProp === 'coffee' && (
            <g transform="translate(74, 84)">
              <rect x="0" y="0" width="14" height="16" rx="3" fill="#FFFDF9" stroke="#2E2824" strokeWidth="2" />
              <path d="M14 4 Q20 8 14 12" stroke="#2E2824" strokeWidth="1.8" fill="none" />
              <path d="M5 -4 Q7 -8 9 -4" stroke="#7A726A" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}

          {/* 5. Beer Mug */}
          {handProp === 'beer' && (
            <g transform="translate(72, 80)">
              <rect x="0" y="6" width="16" height="20" rx="3" fill="#F2C044" stroke="#2E2824" strokeWidth="2.2" />
              <rect x="0" y="0" width="16" height="8" rx="4" fill="#FFFFFF" stroke="#2E2824" strokeWidth="2" />
              <path d="M16 8 Q22 14 16 20" stroke="#2E2824" strokeWidth="2" fill="none" />
            </g>
          )}

          {/* 6. Ramen Bowl */}
          {handProp === 'ramen' && (
            <g transform="translate(50, 82)">
              <path d="M4 8 Q18 24 32 8 Z" fill="#D9534F" stroke="#2E2824" strokeWidth="2.2" />
              <ellipse cx="18" cy="8" rx="14" ry="5" fill="#FFF2D6" stroke="#2E2824" strokeWidth="1.8" />
              <line x1="22" y1="2" x2="36" y2="-4" stroke="#8C4E28" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          )}

          {/* 7. Book */}
          {handProp === 'book' && (
            <g transform="translate(56, 86)">
              <polygon points="0,4 12,0 24,4 24,18 12,14 0,18" fill="#5C8299" stroke="#2E2824" strokeWidth="2.2" />
              <line x1="12" y1="0" x2="12" y2="14" stroke="#2E2824" strokeWidth="1.8" />
            </g>
          )}
        </svg>
      </div>

      {/* Hand-drawn hiragana caption (like "えーあいにゃん" in reference) */}
      {showCaption && (
        <p className="mt-1 text-center font-handwriting text-sm font-bold text-[#3E3833] tracking-wider select-none">
          {nyan.name}
        </p>
      )}
    </div>
  );
};
