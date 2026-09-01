import React from 'react';
import { ActivityType, TransportMethod } from '../types';

interface KenchikoFigureProps {
  activity: ActivityType;
  transportMethod: TransportMethod | null;
  mood?: string;
  className?: string;
  size?: number;
}

export const KenchikoFigure: React.FC<KenchikoFigureProps> = ({
  activity,
  transportMethod,
  className = '',
  size = 200,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-sm overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Definitions for textures and gradients */}
        <defs>
          <linearGradient id="kenchikoSweater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9BD5F0" />
            <stop offset="100%" stopColor="#78B9DC" />
          </linearGradient>
          <linearGradient id="kenchikoSkin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF2EB" />
            <stop offset="100%" stopColor="#FEE3D8" />
          </linearGradient>
        </defs>

        {/* Transit Mode: Bicycle */}
        {activity === 'transit' && transportMethod === 'bicycle' && (
          <g className="animate-bounce" style={{ animationDuration: '0.6s' }}>
            {/* Bicycle Frame */}
            <circle cx="50" cy="155" r="24" stroke="#262626" strokeWidth="4" />
            <circle cx="150" cy="155" r="24" stroke="#262626" strokeWidth="4" />
            <circle cx="50" cy="155" r="5" fill="#262626" />
            <circle cx="150" cy="155" r="5" fill="#262626" />
            <path
              d="M50 155 L90 155 L130 115 L70 115 Z"
              stroke="#262626"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d="M90 155 L85 105" stroke="#262626" strokeWidth="4" strokeLinecap="round" />
            {/* Saddle */}
            <path d="M75 105 Q85 102 95 105" stroke="#262626" strokeWidth="6" strokeLinecap="round" />
            {/* Handlebar */}
            <path d="M130 115 L140 85 L130 80 M140 85 L150 82" stroke="#262626" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}

        {/* Transit Mode: Car */}
        {activity === 'transit' && transportMethod === 'car' && (
          <g className="animate-bounce" style={{ animationDuration: '0.8s' }}>
            {/* Cute Box Car */}
            <path
              d="M30 150 L170 150 Q180 150 180 135 L175 110 Q170 95 140 90 L80 90 Q50 95 40 115 L30 130 Z"
              fill="#fef3c7"
              stroke="#262626"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <rect x="60" y="98" width="35" height="22" rx="4" fill="#ffffff" stroke="#262626" strokeWidth="3" />
            <rect x="105" y="98" width="40" height="22" rx="4" fill="#ffffff" stroke="#262626" strokeWidth="3" />
            {/* Headlight */}
            <circle cx="172" cy="130" r="5" fill="#fbbf24" stroke="#262626" strokeWidth="2" />
            {/* Wheels */}
            <circle cx="65" cy="155" r="16" fill="#404040" stroke="#262626" strokeWidth="4" />
            <circle cx="65" cy="155" r="5" fill="#f5f5f5" />
            <circle cx="145" cy="155" r="16" fill="#404040" stroke="#262626" strokeWidth="4" />
            <circle cx="145" cy="155" r="5" fill="#f5f5f5" />
          </g>
        )}

        {/* Transit Mode: Jinbei-nyan Cloud Flight */}
        {activity === 'transit' && transportMethod === 'jinbei_nyan' && (
          <g className="animate-pulse" style={{ animationDuration: '2s' }}>
            {/* Cloud shape */}
            <path
              d="M40 160 Q30 140 50 135 Q60 115 90 120 Q110 105 135 120 Q160 115 170 135 Q185 145 175 160 Z"
              fill="#e0f2fe"
              stroke="#0284c7"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text x="145" y="152" fontSize="16">🐱</text>
            <text x="165" y="140" fontSize="12" fill="#0369a1" fontWeight="bold">じんべえ</text>
          </g>
        )}

        {/* Kenchiko Figure */}
        {activity === 'nap' ? (
          /* Sleeping / Snoozing Kenchiko with iconic bangs & nightstand glasses */
          <g transform="translate(10, 20)">
            {/* Blanket / Mat */}
            <rect x="20" y="125" width="140" height="35" rx="10" fill="#9BD5F0" stroke="#1F2937" strokeWidth="3.5" />
            <path d="M20 135 Q90 145 160 135" stroke="#78B9DC" strokeWidth="2.5" strokeDasharray="6 6" />
            {/* Pillow */}
            <rect x="25" y="105" width="38" height="26" rx="8" fill="#ffffff" stroke="#1F2937" strokeWidth="3" />
            
            {/* Head lying down */}
            <ellipse cx="46" cy="100" rx="22" ry="19" fill="url(#kenchikoSkin)" stroke="#1F2937" strokeWidth="3.5" />
            
            {/* Signature Dark Straight Bangs Hair */}
            <path
              d="M26 95 C25 80 66 80 66 94 C60 90 55 93 48 90 C42 93 35 91 26 95 Z"
              fill="#181B22"
              stroke="#181B22"
              strokeWidth="1.5"
            />
            
            {/* Sleeping relaxed eyes */}
            <path d="M38 102 Q44 107 48 102" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
            
            {/* Signature Pouty Wavy Sleeping Mouth */}
            <path d="M48 110 Q51 108 54 110" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            
            {/* Cheeks blush */}
            <circle cx="36" cy="108" r="4" fill="#FCA5A5" opacity="0.6" />
            
            {/* Glasses folded neatly on nightstand */}
            <g transform="translate(70, 110)">
              <rect x="0" y="0" width="14" height="11" rx="2.5" stroke="#1A202C" strokeWidth="2" fill="#E2E8F0" opacity="0.8" />
              <rect x="17" y="0" width="14" height="11" rx="2.5" stroke="#1A202C" strokeWidth="2" fill="#E2E8F0" opacity="0.8" />
              <line x1="14" y1="5" x2="17" y2="5" stroke="#1A202C" strokeWidth="2" />
            </g>

            {/* Snooze Zzz */}
            <g className="animate-bounce" style={{ animationDuration: '2s' }}>
              <text x="80" y="70" fontSize="20" fontWeight="900" fill="#0284c7" fontFamily="sans-serif">
                Z
              </text>
              <text x="98" y="52" fontSize="15" fontWeight="900" fill="#38bdf8" fontFamily="sans-serif">
                z
              </text>
              <text x="112" y="38" fontSize="11" fontWeight="900" fill="#7dd3fc" fontFamily="sans-serif">
                z
              </text>
            </g>
          </g>
        ) : (
          /* Upright / Active Kenchiko matching the uploaded photo */
          <g transform={activity === 'transit' && transportMethod === 'bicycle' ? 'translate(0, -10)' : 'translate(0, 0)'}>
            {/* Shadow */}
            <ellipse cx="100" cy="182" rx="34" ry="6" fill="#D6D0C5" />

            {/* Legs */}
            <path
              d={
                activity === 'transit'
                  ? 'M86 148 L80 176 M114 148 L120 176'
                  : 'M88 148 L88 176 M112 148 L112 176'
              }
              stroke="#1F2937"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Shoes */}
            <ellipse cx="86" cy="177" rx="9" ry="4.5" fill="#4B5563" stroke="#1F2937" strokeWidth="2" />
            <ellipse cx="114" cy="177" rx="9" ry="4.5" fill="#4B5563" stroke="#1F2937" strokeWidth="2" />

            {/* Torso / Signature Sky-Blue Knit Sweater */}
            <path
              d="M72 96 Q62 144 76 148 L124 148 Q138 144 128 96 Z"
              fill="url(#kenchikoSweater)"
              stroke="#1F2937"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {/* Sweater Knit Texture Detail & Collar */}
            <path d="M88 96 Q100 106 112 96" stroke="#1F2937" strokeWidth="3" fill="#E0F2FE" strokeLinecap="round" />
            <path d="M80 142 L120 142" stroke="#68A5C6" strokeWidth="2" strokeDasharray="3 3" />

            {/* Arms */}
            {activity === 'snacking' ? (
              // Holding snack to mouth
              <g>
                <path d="M72 108 Q84 116 94 106" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />
                <path d="M128 108 Q116 118 106 106" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />
                {/* Snack item in hands */}
                <circle cx="100" cy="104" r="7.5" fill="#B45309" stroke="#1F2937" strokeWidth="2" />
                <path d="M96 101 L104 101" stroke="#FEF08A" strokeWidth="2" />
              </g>
            ) : (
              <g>
                <path d="M72 105 Q60 125 68 135" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />
                <path d="M128 105 Q140 125 132 135" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />
                {/* Hands */}
                <circle cx="68" cy="135" r="4.5" fill="#FFF2EB" stroke="#1F2937" strokeWidth="2" />
                <circle cx="132" cy="135" r="4.5" fill="#FFF2EB" stroke="#1F2937" strokeWidth="2" />
              </g>
            )}

            {/* Head (Chubby & Endearing Oval) */}
            <ellipse cx="100" cy="65" rx="30" ry="32" fill="url(#kenchikoSkin)" stroke="#1F2937" strokeWidth="3.5" />

            {/* Cheeks Blush */}
            <ellipse cx="76" cy="74" rx="6" ry="4" fill="#FCA5A5" opacity="0.6" />
            <ellipse cx="124" cy="74" rx="6" ry="4" fill="#FCA5A5" opacity="0.6" />

            {/* Droopy Eyebrows above glasses */}
            <path d="M77 44 Q84 48 91 50" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M109 50 Q116 48 123 44" stroke="#1F2937" strokeWidth="2.8" strokeLinecap="round" />

            {/* Eyes (Iconic Droopy / Melancholic Puppy Eyes) */}
            {activity === 'snacking' ? (
              // Joyful munching crescent eyes
              <g>
                <path d="M78 61 Q85 54 92 61" stroke="#1F2937" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M108 61 Q115 54 122 61" stroke="#1F2937" strokeWidth="3.5" strokeLinecap="round" />
              </g>
            ) : (
              // The exact signature droopy eyes from the photo
              <g>
                {/* Left Eye */}
                {/* Droopy Upper Eyelid */}
                <path d="M77 58 C80 54 89 57 93 62" stroke="#1F2937" strokeWidth="3.2" strokeLinecap="round" />
                {/* Pupil */}
                <ellipse cx="85" cy="62" rx="4" ry="4.5" fill="#181B22" />
                {/* Pupil Light Glint */}
                <circle cx="83.5" cy="60.5" r="1.3" fill="#FFFFFF" />
                {/* Lower Droopy Under-Eye Line */}
                <path d="M78 66 Q85 69 92 65" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" />

                {/* Right Eye */}
                {/* Droopy Upper Eyelid */}
                <path d="M107 62 C111 57 120 54 123 58" stroke="#1F2937" strokeWidth="3.2" strokeLinecap="round" />
                {/* Pupil */}
                <ellipse cx="115" cy="62" rx="4" ry="4.5" fill="#181B22" />
                {/* Pupil Light Glint */}
                <circle cx="113.5" cy="60.5" r="1.3" fill="#FFFFFF" />
                {/* Lower Droopy Under-Eye Line */}
                <path d="M108 65 Q115 69 122 66" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            )}

            {/* Signature Dark Rectangular Eyeglasses */}
            <g>
              {/* Left Lens Frame */}
              <rect
                x="73"
                y="50"
                width="22"
                height="19"
                rx="4.5"
                stroke="#1A202C"
                strokeWidth="3.5"
                fill="none"
              />
              {/* Right Lens Frame */}
              <rect
                x="105"
                y="50"
                width="22"
                height="19"
                rx="4.5"
                stroke="#1A202C"
                strokeWidth="3.5"
                fill="none"
              />
              {/* Glasses Center Bridge */}
              <line x1="95" y1="58" x2="105" y2="58" stroke="#1A202C" strokeWidth="3.8" strokeLinecap="round" />
              {/* Glasses Side Temple Hinges */}
              <line x1="68" y1="58" x2="73" y2="58" stroke="#1A202C" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="127" y1="58" x2="132" y2="58" stroke="#1A202C" strokeWidth="3.5" strokeLinecap="round" />
              {/* Subtle Lens Glare Reflection */}
              <line x1="76" y1="53" x2="81" y2="53" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              <line x1="108" y1="53" x2="113" y2="53" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            </g>

            {/* Cute Small Nose under glasses bridge */}
            <g>
              <ellipse cx="100" cy="69" rx="3.5" ry="3" fill="#F87171" opacity="0.6" />
              <path d="M98 70 Q100 72 102 70" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Signature Wavy / Pouty Lips from the photo */}
            {activity === 'snacking' ? (
              // Munching open mouth
              <path d="M95 76 Q100 84 105 76 Z" fill="#EF4444" stroke="#1F2937" strokeWidth="2.5" />
            ) : (
              // Exact signature wavy mouth: ( ~ )
              <g>
                <path
                  d="M93 78 Q96.5 75.5 100 78 Q103.5 80.5 107 78"
                  stroke="#1F2937"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Soft subtle chin line */}
                <path d="M97 86 Q100 88 103 86" stroke="#D1D5DB" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            )}

            {/* Signature Dark Straight Bangs & Hair */}
            {/* Cut neatly across forehead, framing the top and sides */}
            <path
              d="M68 56 C67 36 133 36 132 56 C128 50 120 54 114 47 C108 52 100 48 94 52 C88 47 80 53 74 49 C70 54 68 56 68 56 Z"
              fill="#181B22"
              stroke="#181B22"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Hair highlight shimmer */}
            <path
              d="M80 41 Q100 37 120 41"
              stroke="#374151"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
