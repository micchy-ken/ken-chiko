import React from 'react';
import { NyanCharacter } from '../types';
import { getNyanComposition } from '../utils/nyanAssetComposer';
import { loadLocalKihonNyanImage } from '../services/imageCompression';
import { getAssetUrl, ASSET_PATHS, handleImageError } from '../utils/assetPath';

interface NyanIllustrationProps {
  nyan: NyanCharacter;
  size?: number;
  className?: string;
  isDiscovered?: boolean;
  showCaption?: boolean;
  transparent?: boolean;
}

export const NyanIllustration: React.FC<NyanIllustrationProps> = ({
  nyan,
  size = 130,
  className = '',
  isDiscovered = true,
  showCaption = false,
  transparent = false,
}) => {
  // 1. If custom image URL is provided (e.g. from Google Drive or Spreadsheet)
  if (nyan.customImageUrl && isDiscovered) {
    const customSrc = getAssetUrl(nyan.customImageUrl);
    return (
      <div
        className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
        style={{ width: size }}
      >
        <div
          className={`relative w-full aspect-square flex items-center justify-center ${
            transparent
              ? ''
              : 'rounded-2xl overflow-hidden border border-[#C4BCAB]/60 bg-[#FAF8F4] shadow-sm'
          }`}
        >
          <img
            src={customSrc}
            alt={nyan.name}
            onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
            className={`select-none pointer-events-none ${
              transparent
                ? 'max-w-full max-h-full object-contain filter drop-shadow-[0_4px_12px_rgba(46,40,36,0.15)]'
                : 'w-full h-full object-cover'
            }`}
            referrerPolicy="no-referrer"
          />
        </div>
        {showCaption && (
          <p className="mt-1 text-center font-handwriting text-xs font-bold text-[#3E3833] tracking-wider select-none truncate max-w-full px-1">
            {nyan.name}
          </p>
        )}
      </div>
    );
  }

  // 2. Undiscovered Silhouette (Dashed paper card)
  if (!isDiscovered) {
    return (
      <div
        className={`relative inline-flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-dashed border-[#C4BCAB] bg-[#EFECE4] select-none ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" className="w-3/4 h-3/4 opacity-30" fill="#3E3833">
          <path d="M25 80 L25 45 L35 25 L45 42 Q50 40 55 40 Q60 40 65 42 L75 25 L85 45 L85 80 Q55 85 25 80 Z" />
          <circle cx="85" cy="75" r="8" />
        </svg>
        <span className="font-bold text-[#8A8177] text-xs mt-1 font-handwriting">未発見</span>
      </div>
    );
  }

  // 3. Fallback: Base authentic cat + decorative props
  const config = getNyanComposition(nyan);
  const { headProp, handProp, soundEffect } = config;
  const strokeColor = '#2E2824';

  const hasDecoration = headProp !== 'none' || handProp !== 'none' || Boolean(soundEffect);

  const rawBaseImage = loadLocalKihonNyanImage() || ASSET_PATHS.KIHON_NYAN_TRANSPARENT;
  const baseCatImage = getAssetUrl(rawBaseImage);

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: size }}
    >
      <div
        className={`relative w-full aspect-square flex items-center justify-center ${
          transparent
            ? ''
            : 'rounded-2xl overflow-hidden border border-[#C4BCAB]/50 bg-[#FAF8F5] shadow-sm'
        }`}
      >
        {/* Authentic Original Hand-Drawn Base Cat */}
        <img
          src={baseCatImage}
          alt={nyan.name}
          onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
          className={`select-none pointer-events-none max-w-full max-h-full object-contain ${
            transparent
              ? 'filter drop-shadow-[0_4px_12px_rgba(46,40,36,0.15)]'
              : 'filter drop-shadow-xs'
          }`}
        />

        {/* Decorative Overlay for ◯◯-nyan variations */}
        {hasDecoration && (
          <svg
            viewBox="0 0 700 700"
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* SOUND EFFECT / ONOMATOPOEIA */}
            {soundEffect && (
              <g opacity="0.92">
                <text
                  x="510"
                  y="180"
                  fontSize="36"
                  fontWeight="900"
                  fill="#4A443F"
                  className="font-handwriting select-none drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)]"
                  transform="rotate(6, 510, 180)"
                >
                  {soundEffect}
                </text>
              </g>
            )}

            {/* HEAD PROPS (Centered around x=350, y=170~250) */}
            {/* Hanpen / Oden */}
            {headProp === 'hanpen' && (
              <g transform="translate(315, 125)">
                <polygon
                  points="35,0 70,55 0,55"
                  fill="#FFFBF0"
                  stroke={strokeColor}
                  strokeWidth="8"
                  strokeLinejoin="round"
                />
                <circle cx="35" cy="36" r="6" fill="#D99B4E" opacity="0.8" />
                <line x1="35" y1="55" x2="35" y2="75" stroke="#8C5E35" strokeWidth="6" strokeLinecap="round" />
              </g>
            )}

            {/* Mikan (Orange with little green leaf) */}
            {headProp === 'mikan' && (
              <g transform="translate(320, 130)">
                <ellipse cx="30" cy="30" rx="26" ry="22" fill="#FFA534" stroke={strokeColor} strokeWidth="8" />
                <ellipse cx="30" cy="8" rx="8" ry="4" fill="#52945D" stroke={strokeColor} strokeWidth="4" />
                <circle cx="24" cy="24" r="3" fill="#FFFFFF" opacity="0.6" />
              </g>
            )}

            {/* Antenna (えーあいにゃん) */}
            {headProp === 'antenna' && (
              <g transform="translate(335, 110)">
                <line x1="15" y1="60" x2="15" y2="15" stroke={strokeColor} strokeWidth="8" strokeLinecap="round" />
                <circle cx="15" cy="15" r="12" fill="#5CCB7B" stroke={strokeColor} strokeWidth="7" />
                <line x1="0" y1="10" x2="-10" y2="5" stroke="#5CCB7B" strokeWidth="6" strokeLinecap="round" />
                <line x1="30" y1="10" x2="40" y2="5" stroke="#5CCB7B" strokeWidth="6" strokeLinecap="round" />
              </g>
            )}

            {/* Glasses (JINSにゃん) */}
            {headProp === 'glasses' && (
              <g transform="translate(285, 230)">
                <circle cx="30" cy="22" r="22" stroke={strokeColor} strokeWidth="7" fill="rgba(255,255,255,0.3)" />
                <circle cx="95" cy="22" r="22" stroke={strokeColor} strokeWidth="7" fill="rgba(255,255,255,0.3)" />
                <line x1="52" y1="22" x2="73" y2="22" stroke={strokeColor} strokeWidth="7" strokeLinecap="round" />
              </g>
            )}

            {/* Fever cooling patch */}
            {headProp === 'fever_patch' && (
              <g transform="translate(305, 205)">
                <rect
                  x="0"
                  y="0"
                  width="90"
                  height="36"
                  rx="8"
                  fill="#74B9FF"
                  stroke={strokeColor}
                  strokeWidth="7"
                  opacity="0.9"
                  transform="rotate(-2)"
                />
                <line x1="12" y1="18" x2="78" y2="18" stroke="#4A90E2" strokeWidth="4" strokeDasharray="6 4" />
              </g>
            )}

            {/* Chef hat */}
            {headProp === 'chef_hat' && (
              <g transform="translate(305, 95)">
                <rect x="15" y="60" width="60" height="20" fill="#FFFDF9" stroke={strokeColor} strokeWidth="7" />
                <path
                  d="M 15 60 C 0 50 0 20 25 15 C 35 -5 65 -5 75 15 C 95 20 95 50 75 60 Z"
                  fill="#FFFDF9"
                  stroke={strokeColor}
                  strokeWidth="7"
                />
              </g>
            )}

            {/* Scarf (寒波にゃん) */}
            {headProp === 'scarf' && (
              <g transform="translate(280, 290)">
                <path
                  d="M 10 15 Q 70 35 130 15 Q 120 40 70 42 Q 20 40 10 15 Z"
                  fill="#78B9DC"
                  stroke={strokeColor}
                  strokeWidth="8"
                />
                <rect x="90" y="32" width="28" height="55" rx="6" fill="#78B9DC" stroke={strokeColor} strokeWidth="7" />
              </g>
            )}

            {/* Headband / Hachimaki */}
            {headProp === 'headband' && (
              <g transform="translate(280, 200)">
                <path
                  d="M 10 12 Q 70 8 130 12"
                  stroke="#E84118"
                  strokeWidth="12"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="70" cy="10" r="7" fill="#FFF" />
              </g>
            )}

            {/* Straw / Mountain hat */}
            {headProp === 'straw_hat' && (
              <g transform="translate(275, 120)">
                <ellipse cx="75" cy="45" rx="72" ry="16" fill="#E6C280" stroke={strokeColor} strokeWidth="8" />
                <path d="M 35 45 C 35 15 115 15 115 45 Z" fill="#E6C280" stroke={strokeColor} strokeWidth="8" />
                <path d="M 36 42 Q 75 38 114 42" stroke="#D9534F" strokeWidth="6" fill="none" />
              </g>
            )}

            {/* Ribbon */}
            {headProp === 'ribbon' && (
              <g transform="translate(370, 140)">
                <circle cx="20" cy="20" r="8" fill="#FF7675" stroke={strokeColor} strokeWidth="6" />
                <polygon points="20,20 45,5 42,35" fill="#FF7675" stroke={strokeColor} strokeWidth="6" />
                <polygon points="20,20 -5,5 -2,35" fill="#FF7675" stroke={strokeColor} strokeWidth="6" />
              </g>
            )}

            {/* Flower */}
            {headProp === 'flower' && (
              <g transform="translate(375, 140)">
                <circle cx="15" cy="15" r="7" fill="#FDCB6E" stroke={strokeColor} strokeWidth="5" />
                <circle cx="5" cy="15" r="6" fill="#FF7675" stroke={strokeColor} strokeWidth="4" />
                <circle cx="25" cy="15" r="6" fill="#FF7675" stroke={strokeColor} strokeWidth="4" />
                <circle cx="15" cy="5" r="6" fill="#FF7675" stroke={strokeColor} strokeWidth="4" />
                <circle cx="15" cy="25" r="6" fill="#FF7675" stroke={strokeColor} strokeWidth="4" />
              </g>
            )}

            {/* HAND / FOREGROUND PROPS (Centered around x=350, y=380~440) */}
            {/* Taiyaki (たいやき) */}
            {handProp === 'taiyaki' && (
              <g transform="translate(290, 360)">
                <ellipse cx="60" cy="35" rx="48" ry="28" fill="#E29244" stroke={strokeColor} strokeWidth="8" />
                <polygon points="12,35 -15,15 -10,35 -15,55" fill="#E29244" stroke={strokeColor} strokeWidth="8" strokeLinejoin="round" />
                <circle cx="85" cy="26" r="4" fill={strokeColor} />
                <path d="M 40 22 Q 48 35 40 48" stroke="#B86C28" strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M 58 20 Q 66 35 58 50" stroke="#B86C28" strokeWidth="5" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* Pino box */}
            {handProp === 'pino_box' && (
              <g transform="translate(295, 380)">
                <rect x="0" y="0" width="105" height="60" rx="10" fill="#E84118" stroke={strokeColor} strokeWidth="8" />
                <text x="18" y="42" fontSize="30" fontWeight="bold" fill="#ffffff" fontFamily="sans-serif">
                  pino
                </text>
              </g>
            )}

            {/* Laptop (えーあいにゃん) */}
            {handProp === 'laptop' && (
              <g transform="translate(270, 385)">
                <polygon points="20,55 140,55 120,25 40,25" fill="#F5F6FA" stroke={strokeColor} strokeWidth="8" strokeLinejoin="round" />
                <polygon points="40,25 30,-25 110,-30 120,20" fill="#FFFFFF" stroke={strokeColor} strokeWidth="8" strokeLinejoin="round" />
                <circle cx="70" cy="-5" r="10" fill="#55EFC4" stroke="#00B894" strokeWidth="4" />
              </g>
            )}

            {/* Coffee mug */}
            {handProp === 'coffee' && (
              <g transform="translate(360, 375)">
                <rect x="0" y="0" width="50" height="60" rx="8" fill="#FFFDF9" stroke={strokeColor} strokeWidth="8" />
                <path d="M 50 15 Q 75 30 50 45" stroke={strokeColor} strokeWidth="8" fill="none" />
                <path d="M 18 -15 Q 24 -30 30 -15" stroke="#A4B0BE" strokeWidth="5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* Beer mug */}
            {handProp === 'beer' && (
              <g transform="translate(355, 360)">
                <rect x="0" y="20" width="55" height="70" rx="8" fill="#F1C40F" stroke={strokeColor} strokeWidth="8" />
                <rect x="0" y="0" width="55" height="26" rx="10" fill="#FFFFFF" stroke={strokeColor} strokeWidth="8" />
                <path d="M 55 30 Q 82 50 55 70" stroke={strokeColor} strokeWidth="8" fill="none" />
              </g>
            )}

            {/* Ramen bowl */}
            {handProp === 'ramen' && (
              <g transform="translate(290, 380)">
                <path d="M 10 25 Q 60 85 110 25 Z" fill="#D63031" stroke={strokeColor} strokeWidth="8" />
                <ellipse cx="60" cy="25" rx="50" ry="18" fill="#FFEAA7" stroke={strokeColor} strokeWidth="7" />
                <line x1="75" y1="10" x2="120" y2="-15" stroke="#634832" strokeWidth="7" strokeLinecap="round" />
              </g>
            )}

            {/* Sushi plate */}
            {handProp === 'sushi_plate' && (
              <g transform="translate(285, 395)">
                <ellipse cx="65" cy="40" rx="65" ry="24" fill="#F5F6FA" stroke={strokeColor} strokeWidth="8" />
                <ellipse cx="65" cy="30" rx="38" ry="14" fill="#E84118" stroke={strokeColor} strokeWidth="6" />
                <rect x="52" y="16" width="26" height="28" fill="#2D3436" />
              </g>
            )}

            {/* Onigiri */}
            {handProp === 'onigiri' && (
              <g transform="translate(315, 380)">
                <polygon points="35,0 0,60 70,60" fill="#FFFDF9" stroke={strokeColor} strokeWidth="8" strokeLinejoin="round" />
                <rect x="22" y="36" width="26" height="24" fill="#2D3436" rx="3" />
              </g>
            )}

            {/* Bread */}
            {handProp === 'bread' && (
              <g transform="translate(310, 380)">
                <ellipse cx="40" cy="25" rx="38" ry="22" fill="#E67E22" stroke={strokeColor} strokeWidth="8" />
                <line x1="25" y1="18" x2="35" y2="32" stroke="#FFF" strokeWidth="4" strokeLinecap="round" />
                <line x1="45" y1="18" x2="55" y2="32" stroke="#FFF" strokeWidth="4" strokeLinecap="round" />
              </g>
            )}

            {/* Cardboard shield */}
            {handProp === 'cardboard_shield' && (
              <g transform="translate(345, 360)">
                <polygon points="35,0 70,25 55,75 15,75 0,25" fill="#D3A264" stroke={strokeColor} strokeWidth="8" strokeLinejoin="round" />
                <line x1="15" y1="20" x2="55" y2="60" stroke="#8C5E35" strokeWidth="5" />
              </g>
            )}

            {/* Book */}
            {handProp === 'book' && (
              <g transform="translate(300, 385)">
                <polygon points="0,15 45,0 90,15 90,65 45,50 0,65" fill="#0984E3" stroke={strokeColor} strokeWidth="8" strokeLinejoin="round" />
                <line x1="45" y1="0" x2="45" y2="50" stroke={strokeColor} strokeWidth="6" />
              </g>
            )}

            {/* Shopping bag */}
            {handProp === 'shopping_bag' && (
              <g transform="translate(355, 380)">
                <rect x="0" y="15" width="55" height="60" rx="8" fill="#E84393" stroke={strokeColor} strokeWidth="8" />
                <path d="M 15 15 Q 27 -10 40 15" stroke={strokeColor} strokeWidth="7" fill="none" />
              </g>
            )}
          </svg>
        )}
      </div>

      {showCaption && (
        <p className="mt-1.5 text-center font-handwriting text-xs font-bold text-[#3E3833] tracking-wider select-none truncate max-w-full px-1">
          {nyan.name}
        </p>
      )}
    </div>
  );
};
