/**
 * BirthdayStageEvent.tsx
 *
 * 11/1（日本時間 JST）由美様のお誕生日当日に、ステージ上で展開される特別なプロローグ演出。
 * 1. いつものようにけんちこがいる
 * 2. 「あのね、あのね（もじもじ）」
 * 3. 「ぷれぜんとがあゆのー」
 * 4. 右からはこをもったにゃんこがトコトコ歩いてくる
 * 5. 箱をクリックすると、特別なバースデーサプライズイベント（モーダル）へ！
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Heart, Gift, Cake } from 'lucide-react';
import { NyanCharacter } from '../types';
import { NyanIllustration } from './NyanIllustration';
import { getAssetUrl } from '../utils/assetPath';
import confetti from '../utils/confetti';

interface BirthdayStageEventProps {
  isActive: boolean;
  characters: NyanCharacter[];
  onOpenBirthdayModal: () => void;
  onMonologueChange?: (text: string) => void;
}

export const BirthdayStageEvent: React.FC<BirthdayStageEventProps> = ({
  isActive,
  characters = [],
  onOpenBirthdayModal,
  onMonologueChange,
}) => {
  // ステップ管理:
  // 0: けんちこ「あのね、あのね（もじもじ）」 (0〜3秒)
  // 1: けんちこ「ぷれぜんとがあゆのー」 (3〜5秒)
  // 2: 右端からプレゼント箱を持ったにゃんこが歩いてくる (4.5秒〜)
  // 3: にゃんこ到着！箱がぽよぽよ跳ねて「タップしてね！」
  const [step, setStep] = useState<number>(0);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // 配達してくれるお祝いにゃんこ（きほんのにゃんこ No.1 または先頭のにゃんこ）
  const deliveryCat: NyanCharacter =
    characters.find((c) => c.no === 1) ||
    characters.find((c) => c.name.includes('きほん')) ||
    characters[0] ||
    ({
      id: 'nyan_1',
      no: 1,
      name: 'きほんのにゃんこ',
      reading: 'きほんのにゃんこ',
      personality: 'マイペース',
      features: 'ノーマル',
      discovered: true,
      friendshipLevel: 5,
    } as unknown as NyanCharacter);

  // 自動タイマー進行
  useEffect(() => {
    if (!isActive) return;

    // ステップ0のつぶやき
    onMonologueChange?.('あのね、あのね（もじもじ）');

    // 2.8秒後: ステップ1「ぷれぜんとがあゆのー」
    const timer1 = setTimeout(() => {
      setStep((prev) => (prev < 1 ? 1 : prev));
      onMonologueChange?.('ぷれぜんとがあゆのー');
    }, 2800);

    // 4.5秒後: ステップ2 にゃんこが歩き始める
    const timer2 = setTimeout(() => {
      setStep((prev) => (prev < 2 ? 2 : prev));
    }, 4500);

    // 6.8秒後: ステップ3 にゃんこ到着＆タップ待ち受け
    const timer3 = setTimeout(() => {
      setStep(3);
    }, 6800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isActive, onMonologueChange]);

  // ステージクリックで早送り可能
  const handleStageClick = () => {
    if (step < 3) {
      setStep(3);
      onMonologueChange?.('ぷれぜんとがあゆのー');
    }
  };

  // プレゼント箱をクリックして本番イベントを開く
  const handleBoxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      confetti({ particleCount: 50, spread: 80, origin: { y: 0.6 } });
    } catch {}
    onOpenBirthdayModal();
  };

  if (!isActive) return null;

  return (
    <div
      onClick={handleStageClick}
      className="absolute inset-0 pointer-events-none z-20 overflow-visible"
    >
      {/* けんちこの頭上のもじもじハート・汗エフェクト (ステップ0〜1) */}
      <AnimatePresence>
        {step < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="absolute top-[28%] sm:top-[30%] left-[30%] sm:left-[35%] -translate-x-1/2 flex items-center gap-1 bg-[#FFF9F2] border-2 border-[#EAB308] px-2.5 py-1 rounded-full shadow-md text-[#92400E] text-[11px] sm:text-xs font-black font-handwriting select-none"
          >
            <motion.span
              animate={{ rotate: [-8, 8, -8] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              💕
            </motion.span>
            <span>
              {step === 0 ? 'もじもじ…（あのね…）' : 'ぷれぜんと…！🎁'}
            </span>
            <span className="text-[10px] text-[#D97706]">✨</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 右からトコトコ歩いてくる「はこを持ったにゃんこ」 (ステップ2以降) */}
      <AnimatePresence>
        {step >= 2 && (
          <motion.div
            initial={{ x: 260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{
              type: 'spring',
              damping: 18,
              stiffness: 85,
              duration: 2.2,
            }}
            className="absolute bottom-6 sm:bottom-8 right-[8%] sm:right-[15%] md:right-[20%] pointer-events-auto flex flex-col items-center cursor-pointer select-none group"
            onClick={handleBoxClick}
            title="タップしてプレゼントを開ける！🎁"
          >
            {/* にゃんこの頭上セリフ吹き出し */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="relative mb-2 bg-[#FFFDF9] border-2 border-[#D97706] rounded-2xl px-3 py-1.5 shadow-md flex items-center gap-1.5 font-handwriting text-xs sm:text-sm font-black text-[#92400E] whitespace-nowrap"
            >
              <Cake className="w-4 h-4 text-[#EA580C] shrink-0" />
              <span>ゆみさま、ぷれぜんと持ってきたニャ！🎁</span>
              {/* 吹き出しの三角ポインター */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#D97706]" />
            </motion.div>

            {/* にゃんこ本体 + パーティー帽子 + プレゼント箱 */}
            <div className="relative flex flex-col items-center">
              {/* にゃんこがトコトコ歩くアニメーション */}
              <motion.div
                animate={{
                  y: [0, -7, 0],
                  rotate: [-2, 2, -2],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.7,
                  ease: 'easeInOut',
                }}
                className="relative flex flex-col items-center"
              >
                {/* にゃんこイラスト */}
                <div className="relative w-28 sm:w-32 h-28 sm:h-32 flex items-center justify-center">
                  <NyanIllustration
                    nyan={deliveryCat}
                    size={110}
                    isDiscovered={true}
                    transparent={true}
                  />

                  {/* にゃんこの頭に乗った可愛いパーティー帽子 🥳 */}
                  <span className="absolute -top-3.5 right-1 sm:right-3 text-2xl sm:text-3xl rotate-12 drop-shadow-md animate-bounce">
                    🥳
                  </span>
                </div>

                {/* にゃんこが両手で抱えている大きなプレゼント箱 🎁 */}
                <motion.div
                  animate={{
                    scale: [1, 1.06, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: 'easeInOut',
                  }}
                  className="relative -mt-9 sm:-mt-10 z-20 flex flex-col items-center"
                >
                  {/* クリックを促すキラキラ誘導バッジ */}
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="mb-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#EA580C] to-[#E11D48] text-white text-[10px] sm:text-[11px] font-black shadow-md flex items-center gap-1 border border-white"
                  >
                    <Sparkles className="w-3 h-3 text-amber-200" />
                    <span>ここをタップしてね！</span>
                    <span className="text-xs">👇</span>
                  </motion.div>

                  {/* プレゼントボックス本体 */}
                  <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-tr from-[#EA580C] via-[#F59E0B] to-[#FDE047] p-1.5 shadow-xl flex items-center justify-center border-3 border-white group-hover:scale-110 active:scale-95 transition-transform duration-200">
                    {/* 箱をぎゅっと抱えているにゃんこの両手（白いおてて） */}
                    <div className="absolute -top-1.5 left-2 w-4 h-4 rounded-full bg-white border border-[#D5CCBC] shadow-xs z-30" />
                    <div className="absolute -top-1.5 right-2 w-4 h-4 rounded-full bg-white border border-[#D5CCBC] shadow-xs z-30" />

                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex flex-col items-center justify-center relative overflow-hidden">
                      <span className="text-3xl sm:text-4xl drop-shadow-xs">🎁</span>
                      {/* 箱の角のケーキアイコン */}
                      <span className="absolute bottom-1 right-1 text-xs">🍰</span>
                      <span className="absolute top-1 left-1 text-[11px] animate-pulse">✨</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
