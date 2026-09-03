import React from 'react';
import { ActivityType } from '../types';

interface KihonNyanCatProps {
  activity?: ActivityType;
  mood?: string;
  isPetting?: boolean;
  className?: string;
  size?: number;
}

/**
 * 「きほんのにゃんこ」
 * ユーザー様のオリジナル手描きスケッチ（和紙・鉛筆・ジト目・二足立ち姿）を
 * 忠実に再現した公式基本キャラクターコンポーネント。
 */
export const KihonNyanCat: React.FC<KihonNyanCatProps> = ({
  activity = 'relaxing',
  isPetting = false,
  className = '',
  size = 230,
}) => {
  const isSleeping = activity === 'nap';
  const isWalking = activity === 'transit';
  const isSnacking = activity === 'snacking';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size * 1.08 }}
    >
      <svg
        viewBox="0 0 200 220"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'url(#pencil-jitter)' }}
      >
        {/* SVG Definition for pencil texture and subtle paper shading */}
        <defs>
          <linearGradient id="body-shade" x1="100" y1="90" x2="100" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="85%" stopColor="#FFFDF9" />
            <stop offset="100%" stopColor="#F2EDE4" />
          </linearGradient>
          <linearGradient id="chin-shade" x1="100" y1="80" x2="100" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2E2824" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2E2824" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. Ground Shadow - Hand-drawn graphite pencil hatch lines (matches the reference drawing) */}
        <g opacity="0.85" className="transition-all duration-300">
          <ellipse cx="100" cy="188" rx="42" ry="5" fill="#E8E2D8" />
          <line x1="72" y1="187" x2="128" y2="187" stroke="#2E2824" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="78" y1="189.5" x2="122" y2="189.5" stroke="#2E2824" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="84" y1="192" x2="116" y2="192" stroke="#2E2824" strokeWidth="1.0" strokeLinecap="round" />
          <line x1="90" y1="194" x2="110" y2="194" stroke="#2E2824" strokeWidth="0.7" strokeLinecap="round" />
        </g>

        {/* Dynamic Cat Container with playful state transforms */}
        <g
          className={`transition-all duration-300 origin-bottom ${
            isSleeping
              ? 'rotate-[-8deg] translate-y-2'
              : isWalking
              ? 'animate-bounce'
              : isPetting
              ? 'scale-105'
              : ''
          }`}
        >
          {/* 2. TAIL - Graceful upward curve pointing to the right */}
          <path
            d="M 124 162 C 146 166 158 152 152 134 C 148 124 138 128 134 136 C 130 144 122 152 118 154"
            fill="#FFFDF9"
            stroke="#2E2824"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 3. MAIN BODY & SHORT STUBBY LEGS (Chubby upright two-legged stance) */}
          <path
            d={`
              M 80 88
              C 62 100 58 125 60 152
              C 61 165 65 178 72 186
              C 76 190 82 189 84 184
              C 87 176 89 168 100 168
              C 111 168 113 176 116 184
              C 118 189 124 190 128 186
              C 135 178 139 165 140 152
              C 142 125 138 100 120 88
              Z
            `}
            fill="url(#body-shade)"
            stroke="#2E2824"
            strokeWidth="3.4"
            strokeLinejoin="round"
          />

          {/* Subtle Pencil Shading under chin & groin */}
          <path
            d="M 78 94 Q 100 106 122 94 Q 100 114 78 94 Z"
            fill="url(#chin-shade)"
          />
          <path
            d="M 88 168 Q 100 174 112 168"
            stroke="#2E2824"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* Left Arm / Forepaw resting by the side */}
          <path
            d="M 64 122 C 60 134 60 146 66 156 C 68 158 72 156 72 152 C 72 142 70 132 74 122"
            fill="#FFFDF9"
            stroke="#2E2824"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Arm / Forepaw resting by the side */}
          <path
            d="M 136 122 C 140 134 140 146 134 156 C 132 158 128 156 128 152 C 128 142 130 132 126 122"
            fill="#FFFDF9"
            stroke="#2E2824"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 4. HEAD (Wide, chubby, hand-drawn organic contour) */}
          <path
            d={`
              M 68 62
              C 62 48 66 32 70 28
              C 74 24 82 32 90 40
              C 96 38 104 38 110 40
              C 118 32 126 24 130 28
              C 134 32 138 48 132 62
              C 142 74 140 94 128 102
              C 116 108 84 108 72 102
              C 60 94 58 74 68 62
              Z
            `}
            fill="#FFFDF9"
            stroke="#2E2824"
            strokeWidth="3.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Inner Ear Pencil Texture lines */}
          <path d="M 72 35 L 75 48" stroke="#2E2824" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
          <path d="M 128 35 L 125 48" stroke="#2E2824" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />

          {/* 5. EYES - Iconic Deadpan Flat-Top Slit Eyes (ジト目) */}
          {isSleeping ? (
            // Peaceful curved sleeping lines
            <g>
              <path d="M 76 66 Q 84 74 92 66" stroke="#2E2824" strokeWidth="3.0" strokeLinecap="round" fill="none" />
              <path d="M 108 66 Q 116 74 124 66" stroke="#2E2824" strokeWidth="3.0" strokeLinecap="round" fill="none" />
            </g>
          ) : isPetting ? (
            // Blissful happy closed eyes (^^)
            <g>
              <path d="M 76 69 Q 84 61 92 69" stroke="#2E2824" strokeWidth="3.2" strokeLinecap="round" fill="none" />
              <path d="M 108 69 Q 116 61 124 69" stroke="#2E2824" strokeWidth="3.2" strokeLinecap="round" fill="none" />
              {/* Soft pink blushing on cheeks */}
              <ellipse cx="73" cy="74" rx="5" ry="3" fill="#E88B84" opacity="0.45" />
              <ellipse cx="127" cy="74" rx="5" ry="3" fill="#E88B84" opacity="0.45" />
            </g>
          ) : (
            // The exact reference deadpan eyes
            <g>
              {/* Left Eye: Flat upper line + square/half-circle dark pupil underneath */}
              <line x1="76" y1="64" x2="92" y2="64" stroke="#2E2824" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M 80 65 C 80 72 88 72 88 65 Z" fill="#2E2824" />

              {/* Right Eye: Flat upper line + square/half-circle dark pupil underneath */}
              <line x1="108" y1="64" x2="124" y2="64" stroke="#2E2824" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M 112 65 C 112 72 120 72 120 65 Z" fill="#2E2824" />
            </g>
          )}

          {/* 6. MOUTH - Iconic Inverted 'T' Nose & Mouth Line */}
          {isSnacking ? (
            // Chewing open mouth
            <g>
              <line x1="100" y1="71" x2="100" y2="76" stroke="#2E2824" strokeWidth="2.8" strokeLinecap="round" />
              <ellipse cx="100" cy="80" rx="4" ry="3" fill="#D9433B" stroke="#2E2824" strokeWidth="2" />
            </g>
          ) : (
            // The exact reference inverted 'T' line
            <g>
              <line x1="100" y1="71" x2="100" y2="78" stroke="#2E2824" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="93" y1="78" x2="107" y2="78" stroke="#2E2824" strokeWidth="2.8" strokeLinecap="round" />
            </g>
          )}

          {/* 7. WHISKERS - Two delicate pencil strokes on each cheek */}
          <g opacity="0.9">
            {/* Left Whiskers */}
            <path d="M 64 71 L 46 69" stroke="#2E2824" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 65 79 L 48 83" stroke="#2E2824" strokeWidth="2.2" strokeLinecap="round" />

            {/* Right Whiskers */}
            <path d="M 136 71 L 154 69" stroke="#2E2824" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 135 79 L 152 83" stroke="#2E2824" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
};
