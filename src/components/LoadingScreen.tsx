import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, ArrowRight, Cloud, RefreshCw } from 'lucide-react';
import { loadLocalKenchikoImage } from '../services/imageCompression';
import { getAssetUrl, ASSET_PATHS, handleImageError } from '../utils/assetPath';
import { MasterFetchStatus } from '../services/firebaseSync';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  customImageUrl?: string;
  currentUserId?: string | null;
  masterStatus?: MasterFetchStatus | null;
  onSkip?: () => void;
}

/**
 * LoadingScreen: けんちこワールド起動・ユーザー切替時のロード画面
 * 温かみのある手描き和紙トーンと、ぴょこぴょこ動くけんちこのアニメーションで
 * クラウド同期やデータ準備の待機時間を心地よく演出します。
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message,
  subMessage,
  customImageUrl,
  currentUserId,
  masterStatus,
  onSkip,
}) => {
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [showSkipButton, setShowSkipButton] = useState<boolean>(false);

  // 経過秒数のカウント（一定時間経過でスキップボタンや安心メッセージを表示）
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 0.5);
    }, 500);

    // 2.5秒経過したら手動開始ボタンを表示（通信詰まり対策）
    const skipTimer = setTimeout(() => {
      setShowSkipButton(true);
    }, 2500);

    return () => {
      clearInterval(interval);
      clearTimeout(skipTimer);
    };
  }, []);

  const rawImage =
    customImageUrl ||
    loadLocalKenchikoImage() ||
    ASSET_PATHS.KIHON_NYAN_TRANSPARENT;
  const activeImage = getAssetUrl(rawImage);

  // 経過時間に応じた動的ステータステキスト
  const getDynamicStatusText = () => {
    if (message) return message;
    if (elapsedSec < 1.2) {
      return currentUserId
        ? `${currentUserId} さんのセーブデータを準備中...`
        : 'けんちこワールドを準備中...';
    }
    if (elapsedSec < 2.8) {
      return 'マスターデータとにゃんこ図鑑を同期中🐾';
    }
    if (elapsedSec < 4.5) {
      return 'お散歩の記録と思い出絵日記を整えています...';
    }
    return 'まもなく完了します（ローカルデータ保護中）';
  };

  return (
    <div
      id="kenchiko-loading-screen"
      className="fixed inset-0 z-50 min-h-screen bg-[#F4F1EA] text-[#3E3833] flex flex-col items-center justify-center p-6 select-none font-['Zen_Maru_Gothic','M_PLUS_Rounded_1c',sans-serif]"
    >
      {/* Background Subtle Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(#E8DFC8_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      {/* Main Centered Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
        {/* Animated Kenchiko Character */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center mb-4">
          {/* Subtle pulsating halo */}
          <div className="absolute inset-4 rounded-full bg-[#EADDCA]/60 animate-ping opacity-25" />
          <div className="absolute inset-2 rounded-full bg-[#EFE7D8] shadow-inner" />

          {/* Bouncing character illustration */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center animate-bounce">
            <img
              src={activeImage}
              alt="けんちこ"
              onError={(e) =>
                handleImageError(e, 'images/kihon-nyan-transparent.png')
              }
              className="max-w-full max-h-full object-contain filter drop-shadow-[0_8px_16px_rgba(46,40,36,0.18)] pointer-events-none"
            />
          </div>

          {/* Floating Paw Prints */}
          <div className="absolute -top-1 -right-1 text-base animate-pulse">🐾</div>
          <div className="absolute bottom-2 -left-2 text-xs opacity-75 animate-bounce">🐾</div>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-[#2E2824] tracking-wider font-handwriting">
          けんちこワールド
        </h2>

        {/* Status Message */}
        <div className="mt-3 flex items-center justify-center gap-2 text-[#6C421A] min-h-[28px]">
          <Loader2 className="w-4 h-4 animate-spin text-[#8A532A] shrink-0" />
          <p className="font-handwriting text-sm sm:text-base font-bold tracking-wide">
            {getDynamicStatusText()}
          </p>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-48 sm:w-60 h-2 bg-[#E5DBC7] rounded-full mt-4 overflow-hidden shadow-inner border border-[#D5C9B3]">
          <div
            className="h-full bg-gradient-to-r from-[#8A532A] to-[#D97706] rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.min(95, Math.max(15, elapsedSec * 28))}%`,
            }}
          />
        </div>

        {/* Sub-note / Reassurance */}
        <p className="mt-4 text-xs text-[#8A7D71] font-medium leading-relaxed max-w-xs">
          {subMessage ||
            'データは端末内（ローカル）にも安全に保護されています。'}
        </p>

        {/* Master status pill if available */}
        {masterStatus?.fetchedFromCloud && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#E8F0EA] border border-[#C5DDCB] text-[#345B42] text-[11px] font-bold rounded-full">
            <Sparkles className="w-3 h-3 text-[#487560]" />
            <span>最新マスター確認完了</span>
          </div>
        )}

        {/* Skip / Force Start Button (Shown if loading takes > 2.5 seconds) */}
        {showSkipButton && onSkip && (
          <div className="mt-6 animate-fade-in">
            <button
              onClick={onSkip}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F4] hover:bg-white text-[#6C421A] text-xs font-bold rounded-full border border-[#D4C4AE] shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
            >
              <span>今すぐセカイに入る</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#8A532A]" />
            </button>
          </div>
        )}
      </div>

      {/* Footnote */}
      <div className="absolute bottom-4 text-center">
        <p className="text-[11px] text-[#A3998D] font-mono">
          Kenchiko World · Loading
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
