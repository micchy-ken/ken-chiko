import React from 'react';
import { User, Settings, ShieldCheck } from 'lucide-react';
import { loadLocalKenchikoImage } from '../services/imageCompression';
import { getAssetUrl, ASSET_PATHS, handleImageError } from '../utils/assetPath';

interface DefaultUserPlaceholderProps {
  customImageUrl?: string;
  onSelectUser: () => void;
  onOpenAdmin: () => void;
}

/**
 * デフォルトユーザー（プレイヤー未指定・プレビュー環境）専用の待機画面
 * ゲーム画面、ステージ、タイマー、シミュレーションループを一切稼働させず、
 * 画面中央にけんちこのイラストのみを配置して完全停止します。
 */
export const DefaultUserPlaceholder: React.FC<DefaultUserPlaceholderProps> = ({
  customImageUrl,
  onSelectUser,
  onOpenAdmin,
}) => {
  const rawImage =
    customImageUrl ||
    loadLocalKenchikoImage() ||
    ASSET_PATHS.KIHON_NYAN_TRANSPARENT;
  const activeImage = getAssetUrl(rawImage);

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#3E3833] flex flex-col items-center justify-center p-6 select-none relative font-['Zen_Maru_Gothic','M_PLUS_Rounded_1c',sans-serif]">
      {/* Top Bar with subtle admin / switch user buttons */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={onOpenAdmin}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F4] hover:bg-white text-[#635A52] hover:text-[#2E2824] text-xs font-bold sketch-card-subtle transition shadow-xs"
          title="管理・開発コンソール"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#487560]" />
          <span>管理画面</span>
        </button>

        <button
          onClick={onSelectUser}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F4] hover:bg-white text-[#635A52] hover:text-[#2E2824] text-xs font-bold sketch-card-subtle transition shadow-xs"
          title="プレイヤーを選択"
        >
          <Settings className="w-3.5 h-3.5 text-[#487560]" />
          <span>設定</span>
        </button>
      </div>

      {/* Main Centered Area: ONLY Kenchiko Illustration */}
      <div className="flex flex-col items-center justify-center max-w-sm w-full animate-fade-in">
        {/* Clickable Kenchiko Illustration */}
        <button
          onClick={onSelectUser}
          className="group relative flex items-center justify-center p-4 transition-transform duration-300 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer"
          title="タップしてプレイヤーを選択してはじめる"
        >
          <div className="w-60 h-60 sm:w-72 sm:h-72 flex items-center justify-center">
            <img
              src={activeImage}
              alt="けんちこ"
              onError={(e) =>
                handleImageError(e, 'images/kihon-nyan-transparent.png')
              }
              className="max-w-full max-h-full object-contain filter drop-shadow-[0_10px_20px_rgba(46,40,36,0.15)]"
            />
          </div>
        </button>

        {/* Gentle Character Name */}
        <h1 className="mt-3 text-xl sm:text-2xl font-black text-[#2E2824] tracking-wider font-handwriting">
          けんちこ
        </h1>

        <p className="mt-1 text-xs text-[#7A7269] font-medium">
          プレイヤー未選択（待機中）
        </p>

        {/* Play / Select Player Button */}
        <div className="mt-6 flex flex-col items-center gap-2 w-full max-w-xs">
          <button
            onClick={onSelectUser}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#3E3833] hover:bg-[#2E2824] text-[#FAF8F4] text-sm font-black sketch-border shadow-md transition-all duration-200 active:translate-y-0.5 cursor-pointer"
          >
            <User className="w-4 h-4 text-[#C2B7A3]" />
            <span className="font-handwriting">プレイヤーを選択してはじめる</span>
          </button>
        </div>
      </div>

      {/* Subtle Footer Note */}
      <div className="absolute bottom-4 text-center">
        <p className="text-[11px] text-[#9E968D]">
          URLパラメータ（?user=名前）または上のボタンから遊ぶ人を選んでください
        </p>
      </div>
    </div>
  );
};
