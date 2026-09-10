import React from 'react';
import { KounichanVehicleId, KounichanVehicleConfig } from '../../types/kounichan';
import { getAssetUrl, handleImageError } from '../../utils/assetPath';

interface KounichanVehicleIllustrationProps {
  vehicle: KounichanVehicleConfig;
  size?: number;
  isDashing?: boolean;
  direction?: 'ltr' | 'rtl'; // Left to right or Right to left
  className?: string;
  showOnomatopoeiaBadge?: boolean;
}

export const KounichanVehicleIllustration: React.FC<KounichanVehicleIllustrationProps> = ({
  vehicle,
  size = 140,
  isDashing = false,
  direction = 'ltr',
  className = '',
  showOnomatopoeiaBadge = false,
}) => {
  const isFlipped = direction === 'rtl';

  // If custom user image exists (sliced PNG or uploaded image)
  if (vehicle.customImageUrl) {
    return (
      <div
        className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
        style={{ width: size }}
      >
        <div
          className={`relative w-full flex items-center justify-center transition-transform duration-200 ${
            isFlipped ? '-scale-x-100' : 'scale-x-100'
          }`}
        >
          <img
            src={getAssetUrl(vehicle.customImageUrl)}
            alt={`${vehicle.name}に乗るこうにちゃん`}
            onError={(e) => handleImageError(e, '')}
            className="w-full h-auto max-h-[160px] object-contain filter drop-shadow-[0_4px_8px_rgba(46,40,36,0.18)] pointer-events-none"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    );
  }

  // Fallback high-fidelity SVG sketches matching the user's authentic art style
  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: size }}
    >
      <div
        className={`relative w-full flex items-center justify-center transition-transform duration-200 ${
          isFlipped ? '-scale-x-100' : 'scale-x-100'
        }`}
      >
        {renderSvgVehicle(vehicle.id, size, isDashing)}
      </div>

      {showOnomatopoeiaBadge && (
        <div className="absolute -bottom-4 bg-[#FFFDF9] border border-[#2E2824] px-2 py-0.5 rounded-full text-[10px] font-bold font-handwriting shadow-xs text-[#2E2824] whitespace-nowrap">
          {vehicle.onomatopoeia}
        </div>
      )}
    </div>
  );
};

function renderSvgVehicle(id: KounichanVehicleId, size: number, isDashing: boolean) {
  switch (id) {
    case 'tricycle_turbo':
      return (
        <svg viewBox="0 0 160 130" className="w-full h-auto drop-shadow-md">
          {/* Exhaust turbo lines if dashing */}
          {isDashing && (
            <g opacity="0.8">
              <path d="M 15 85 Q 0 85 5 95" stroke="#E05B48" strokeWidth="2.5" fill="none" />
              <path d="M 22 75 Q 5 72 10 80" stroke="#F59E0B" strokeWidth="2" fill="none" />
              <text x="5" y="65" fill="#E05B48" fontSize="12" fontWeight="bold" fontFamily="sans-serif">ばびゅーん！</text>
            </g>
          )}

          {/* Rear Wheels */}
          <ellipse cx="32" cy="98" rx="14" ry="14" fill="#3E3833" />
          <ellipse cx="32" cy="98" rx="8" ry="8" fill="#EAE5D9" stroke="#3E3833" strokeWidth="1.5" />
          <ellipse cx="45" cy="100" rx="11" ry="11" fill="#4A423B" opacity="0.5" />

          {/* Tricycle Red Frame */}
          <path d="M 32 98 L 75 88 L 108 55 L 115 42" stroke="#C8483B" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 75 88 L 115 102" stroke="#C8483B" strokeWidth="4.5" strokeLinecap="round" />
          {/* Seat */}
          <path d="M 52 75 C 60 70, 85 70, 92 78 C 88 84, 58 84, 52 75 Z" fill="#B3392E" stroke="#2E2824" strokeWidth="2" />

          {/* Front Wheel & Fork */}
          <path d="M 115 42 L 122 100" stroke="#8A8177" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="122" cy="100" rx="19" ry="19" fill="#2E2824" />
          <ellipse cx="122" cy="100" rx="12" ry="12" fill="#FAF8F4" stroke="#2E2824" strokeWidth="2" />
          <circle cx="122" cy="100" r="4" fill="#C8483B" />
          {/* Pedals */}
          <path d="M 122 100 L 130 108" stroke="#3E3833" strokeWidth="3" />
          <rect x="127" y="106" width="8" height="4" rx="1" fill="#E47062" />

          {/* Handlebars */}
          <path d="M 108 44 Q 115 35 125 40" stroke="#7A726A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <ellipse cx="106" cy="45" rx="3.5" ry="3.5" fill="#FAF8F4" stroke="#2E2824" strokeWidth="1.5" />

          {/* Kouni-chan Rider (Toddler, Overalls) */}
          {/* Legs pedaling */}
          <path d="M 75 75 Q 95 85 124 104" stroke="#4A6572" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          {/* Shoes */}
          <ellipse cx="128" cy="107" rx="6" ry="4" fill="#C8483B" stroke="#2E2824" strokeWidth="1.2" />

          {/* Body / Overalls */}
          <path d="M 68 55 C 68 45, 86 45, 88 56 L 85 78 L 68 78 Z" fill="#546E7A" stroke="#2E2824" strokeWidth="2" />
          {/* White inner shirt sleeve */}
          <ellipse cx="78" cy="52" rx="7" ry="7" fill="#FFFDF9" stroke="#2E2824" strokeWidth="1.5" />
          {/* Arms reaching to handlebars */}
          <path d="M 76 52 L 106 45" stroke="#F5D0B5" strokeWidth="7" strokeLinecap="round" />
          <ellipse cx="106" cy="45" rx="4" ry="4" fill="#F5D0B5" stroke="#2E2824" strokeWidth="1.2" />

          {/* Head & Cute Face */}
          <circle cx="80" cy="30" r="16" fill="#FCE5D4" stroke="#2E2824" strokeWidth="2" />
          {/* Bob cut hair */}
          <path d="M 65 30 C 64 12, 96 12, 95 30 C 95 38, 93 42, 90 44 C 88 32, 72 32, 69 44 C 66 41, 65 36, 65 30 Z" fill="#2E2824" />
          {/* Bangs */}
          <path d="M 70 24 Q 80 28 90 24" stroke="#2E2824" strokeWidth="2" fill="none" />
          {/* Eyes & Smile */}
          <circle cx="85" cy="30" r="2.2" fill="#2E2824" />
          <ellipse cx="89" cy="34" rx="2.5" ry="1.5" fill="#F48FB1" opacity="0.7" />
          <path d="M 83 36 Q 87 39 90 35" stroke="#2E2824" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      );

    case 'koyumi_2':
      return (
        <svg viewBox="0 0 160 130" className="w-full h-auto drop-shadow-md">
          {/* Weathered / Retro Tricycle (Koyumi 2) */}
          {/* Extra stabilizer support wheels */}
          <ellipse cx="28" cy="98" rx="10" ry="10" fill="#6B6258" stroke="#3E3833" strokeWidth="1.5" />
          <ellipse cx="44" cy="102" rx="8" ry="8" fill="#544B42" stroke="#3E3833" strokeWidth="1.2" />
          <path d="M 28 98 L 48 90" stroke="#8C7A6B" strokeWidth="3" />

          {/* Aged Bronze Frame */}
          <path d="M 44 92 L 72 82 L 102 54 L 108 42" stroke="#7A5C43" strokeWidth="5" strokeLinecap="round" />
          <path d="M 72 82 L 108 98" stroke="#7A5C43" strokeWidth="4" strokeLinecap="round" />
          {/* Vintage Spring Seat */}
          <path d="M 52 74 C 58 68, 80 68, 86 75 C 80 81, 56 80, 52 74 Z" fill="#5C4028" stroke="#2E2824" strokeWidth="1.8" />
          <path d="M 68 76 L 68 83" stroke="#3E3833" strokeWidth="2.5" />

          {/* Front Wheel */}
          <path d="M 108 42 L 115 98" stroke="#63584E" strokeWidth="4" />
          <ellipse cx="115" cy="98" rx="18" ry="18" fill="#423932" stroke="#2E2824" strokeWidth="2" />
          <ellipse cx="115" cy="98" rx="10" ry="10" fill="#BDB3A6" stroke="#3E3833" strokeWidth="1.5" />
          {/* Spokes */}
          <line x1="115" y1="80" x2="115" y2="116" stroke="#7D756D" strokeWidth="1" />
          <line x1="97" y1="98" x2="133" y2="98" stroke="#7D756D" strokeWidth="1" />

          {/* Rusted Handlebars */}
          <path d="M 100 44 Q 106 36 116 40" stroke="#5E4B3C" strokeWidth="3.5" fill="none" strokeLinecap="round" />

          {/* Kouni-chan in White Tee and Denim */}
          <path d="M 72 72 Q 88 80 116 102" stroke="#37474F" strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="120" cy="105" rx="5" ry="3.5" fill="#8D6E63" />

          <path d="M 66 52 C 66 42, 82 42, 84 53 L 80 74 L 66 74 Z" fill="#FAF8F5" stroke="#2E2824" strokeWidth="2" />
          {/* Arms */}
          <path d="M 74 52 L 100 44" stroke="#FCE5D4" strokeWidth="6" strokeLinecap="round" />

          {/* Head & Smile */}
          <circle cx="78" cy="28" r="15" fill="#FCE5D4" stroke="#2E2824" strokeWidth="2" />
          <path d="M 63 28 C 62 12, 92 12, 91 28 C 91 36, 88 40, 86 42 C 84 32, 70 32, 67 42 C 64 39, 63 34, 63 28 Z" fill="#2E2824" />
          <circle cx="82" cy="28" r="2.2" fill="#2E2824" />
          <path d="M 80 34 Q 84 37 87 33" stroke="#2E2824" strokeWidth="1.5" fill="none" />
        </svg>
      );

    case 'four_wheeler':
      return (
        <svg viewBox="0 0 160 130" className="w-full h-auto drop-shadow-md">
          {/* Blue 4-Wheeler Car (Burunrun) */}
          {/* Rear Wheel */}
          <ellipse cx="38" cy="100" rx="14" ry="14" fill="#37474F" stroke="#263238" strokeWidth="2" />
          <ellipse cx="38" cy="100" rx="6" ry="6" fill="#CFD8DC" />

          {/* Front Wheel */}
          <ellipse cx="118" cy="100" rx="14" ry="14" fill="#37474F" stroke="#263238" strokeWidth="2" />
          <ellipse cx="118" cy="100" rx="6" ry="6" fill="#CFD8DC" />

          {/* Blue Car Body */}
          <path
            d="M 22 92 L 20 68 Q 22 62 30 62 L 60 62 L 78 48 L 125 54 Q 135 56 138 66 L 140 92 Q 138 96 128 96 L 26 96 Z"
            fill="#5D9CEC"
            stroke="#2E2824"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Car Front Grill / Headlights */}
          <ellipse cx="132" cy="72" rx="4" ry="5" fill="#FFF9C4" stroke="#2E2824" strokeWidth="1.5" />
          <ellipse cx="120" cy="74" rx="3.5" ry="4.5" fill="#FFF9C4" stroke="#2E2824" strokeWidth="1.2" />

          {/* Windshield bar */}
          <path d="M 82 48 L 86 34 L 106 36 L 102 50" stroke="#3E3833" strokeWidth="3" fill="none" strokeLinejoin="round" />
          {/* Steering wheel */}
          <ellipse cx="94" cy="46" rx="8" ry="4" fill="none" stroke="#2E2824" strokeWidth="3" />

          {/* Beaming Joyful Kouni-chan Sitting Inside */}
          <path d="M 64 54 C 64 45, 82 45, 84 54 L 84 66 L 64 66 Z" fill="#FAF8F5" stroke="#2E2824" strokeWidth="2" />
          {/* Hands on steering wheel */}
          <ellipse cx="90" cy="48" rx="4" ry="4" fill="#FCE5D4" stroke="#2E2824" strokeWidth="1.2" />
          <ellipse cx="98" cy="48" rx="4" ry="4" fill="#FCE5D4" stroke="#2E2824" strokeWidth="1.2" />

          {/* Head - Beaming smile */}
          <circle cx="74" cy="30" r="16" fill="#FCE5D4" stroke="#2E2824" strokeWidth="2" />
          <path d="M 59 30 C 58 12, 89 12, 88 30 C 88 38, 86 42, 84 44 C 82 32, 68 32, 65 44 C 62 41, 61 36, 59 30 Z" fill="#2E2824" />
          {/* Happy Eyes (Arc ^_^) */}
          <path d="M 72 28 Q 75 25 78 28" stroke="#2E2824" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 80 28 Q 83 25 86 28" stroke="#2E2824" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Big toothy grin */}
          <path d="M 73 34 Q 79 41 85 34 Z" fill="#FFFDF9" stroke="#2E2824" strokeWidth="1.8" />
          <ellipse cx="69" cy="33" rx="3" ry="1.8" fill="#F48FB1" opacity="0.8" />
          <ellipse cx="88" cy="33" rx="3" ry="1.8" fill="#F48FB1" opacity="0.8" />
        </svg>
      );

    case 'dendrobium':
      return (
        <svg viewBox="0 0 170 140" className="w-full h-auto drop-shadow-lg">
          {/* Steampunk / Mecha Dendrobium successor */}
          {/* Smoke puffs */}
          <circle cx="130" cy="20" r="7" fill="#E0D7C8" opacity="0.8" />
          <circle cx="140" cy="14" r="9" fill="#EAE5D9" opacity="0.6" />

          {/* Caterpillar / Heavy Wheels */}
          <rect x="25" y="104" width="115" height="18" rx="8" fill="#37474F" stroke="#212121" strokeWidth="2" />
          <circle cx="38" cy="113" r="6" fill="#78909C" />
          <circle cx="60" cy="113" r="6" fill="#78909C" />
          <circle cx="82" cy="113" r="6" fill="#78909C" />
          <circle cx="104" cy="113" r="6" fill="#78909C" />
          <circle cx="126" cy="113" r="6" fill="#78909C" />

          {/* Heavy Armored Body */}
          <path
            d="M 30 104 L 35 60 Q 40 40 60 38 L 105 38 Q 120 40 126 60 L 132 104 Z"
            fill="#8D6E63"
            stroke="#2E2824"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Big Glowing Turbine / Searchlight on the front */}
          <circle cx="45" cy="85" r="16" fill="#FFB74D" stroke="#2E2824" strokeWidth="2.5" />
          <circle cx="45" cy="85" r="10" fill="#FFF3E0" />
          <circle cx="45" cy="85" r="4" fill="#FFFFFF" />

          {/* Missile Pods on Side */}
          <g transform="translate(112, 52)">
            <rect x="0" y="0" width="28" height="28" rx="4" fill="#5D4037" stroke="#2E2824" strokeWidth="2" />
            <circle cx="7" cy="7" r="3.5" fill="#D32F2F" />
            <circle cx="21" cy="7" r="3.5" fill="#D32F2F" />
            <circle cx="7" cy="21" r="3.5" fill="#D32F2F" />
            <circle cx="21" cy="21" r="3.5" fill="#D32F2F" />
          </g>

          {/* Exhaust Chimney pipe */}
          <path d="M 118 38 L 122 22 L 128 22 L 126 38 Z" fill="#4E342E" stroke="#2E2824" strokeWidth="2" />

          {/* Cockpit Window */}
          <rect x="62" y="48" width="40" height="34" rx="6" fill="#CFD8DC" stroke="#2E2824" strokeWidth="2.5" opacity="0.9" />

          {/* Pilot Kouni-chan inside */}
          <circle cx="82" cy="62" r="11" fill="#FCE5D4" />
          <path d="M 72 62 C 72 50, 92 50, 92 62 C 92 68, 90 71, 88 72 C 86 64, 76 64, 74 72 Z" fill="#2E2824" />
          {/* Eyes & Grin */}
          <circle cx="84" cy="62" r="1.8" fill="#2E2824" />
          <path d="M 82 66 Q 85 69 88 66" stroke="#2E2824" strokeWidth="1.4" fill="none" />
          {/* Hands holding mecha control levers */}
          <path d="M 70 78 L 76 72" stroke="#2E2824" strokeWidth="2" />
          <circle cx="70" cy="78" r="2.5" fill="#D32F2F" />
        </svg>
      );

    case 'space_trike':
      return (
        <svg viewBox="0 0 160 130" className="w-full h-auto drop-shadow-md">
          {/* Space Trike (High-tech, astronaut canopy) */}
          {/* Glowing Jet Plasma Thruster behind */}
          <path d="M 28 80 Q 0 85 8 96 Q 25 90 32 86 Z" fill="#00E5FF" opacity="0.8" />
          <path d="M 22 83 Q 8 86 14 93 Q 22 90 28 86 Z" fill="#FFFFFF" />

          {/* Rear wheel with neon cyan ring */}
          <ellipse cx="40" cy="98" rx="14" ry="14" fill="#263238" stroke="#37474F" strokeWidth="2" />
          <ellipse cx="40" cy="98" rx="9" ry="9" fill="none" stroke="#00E5FF" strokeWidth="2.5" />

          {/* Futuristic White Body Frame */}
          <path
            d="M 38 88 L 65 84 L 95 64 L 115 64 L 126 95 L 42 95 Z"
            fill="#ECEFF1"
            stroke="#37474F"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Blue stripe detail */}
          <path d="M 70 82 L 105 68 L 115 68" stroke="#0288D1" strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* Front Streamlined Wheel */}
          <ellipse cx="124" cy="96" rx="15" ry="15" fill="#263238" stroke="#37474F" strokeWidth="2" />
          <ellipse cx="124" cy="96" rx="8" ry="8" fill="none" stroke="#00E5FF" strokeWidth="2" />

          {/* Transparent Bubble Canopy */}
          <path
            d="M 58 80 C 55 35, 105 35, 110 80 Z"
            fill="#B2EBF2"
            stroke="#00ACC1"
            strokeWidth="2"
            opacity="0.65"
          />
          {/* Canopy reflection glint */}
          <path d="M 68 55 Q 85 42 98 48" stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />

          {/* Kouni-chan in Space Suit with Helmet */}
          <circle cx="82" cy="58" r="14" fill="#FFFFFF" stroke="#0288D1" strokeWidth="2" />
          {/* Helmet Glass Visor */}
          <ellipse cx="85" cy="58" rx="9" ry="9" fill="#E0F7FA" stroke="#0097A7" strokeWidth="1.2" />
          {/* Face inside helmet */}
          <circle cx="85" cy="58" r="7" fill="#FCE5D4" />
          <circle cx="87" cy="57" r="1.6" fill="#2E2824" />
          <path d="M 85 61 Q 88 63 90 60" stroke="#2E2824" strokeWidth="1.2" fill="none" />
        </svg>
      );

    case 'aqua_yakkun':
      return (
        <svg viewBox="0 0 170 120" className="w-full h-auto drop-shadow-md">
          {/* Toyota Aqua 'Yakkun' (White compact hatchback) */}
          {/* Wheels */}
          <ellipse cx="44" cy="92" rx="14" ry="14" fill="#37474F" stroke="#263238" strokeWidth="2" />
          <ellipse cx="44" cy="92" rx="7" ry="7" fill="#ECEFF1" stroke="#90A4AE" strokeWidth="1.5" />

          <ellipse cx="132" cy="92" rx="14" ry="14" fill="#37474F" stroke="#263238" strokeWidth="2" />
          <ellipse cx="132" cy="92" rx="7" ry="7" fill="#ECEFF1" stroke="#90A4AE" strokeWidth="1.5" />

          {/* White Car Body */}
          <path
            d="M 22 84 L 20 66 Q 24 50 48 42 L 88 38 Q 116 38 135 56 L 152 68 Q 158 74 156 84 L 152 88 L 144 88 Q 140 80 132 80 Q 124 80 120 88 L 56 88 Q 52 80 44 80 Q 36 80 32 88 L 22 88 Z"
            fill="#FFFFFF"
            stroke="#2E2824"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Aqua Aerodynamic Roof & Windows */}
          <path
            d="M 48 44 L 84 40 L 84 60 L 40 60 Z"
            fill="#CFD8DC"
            stroke="#2E2824"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M 88 40 L 118 46 L 132 58 L 88 58 Z"
            fill="#ECEFF1"
            stroke="#2E2824"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Front Headlights */}
          <path d="M 145 64 Q 154 68 152 74 L 140 72 Z" fill="#FFF9C4" stroke="#2E2824" strokeWidth="1.5" />
          {/* Door line */}
          <line x1="86" y1="40" x2="86" y2="88" stroke="#90A4AE" strokeWidth="1.5" />

          {/* Side Mirror */}
          <ellipse cx="118" cy="56" rx="4" ry="3" fill="#FFFFFF" stroke="#2E2824" strokeWidth="1.5" />

          {/* Kouni-chan leaning out of front passenger window waving! */}
          <path d="M 94 58 C 94 48, 108 48, 110 58 Z" fill="#FAF8F5" stroke="#2E2824" strokeWidth="1.5" />
          <circle cx="102" cy="48" r="10" fill="#FCE5D4" stroke="#2E2824" strokeWidth="1.6" />
          <path d="M 92 48 C 91 38, 112 38, 111 48 C 111 53, 109 56, 108 58 C 106 50, 96 50, 94 58 Z" fill="#2E2824" />
          <circle cx="104" cy="48" r="1.6" fill="#2E2824" />
          <path d="M 102 52 Q 105 55 107 52" stroke="#2E2824" strokeWidth="1.2" fill="none" />
          {/* Waving little hand outside */}
          <ellipse cx="114" cy="50" rx="3" ry="3" fill="#FCE5D4" stroke="#2E2824" strokeWidth="1" />
        </svg>
      );

    default:
      return null;
  }
}
