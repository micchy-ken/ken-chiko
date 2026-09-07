import React from 'react';
import { LocationId } from '../types';

interface LocationIllustrationProps {
  locationId: LocationId;
  variant?: 'card' | 'stamp' | 'icon' | 'banner';
  className?: string;
}

export const LocationIllustration: React.FC<LocationIllustrationProps> = ({
  locationId,
  variant = 'card',
  className = '',
}) => {
  const renderSvg = () => {
    switch (locationId) {
      case 'living':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Background wall & floor */}
            <rect width="240" height="160" fill="#FAF4EB" />
            <rect y="115" width="240" height="45" fill="#E8DEC8" />
            <line x1="0" y1="115" x2="240" y2="115" stroke="#C4B79B" strokeWidth="2" />

            {/* Window with sunlight */}
            <g transform="translate(145, 18)">
              <rect width="65" height="60" rx="4" fill="#E8F4FA" stroke="#8C7A68" strokeWidth="2.5" />
              <line x1="32.5" y1="0" x2="32.5" y2="60" stroke="#8C7A68" strokeWidth="2" />
              <line x1="0" y1="30" x2="65" y2="30" stroke="#8C7A68" strokeWidth="2" />
              {/* Sun & cloud in window */}
              <circle cx="48" cy="18" r="8" fill="#FAD02C" opacity="0.8" />
              <path d="M 15 42 Q 22 36 30 40 Q 38 36 45 42 Z" fill="#FFFFFF" opacity="0.9" />
              {/* Plant on windowsill */}
              <rect x="8" y="52" width="14" height="9" rx="2" fill="#C97A52" stroke="#4A3B32" strokeWidth="1.5" />
              <path d="M 15 52 Q 10 40 6 45 Q 12 48 15 52" fill="#729E74" stroke="#3A593B" strokeWidth="1.2" />
              <path d="M 15 52 Q 20 40 24 45 Q 18 48 15 52" fill="#88B88A" stroke="#3A593B" strokeWidth="1.2" />
            </g>

            {/* Cozy Sofa */}
            <g transform="translate(20, 50)">
              {/* Sofa back */}
              <rect x="0" y="10" width="105" height="48" rx="12" fill="#E59866" stroke="#4A3425" strokeWidth="2.5" />
              {/* Sofa cushions */}
              <rect x="6" y="28" width="44" height="28" rx="8" fill="#F0B27A" stroke="#4A3425" strokeWidth="2" />
              <rect x="55" y="28" width="44" height="28" rx="8" fill="#F0B27A" stroke="#4A3425" strokeWidth="2" />
              {/* Armrests */}
              <rect x="-6" y="22" width="16" height="36" rx="8" fill="#DC7633" stroke="#4A3425" strokeWidth="2.5" />
              <rect x="95" y="22" width="16" height="36" rx="8" fill="#DC7633" stroke="#4A3425" strokeWidth="2.5" />
              {/* Throw pillow */}
              <rect x="10" y="25" width="22" height="20" rx="5" transform="rotate(-10 21 35)" fill="#F9E79F" stroke="#4A3425" strokeWidth="1.8" />
              {/* Legs */}
              <line x1="8" y1="58" x2="4" y2="70" stroke="#4A3425" strokeWidth="3" strokeLinecap="round" />
              <line x1="97" y1="58" x2="101" y2="70" stroke="#4A3425" strokeWidth="3" strokeLinecap="round" />
            </g>

            {/* Kotatsu / Low Table */}
            <g transform="translate(100, 92)">
              {/* Blanket */}
              <path d="M 5 22 Q 45 10 90 22 L 98 42 Q 45 46 -3 42 Z" fill="#7DCEA0" stroke="#2E5A3E" strokeWidth="2.5" />
              {/* Blanket pattern */}
              <circle cx="30" cy="28" r="3" fill="#A9DFBF" />
              <circle cx="60" cy="26" r="3" fill="#A9DFBF" />
              <circle cx="45" cy="36" r="3" fill="#A9DFBF" />
              {/* Table top */}
              <rect x="10" y="8" width="75" height="14" rx="4" fill="#D35400" stroke="#4A2000" strokeWidth="2.5" />
              <rect x="14" y="10" width="67" height="4" rx="2" fill="#E59866" opacity="0.6" />
              {/* Mikan (Orange) with leaf */}
              <circle cx="42" cy="5" r="5" fill="#F39C12" stroke="#6E2C00" strokeWidth="1.5" />
              <ellipse cx="45" cy="1" rx="3" ry="1.5" fill="#27AE60" transform="rotate(15 45 1)" />
              {/* Teacup with steam */}
              <rect x="58" y="2" width="8" height="7" rx="2" fill="#FFFFFF" stroke="#4A3425" strokeWidth="1.5" />
              <path d="M 61 -2 Q 59 -5 63 -8" stroke="#BDC3C7" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </g>
          </svg>
        );

      case 'bedroom':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Night room wall & floor */}
            <rect width="240" height="160" fill="#2C3E50" />
            <rect y="118" width="240" height="42" fill="#1A252F" />
            <line x1="0" y1="118" x2="240" y2="118" stroke="#34495E" strokeWidth="2" />

            {/* Night Window with Moon and Stars */}
            <g transform="translate(140, 16)">
              <rect width="68" height="62" rx="6" fill="#1B2631" stroke="#5D6D7E" strokeWidth="2.5" />
              <line x1="34" y1="0" x2="34" y2="62" stroke="#5D6D7E" strokeWidth="2" />
              <line x1="0" y1="31" x2="68" y2="31" stroke="#5D6D7E" strokeWidth="2" />
              {/* Crescent Moon */}
              <path d="M 52 14 A 10 10 0 0 0 44 28 A 12 12 0 0 1 52 14 Z" fill="#F9E79F" />
              {/* Twinkling Stars */}
              <circle cx="15" cy="18" r="1.5" fill="#FDFEFE" opacity="0.9" />
              <circle cx="26" cy="42" r="1.2" fill="#FDFEFE" opacity="0.8" />
              <circle cx="56" cy="48" r="1.5" fill="#FDFEFE" opacity="0.9" />
              {/* Star sparkle */}
              <path d="M 18 35 L 20 38 L 18 41 L 16 38 Z" fill="#F9E79F" />
            </g>

            {/* Bedside Table & Glowing Lamp */}
            <g transform="translate(25, 68)">
              {/* Table */}
              <rect x="0" y="24" width="34" height="34" rx="4" fill="#784212" stroke="#2C1B0E" strokeWidth="2" />
              <line x1="0" y1="40" x2="34" y2="40" stroke="#2C1B0E" strokeWidth="1.5" />
              <circle cx="17" cy="32" r="2" fill="#F39C12" />
              {/* Lamp stand */}
              <rect x="14" y="10" width="6" height="14" fill="#BDC3C7" stroke="#2C1B0E" strokeWidth="1.5" />
              {/* Lamp shade & light glow */}
              <circle cx="17" cy="4" r="22" fill="#FAD7A0" opacity="0.25" />
              <path d="M 7 10 L 12 -4 L 22 -4 L 27 10 Z" fill="#FAD7A0" stroke="#784212" strokeWidth="2" />
              <ellipse cx="17" cy="10" rx="10" ry="2.5" fill="#FAD7A0" />
            </g>

            {/* Cozy Bed */}
            <g transform="translate(68, 55)">
              {/* Headboard */}
              <rect x="0" y="0" width="14" height="68" rx="4" fill="#6E2C00" stroke="#2C1B0E" strokeWidth="2.5" />
              {/* Bed frame & mattress */}
              <rect x="14" y="26" width="130" height="42" rx="6" fill="#FDFEFE" stroke="#2C1B0E" strokeWidth="2.5" />
              {/* Fluffy Duvet / Comforter */}
              <rect x="42" y="26" width="102" height="42" rx="6" fill="#5DADE2" stroke="#1B4F72" strokeWidth="2.5" />
              {/* Duvet fold */}
              <rect x="36" y="26" width="14" height="42" rx="4" fill="#AED6F1" stroke="#1B4F72" strokeWidth="2" />
              {/* Stars pattern on blanket */}
              <circle cx="70" cy="42" r="2" fill="#EBF5FB" opacity="0.8" />
              <circle cx="95" cy="52" r="2" fill="#EBF5FB" opacity="0.8" />
              <circle cx="120" cy="40" r="2" fill="#EBF5FB" opacity="0.8" />
              {/* Fluffy Pillows */}
              <rect x="18" y="20" width="22" height="24" rx="6" fill="#E8F8F5" stroke="#2C1B0E" strokeWidth="2" transform="rotate(-5 29 32)" />
              {/* Cute Cat Silhouette Sleeping Foot of Bed */}
              <g transform="translate(112, 38)">
                <ellipse cx="12" cy="10" rx="10" ry="8" fill="#FAD7A0" stroke="#784212" strokeWidth="1.5" />
                <polygon points="5,4 8,0 11,4" fill="#FAD7A0" stroke="#784212" strokeWidth="1.2" />
                <polygon points="12,3 15,-1 18,3" fill="#FAD7A0" stroke="#784212" strokeWidth="1.2" />
                <path d="M 2 12 Q -4 14 -2 18 Q 3 16 4 13" fill="#FAD7A0" stroke="#784212" strokeWidth="1.5" />
              </g>
              {/* Bed legs */}
              <line x1="20" y1="68" x2="20" y2="78" stroke="#2C1B0E" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="135" y1="68" x2="135" y2="78" stroke="#2C1B0E" strokeWidth="3.5" strokeLinecap="round" />
            </g>
          </svg>
        );

      case 'office':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Office room wall & carpet */}
            <rect width="240" height="160" fill="#EBF5FB" />
            <rect y="112" width="240" height="48" fill="#D4E6F1" />
            <line x1="0" y1="112" x2="240" y2="112" stroke="#A9CCE3" strokeWidth="2" />

            {/* City High-rise Window */}
            <g transform="translate(140, 14)">
              <rect width="78" height="66" rx="4" fill="#D6EAF8" stroke="#5D6D7E" strokeWidth="2" />
              <line x1="39" y1="0" x2="39" y2="66" stroke="#5D6D7E" strokeWidth="1.5" />
              {/* Distant Skyscrapers */}
              <rect x="8" y="24" width="18" height="42" fill="#A6ACAF" stroke="#5D6D7E" strokeWidth="1" />
              <rect x="30" y="16" width="22" height="50" fill="#85929E" stroke="#5D6D7E" strokeWidth="1" />
              <rect x="56" y="28" width="16" height="38" fill="#ABB2B9" stroke="#5D6D7E" strokeWidth="1" />
              {/* Tiny office window dots */}
              <circle cx="14" cy="32" r="1" fill="#F9E79F" />
              <circle cx="20" cy="40" r="1" fill="#F9E79F" />
              <circle cx="38" cy="25" r="1" fill="#F9E79F" />
              <circle cx="44" cy="35" r="1" fill="#F9E79F" />
            </g>

            {/* Wall Clock */}
            <g transform="translate(45, 24)">
              <circle cx="14" cy="14" r="14" fill="#FFFFFF" stroke="#34495E" strokeWidth="2" />
              <circle cx="14" cy="14" r="1.5" fill="#34495E" />
              <line x1="14" y1="14" x2="14" y2="6" stroke="#34495E" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="14" y1="14" x2="20" y2="14" stroke="#E74C3C" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Office Desk */}
            <g transform="translate(30, 72)">
              {/* Desk Top */}
              <rect x="0" y="18" width="130" height="10" rx="3" fill="#D35400" stroke="#3E2723" strokeWidth="2.5" />
              {/* Desk Legs */}
              <rect x="6" y="28" width="8" height="42" fill="#5D4037" stroke="#3E2723" strokeWidth="2" />
              <rect x="116" y="28" width="8" height="42" fill="#5D4037" stroke="#3E2723" strokeWidth="2" />
              {/* Desk drawer unit */}
              <rect x="90" y="28" width="30" height="36" fill="#A04000" stroke="#3E2723" strokeWidth="2" />
              <line x1="90" y1="46" x2="120" y2="46" stroke="#3E2723" strokeWidth="1.5" />
              <circle cx="105" cy="37" r="1.5" fill="#F4D03F" />
              <circle cx="105" cy="55" r="1.5" fill="#F4D03F" />

              {/* PC Monitor */}
              <rect x="35" y="-14" width="46" height="30" rx="3" fill="#1C2833" stroke="#2C3E50" strokeWidth="2" />
              <rect x="38" y="-11" width="40" height="24" rx="2" fill="#34495E" />
              {/* Code lines / chart on screen */}
              <line x1="42" y1="-5" x2="60" y2="-5" stroke="#2ECC71" strokeWidth="1.5" />
              <line x1="42" y1="-1" x2="72" y2="-1" stroke="#3498DB" strokeWidth="1.5" />
              <line x1="42" y1="3" x2="55" y2="3" stroke="#F1C40F" strokeWidth="1.5" />
              <line x1="42" y1="7" x2="68" y2="7" stroke="#E74C3C" strokeWidth="1.5" />
              {/* Monitor Stand */}
              <rect x="54" y="14" width="8" height="6" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="1.5" />
              <rect x="48" y="17" width="20" height="3" rx="1.5" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="1" />

              {/* Keyboard & Mouse */}
              <rect x="42" y="20" width="30" height="5" rx="1" fill="#BDC3C7" stroke="#7F8C8D" strokeWidth="1" />
              <rect x="76" y="21" width="5" height="4" rx="1" fill="#BDC3C7" stroke="#7F8C8D" strokeWidth="1" />

              {/* Coffee Mug with cute steam */}
              <rect x="18" y="8" width="10" height="11" rx="2" fill="#E74C3C" stroke="#78281F" strokeWidth="1.5" />
              <path d="M 28 11 Q 32 13 28 16" stroke="#78281F" strokeWidth="1.5" fill="none" />
              <path d="M 23 4 Q 21 0 24 -4" stroke="#BDC3C7" strokeWidth="1.5" strokeLinecap="round" fill="none" />

              {/* Little Succulent Plant */}
              <rect x="6" y="8" width="8" height="10" rx="2" fill="#F5CBA7" stroke="#4A3425" strokeWidth="1.5" />
              <circle cx="10" cy="6" r="4" fill="#52BE80" stroke="#1E8449" strokeWidth="1.2" />
            </g>

            {/* Ergonomic Office Chair */}
            <g transform="translate(170, 75)">
              <rect x="4" y="0" width="28" height="34" rx="8" fill="#34495E" stroke="#1A252F" strokeWidth="2.5" />
              <rect x="0" y="30" width="36" height="12" rx="4" fill="#2C3E50" stroke="#1A252F" strokeWidth="2" />
              <rect x="16" y="42" width="5" height="14" fill="#7F8C8D" stroke="#1A252F" strokeWidth="1.5" />
              {/* Wheels */}
              <line x1="5" y1="56" x2="32" y2="56" stroke="#1A252F" strokeWidth="3" strokeLinecap="round" />
              <circle cx="6" cy="59" r="2.5" fill="#1A252F" />
              <circle cx="31" cy="59" r="2.5" fill="#1A252F" />
            </g>
          </svg>
        );

      case 'beginner_forest':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Sky */}
            <rect width="240" height="160" fill="#E8F8F5" />
            {/* Sun & Clouds */}
            <circle cx="205" cy="28" r="14" fill="#F9E79F" opacity="0.9" />
            <path d="M 30 25 Q 40 18 52 24 Q 62 18 72 25 Q 78 32 68 36 L 35 36 Q 24 32 30 25 Z" fill="#FFFFFF" opacity="0.95" />

            {/* Distant green hills */}
            <path d="M -10 110 Q 60 75 140 95 Q 200 80 250 100 L 250 160 L -10 160 Z" fill="#A3E4D7" />
            <path d="M -10 120 Q 80 90 170 115 Q 220 105 250 120 L 250 160 L -10 160 Z" fill="#76D7C4" />
            {/* Foreground lush meadow */}
            <path d="M -10 130 Q 70 120 160 132 Q 210 124 250 135 L 250 160 L -10 160 Z" fill="#58D68D" />

            {/* Fluffy Trees (Left) */}
            <g transform="translate(15, 45)">
              {/* Trunk */}
              <rect x="22" y="55" width="10" height="35" rx="3" fill="#873600" stroke="#4A2000" strokeWidth="2" />
              {/* Foliage layers */}
              <circle cx="27" cy="40" r="26" fill="#28B463" stroke="#196F3D" strokeWidth="2.5" />
              <circle cx="16" cy="32" r="18" fill="#2ECC71" stroke="#196F3D" strokeWidth="2" />
              <circle cx="38" cy="32" r="18" fill="#2ECC71" stroke="#196F3D" strokeWidth="2" />
              <circle cx="27" cy="18" r="16" fill="#52BE80" stroke="#196F3D" strokeWidth="2" />
            </g>

            {/* Fluffy Tree (Center-Right) */}
            <g transform="translate(155, 38)">
              <rect x="24" y="60" width="12" height="42" rx="3" fill="#873600" stroke="#4A2000" strokeWidth="2" />
              <circle cx="30" cy="42" r="30" fill="#229954" stroke="#145A32" strokeWidth="2.5" />
              <circle cx="18" cy="34" r="20" fill="#27AE60" stroke="#145A32" strokeWidth="2" />
              <circle cx="42" cy="34" r="20" fill="#27AE60" stroke="#145A32" strokeWidth="2" />
              <circle cx="30" cy="18" r="18" fill="#58D68D" stroke="#145A32" strokeWidth="2" />
            </g>

            {/* Wooden Forest Signpost */}
            <g transform="translate(90, 88)">
              <rect x="8" y="18" width="6" height="36" fill="#6E2C00" stroke="#3E1800" strokeWidth="2" rx="2" />
              {/* Sign Board */}
              <path d="M 0 6 L 32 6 L 40 16 L 32 26 L 0 26 Z" fill="#D35400" stroke="#3E1800" strokeWidth="2" />
              <line x1="6" y1="13" x2="26" y2="13" stroke="#FDFEFE" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="19" x2="20" y2="19" stroke="#FDFEFE" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Fluffy Sheep Grazing */}
            <g transform="translate(118, 120)">
              {/* Body */}
              <ellipse cx="14" cy="10" rx="12" ry="9" fill="#FFFFFF" stroke="#34495E" strokeWidth="2" />
              <circle cx="5" cy="7" r="5" fill="#FFFFFF" />
              <circle cx="12" cy="3" r="5" fill="#FFFFFF" />
              <circle cx="20" cy="7" r="5" fill="#FFFFFF" />
              <circle cx="18" cy="14" r="5" fill="#FFFFFF" />
              <circle cx="9" cy="15" r="5" fill="#FFFFFF" />
              {/* Head */}
              <ellipse cx="26" cy="8" rx="5" ry="4" fill="#34495E" />
              <ellipse cx="28" cy="5" rx="3" ry="1.5" fill="#34495E" transform="rotate(-20 28 5)" />
              {/* Legs */}
              <line x1="7" y1="18" x2="7" y2="24" stroke="#34495E" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="24" stroke="#34495E" strokeWidth="2" strokeLinecap="round" />
              <line x1="17" y1="18" x2="17" y2="24" stroke="#34495E" strokeWidth="2" strokeLinecap="round" />
              <line x1="22" y1="18" x2="22" y2="24" stroke="#34495E" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Wildflowers */}
            <g transform="translate(40, 142)">
              <circle cx="0" cy="0" r="3" fill="#F4D03F" />
              <circle cx="0" cy="0" r="1.2" fill="#E67E22" />
              <line x1="0" y1="3" x2="0" y2="8" stroke="#196F3D" strokeWidth="1.5" />
            </g>
            <g transform="translate(70, 146)">
              <circle cx="0" cy="0" r="3" fill="#F1948A" />
              <circle cx="0" cy="0" r="1.2" fill="#922B21" />
              <line x1="0" y1="3" x2="0" y2="8" stroke="#196F3D" strokeWidth="1.5" />
            </g>
            <g transform="translate(195, 144)">
              <circle cx="0" cy="0" r="3.5" fill="#BB8FCE" />
              <circle cx="0" cy="0" r="1.5" fill="#5B2C6F" />
              <line x1="0" y1="3.5" x2="0" y2="9" stroke="#196F3D" strokeWidth="1.5" />
            </g>
          </svg>
        );

      case 'lalaport':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Sky */}
            <rect width="240" height="160" fill="#FDEDEC" />
            <rect y="125" width="240" height="35" fill="#FADBD8" />
            <line x1="0" y1="125" x2="240" y2="125" stroke="#E6B0AA" strokeWidth="2" />

            {/* Shopping Mall Main Modern Architecture */}
            <g transform="translate(20, 25)">
              {/* Mall Building Base */}
              <rect x="0" y="25" width="195" height="75" rx="8" fill="#FFFFFF" stroke="#4A3425" strokeWidth="2.5" />
              {/* Mall Glass Atrium Arches */}
              <path d="M 65 25 Q 97 -2 130 25 Z" fill="#AED6F1" stroke="#4A3425" strokeWidth="2.5" />
              <line x1="97" y1="0" x2="97" y2="25" stroke="#4A3425" strokeWidth="2" />
              <line x1="80" y1="12" x2="114" y2="12" stroke="#4A3425" strokeWidth="1.5" />

              {/* Decorative Colorful Mall Banners */}
              <polygon points="15,25 25,25 20,40" fill="#E74C3C" stroke="#78281F" strokeWidth="1.2" />
              <polygon points="28,25 38,25 33,40" fill="#F1C40F" stroke="#7D6608" strokeWidth="1.2" />
              <polygon points="41,25 51,25 46,40" fill="#3498DB" stroke="#1B4F72" strokeWidth="1.2" />
              <polygon points="145,25 155,25 150,40" fill="#2ECC71" stroke="#196F3D" strokeWidth="1.2" />
              <polygon points="158,25 168,25 163,40" fill="#9B59B6" stroke="#512E5F" strokeWidth="1.2" />
              <polygon points="171,25 181,25 176,40" fill="#E67E22" stroke="#7E5109" strokeWidth="1.2" />

              {/* Main Entrance Glass Doors */}
              <rect x="75" y="55" width="45" height="45" rx="3" fill="#D6EAF8" stroke="#4A3425" strokeWidth="2" />
              <line x1="97.5" y1="55" x2="97.5" y2="100" stroke="#4A3425" strokeWidth="2" />
              <rect x="79" y="60" width="14" height="28" fill="#EBF5FB" stroke="#4A3425" strokeWidth="1" />
              <rect x="102" y="60" width="14" height="28" fill="#EBF5FB" stroke="#4A3425" strokeWidth="1" />

              {/* Mall Shop Windows */}
              <rect x="15" y="55" width="45" height="32" rx="3" fill="#FCF3CF" stroke="#4A3425" strokeWidth="2" />
              <line x1="37" y1="55" x2="37" y2="87" stroke="#4A3425" strokeWidth="1.5" />
              {/* Mannequin / dress */}
              <path d="M 24 75 L 30 63 L 34 75 Z" fill="#E74C3C" />
              <circle cx="29" cy="61" r="2" fill="#F5B7B1" />

              <rect x="135" y="55" width="45" height="32" rx="3" fill="#FCF3CF" stroke="#4A3425" strokeWidth="2" />
              <line x1="157" y1="55" x2="157" y2="87" stroke="#4A3425" strokeWidth="1.5" />
              {/* Bag display */}
              <rect x="144" y="68" width="8" height="10" rx="1.5" fill="#8E44AD" />
              <rect x="162" y="66" width="10" height="12" rx="1.5" fill="#E67E22" />

              {/* Mall Rooftop Logo Plaque */}
              <rect x="80" y="32" width="35" height="14" rx="3" fill="#C0392B" stroke="#4A3425" strokeWidth="1.5" />
              <line x1="84" y1="39" x2="111" y2="39" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Colorful Helium Balloons Floating */}
            <g transform="translate(195, 30)">
              <ellipse cx="10" cy="14" rx="8" ry="10" fill="#E74C3C" stroke="#78281F" strokeWidth="1.5" />
              <polygon points="9,24 11,24 10,26" fill="#E74C3C" />
              <path d="M 10 26 Q 6 36 12 44" stroke="#7F8C8D" strokeWidth="1.2" fill="none" />

              <ellipse cx="22" cy="18" rx="7" ry="9" fill="#F1C40F" stroke="#7D6608" strokeWidth="1.5" />
              <polygon points="21,27 23,27 22,29" fill="#F1C40F" />
              <path d="M 22 29 Q 26 38 18 46" stroke="#7F8C8D" strokeWidth="1.2" fill="none" />
            </g>

            {/* Shopping Bags in Foreground */}
            <g transform="translate(45, 122)">
              {/* Coral shopping bag */}
              <rect x="0" y="6" width="16" height="20" rx="3" fill="#E74C3C" stroke="#4A3425" strokeWidth="2" />
              <path d="M 4 6 Q 8 -2 12 6" stroke="#4A3425" strokeWidth="2" fill="none" />
              {/* Mint shopping bag */}
              <rect x="14" y="10" width="18" height="16" rx="3" fill="#1ABC9C" stroke="#4A3425" strokeWidth="2" />
              <path d="M 19 10 Q 23 2 27 10" stroke="#4A3425" strokeWidth="2" fill="none" />
            </g>
          </svg>
        );

      case 'aeon':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Sky */}
            <rect width="240" height="160" fill="#F4ECF7" />
            <rect y="122" width="240" height="38" fill="#E8DAEF" />
            <line x1="0" y1="122" x2="240" y2="122" stroke="#D2B4DE" strokeWidth="2" />

            {/* Aeon Big Super Mall Building */}
            <g transform="translate(25, 20)">
              {/* Main Building Body */}
              <rect x="0" y="24" width="190" height="78" rx="8" fill="#FFFFFF" stroke="#3E2723" strokeWidth="2.5" />

              {/* Signature Magenta / Purple Top Band */}
              <rect x="0" y="24" width="190" height="16" rx="6" fill="#884EA0" stroke="#3E2723" strokeWidth="2" />
              {/* Logo Emblem Placeholder */}
              <rect x="75" y="10" width="40" height="20" rx="4" fill="#A569BD" stroke="#3E2723" strokeWidth="2" />
              <ellipse cx="95" cy="20" rx="12" ry="5" fill="#FFFFFF" stroke="#3E2723" strokeWidth="1.5" />
              <circle cx="95" cy="20" r="2.5" fill="#884EA0" />

              {/* Striped Awnings for Food / Bakery / Sweets Corner */}
              <g transform="translate(15, 52)">
                <path d="M 0 0 L 60 0 L 55 14 L -5 14 Z" fill="#E74C3C" stroke="#3E2723" strokeWidth="1.8" />
                <path d="M 10 0 L 20 0 L 15 14 L 5 14 Z" fill="#FFFFFF" />
                <path d="M 30 0 L 40 0 L 35 14 L 25 14 Z" fill="#FFFFFF" />
                <path d="M 50 0 L 60 0 L 55 14 L 45 14 Z" fill="#FFFFFF" />
                {/* Bakery Window */}
                <rect x="0" y="14" width="50" height="36" fill="#FEF9E7" stroke="#3E2723" strokeWidth="2" />
                {/* Bread & Cake on Shelf */}
                <ellipse cx="14" cy="30" rx="8" ry="4" fill="#D35400" />
                <rect x="28" y="24" width="14" height="12" rx="2" fill="#F39C12" />
              </g>

              {/* Main Entrance Sliding Doors */}
              <g transform="translate(85, 52)">
                <rect x="0" y="0" width="42" height="50" fill="#D6EAF8" stroke="#3E2723" strokeWidth="2" />
                <line x1="21" y1="0" x2="21" y2="50" stroke="#3E2723" strokeWidth="2" />
                <rect x="4" y="6" width="13" height="36" fill="#EBF5FB" stroke="#3E2723" strokeWidth="1" />
                <rect x="25" y="6" width="13" height="36" fill="#EBF5FB" stroke="#3E2723" strokeWidth="1" />
                {/* Automatic door sensor */}
                <rect x="16" y="-3" width="10" height="4" rx="1" fill="#34495E" />
              </g>

              {/* Chateraise / Dessert Shop Awning */}
              <g transform="translate(135, 52)">
                <path d="M 0 0 L 45 0 L 40 14 L -5 14 Z" fill="#27AE60" stroke="#3E2723" strokeWidth="1.8" />
                <path d="M 10 0 L 20 0 L 15 14 L 5 14 Z" fill="#FFFFFF" />
                <path d="M 30 0 L 40 0 L 35 14 L 25 14 Z" fill="#FFFFFF" />
                {/* Shop window */}
                <rect x="0" y="14" width="38" height="36" fill="#FEF9E7" stroke="#3E2723" strokeWidth="2" />
                <circle cx="12" cy="28" r="5" fill="#E74C3C" />
                <ellipse cx="26" cy="32" rx="6" ry="3" fill="#8E44AD" />
              </g>
            </g>

            {/* Cute Supermarket Shopping Cart in foreground */}
            <g transform="translate(170, 115)">
              {/* Basket Mesh */}
              <rect x="4" y="4" width="26" height="18" rx="2" fill="#EAEDED" stroke="#34495E" strokeWidth="2" />
              <line x1="4" y1="10" x2="30" y2="10" stroke="#BDC3C7" strokeWidth="1.2" />
              <line x1="4" y1="16" x2="30" y2="16" stroke="#BDC3C7" strokeWidth="1.2" />
              <line x1="12" y1="4" x2="12" y2="22" stroke="#BDC3C7" strokeWidth="1.2" />
              <line x1="20" y1="4" x2="20" y2="22" stroke="#BDC3C7" strokeWidth="1.2" />
              {/* Handle */}
              <line x1="0" y1="4" x2="6" y2="12" stroke="#E74C3C" strokeWidth="2.5" strokeLinecap="round" />
              {/* Goodies inside */}
              <path d="M 8 2 L 14 -8 L 18 -6 L 12 4 Z" fill="#D35400" stroke="#78281F" strokeWidth="1.2" />
              <circle cx="22" cy="2" r="4" fill="#E74C3C" stroke="#78281F" strokeWidth="1.2" />
              {/* Wheels */}
              <line x1="8" y1="22" x2="8" y2="28" stroke="#34495E" strokeWidth="2" />
              <line x1="26" y1="22" x2="26" y2="28" stroke="#34495E" strokeWidth="2" />
              <circle cx="8" cy="29" r="2.5" fill="#34495E" />
              <circle cx="26" cy="29" r="2.5" fill="#34495E" />
            </g>
          </svg>
        );

      case 'study':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Wall & Floor */}
            <rect width="240" height="160" fill="#EAECEE" />
            <rect y="115" width="240" height="45" fill="#D5D8DC" />
            <line x1="0" y1="115" x2="240" y2="115" stroke="#ABB2B9" strokeWidth="2" />

            {/* Giant Tall Wooden Bookshelf (Left) */}
            <g transform="translate(20, 16)">
              {/* Outer frame */}
              <rect x="0" y="0" width="85" height="110" rx="4" fill="#5D4037" stroke="#2C1B0E" strokeWidth="2.5" />
              {/* Shelves */}
              <line x1="0" y1="36" x2="85" y2="36" stroke="#2C1B0E" strokeWidth="2.5" />
              <line x1="0" y1="72" x2="85" y2="72" stroke="#2C1B0E" strokeWidth="2.5" />

              {/* Top Shelf Books */}
              <rect x="6" y="10" width="9" height="26" rx="1.5" fill="#C0392B" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="16" y="14" width="7" height="22" rx="1.5" fill="#2980B9" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="24" y="8" width="10" height="28" rx="1.5" fill="#27AE60" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="35" y="12" width="8" height="24" rx="1.5" fill="#F39C12" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="44" y="10" width="11" height="26" rx="1.5" fill="#8E44AD" stroke="#2C1B0E" strokeWidth="1.5" />
              {/* Leaning book */}
              <rect x="58" y="14" width="7" height="24" rx="1.5" fill="#D35400" stroke="#2C1B0E" strokeWidth="1.5" transform="rotate(18 62 26)" />

              {/* Middle Shelf Books & Globe */}
              <rect x="6" y="46" width="8" height="26" rx="1.5" fill="#16A085" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="15" y="48" width="9" height="24" rx="1.5" fill="#E67E22" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="25" y="44" width="8" height="28" rx="1.5" fill="#2C3E50" stroke="#2C1B0E" strokeWidth="1.5" />
              {/* Mini Globe / Gadget */}
              <circle cx="58" cy="56" r="10" fill="#85C1E9" stroke="#2C1B0E" strokeWidth="1.8" />
              <ellipse cx="58" cy="56" rx="10" ry="3" fill="none" stroke="#2C1B0E" strokeWidth="1.2" />
              <path d="M 58 66 L 58 71 M 52 71 L 64 71" stroke="#D4AC0D" strokeWidth="2" strokeLinecap="round" />

              {/* Bottom Shelf Thick Tomes */}
              <rect x="6" y="80" width="14" height="30" rx="2" fill="#78281F" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="21" y="82" width="12" height="28" rx="2" fill="#1B4F72" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="34" y="80" width="13" height="30" rx="2" fill="#145A32" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="48" y="84" width="10" height="26" rx="2" fill="#7D6608" stroke="#2C1B0E" strokeWidth="1.5" />
              <rect x="59" y="82" width="12" height="28" rx="2" fill="#4A235A" stroke="#2C1B0E" strokeWidth="1.5" />
            </g>

            {/* Inventor's Study Desk & Gadgets (Right) */}
            <g transform="translate(115, 65)">
              {/* Desk */}
              <rect x="0" y="24" width="105" height="10" rx="3" fill="#8D6E63" stroke="#2C1B0E" strokeWidth="2.5" />
              <rect x="8" y="34" width="6" height="38" fill="#5D4037" stroke="#2C1B0E" strokeWidth="2" />
              <rect x="91" y="34" width="6" height="38" fill="#5D4037" stroke="#2C1B0E" strokeWidth="2" />

              {/* Vintage Banker's Desk Lamp with Emerald Glass */}
              <g transform="translate(8, -8)">
                <path d="M 12 32 L 12 12 Q 12 2 20 2 L 28 2" stroke="#B7950B" strokeWidth="3" fill="none" strokeLinecap="round" />
                <rect x="22" y="-2" width="20" height="9" rx="4" fill="#27AE60" stroke="#196F3D" strokeWidth="1.8" />
                {/* Glow */}
                <circle cx="32" cy="14" r="16" fill="#F9E79F" opacity="0.3" />
                <ellipse cx="12" cy="32" rx="6" ry="2" fill="#B7950B" />
              </g>

              {/* Flask / Chemistry Gadget with bubbling liquid */}
              <g transform="translate(54, 4)">
                <path d="M 8 0 L 8 6 L 2 18 Q 0 20 2 20 L 16 20 Q 18 20 16 18 L 10 6 L 10 0 Z" fill="#A2D9CE" stroke="#16A085" strokeWidth="1.5" />
                <circle cx="7" cy="15" r="1.5" fill="#1ABC9C" />
                <circle cx="11" cy="12" r="1" fill="#1ABC9C" />
              </g>

              {/* Magnifying Glass */}
              <g transform="translate(76, 12)">
                <circle cx="8" cy="8" r="7" fill="#E8F8F5" stroke="#D4AC0D" strokeWidth="2" />
                <line x1="13" y1="13" x2="22" y2="22" stroke="#784212" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Open Notebook & Feather Quill */}
              <path d="M 30 20 L 45 22 L 45 27 L 30 25 Z" fill="#FDFEFE" stroke="#2C1B0E" strokeWidth="1.2" />
              <path d="M 45 22 L 60 20 L 60 25 L 45 27 Z" fill="#F4F6F6" stroke="#2C1B0E" strokeWidth="1.2" />
            </g>
          </svg>
        );

      case 'camp':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Starry Night Sky */}
            <rect width="240" height="160" fill="#1B2631" />
            {/* Distant Mountain Silhouettes */}
            <polygon points="-10,120 45,55 110,120" fill="#283747" />
            <polygon points="80,120 145,45 210,120" fill="#212F3D" />
            <polygon points="170,120 215,65 260,120" fill="#283747" />

            {/* Glowing Moon & Constellations */}
            <circle cx="210" cy="25" r="12" fill="#F9E79F" />
            <circle cx="210" cy="25" r="16" fill="#F9E79F" opacity="0.25" />
            <circle cx="35" cy="22" r="1.5" fill="#FFFFFF" />
            <circle cx="55" cy="16" r="1.5" fill="#FFFFFF" />
            <circle cx="75" cy="30" r="1.5" fill="#FFFFFF" />
            <circle cx="95" cy="20" r="1.5" fill="#FFFFFF" />
            <line x1="35" y1="22" x2="55" y2="16" stroke="#FFFFFF" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
            <line x1="55" y1="16" x2="75" y2="30" stroke="#FFFFFF" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />
            <line x1="75" y1="30" x2="95" y2="20" stroke="#FFFFFF" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6" />

            {/* Forest Ground */}
            <rect y="115" width="240" height="45" fill="#145A32" />
            <path d="M 0 115 Q 60 108 120 115 Q 180 122 240 115 L 240 160 L 0 160 Z" fill="#0E3A22" />

            {/* Pine Trees (Right) */}
            <g transform="translate(180, 50)">
              <rect x="18" y="55" width="8" height="25" fill="#4A2810" />
              <polygon points="22,10 5,30 39,30" fill="#196F3D" stroke="#0E3A22" strokeWidth="2" />
              <polygon points="22,25 2,46 42,46" fill="#145A32" stroke="#0E3A22" strokeWidth="2" />
              <polygon points="22,40 -2,62 46,62" fill="#0B4224" stroke="#0E3A22" strokeWidth="2" />
            </g>

            {/* Cozy Triangle Tent (Left) */}
            <g transform="translate(30, 58)">
              {/* Tent body */}
              <polygon points="45,0 0,65 90,65" fill="#E67E22" stroke="#2C1B0E" strokeWidth="2.5" />
              {/* Tent door flaps */}
              <polygon points="45,0 45,65 15,65" fill="#D35400" stroke="#2C1B0E" strokeWidth="2" />
              <polygon points="45,0 45,65 75,65" fill="#F39C12" stroke="#2C1B0E" strokeWidth="2" />
              <polygon points="45,15 30,65 60,65" fill="#2C1B0E" opacity="0.85" />
              {/* Tent poles & ropes */}
              <line x1="45" y1="0" x2="-8" y2="70" stroke="#FDFEFE" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="45" y1="0" x2="98" y2="70" stroke="#FDFEFE" strokeWidth="1.5" strokeDasharray="3 3" />
            </g>

            {/* Crackling Campfire (Center) */}
            <g transform="translate(130, 102)">
              {/* Fire glow */}
              <circle cx="15" cy="10" r="24" fill="#F39C12" opacity="0.3" />
              {/* Firewood logs */}
              <rect x="0" y="16" width="30" height="7" rx="3.5" fill="#6E2C00" stroke="#2C1B0E" strokeWidth="2" transform="rotate(-20 15 19)" />
              <rect x="0" y="16" width="30" height="7" rx="3.5" fill="#784212" stroke="#2C1B0E" strokeWidth="2" transform="rotate(20 15 19)" />
              {/* Stone circle */}
              <circle cx="-3" cy="22" r="4" fill="#7F8C8D" stroke="#2C1B0E" strokeWidth="1.2" />
              <circle cx="8" cy="25" r="4" fill="#95A5A6" stroke="#2C1B0E" strokeWidth="1.2" />
              <circle cx="22" cy="25" r="4" fill="#7F8C8D" stroke="#2C1B0E" strokeWidth="1.2" />
              <circle cx="33" cy="22" r="4" fill="#95A5A6" stroke="#2C1B0E" strokeWidth="1.2" />
              {/* Animated-look flames */}
              <path d="M 15 22 Q 2 12 12 -4 Q 18 6 15 22 Z" fill="#E74C3C" stroke="#922B21" strokeWidth="1.5" />
              <path d="M 15 22 Q 28 10 18 -6 Q 10 4 15 22 Z" fill="#F39C12" stroke="#B9770E" strokeWidth="1.5" />
              <path d="M 15 20 Q 12 12 15 4 Q 18 12 15 20 Z" fill="#F9E79F" />
              {/* Spark embers */}
              <circle cx="8" cy="-10" r="1.5" fill="#F39C12" />
              <circle cx="22" cy="-14" r="1.2" fill="#F1C40F" />
            </g>
          </svg>
        );

      case 'hotspring':
        return (
          <svg viewBox="0 0 240 160" className="w-full h-full" fill="none">
            {/* Mountain sky */}
            <rect width="240" height="160" fill="#FEF5E7" />
            {/* Bamboo grove background */}
            <g transform="translate(10, 0)">
              <rect x="10" y="0" width="8" height="95" fill="#7DCEA0" stroke="#1E8449" strokeWidth="1.5" />
              <rect x="25" y="0" width="7" height="95" fill="#52BE80" stroke="#1E8449" strokeWidth="1.5" />
              <rect x="38" y="0" width="9" height="95" fill="#7DCEA0" stroke="#1E8449" strokeWidth="1.5" />
              <rect x="190" y="0" width="8" height="95" fill="#7DCEA0" stroke="#1E8449" strokeWidth="1.5" />
              <rect x="205" y="0" width="9" height="95" fill="#52BE80" stroke="#1E8449" strokeWidth="1.5" />
            </g>

            {/* Hot Spring Sign & Emblem (♨) */}
            <g transform="translate(100, 12)">
              <circle cx="20" cy="18" r="18" fill="#E74C3C" stroke="#922B21" strokeWidth="2" />
              <path d="M 12 24 Q 20 28 28 24" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M 14 18 Q 16 13 14 8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M 20 18 Q 22 11 20 6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M 26 18 Q 28 13 26 8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
            </g>

            {/* Natural Rock Onsen Bath (岩風呂) */}
            <g transform="translate(25, 62)">
              {/* Outer Rock Border */}
              <ellipse cx="95" cy="45" rx="90" ry="38" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="3" />
              {/* Steaming Mineral Water */}
              <ellipse cx="95" cy="45" rx="78" ry="30" fill="#5DADE2" stroke="#1B4F72" strokeWidth="2.5" />
              <ellipse cx="95" cy="45" rx="66" ry="22" fill="#85C1E9" opacity="0.8" />

              {/* Individual Natural Stones framing the tub */}
              <ellipse cx="15" cy="38" rx="16" ry="12" fill="#95A5A6" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="40" cy="68" rx="18" ry="12" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="75" cy="76" rx="20" ry="12" fill="#95A5A6" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="115" cy="76" rx="22" ry="12" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="155" cy="68" rx="18" ry="12" fill="#95A5A6" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="178" cy="40" rx="16" ry="12" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="155" cy="18" rx="18" ry="10" fill="#95A5A6" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="115" cy="12" rx="20" ry="10" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="75" cy="12" rx="20" ry="10" fill="#95A5A6" stroke="#2C3E50" strokeWidth="2" />
              <ellipse cx="38" cy="18" rx="18" ry="10" fill="#7F8C8D" stroke="#2C3E50" strokeWidth="2" />

              {/* Steam Puffs Rising */}
              <path d="M 65 35 Q 60 20 70 8 Q 80 -4 75 -16" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.75" fill="none" />
              <path d="M 95 38 Q 105 22 95 10 Q 85 -2 95 -18" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" fill="none" />
              <path d="M 125 35 Q 120 20 130 8 Q 140 -4 135 -16" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.75" fill="none" />

              {/* Wooden Bath Bucket (湯桶) floating with small towel */}
              <g transform="translate(130, 32)">
                <ellipse cx="12" cy="10" rx="12" ry="6" fill="#D35400" stroke="#4A2000" strokeWidth="1.8" />
                <rect x="0" y="10" width="24" height="8" rx="2" fill="#E59866" stroke="#4A2000" strokeWidth="1.8" />
                <ellipse cx="12" cy="18" rx="12" ry="6" fill="#D35400" stroke="#4A2000" strokeWidth="1.8" />
                {/* White folded towel */}
                <rect x="6" y="6" width="12" height="7" rx="1.5" fill="#FFFFFF" stroke="#4A2000" strokeWidth="1.2" />
              </g>

              {/* Bamboo Water Spout */}
              <g transform="translate(160, 5)">
                <rect x="0" y="8" width="22" height="8" rx="3" fill="#52BE80" stroke="#1E8449" strokeWidth="1.5" transform="rotate(15 0 8)" />
                {/* Flowing water trickling into tub */}
                <path d="M 16 16 Q 18 24 16 32" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9" />
              </g>
            </g>
          </svg>
        );

      default:
        return (
          <div className="w-full h-full bg-[#FAF8F4] flex items-center justify-center">
            <span className="text-2xl">🏡</span>
          </div>
        );
    }
  };

  if (variant === 'stamp') {
    return (
      <div className={`relative inline-block p-1 bg-white border-2 border-dashed border-[#D4C8B5] rounded-xl shadow-xs overflow-hidden ${className}`}>
        <div className="w-full h-full rounded-lg overflow-hidden border border-[#EAE5D9]">
          {renderSvg()}
        </div>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <div className={`relative rounded-2xl overflow-hidden border border-[#DDD7C8] shadow-xs bg-[#FAF8F4] ${className}`}>
        {renderSvg()}
      </div>
    );
  }

  // Default 'card' / postcard view
  return (
    <div className={`relative rounded-xl overflow-hidden border border-[#DDD7C8]/80 shadow-xs bg-[#FAF8F4] ${className}`}>
      {renderSvg()}
    </div>
  );
};
