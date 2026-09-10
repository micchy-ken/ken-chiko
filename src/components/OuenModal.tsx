/**
 * OuenModal: Modal dialog for choosing a mood category when asking Kenchiko for cheer and encouragement.
 */
import React from 'react';
import { OuenCategory, KenchikoState } from '../types';
import { KenchikoAvatar } from './KenchikoAvatar';
import { Heart, X, Sparkles, HelpCircle } from 'lucide-react';

interface OuenModalProps {
  categories: OuenCategory[];
  kenchiko: KenchikoState;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
}

export const OuenModal: React.FC<OuenModalProps> = ({
  categories,
  kenchiko,
  onClose,
  onSelectCategory,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-md bg-[#FAF8F4] rounded-3xl border-2 border-[#DDD7C8] shadow-2xl p-6 overflow-hidden transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#EFECE4] hover:bg-[#E2DDD2] text-[#6E665C] transition flex items-center justify-center"
          title="とじる"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Kenchiko Header Dialogue */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full bg-[#FFF9EE] border-2 border-[#E7CBA9] flex items-center justify-center shadow-inner overflow-hidden p-2">
              <KenchikoAvatar
                customImageUrl={kenchiko.customImageUrl}
                alt="けんちこ"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 bg-[#D4736A] text-white p-1.5 rounded-full shadow-md">
              <Heart className="w-4 h-4 fill-current animate-pulse" />
            </span>
          </div>

          <div className="bg-[#FFFDF9] border border-[#E7DECD] rounded-2xl px-5 py-3 shadow-xs relative max-w-xs">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#FFFDF9] border-t border-l border-[#E7DECD] rotate-45"></div>
            <p className="font-handwriting font-black text-lg text-[#3E3833] tracking-wide">
              けんちこ「どうしたの？」
            </p>
            <p className="text-xs text-[#7A7166] mt-1 font-bold">
              気持ちを教えてね。けんちこが応援するよ！
            </p>
          </div>
        </div>

        {/* Categories / Choices List */}
        <div className="space-y-3 mb-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className="w-full group flex items-center justify-between p-4 rounded-2xl bg-white hover:bg-[#FFF8F6] border-2 border-[#EADFD0] hover:border-[#D4736A] shadow-xs hover:shadow-md transition duration-150 transform hover:-translate-y-0.5 active:translate-y-0 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#FFF2F0] group-hover:bg-[#FFE5E2] text-[#D4736A] flex items-center justify-center transition">
                  <Sparkles className="w-5 h-5" />
                </span>
                <span className="font-handwriting font-black text-base text-[#3E3833] group-hover:text-[#D4736A] transition">
                  {category.label}
                </span>
              </div>
              <span className="text-xs font-bold text-[#A89F93] group-hover:text-[#D4736A] transition font-handwriting">
                応援してもらう ➔
              </span>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-[#EAE5D9]">
          <p className="text-[11px] text-[#8C837A] font-bold">
            ※ 応援中は15秒間、けんちこが寄り添ってくれます（猫は出ません）
          </p>
        </div>
      </div>
    </div>
  );
};
