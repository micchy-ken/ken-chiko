/**
 * SpecialGiftModal.tsx
 * 
 * yumi様あてのデータ復旧のお詫びと感謝の特別プレゼント（1,000ポイント）モーダル。
 * 1回限りの受け取りを保証し、ガラポン福引（5回分）へのスムーズな導線を提供。
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Sparkles, Heart, Dices, X, Check } from 'lucide-react';
import { GARAPON_COST } from '../types/rewards';
import confetti from '../utils/confetti';

interface SpecialGiftModalProps {
  isOpen: boolean;
  recipientName: string;
  pointsAmount: number;
  onClaim: (andOpenGarapon: boolean) => void;
  onClose: () => void;
}

export const SpecialGiftModal: React.FC<SpecialGiftModalProps> = ({
  isOpen,
  recipientName,
  pointsAmount,
  onClaim,
  onClose,
}) => {
  if (!isOpen) return null;

  const spinsCount = Math.floor(pointsAmount / GARAPON_COST);

  const handleClaim = (openGarapon: boolean) => {
    confetti();
    onClaim(openGarapon);
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/75 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-[#FFFDF9] border-4 border-[#C8744E] rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#2E2824] overflow-hidden text-center space-y-5"
        >
          {/* Top-right close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FAF8F4] hover:bg-[#EAE5D9] text-[#7A726A] hover:text-[#2E2824] border border-[#D5CEBF] flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Festive Icon & Heading */}
          <div className="space-y-2">
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-[#FEF3C7] to-[#FDE68A] border-3 border-[#D97706] shadow-md text-4xl mb-1">
              <span>🎁</span>
              <span className="absolute -top-1 -right-1 text-xl animate-bounce">
                ✨
              </span>
            </div>

            <div className="inline-block px-3 py-1 rounded-full bg-[#FDF0EB] border border-[#F6D0C1] text-[#C8744E] text-xs font-black">
              {recipientName} 様へ
            </div>

            <h2 className="text-xl sm:text-2xl font-black font-handwriting text-[#2E2824] tracking-wide">
              けんちこからの特別プレゼント！
            </h2>

            <p className="text-xs sm:text-sm font-handwriting text-[#5A524A] leading-relaxed max-w-sm mx-auto">
              データ復旧のお詫びと、いつもけんちこを温かく見守ってくださる由美さんへの日頃の感謝を込めて、特別ポイントをお届けします🐾
            </p>
          </div>

          {/* Points Highlight Card */}
          <div className="p-4 bg-gradient-to-br from-[#FFF8E7] to-[#FEF3C7] rounded-2xl border-2 border-[#F59E0B] shadow-inner space-y-2">
            <div className="text-[11px] font-bold text-[#92400E] flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              <span>特別付与ポイント</span>
            </div>

            <div className="text-3xl sm:text-4xl font-black font-handwriting text-[#B45309] tracking-wider drop-shadow-xs">
              +{pointsAmount.toLocaleString()} <span className="text-xl">pt</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-[#FCD34D] text-[11px] font-bold text-[#78350F]">
              <Dices className="w-3.5 h-3.5 text-[#D97706]" />
              <span>ガラポン福引がたっぷり {spinsCount}回分 回せます！</span>
            </div>
          </div>

          <p className="text-[11px] text-[#7A726A] italic">
            ※このプレゼントは由美さん専用で、1回限りお受け取りいただけます。
          </p>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleClaim(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#D97706] via-[#EA580C] to-[#C8744E] hover:from-[#B45309] hover:to-[#B45309] text-white font-black text-sm sm:text-base shadow-[4px_4px_0px_#2E2824] transition active:translate-y-0.5 active:shadow-[1px_1px_0px_#2E2824] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Dices className="w-5 h-5 text-amber-200" />
              <span>受け取ってガラポンを回す！</span>
            </button>

            <button
              type="button"
              onClick={() => handleClaim(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#FAF8F4] hover:bg-[#EAE5D9] text-[#5A524A] hover:text-[#2E2824] font-bold text-xs border border-[#D5CEBF] transition cursor-pointer"
            >
              <span>ポイントを受け取る（あとで回す）</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
