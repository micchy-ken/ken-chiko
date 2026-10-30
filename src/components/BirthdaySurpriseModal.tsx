/**
 * BirthdaySurpriseModal.tsx
 * 
 * 2026年11月1日（日本時間 JST）yumi様のお誕生日のための特別サプライズ演出モーダル。
 * けんちこのバースデーハット・ケーキ演出、にゃんこたちの祝福、
 * そしてカルチェラタンのケーキ・洋菓子引換券（ゴールドチケット）5枚のプレゼント。
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Heart, Gift, Award, Calendar, ChevronRight, X, Cake } from 'lucide-react';
import { RewardTicket } from '../types/rewards';
import { getAssetUrl, handleImageError } from '../utils/assetPath';
import confetti from '../utils/confetti';

interface BirthdaySurpriseModalProps {
  isOpen: boolean;
  recipientName?: string;
  kenchikoImageUrl?: string;
  onClaim: () => void;
  onClose: () => void;
  isPreview?: boolean;
}

export const BirthdaySurpriseModal: React.FC<BirthdaySurpriseModalProps> = ({
  isOpen,
  recipientName = '由美様',
  kenchikoImageUrl,
  onClaim,
  onClose,
  isPreview = false,
}) => {
  const [phase, setPhase] = useState<'box' | 'celebrate'>('box');
  const [ticketAnimIndex, setTicketAnimIndex] = useState<number>(0);

  // 初回表示時に紙吹雪およびフェーズのリセット
  useEffect(() => {
    if (isOpen) {
      setPhase('box');
      setTicketAnimIndex(0);
      try {
        confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } });
      } catch {}
    }
  }, [isOpen]);

  // 開封フェーズへの移行
  const handleOpenBox = () => {
    setPhase('celebrate');
    try {
      // 盛大なバースデー紙吹雪
      confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 } });
      setTimeout(() => {
        confetti({ particleCount: 60, spread: 90, origin: { y: 0.4 } });
      }, 350);
    } catch {}
  };

  // チケットのアニメーション順次表示
  useEffect(() => {
    if (phase === 'celebrate') {
      const timer = setInterval(() => {
        setTicketAnimIndex((prev) => (prev < 5 ? prev + 1 : prev));
      }, 200);
      return () => clearInterval(timer);
    }
  }, [phase]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-[#231B16]/85 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F2] to-[#FFF3E6] border-4 border-[#EAB308] rounded-3xl p-5 sm:p-7 shadow-[10px_10px_0px_#231B16] text-center space-y-4 my-auto overflow-hidden"
        >
          {/* Top-right close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/90 hover:bg-[#F3EFE6] text-[#7A726A] hover:text-[#231B16] border border-[#D5CEBF] flex items-center justify-center transition active:scale-95 cursor-pointer z-20 shadow-xs"
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Preview Badge if admin testing */}
          {isPreview && (
            <div className="inline-block px-3.5 py-1 rounded-full bg-[#FEF3C7] border border-[#F59E0B] text-[#B45309] text-[11px] font-black shadow-xs animate-bounce">
              🛠️ 管理者演出プレビュー中（最前面表示・ポップアップ確認OK）
            </div>
          )}

          {/* PHASE 1: UNOPENED BOX */}
          {phase === 'box' && (
            <div className="py-4 space-y-5">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] text-xs font-black shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>2026年11月1日 • Special Day</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black font-handwriting text-[#231B16] tracking-wide pt-1">
                  2026年11月1日 • Special Day 由美様へ 特別なお届けもの
                </h2>
                <p className="text-xs sm:text-sm font-handwriting text-[#6E645A]">
                  けんちこと仲間たちから、愛を込めたサプライズです🐾
                </p>
              </div>

              {/* Pulsing Gift Box Illustration */}
              <div className="relative py-4 flex items-center justify-center">
                <motion.div
                  animate={{
                    scale: [1, 1.08, 1],
                    rotate: [-2, 2, -2],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.2,
                    ease: 'easeInOut',
                  }}
                  className="relative cursor-pointer select-none"
                  onClick={handleOpenBox}
                >
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-tr from-[#EA580C] via-[#F59E0B] to-[#FDE047] p-1 shadow-xl flex items-center justify-center border-4 border-white">
                    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex flex-col items-center justify-center relative overflow-hidden">
                      <span className="text-6xl sm:text-7xl">🎁</span>
                      <span className="absolute -top-1 -right-1 text-2xl animate-bounce">✨</span>
                      <span className="absolute -bottom-1 -left-1 text-xl animate-pulse">🎂</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenBox}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#D97706] via-[#EA580C] to-[#E11D48] hover:from-[#B45309] hover:to-[#BE123C] text-white font-black text-sm sm:text-base shadow-[4px_4px_0px_#231B16] transition active:translate-y-0.5 active:shadow-[1px_1px_0px_#231B16] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-amber-200" />
                  <span>プレゼントを開ける！</span>
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* PHASE 2: CELEBRATION & TICKET UNVEIL */}
          {phase === 'celebrate' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Header Banner */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs font-black">
                  <Cake className="w-3.5 h-3.5 text-[#EF4444]" />
                  <span>HAPPY BIRTHDAY 2026.11.01</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black font-handwriting text-[#231B16] tracking-wide">
                  ゆみさまー！はぴばすでい🎉
                </h2>
              </div>

              {/* Kenchiko with Birthday Party Hat & Cake */}
              <div className="relative p-4 bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] rounded-2xl border-2 border-[#F59E0B] shadow-inner space-y-3">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white border-4 border-[#D97706] p-1 flex items-center justify-center shadow-lg relative overflow-visible bg-gradient-to-b from-[#FFFBEB] to-[#FEF3C7]">
                    {kenchikoImageUrl ? (
                      <img
                        src={getAssetUrl(kenchikoImageUrl)}
                        alt="けんちこ"
                        onError={(e) => handleImageError(e, 'images/kihon-nyan-transparent.png')}
                        className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.15)] pointer-events-none select-none rounded-full"
                      />
                    ) : (
                      <span className="text-5xl">🐱</span>
                    )}
                    {/* Glowing Candle Cake */}
                    <span className="absolute -bottom-2.5 -left-2.5 text-3xl animate-pulse drop-shadow-md">
                      🎂
                    </span>
                  </div>
                </div>

                {/* Companions speech bubbles */}
                <div className="text-xs sm:text-sm font-handwriting text-[#5A4325] leading-relaxed max-w-sm mx-auto space-y-1.5">
                  <p className="font-black text-[#92400E] text-sm sm:text-base">
                    「ゆみさまー！はぴばすでい🎉」
                  </p>
                  <p className="font-bold text-[#EA580C] text-xs sm:text-sm leading-snug">
                    「これからもずーっとずーっとずーっといっしょねー！しゅきぃぃぃ❤❤❤t」
                  </p>
                </div>
              </div>

              {/* 5 Karuchieratan Gold Tickets Container */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black text-[#92400E] flex items-center gap-1">
                    <Award className="w-4 h-4 text-[#D97706]" />
                    カルチェラタン引換券（ゴールド引換券 × 5枚）
                  </span>
                  <span className="text-[11px] font-bold text-[#B45309] bg-white px-2 py-0.5 rounded-full border border-[#FCD34D]">
                    合計 5枚
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((num, i) => (
                    <motion.div
                      key={num}
                      initial={{ opacity: 0, scale: 0.6, y: 15 }}
                      animate={{
                        opacity: i < ticketAnimIndex ? 1 : 0.3,
                        scale: i < ticketAnimIndex ? 1 : 0.9,
                        y: i < ticketAnimIndex ? 0 : 5,
                      }}
                      transition={{ type: 'spring', damping: 15 }}
                      className="p-2 sm:p-2.5 bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] rounded-xl border-2 border-[#D97706] shadow-sm flex sm:flex-col items-center justify-between sm:justify-center gap-1.5"
                    >
                      <div className="text-xl sm:text-2xl">🍰</div>
                      <div className="text-left sm:text-center">
                        <div className="text-[10px] font-black text-[#92400E] leading-tight">
                          かるちぇらたん
                        </div>
                        <div className="text-[9px] text-[#B45309] font-bold">
                          引換券 #{num}
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-[#D97706] bg-white/80 px-1.5 py-0.5 rounded border border-[#FCD34D]">
                        GOLD
                      </span>
                    </motion.div>
                  ))}
                </div>

                <p className="text-[11px] text-[#7A726A] italic pt-1">
                  ※チケットはお手持ちの所持チケットに追加され、いつでもお店でご利用いただけます。
                </p>
              </div>

              {/* Final Action Button */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 } });
                    } catch {}
                    onClaim();
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#D97706] via-[#EA580C] to-[#E11D48] hover:from-[#B45309] hover:to-[#BE123C] text-white font-black text-sm sm:text-base shadow-[4px_4px_0px_#231B16] transition active:translate-y-0.5 active:shadow-[1px_1px_0px_#231B16] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cake className="w-5 h-5 text-amber-200" />
                  <span>ありがとう！チケットを受け取る 🍰✨</span>
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
