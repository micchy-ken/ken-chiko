import React from 'react';
import { BookOpen, Settings, ShieldCheck } from 'lucide-react';
import { loadLocalKenchikoImage } from '../services/imageCompression';
import { getAssetUrl, ASSET_PATHS, handleImageError } from '../utils/assetPath';

interface DefaultUserPlaceholderProps {
  customImageUrl?: string;
  onOpenTutorial: () => void;
  onSelectUser?: () => void;
  onOpenAdmin?: () => void;
}

/**
 * デフォルトユーザー（プレイヤー未指定・プレビュー環境）専用の待機画面
 * ゲーム画面、ステージ、タイマー、シミュレーションループを一切稼働させず、
 * 画面中央にけんちこのイラストのみを配置して完全停止します。
 */
export const DefaultUserPlaceholder: React.FC<DefaultUserPlaceholderProps> = ({
  customImageUrl,
  onOpenTutorial,
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
      {/* Top Bar with subtle admin / settings buttons */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F4] hover:bg-white text-[#635A52] hover:text-[#2E2824] text-xs font-bold sketch-card-subtle transition shadow-xs cursor-pointer"
            title="管理・開発コンソール"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#487560]" />
            <span>管理画面</span>
          </button>
        )}

        {onSelectUser && (
          <button
            onClick={onSelectUser}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F4] hover:bg-white text-[#635A52] hover:text-[#2E2824] text-xs font-bold sketch-card-subtle transition shadow-xs cursor-pointer"
            title="設定・プレイヤー選択"
          >
            <Settings className="w-3.5 h-3.5 text-[#487560]" />
            <span>設定</span>
          </button>
        )}
      </div>

      {/* Main Centered Area: ONLY Kenchiko Illustration + Guide Link */}
      <div className="flex flex-col items-center justify-center max-w-sm w-full animate-fade-in">
        {/* Kenchiko Illustration */}
        <div className="w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center p-2">
          <img
            src={activeImage}
            alt="けんちこ"
            onError={(e) =>
              handleImageError(e, 'images/kihon-nyan-transparent.png')
            }
            className="max-w-full max-h-full object-contain filter drop-shadow-[0_10px_20px_rgba(46,40,36,0.15)] pointer-events-none"
          />
        </div>

        {/* Character Title */}
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-[#2E2824] tracking-wider font-handwriting">
          けんちこ
        </h1>

        <p className="mt-1 text-xs text-[#7A7269] font-medium">
          けんちこ観察日記
        </p>

        {/* How to Play Guide Link */}
        <div className="mt-6 flex flex-col items-center">
          <button
            onClick={onOpenTutorial}
            className="group inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#487560] hover:text-[#325645] bg-[#E8F0EA]/70 hover:bg-[#E8F0EA] rounded-full transition-all duration-200 cursor-pointer border border-[#487560]/20 hover:border-[#487560]/40 shadow-xs"
          >
            <BookOpen className="w-4 h-4 text-[#487560] transition-transform group-hover:scale-110" />
            <span className="underline underline-offset-4 decoration-[#487560]/40 group-hover:decoration-[#487560]">
              遊び方ガイド
            </span>
          </button>
        </div>
      </div>

      {/* Subtle Footer Note */}
      <div className="absolute bottom-4 text-center">
        <p className="text-[11px] text-[#9E968D]">
          プレイするにはURLに「?user=お名前」を指定してください
        </p>
      </div>
    </div>
  );
};
