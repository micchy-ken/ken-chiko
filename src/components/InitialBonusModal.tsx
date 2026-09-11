import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Gift, Ticket, ArrowRight, Check, X } from 'lucide-react';
import { GARAPON_COST } from '../types/rewards';

interface InitialBonusModalProps {
  isOpen: boolean;
  discoveredCount: number;
  bonusAmount: number;
  onClaimAndOpenGarapon: () => void;
  onClaimAndClose: () => void;
}

export const InitialBonusModal: React.FC<InitialBonusModalProps> = ({
  isOpen,
  discoveredCount,
  bonusAmount,
  onClaimAndOpenGarapon,
  onClaimAndClose,
}) => {
  if (!isOpen) return null;

  const spinsCount = Math.floor(bonusAmount / GARAPON_COST);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/70 backdrop-blur-xs"
      onClick={() => onClaimAndClose?.()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#FFFDF9] border-3 border-[#2E2824] rounded-3xl p-6 shadow-[6px_6px_0px_#2E2824] overflow-hidden text-center space-y-5"
      >
        {/* Top-right close button */}
        <button
          type="button"
          onClick={() => onClaimAndClose?.()}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FAF8F4] hover:bg-[#EAE5D9] text-[#2E2824] border border-[#2E2824] flex items-center justify-center transition active:scale-95 cursor-pointer"
          title="閉じる"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Festive top banner */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FEF3C7] border-2 border-[#D97706] shadow-sm text-3xl mb-1">
            🎪
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-handwriting text-[#2E2824]">
            ガラポン福引＆ご褒美チケット登場！
          </h2>
          <p className="text-xs sm:text-sm font-handwriting text-[#7A726A]">
            ポイントを貯めてガラポンを回すと、実際のお菓子や本のご褒美引換券が当たる新機能がオープンしました！
          </p>
        </div>

        {/* Bonus Calculation Card */}
        <div className="bg-[#FAF8F4] border-2 border-[#2E2824] rounded-2xl p-4 space-y-2 text-left shadow-[2px_2px_0px_#2E2824]">
          <div className="flex items-center justify-between border-b border-[#2E2824]/20 pb-2">
            <span className="text-xs font-bold font-handwriting text-[#5A524A]">
              見つけたにゃんこ初回ボーナス
            </span>
            <span className="text-xs font-mono font-bold bg-[#EAE3D2] px-2 py-0.5 rounded-lg border border-[#2E2824]">
              {discoveredCount} 匹 発見済み
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-[#7A726A] font-handwriting">
              {discoveredCount} 匹 × 50 pt ＝
            </div>
            <div className="text-2xl font-black font-handwriting text-[#B45309]">
              + {bonusAmount.toLocaleString()} pt
            </div>
          </div>

          {spinsCount > 0 && (
            <p className="text-[11px] text-[#487560] font-bold font-handwriting pt-1 border-t border-[#2E2824]/10">
              ✨ 今すぐガラポンが <span className="underline">{spinsCount} 回</span> 回せます！
            </p>
          )}
        </div>

        {/* 3 Real Voucher Ticket Preview Chips */}
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-handwriting">
          <div className="p-2 rounded-xl bg-[#FFFBEB] border border-[#D97706] text-center space-y-0.5">
            <span className="text-lg">🍰</span>
            <p className="font-bold text-[#B45309] truncate">かるちぇらたん</p>
          </div>
          <div className="p-2 rounded-xl bg-[#F1F5F9] border border-[#64748B] text-center space-y-0.5">
            <span className="text-lg">📚</span>
            <p className="font-bold text-[#334155] truncate">にゃんこ本</p>
          </div>
          <div className="p-2 rounded-xl bg-[#FEF2F2] border border-[#EF4444] text-center space-y-0.5">
            <span className="text-lg">🍫</span>
            <p className="font-bold text-[#B91C1C] truncate">コンビニお菓子</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onClaimAndOpenGarapon}
            className="w-full py-3 px-5 rounded-2xl font-black font-handwriting text-base bg-[#B45309] hover:bg-[#92400E] text-white border-2 border-[#2E2824] shadow-[3px_3px_0px_#2E2824] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-[#FDE68A]" />
            <span>ボーナスを受け取って福引へ！</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClaimAndClose}
            className="w-full py-2 text-xs font-bold font-handwriting text-[#7A726A] hover:text-[#2E2824]"
          >
            ボーナスを受け取って後で回す
          </button>
        </div>
      </motion.div>
    </div>
  );
};
