/**
 * BirthdayStageEvent.tsx
 *
 * 11/1（日本時間 JST）由美様のお誕生日当日に、ステージ上で展開される特別なプロローグ演出。
 * 1. いつものようにけんちこがいる（「あのね、あのね」）
 * 2. タップすると「ぷれぜんとがあゆのー！」
 * 3. タップすると右からはこをもったにゃんこがトコトコ歩いてくる（しゃべらない）
 * 4. 箱をクリックすると、特別なバースデーサプライズイベント（モーダル）へ！
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NyanCharacter } from '../types';
import { NyanIllustration } from './NyanIllustration';
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
  // 0: けんちこ「あのね、あのね」 -> タップ待ち
  // 1: けんちこ「ぷれぜんとがあゆのー！」 -> タップ待ち
  // 2: 右端からプレゼント箱を持ったにゃんこがトコトコ歩いてくる（勝手に喋らない）
  const [step, setStep] = useState<number>(0);

  const onMonologueChangeRef = useRef(onMonologueChange);
  useEffect(() => {
    onMonologueChangeRef.current = onMonologueChange;
  });

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

  // ステップ変更時にけんちこのつぶやきテキストを更新
  useEffect(() => {
    if (!isActive) return;

    if (step === 0) {
      onMonologueChangeRef.current?.('あのね、あのね');
    } else if (step === 1) {
      onMonologueChangeRef.current?.('ぷれぜんとがあゆのー！');
    } else if (step >= 2) {
      onMonologueChangeRef.current?.('ぷれぜんとがあゆのー！🎁');
    }
  }, [isActive, step]);

  // タップして次のステップへ
  const handleAdvanceStep = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (step < 2) {
      setStep((prev) => prev + 1);
    }
  };

  // プレゼント箱をクリックして本番イベントを開く
  const handleBoxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      confetti({ particleCount: 60, spread: 90, origin: { y: 0.6 } });
    } catch {}
    onOpenBirthdayModal();
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-visible">
      {/* ステップ0〜1の時、ステージ全体タップで次のセリフへ進む透明クリックエリア */}
      {step < 2 && (
        <div
          onClick={handleAdvanceStep}
          className="absolute inset-0 pointer-events-auto cursor-pointer z-10"
          title="タップして次へ進む"
        />
      )}

      {/* けんちこの頭上のもじもじハート吹き出し (ステップ0〜1) */}
      <AnimatePresence>
        {step < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            onClick={handleAdvanceStep}
            className="absolute top-[28%] sm:top-[30%] left-[30%] sm:left-[35%] -translate-x-1/2 flex items-center gap-1.5 bg-[#FFF9F2] border-2 border-[#EAB308] px-3.5 py-2 rounded-full shadow-lg text-[#92400E] text-xs sm:text-sm font-black font-handwriting select-none pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 transition-transform z-20 animate-bounce"
            title="ここをたっぷ！"
          >
            <motion.span
              animate={{ rotate: [-10, 10, -10] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              💕
            </motion.span>
            <span>
              {step === 0 ? 'あのね、あのね' : 'ぷれぜんとがあゆのー！'}
            </span>
            <span className="text-[10px] text-white bg-[#EA580C] px-2 py-0.5 rounded-full font-bold shadow-xs">
              ここをたっぷ👆
            </span>
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
              stiffness: 90,
              duration: 1.8,
            }}
            className="absolute bottom-6 sm:bottom-8 right-[6%] sm:right-[14%] md:right-[20%] pointer-events-auto flex flex-col items-center cursor-pointer select-none group z-20"
            onClick={handleBoxClick}
            title="タップしてプレゼントを開ける！🎁"
          >
            {/* にゃんこ本体 + プレゼント箱 */}
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
                </div>

                {/* にゃんこが両手で抱えている大きなプレゼント箱 🎁 */}
                <motion.div
                  animate={{
                    scale: [1, 1.08, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.4,
                    ease: 'easeInOut',
                  }}
                  className="relative -mt-9 sm:-mt-10 z-20 flex flex-col items-center"
                >
                  {/* プレゼントボックス本体 */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-[#EA580C] via-[#F59E0B] to-[#FDE047] p-1.5 shadow-2xl flex items-center justify-center border-4 border-white group-hover:scale-115 active:scale-95 transition-transform duration-200">
                    {/* 箱をぎゅっと抱えているにゃんこの両手（白いおてて） */}
                    <div className="absolute -top-1.5 left-2 w-4.5 h-4.5 rounded-full bg-white border border-[#D5CCBC] shadow-xs z-30" />
                    <div className="absolute -top-1.5 right-2 w-4.5 h-4.5 rounded-full bg-white border border-[#D5CCBC] shadow-xs z-30" />

                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex flex-col items-center justify-center relative overflow-hidden">
                      <span className="text-4xl sm:text-5xl drop-shadow-sm">🎁</span>
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
