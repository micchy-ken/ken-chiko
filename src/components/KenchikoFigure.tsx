import React from 'react';
import { ActivityType, TransportMethod } from '../types';

interface KenchikoFigureProps {
  activity: ActivityType;
  transportMethod: TransportMethod | null;
  mood: string;
  className?: string;
  size?: number;
}

export const KenchikoFigure: React.FC<KenchikoFigureProps> = ({
  activity,
  transportMethod,
  className = '',
  size = 200,
}) => {
  // Simple black pen-line minimalist Japanese indie character style
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

        {/* Kenchiko Body & Head (Middle-aged man mascot "けんちこ") */}
        {activity === 'nap' ? (
          /* Sleeping / Snoozing Kenchiko */
          <g transform="translate(10, 20)">
            {/* Blanket / Mat */}
            <rect x="20" y="125" width="140" height="35" rx="10" fill="#fed7aa" stroke="#262626" strokeWidth="4" />
            <path d="M20 135 Q90 145 160 135" stroke="#ea580c" strokeWidth="2" strokeDasharray="6 6" />
            {/* Pillow */}
            <rect x="25" y="105" width="35" height="25" rx="6" fill="#ffffff" stroke="#262626" strokeWidth="3" />
            {/* Head lying down */}
            <ellipse cx="45" cy="100" rx="22" ry="18" fill="#fffbeb" stroke="#262626" strokeWidth="4" />
            {/* Gentle bald spot / side hair */}
            <path d="M25 95 Q20 105 28 112 M62 95 Q68 105 60 112" stroke="#262626" strokeWidth="3" strokeLinecap="round" />
            {/* Sleeping closed eye */}
            <path d="M42 98 Q47 103 52 98" stroke="#262626" strokeWidth="3" strokeLinecap="round" />
            {/* Round cute nose */}
            <circle cx="53" cy="102" r="3.5" fill="#fca5a5" stroke="#262626" strokeWidth="2" />
            {/* Snooze Zzz */}
            <g className="animate-bounce" style={{ animationDuration: '2s' }}>
              <text x="75" y="70" fontSize="22" fontWeight="bold" fill="#3b82f6" fontFamily="sans-serif">
                Z
              </text>
              <text x="95" y="52" fontSize="16" fontWeight="bold" fill="#60a5fa" fontFamily="sans-serif">
                z
              </text>
              <text x="110" y="38" fontSize="12" fontWeight="bold" fill="#93c5fd" fontFamily="sans-serif">
                z
              </text>
            </g>
          </g>
        ) : (
          /* Upright / Active Kenchiko */
          <g transform={activity === 'transit' && transportMethod === 'bicycle' ? 'translate(0, -10)' : 'translate(0, 0)'}>
            {/* Shadow */}
            <ellipse cx="100" cy="180" rx="35" ry="7" fill="#e5e5e5" />

            {/* Legs */}
            <path
              d={
                activity === 'transit'
                  ? "M85 145 L78 175 M115 145 L122 175"
                  : "M88 145 L88 175 M112 145 L112 175"
              }
              stroke="#262626"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Shoes */}
            <ellipse cx="85" cy="176" rx="8" ry="4" fill="#525252" stroke="#262626" strokeWidth="2" />
            <ellipse cx="115" cy="176" rx="8" ry="4" fill="#525252" stroke="#262626" strokeWidth="2" />

            {/* Torso / Comfy Shirt */}
            <path
              d="M75 95 Q65 145 78 148 L122 148 Q135 145 125 95 Z"
              fill="#fef08a"
              stroke="#262626"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* Collar */}
            <path d="M90 95 L100 108 L110 95" stroke="#262626" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* Arms */}
            {activity === 'snacking' ? (
              // Holding snack to mouth
              <g>
                <path d="M75 110 Q85 115 95 105" stroke="#262626" strokeWidth="4" strokeLinecap="round" />
                <path d="M125 110 Q115 118 105 105" stroke="#262626" strokeWidth="4" strokeLinecap="round" />
                {/* Cute Snack item in hand */}
                <circle cx="100" cy="103" r="7" fill="#92400e" stroke="#262626" strokeWidth="2" />
                <path d="M96 100 L104 100" stroke="#fef08a" strokeWidth="2" />
              </g>
            ) : (
              <g>
                <path d="M75 105 Q62 125 70 135" stroke="#262626" strokeWidth="4" strokeLinecap="round" />
                <path d="M125 105 Q138 125 130 135" stroke="#262626" strokeWidth="4" strokeLinecap="round" />
              </g>
            )}

            {/* Head */}
            <ellipse cx="100" cy="65" rx="28" ry="30" fill="#fffbeb" stroke="#262626" strokeWidth="4" />

            {/* Hair: Minimalist wavy side strands */}
            <path
              d="M72 60 Q68 75 75 80 M128 60 Q132 75 125 80 M75 48 Q100 35 125 48"
              stroke="#262626"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Eyes */}
            {activity === 'snacking' ? (
              // Joyful crescent eyes
              <g>
                <path d="M86 63 Q92 57 98 63" stroke="#262626" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M102 63 Q108 57 114 63" stroke="#262626" strokeWidth="3.5" strokeLinecap="round" />
              </g>
            ) : (
              // Stoic dot eyes
              <g>
                <circle cx="91" cy="62" r="3.5" fill="#262626" />
                <circle cx="109" cy="62" r="3.5" fill="#262626" />
              </g>
            )}

            {/* Eyebrows */}
            <path d="M86 54 Q92 51 97 54" stroke="#262626" strokeWidth="2" strokeLinecap="round" />
            <path d="M103 54 Q108 51 114 54" stroke="#262626" strokeWidth="2" strokeLinecap="round" />

            {/* Round Nose */}
            <ellipse cx="100" cy="68" rx="4.5" ry="4" fill="#fca5a5" stroke="#262626" strokeWidth="2.5" />

            {/* Cheeks blush */}
            <circle cx="82" cy="71" r="5" fill="#fecaca" opacity="0.7" />
            <circle cx="118" cy="71" r="5" fill="#fecaca" opacity="0.7" />

            {/* Stubble dots (subtle middle-aged cute charm) */}
            <circle cx="94" cy="80" r="0.8" fill="#737373" />
            <circle cx="98" cy="82" r="0.8" fill="#737373" />
            <circle cx="102" cy="82" r="0.8" fill="#737373" />
            <circle cx="106" cy="80" r="0.8" fill="#737373" />

            {/* Mouth */}
            {activity === 'snacking' ? (
              // Munching open mouth
              <path d="M96 74 Q100 80 104 74 Z" fill="#ef4444" stroke="#262626" strokeWidth="2" />
            ) : (
              // Slight relaxed curve
              <path d="M95 76 Q100 80 105 76" stroke="#262626" strokeWidth="2.5" strokeLinecap="round" />
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
