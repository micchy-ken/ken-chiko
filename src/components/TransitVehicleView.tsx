import React, { useState } from 'react';
import { TransportMethod, NyanCharacter } from '../types';
import { getAssetUrl, handleImageError } from '../utils/assetPath';
import { loadLocalKenchikoImage } from '../services/imageCompression';
import { NyanIllustration } from './NyanIllustration';
import { Wind, Sparkles, Cloud, Footprints } from 'lucide-react';

interface TransitVehicleViewProps {
  transportMethod: TransportMethod | null;
  kenchikoImageUrl?: string;
  characters?: NyanCharacter[];
  targetLocationName?: string;
  size?: number;
}

export const TransitVehicleView: React.FC<TransitVehicleViewProps> = ({
  transportMethod = 'walk',
  kenchikoImageUrl,
  characters = [],
  targetLocationName,
  size = 280,
}) => {
  const [jinbeiImgError, setJinbeiImgError] = useState(false);

  // 1. Kenchiko avatar image
  const rawKenchikoImg = kenchikoImageUrl || loadLocalKenchikoImage() || '';
  const activeKenchikoImg = getAssetUrl(rawKenchikoImg);

  // 2. Jinbei-nyan lookup from Nyanko Zukan (No. 205)
  const jinbeiChar = characters.find(
    (c) => c.no === 205 || c.name.includes('じんべえ') || c.name.includes('じんべい')
  );

  // Jinbei-nyan vehicle mount: always prioritize transparent cut-out illustration
  const isCustomUserUpload =
    jinbeiChar?.customImageUrl?.startsWith('data:') ||
    jinbeiChar?.customImageUrl?.startsWith('blob:');
  const jinbeiCandidateUrl = isCustomUserUpload
    ? getAssetUrl(jinbeiChar!.customImageUrl)
    : getAssetUrl('images/jinbei-nyan-transparent.png');

  // Fallback authentic Jinbei-nyan SVG illustration if external file is absent
  const renderFallbackJinbeiSvg = () => (
    <div className="relative w-44 h-32 flex items-center justify-center">
      {/* Whale shark cat body SVG */}
      <svg viewBox="0 0 200 130" className="w-full h-full drop-shadow-md">
        {/* Soft whale shark body with light blue / navy gradient tone */}
        <path
          d="M 20 65 Q 25 25 80 20 Q 145 20 185 50 Q 195 65 180 75 Q 140 105 80 100 Q 30 95 20 65 Z"
          fill="#4A7596"
          stroke="#2E3E4E"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        {/* Dorsal fin (背びれ) */}
        <path
          d="M 85 20 Q 95 0 115 5 Q 108 18 102 20 Z"
          fill="#3B6282"
          stroke="#2E3E4E"
          strokeWidth="3"
        />
        {/* Pectoral fin (胸びれ) */}
        <path
          d="M 70 85 Q 75 118 95 115 Q 92 95 85 85 Z"
          fill="#3B6282"
          stroke="#2E3E4E"
          strokeWidth="3"
        />
        {/* Tail fin (尾びれ) */}
        <path
          d="M 22 65 Q 5 40 2 28 Q 12 48 20 58 Q 10 75 4 95 Q 8 82 22 65 Z"
          fill="#3B6282"
          stroke="#2E3E4E"
          strokeWidth="3"
        />
        {/* Underbelly white pattern */}
        <path
          d="M 40 75 Q 80 96 140 92 Q 170 80 180 75 Q 140 85 80 82 Q 50 80 40 75 Z"
          fill="#EBF3F8"
          stroke="#2E3E4E"
          strokeWidth="2.5"
        />
        {/* White whale shark spots */}
        <circle cx="55" cy="50" r="3" fill="#FFFFFF" opacity="0.9" />
        <circle cx="75" cy="42" r="3.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="95" cy="38" r="3" fill="#FFFFFF" opacity="0.9" />
        <circle cx="115" cy="40" r="3.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="68" cy="62" r="3" fill="#FFFFFF" opacity="0.9" />
        <circle cx="88" cy="56" r="3.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="108" cy="54" r="3" fill="#FFFFFF" opacity="0.9" />
        <circle cx="128" cy="55" r="3.5" fill="#FFFFFF" opacity="0.9" />
        <circle cx="145" cy="60" r="3" fill="#FFFFFF" opacity="0.9" />
        {/* Cat Ears */}
        <polygon points="155,30 168,10 178,35" fill="#4A7596" stroke="#2E3E4E" strokeWidth="3" />
        <polygon points="160,28 168,16 173,32" fill="#F4B8C1" />
        <polygon points="135,24 145,5 155,27" fill="#4A7596" stroke="#2E3E4E" strokeWidth="3" />
        <polygon points="139,22 145,12 150,25" fill="#F4B8C1" />
        {/* Cat deadpan face */}
        <circle cx="168" cy="48" r="3.5" fill="#2E2824" />
        <circle cx="180" cy="52" r="3.5" fill="#2E2824" />
        <path d="M 172 56 Q 175 60 178 56" fill="none" stroke="#2E2824" strokeWidth="2" strokeLinecap="round" />
        {/* Whiskers */}
        <line x1="184" y1="50" x2="196" y2="48" stroke="#2E2824" strokeWidth="1.8" />
        <line x1="184" y1="55" x2="195" y2="57" stroke="#2E2824" strokeWidth="1.8" />
        {/* Festive fairy lights wrapped around body */}
        <path d="M 45 60 Q 80 40 120 70 Q 150 50 175 65" fill="none" stroke="#D9822B" strokeWidth="1.5" strokeDasharray="3 5" />
        <circle cx="60" cy="52" r="3" fill="#FFD54F" className="animate-ping" />
        <circle cx="95" cy="52" r="3" fill="#81C784" className="animate-pulse" />
        <circle cx="135" cy="62" r="3" fill="#FF8A80" className="animate-pulse" />
        <circle cx="165" cy="58" r="3" fill="#FFD54F" className="animate-ping" />
      </svg>
    </div>
  );

  // -------------------------------------------------------------------------
  // RENDER VEHICLES ACCORDING TO TRANSPORT METHOD
  // -------------------------------------------------------------------------

  // A. JINBEI-NYAN (じんべえにゃん)
  if (transportMethod === 'jinbei_nyan') {
    return (
      <div
        className="relative flex flex-col items-center justify-center select-none py-2"
        style={{ width: size, minHeight: size * 0.95 }}
      >
        {/* Sky / Cloud atmosphere */}
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none opacity-40 px-2">
          <Cloud className="w-8 h-8 text-[#A0C4DF] animate-pulse" />
          <Sparkles className="w-6 h-6 text-[#E4C268] animate-spin" style={{ animationDuration: '6s' }} />
          <Cloud className="w-10 h-10 text-[#A0C4DF] translate-y-6" />
        </div>

        {/* Floating Jinbei-nyan Mount + Kenchiko on Back */}
        <div className="relative z-10 flex flex-col items-center animate-bounce" style={{ animationDuration: '3s' }}>
          {/* Kenchiko sitting comfortably on Jinbei-nyan's back */}
          <div className="relative z-20 -mb-10 sm:-mb-12 -translate-x-2 transition-transform">
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
              {activeKenchikoImg ? (
                <img
                  src={activeKenchikoImg}
                  alt="けんちこ"
                  onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
                  className="max-w-full max-h-full object-contain filter drop-shadow-[0_4px_8px_rgba(46,40,36,0.22)]"
                />
              ) : (
                <div className="text-3xl">🐱</div>
              )}
            </div>
          </div>

          {/* Jinbei-nyan Cutout Illustration */}
          <div className="relative z-10 filter drop-shadow-[0_10px_20px_rgba(46,40,36,0.18)]">
            {!jinbeiImgError ? (
              <img
                src={jinbeiCandidateUrl}
                alt="じんべえにゃん"
                onError={() => setJinbeiImgError(true)}
                className="w-56 h-40 sm:w-64 sm:h-44 object-contain filter drop-shadow-[0_6px_14px_rgba(46,40,36,0.16)]"
                referrerPolicy="no-referrer"
              />
            ) : jinbeiChar ? (
              <div className="w-56 h-40 flex items-center justify-center">
                <NyanIllustration nyan={jinbeiChar} size={160} transparent={true} />
              </div>
            ) : (
              renderFallbackJinbeiSvg()
            )}
          </div>

          {/* Floating Cloud Platform underneath */}
          <div className="flex items-center gap-2 -mt-4 opacity-80">
            <span className="text-xl animate-pulse">☁️</span>
            <span className="text-2xl">☁️</span>
            <span className="text-xl animate-pulse">☁️</span>
          </div>
        </div>

        {/* Caption Banner */}
        <div className="relative z-10 mt-3 bg-[#EAF2F8] border border-[#B8D2E4] px-3.5 py-1 rounded-full text-xs font-bold text-[#2A4D69] flex items-center gap-1.5 shadow-xs font-handwriting">
          <Sparkles className="w-3.5 h-3.5 text-[#3A75A4]" />
          <span>じんべえにゃん号で空の旅 ✨</span>
        </div>
      </div>
    );
  }

  // B. BICYCLE (じてんしゃ)
  if (transportMethod === 'bicycle') {
    return (
      <div
        className="relative flex flex-col items-center justify-center select-none py-2"
        style={{ width: size, minHeight: size * 0.95 }}
      >
        {/* Speed wind lines */}
        <div className="absolute top-8 left-2 flex flex-col gap-1 text-[#8C7E72] opacity-40">
          <div className="w-8 h-0.5 bg-[#8C7E72] rounded-full animate-pulse" />
          <div className="w-12 h-0.5 bg-[#8C7E72] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          {/* Kenchiko Riding On Saddle */}
          <div className="relative z-20 translate-y-7 -translate-x-2 animate-bounce" style={{ animationDuration: '1.2s' }}>
            <div className="w-24 h-24 sm:w-26 sm:h-26 flex items-center justify-center">
              {activeKenchikoImg ? (
                <img
                  src={activeKenchikoImg}
                  alt="けんちこ"
                  onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
                  className="max-w-full max-h-full object-contain filter drop-shadow-[0_4px_8px_rgba(46,40,36,0.15)]"
                />
              ) : (
                <div className="text-4xl">🐱</div>
              )}
            </div>
          </div>

          {/* Hand-drawn Sketch Bicycle SVG */}
          <div className="relative z-10">
            <svg viewBox="0 0 200 120" className="w-48 h-32 drop-shadow-md">
              {/* Ground shadow */}
              <ellipse cx="100" cy="112" rx="75" ry="6" fill="#DDD7C8" opacity="0.6" />

              {/* Rear Wheel */}
              <g className="origin-[45px_80px]">
                <circle cx="45" cy="80" r="28" fill="#FFFDF9" stroke="#3E3833" strokeWidth="3" />
                <circle cx="45" cy="80" r="24" fill="none" stroke="#A89F91" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="45" cy="80" r="4" fill="#3E3833" />
                {/* Spokes */}
                <line x1="45" y1="52" x2="45" y2="108" stroke="#A89F91" strokeWidth="1.2" />
                <line x1="17" y1="80" x2="73" y2="80" stroke="#A89F91" strokeWidth="1.2" />
                <line x1="25" y1="60" x2="65" y2="100" stroke="#A89F91" strokeWidth="1.2" />
                <line x1="25" y1="100" x2="65" y2="60" stroke="#A89F91" strokeWidth="1.2" />
              </g>

              {/* Front Wheel */}
              <g className="origin-[155px_80px]">
                <circle cx="155" cy="80" r="28" fill="#FFFDF9" stroke="#3E3833" strokeWidth="3" />
                <circle cx="155" cy="80" r="24" fill="none" stroke="#A89F91" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="155" cy="80" r="4" fill="#3E3833" />
                {/* Spokes */}
                <line x1="155" y1="52" x2="155" y2="108" stroke="#A89F91" strokeWidth="1.2" />
                <line x1="127" y1="80" x2="183" y2="80" stroke="#A89F91" strokeWidth="1.2" />
                <line x1="135" y1="60" x2="175" y2="100" stroke="#A89F91" strokeWidth="1.2" />
                <line x1="135" y1="100" x2="175" y2="60" stroke="#A89F91" strokeWidth="1.2" />
              </g>

              {/* Bicycle Diamond Frame (Pastel Sage Green) */}
              <path
                d="M 45 80 L 92 80 L 140 45 L 88 45 Z"
                fill="none"
                stroke="#5E836A"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="45" y1="80" x2="88" y2="45" stroke="#5E836A" strokeWidth="4" strokeLinecap="round" />
              <line x1="92" y1="80" x2="88" y2="35" stroke="#5E836A" strokeWidth="4" strokeLinecap="round" />
              <line x1="155" y1="80" x2="140" y2="30" stroke="#5E836A" strokeWidth="4" strokeLinecap="round" />

              {/* Saddle (サドル) */}
              <path d="M 76 34 Q 88 30 102 34 Q 96 39 82 38 Z" fill="#3E3833" stroke="#2E2824" strokeWidth="2" />

              {/* Handlebar & Bell (ハンドル) */}
              <path d="M 136 30 L 144 22 L 138 20" fill="none" stroke="#3E3833" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="140" cy="18" r="3" fill="#E5B25D" stroke="#3E3833" strokeWidth="1" />

              {/* Front Basket (カゴ) */}
              <rect x="146" y="24" width="22" height="18" rx="3" fill="#EAE5D9" stroke="#3E3833" strokeWidth="2" />
              <line x1="153" y1="24" x2="153" y2="42" stroke="#3E3833" strokeWidth="1" />
              <line x1="161" y1="24" x2="161" y2="42" stroke="#3E3833" strokeWidth="1" />
              <line x1="146" y1="33" x2="168" y2="33" stroke="#3E3833" strokeWidth="1" />
              {/* Little Flower / snack in basket */}
              <circle cx="157" cy="22" r="3" fill="#F07C82" />

              {/* Pedals & Chain ring */}
              <circle cx="92" cy="80" r="7" fill="#FFFDF9" stroke="#3E3833" strokeWidth="2.5" />
              <line x1="92" y1="80" x2="98" y2="92" stroke="#3E3833" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="94" y="91" width="9" height="3" rx="1" fill="#3E3833" />
            </svg>
          </div>
        </div>

        {/* Road Surface & Motion Line */}
        <div className="w-48 h-1 border-b-2 border-dashed border-[#8C7E72] -mt-1 opacity-70" />

        {/* Caption */}
        <div className="relative z-10 mt-3 bg-[#EEF4F0] border border-[#C6D8CD] px-3.5 py-1 rounded-full text-xs font-bold text-[#3D5C45] flex items-center gap-1.5 shadow-xs font-handwriting">
          <Wind className="w-3.5 h-3.5 text-[#527D5E]" />
          <span>自転車でスイスイ快走中 🚲</span>
        </div>
      </div>
    );
  }

  // C. CAR (くるま / アクア)
  if (transportMethod === 'car') {
    return (
      <div
        className="relative flex flex-col items-center justify-center select-none py-2"
        style={{ width: size, minHeight: size * 0.95 }}
      >
        {/* Speed trails */}
        <div className="absolute top-12 left-2 flex flex-col gap-1.5 text-[#8C7E72] opacity-40">
          <div className="w-10 h-0.5 bg-[#8C7E72] rounded-full animate-pulse" />
          <div className="w-6 h-0.5 bg-[#8C7E72] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          {/* Kenchiko in Driver's Window */}
          <div className="relative z-20 translate-y-9 translate-x-3 animate-bounce" style={{ animationDuration: '0.8s' }}>
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
              {activeKenchikoImg ? (
                <img
                  src={activeKenchikoImg}
                  alt="けんちこ"
                  onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
                  className="max-w-full max-h-full object-contain filter drop-shadow-[0_4px_8px_rgba(46,40,36,0.15)]"
                />
              ) : (
                <div className="text-3xl">🐱</div>
              )}
            </div>
          </div>

          {/* Cute Compact Aqua-style Car SVG */}
          <div className="relative z-10">
            <svg viewBox="0 0 220 110" className="w-56 h-28 drop-shadow-md">
              {/* Ground shadow */}
              <ellipse cx="110" cy="102" rx="90" ry="6" fill="#DDD7C8" opacity="0.6" />

              {/* Car Body (Aqua Style Compact Hatchback, Soft Pale Aqua Blue) */}
              <path
                d="M 25 82 Q 18 80 18 68 Q 20 54 45 46 Q 70 30 115 28 Q 160 28 185 45 Q 205 52 205 68 Q 205 82 195 82 Z"
                fill="#5B9BBF"
                stroke="#2A4B60"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />

              {/* Roof & Pillars */}
              <path
                d="M 62 46 Q 90 32 125 32 Q 160 32 178 46 Z"
                fill="#3E7596"
                opacity="0.3"
              />

              {/* Front Windshield & Window Glass */}
              <path
                d="M 68 47 L 98 47 L 98 62 L 56 62 Q 58 52 68 47 Z"
                fill="#E8F4FA"
                stroke="#2A4B60"
                strokeWidth="2.5"
              />
              <path
                d="M 104 47 L 148 47 L 158 62 L 104 62 Z"
                fill="#E8F4FA"
                stroke="#2A4B60"
                strokeWidth="2.5"
              />
              {/* Window reflection */}
              <line x1="112" y1="50" x2="135" y2="58" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

              {/* Headlight & Tail light */}
              <path d="M 198 58 Q 204 60 204 68 L 196 68 Z" fill="#FFF385" stroke="#2A4B60" strokeWidth="2" />
              <path d="M 19 62 Q 18 68 22 72 L 25 64 Z" fill="#F05A5A" stroke="#2A4B60" strokeWidth="1.5" />

              {/* Front Bumper & Door line */}
              <line x1="101" y1="47" x2="101" y2="82" stroke="#2A4B60" strokeWidth="2" />
              <rect x="108" y="66" width="7" height="2.5" rx="1" fill="#2A4B60" />

              {/* Wheels (Front & Rear) */}
              <g>
                <circle cx="58" cy="85" r="17" fill="#2E2824" stroke="#1A1816" strokeWidth="2" />
                <circle cx="58" cy="85" r="10" fill="#EAE5D9" stroke="#3E3833" strokeWidth="2" />
                <circle cx="58" cy="85" r="3.5" fill="#2E2824" />
                {/* Spoke marks */}
                <circle cx="58" cy="85" r="7" fill="none" stroke="#A89F91" strokeWidth="1" strokeDasharray="2 3" />
              </g>

              <g>
                <circle cx="165" cy="85" r="17" fill="#2E2824" stroke="#1A1816" strokeWidth="2" />
                <circle cx="165" cy="85" r="10" fill="#EAE5D9" stroke="#3E3833" strokeWidth="2" />
                <circle cx="165" cy="85" r="3.5" fill="#2E2824" />
                <circle cx="165" cy="85" r="7" fill="none" stroke="#A89F91" strokeWidth="1" strokeDasharray="2 3" />
              </g>

              {/* Exhaust Smoke puff */}
              <circle cx="10" cy="80" r="4" fill="#DDD7C8" opacity="0.7" />
              <circle cx="4" cy="76" r="3" fill="#DDD7C8" opacity="0.5" />
            </svg>
          </div>
        </div>

        {/* Road Surface */}
        <div className="w-56 h-1 border-b-2 border-dashed border-[#8C7E72] -mt-1 opacity-70" />

        {/* Caption */}
        <div className="relative z-10 mt-3 bg-[#EAF2F8] border border-[#B8D2E4] px-3.5 py-1 rounded-full text-xs font-bold text-[#2A4D69] flex items-center gap-1.5 shadow-xs font-handwriting">
          <span>🚗</span>
          <span>愛車（アクア）でドライブ中 💨</span>
        </div>
      </div>
    );
  }

  // D. TRAIN (しんかんせん)
  if (transportMethod === 'train') {
    return (
      <div
        className="relative flex flex-col items-center justify-center select-none py-2"
        style={{ width: size, minHeight: size * 0.95 }}
      >
        <div className="relative z-10 flex flex-col items-center">
          {/* Kenchiko in Train Window */}
          <div className="relative z-20 translate-y-8 translate-x-2 animate-bounce" style={{ animationDuration: '0.6s' }}>
            <div className="w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
              {activeKenchikoImg ? (
                <img
                  src={activeKenchikoImg}
                  alt="けんちこ"
                  onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
                  className="max-w-full max-h-full object-contain filter drop-shadow-[0_4px_8px_rgba(46,40,36,0.15)]"
                />
              ) : (
                <div className="text-3xl">🐱</div>
              )}
            </div>
          </div>

          {/* Shinkansen SVG */}
          <div className="relative z-10">
            <svg viewBox="0 0 220 95" className="w-56 h-24 drop-shadow-md">
              <ellipse cx="110" cy="90" rx="95" ry="4" fill="#DDD7C8" opacity="0.6" />
              {/* Bullet Train Nose & Body */}
              <path
                d="M 20 75 L 155 75 Q 185 75 205 60 Q 215 50 195 45 Q 165 40 140 40 L 20 40 Z"
                fill="#FAF8F5"
                stroke="#2A3D52"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              {/* Blue Stripe */}
              <path d="M 20 62 L 165 62 Q 188 62 198 56 L 20 56 Z" fill="#2E6BA8" />
              {/* Train Windows */}
              <rect x="40" y="45" width="22" height="12" rx="2" fill="#2E3E4E" />
              <rect x="75" y="45" width="24" height="12" rx="2" fill="#E8F4FA" stroke="#2E3E4E" strokeWidth="2" />
              <rect x="112" y="45" width="22" height="12" rx="2" fill="#2E3E4E" />
              {/* Cockpit Window */}
              <path d="M 165 44 Q 180 44 190 50 L 175 52 Z" fill="#2E3E4E" />
            </svg>
          </div>
        </div>

        {/* Rail Tracks */}
        <div className="w-56 h-1 border-b-2 border-dashed border-[#5A6E82] -mt-1 opacity-70" />

        <div className="relative z-10 mt-3 bg-[#FAF8F5] border border-[#DDD7C8] px-3.5 py-1 rounded-full text-xs font-bold text-[#2E3E4E] flex items-center gap-1.5 shadow-xs font-handwriting">
          <span>🚅</span>
          <span>しんかんせんで超高速移動！</span>
        </div>
      </div>
    );
  }

  // E. DEFAULT / WALK (とほ)
  return (
    <div
      className="relative flex flex-col items-center justify-center select-none py-2"
      style={{ width: size, minHeight: size * 0.95 }}
    >
      <div className="relative z-10 flex flex-col items-center animate-bounce" style={{ animationDuration: '1.2s' }}>
        <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
          {activeKenchikoImg ? (
            <img
              src={activeKenchikoImg}
              alt="けんちこ"
              onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
              className="max-w-full max-h-full object-contain filter drop-shadow-[0_6px_14px_rgba(46,40,36,0.2)]"
            />
          ) : (
            <div className="text-5xl">🐱</div>
          )}
        </div>
      </div>

      {/* Walking Footprints Trail */}
      <div className="flex items-center gap-3 text-[#8C7E72] mt-1 opacity-70">
        <Footprints className="w-4 h-4 -rotate-12" />
        <Footprints className="w-4 h-4 rotate-12" />
        <Footprints className="w-4 h-4 -rotate-12" />
      </div>

      <div className="relative z-10 mt-3 bg-[#FAF8F4] border border-[#DDD7C8] px-3.5 py-1 rounded-full text-xs font-bold text-[#6B5A4E] flex items-center gap-1.5 shadow-xs font-handwriting">
        <Footprints className="w-3.5 h-3.5 text-[#8C5A3E]" />
        <span>てくてく自分の足でお散歩 🐾</span>
      </div>
    </div>
  );
};
