import React from 'react';

/**
 * Global SVG Definitions for organic hand-drawn pencil sketches:
 * - feTurbulence + feDisplacementMap for pencil roughness & tremor
 * - Cross-hatching & line shading patterns
 * - Soft paper watercolor gradients
 */
export const PencilSketchFilters: React.FC = () => {
  return (
    <svg className="absolute w-0 h-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <defs>
        {/* Filter 1: Gentle Pencil Tremor & Roughness (Hand-drawn jitter) */}
        <filter id="pencil-jitter" x="-10%" y="-10%" width="120%" height="120%" filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="displaced" />
        </filter>

        {/* Filter 2: Subtle Rough Edge for paper & cards */}
        <filter id="paper-edge" x="-5%" y="-5%" width="110%" height="110%" filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Shading Pattern 1: Fine Diagonal Pencil Hatch (45 deg) */}
        <pattern id="pencil-hatch-45" width="5" height="5" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#2E2824" strokeWidth="0.85" opacity="0.35" />
        </pattern>

        {/* Shading Pattern 2: Dense Cross Hatch */}
        <pattern id="pencil-cross-hatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#2E2824" strokeWidth="0.8" opacity="0.25" />
          <line x1="0" y1="0" x2="6" y2="0" stroke="#2E2824" strokeWidth="0.8" opacity="0.25" />
        </pattern>

        {/* Shading Pattern 3: Soft Ground Stipple / Shadow */}
        <pattern id="ground-stipple" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill="#2E2824" opacity="0.2" />
          <circle cx="3" cy="3" r="0.6" fill="#2E2824" opacity="0.2" />
        </pattern>
      </defs>
    </svg>
  );
};
