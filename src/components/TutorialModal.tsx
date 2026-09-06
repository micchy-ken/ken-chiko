import React, { useState } from 'react';
import {
  X,
  Compass,
  BookOpen,
  Heart,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MapPin,
  Footprints,
  Bike,
  Car,
  Train,
  Smile,
  BookMarked,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const steps = [
    {
      stepNumber: 1,
      badge: 'たび・いどう',
      title: 'けんちこと気ままな旅',
      icon: Compass,
      iconColor: 'text-[#487560]',
      bgColor: 'bg-[#EBF3ED]',
      borderColor: 'border-[#487560]',
      mainText: 'けんちこは自由気ままに色々な場所へお出かけします。',
      subText: 'りびんぐやしんしつでのんびり過ごすだけでなく、ららぽーとや木曽駒キャンプ場、ならここの温泉などへ旅に出ることも！',
      tags: [
        { label: 'りびんぐ', icon: MapPin },
        { label: 'ららぽーと', icon: MapPin },
        { label: '木曽駒キャンプ場', icon: MapPin },
        { label: 'ならここの温泉', icon: MapPin },
      ],
      transportList: [
        { label: '徒歩', icon: Footprints },
        { label: '自転車', icon: Bike },
        { label: 'アクア', icon: Car },
        { label: '新幹線', icon: Train },
      ],
      hint: '徒歩やお気に入りのアクア、新幹線に乗って移動します。',
    },
    {
      stepNumber: 2,
      badge: 'ずかん・えにっき',
      title: 'いろんなにゃんことの出会い',
      icon: BookOpen,
      iconColor: 'text-[#C95D41]',
      bgColor: 'bg-[#FCEEEA]',
      borderColor: 'border-[#C95D41]',
      mainText: 'お出かけ先で個性豊かなにゃんこと出会おう！',
      subText: '新しいにゃんこと出会うと「◯◯にゃん図鑑」に記録されます。一緒に遊んだ楽しい思い出は、自動的に「おもいで絵日記」に綴られていきます。',
      tags: [
        { label: '◯◯にゃん図鑑', icon: BookOpen },
        { label: 'おもいで絵日記', icon: BookMarked },
        { label: 'であい記録', icon: Sparkles },
      ],
      hint: '出会ったにゃんこは図鑑でいつでもプロフィールを確認できます。',
    },
    {
      stepNumber: 3,
      badge: 'みまもり・ふれあい',
      title: 'のんびり見守りとなでなで',
      icon: Heart,
      iconColor: 'text-[#BA7323]',
      bgColor: 'bg-[#FEF5E7]',
      borderColor: 'border-[#BA7323]',
      mainText: 'お出かけ中にアプリを閉じても大丈夫です。',
      subText: '時間が経ってからまたアプリを開くと、目的地に到着して新しいにゃんこと出会えたり、絵日記が届いています。画面のけんちこをタップすると「なでなで」して喜んでくれます。',
      tags: [
        { label: '自動でおでかけ', icon: CheckCircle2 },
        { label: 'タップでなでなで', icon: Smile },
        { label: 'のんびり放置OK', icon: Sparkles },
      ],
      hint: '疲れたらいつでも開いて、けんちこの様子を覗いてみてください。',
    },
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('kenchiko_tutorial_seen', 'true');
    } catch (_e) {
      // ignore localstorage errors
    }
    confetti({
      particleCount: 40,
      spread: 70,
      origin: { y: 0.6 },
    });
    onClose();
  };

  return (
    <div
      id="tutorial-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-fadeIn"
      onClick={handleComplete}
    >
      <div
        id="tutorial-modal-container"
        className="bg-[#FAF8F4] w-full max-w-lg rounded-2xl sketch-card border-2 border-[#3E3833] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#ECE7DC] px-5 py-3.5 border-b-1.5 border-[#3E3833] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📖</span>
            <div>
              <h2 className="font-handwriting font-black text-base text-[#2E2824] leading-tight">
                けんちこの世界へようこそ！
              </h2>
              <p className="font-handwriting text-xs text-[#71685F]">
                あそびかたガイド ({currentStep + 1} / {steps.length})
              </p>
            </div>
          </div>
          <button
            id="tutorial-skip-btn"
            onClick={handleComplete}
            className="text-xs font-handwriting font-bold px-2.5 py-1 text-[#71685F] hover:text-[#2E2824] hover:bg-[#DDD7C8] rounded-md transition flex items-center gap-1"
          >
            <span>スキップ</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body / Slide Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col justify-between space-y-4">
          <div>
            {/* Step Badge & Icon */}
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-xs font-black font-handwriting px-3 py-1 rounded-full border ${current.bgColor} ${current.borderColor} ${current.iconColor}`}
              >
                ステップ {current.stepNumber}: {current.badge}
              </span>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-1.5 ${current.borderColor} ${current.bgColor}`}
              >
                <current.icon className={`w-5 h-5 ${current.iconColor}`} />
              </div>
            </div>

            {/* Title */}
            <h3 className="font-handwriting font-black text-lg sm:text-xl text-[#2E2824] mb-2 leading-snug">
              {current.title}
            </h3>

            {/* Main Explanations */}
            <div className="space-y-3 bg-[#F4EFE6] border border-[#DDD7C8] rounded-xl p-3.5 sm:p-4 text-[#3E3833]">
              <p className="font-handwriting font-bold text-sm sm:text-base leading-relaxed text-[#2E2824]">
                {current.mainText}
              </p>
              <p className="font-handwriting text-xs sm:text-sm text-[#5A524A] leading-relaxed">
                {current.subText}
              </p>

              {/* Tags / Visual pills */}
              {current.tags && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {current.tags.map((tag, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 bg-white border border-[#DDD7C8] px-2.5 py-1 rounded-full text-xs font-handwriting text-[#4A433D]"
                    >
                      <tag.icon className="w-3 h-3 text-[#BA7323]" />
                      <span>{tag.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Transport methods if step 1 */}
              {current.transportList && (
                <div className="pt-2 border-t border-[#E5DFD1]">
                  <div className="text-[11px] font-handwriting font-bold text-[#71685F] mb-1.5">
                    いろいろな移動手段：
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {current.transportList.map((t, idx) => (
                      <div
                        key={idx}
                        className="bg-white/80 border border-[#DDD7C8] rounded-lg p-1.5 text-center flex flex-col items-center justify-center gap-0.5"
                      >
                        <t.icon className="w-3.5 h-3.5 text-[#487560]" />
                        <span className="font-handwriting text-[10px] text-[#4A433D] font-bold">
                          {t.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Friendly hint box */}
            <div className="mt-3 flex items-start gap-2 bg-[#FAF4EB] border border-[#ECD9BE] rounded-lg px-3 py-2 text-xs font-handwriting text-[#8A5A23]">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#BA7323]" />
              <span>{current.hint}</span>
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep === idx
                    ? 'w-6 bg-[#3E3833]'
                    : 'w-2 bg-[#DDD7C8] hover:bg-[#B0A79A]'
                }`}
                title={`ステップ ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-[#ECE7DC] px-5 py-3 border-t-1.5 border-[#3E3833] flex items-center justify-between gap-3">
          <button
            id="tutorial-prev-btn"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg font-handwriting text-xs font-bold transition ${
              currentStep === 0
                ? 'opacity-0 pointer-events-none'
                : 'bg-[#FAF8F4] text-[#4A433D] border border-[#DDD7C8] hover:bg-white shadow-xs'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>もどる</span>
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              id="tutorial-next-btn"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#3E3833] hover:bg-[#2A2522] text-[#FAF8F4] font-handwriting text-xs sm:text-sm font-bold shadow-sm transition active:scale-98"
            >
              <span>つぎへ</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="tutorial-start-btn"
              onClick={handleComplete}
              className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-[#487560] hover:bg-[#3B614F] text-white font-handwriting text-xs sm:text-sm font-black shadow-md transition active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>けんちこと旅に出発する！</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
