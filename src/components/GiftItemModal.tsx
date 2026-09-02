import React, { useState } from 'react';
import { GiftItem, KenchikoState, NyanCharacter } from '../types';
import {
  X,
  Gift,
  Heart,
  UtensilsCrossed,
  Shield,
  ShoppingBag,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GiftItemModalProps {
  inventory: GiftItem[];
  kenchiko: KenchikoState;
  companionNyan: NyanCharacter | null;
  onClose: () => void;
  onUseItem: (item: GiftItem, target: 'kenchiko' | 'nyan') => void;
}

export const GiftItemModal: React.FC<GiftItemModalProps> = ({
  inventory,
  companionNyan,
  onClose,
  onUseItem,
}) => {
  const [selectedItem, setSelectedItem] = useState<GiftItem | null>(inventory[0] || null);
  const [target, setTarget] = useState<'kenchiko' | 'nyan'>('kenchiko');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleGive = () => {
    if (!selectedItem || selectedItem.count <= 0) return;

    confetti({
      particleCount: 25,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#D97543', '#487560', '#3C5C7A'],
    });

    onUseItem(selectedItem, target);
    setFeedback(`「${selectedItem.name}」をプレゼントしました！ ${selectedItem.effectText}`);

    setTimeout(() => {
      setFeedback(null);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#ECE7DC] px-6 py-4 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sketch-tag bg-[#3E3833] text-white shadow-sm">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#2E2824] font-handwriting">アイテム・おやつをあげる</h3>
              <p className="text-xs text-[#7A726A] font-handwriting">
                お腹を満たしたり、気分を高めたり、特定のにゃんと仲良くなれます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sketch-tag bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Target Selection Tabs */}
          <div className="flex items-center gap-2 p-1 bg-[#EAE6DC] sketch-tag">
            <button
              onClick={() => setTarget('kenchiko')}
              className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 font-handwriting ${
                target === 'kenchiko'
                  ? 'bg-[#3E3833] text-white sketch-border shadow-sm'
                  : 'text-[#5A524A] hover:text-[#2E2824]'
              }`}
            >
              <span>👨 けんちこにプレゼント</span>
            </button>
            <button
              onClick={() => setTarget('nyan')}
              disabled={!companionNyan}
              className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 font-handwriting ${
                target === 'nyan'
                  ? 'bg-[#487560] text-white sketch-border shadow-sm'
                  : !companionNyan
                  ? 'text-[#A8A096] opacity-50 cursor-not-allowed'
                  : 'text-[#5A524A] hover:text-[#2E2824]'
              }`}
            >
              <span>🐱 {companionNyan ? `${companionNyan.name}にあげる` : 'にゃん不在'}</span>
            </button>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto p-1">
            {inventory.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-3 text-left transition flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-[#FFFDF9] sketch-border shadow-sm'
                      : 'bg-[#FAF8F4] sketch-card-subtle opacity-85 hover:opacity-100'
                  }`}
                >
                  <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#2E2824] truncate font-handwriting">{item.name}</p>
                    <p className="text-[10px] text-[#7A726A] line-clamp-1">{item.description}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold text-[#D97543] font-mono">
                      所持: {item.count}個
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Item Detail Card */}
          {selectedItem && (
            <div className="p-4 bg-[#FFFDF9] sketch-card-subtle space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#2E2824] flex items-center gap-2 font-handwriting">
                  <span className="text-xl">{selectedItem.icon}</span>
                  <span>{selectedItem.name}</span>
                </h4>
                <span className="text-xs font-mono font-bold text-[#7A726A]">
                  のこり: {selectedItem.count}個
                </span>
              </div>
              <p className="text-xs text-[#5A524A] leading-relaxed font-handwriting">{selectedItem.effectText}</p>
              <div className="flex items-center gap-3 text-[11px] font-bold text-[#7A726A] pt-1">
                {selectedItem.hungerRecovery > 0 && (
                  <span className="flex items-center gap-1 text-[#D97543]">
                    <UtensilsCrossed className="w-3.5 h-3.5" /> 満腹+{selectedItem.hungerRecovery}
                  </span>
                )}
                {selectedItem.happinessGain > 0 && (
                  <span className="flex items-center gap-1 text-[#C85A53]">
                    <Heart className="w-3.5 h-3.5" /> ごきげん+{selectedItem.happinessGain}
                  </span>
                )}
                {selectedItem.staminaGain > 0 && (
                  <span className="flex items-center gap-1 text-[#487560]">
                    <Shield className="w-3.5 h-3.5" /> 体力+{selectedItem.staminaGain}
                  </span>
                )}
              </div>
            </div>
          )}

          {feedback && (
            <div className="p-3 bg-[#EAF5EC] text-[#2F583A] text-xs font-bold sketch-tag animate-fadeIn font-handwriting">
              {feedback}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleGive}
            disabled={!selectedItem || selectedItem.count <= 0}
            className={`w-full py-3 text-sm font-bold sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting flex items-center justify-center gap-2 ${
              !selectedItem || selectedItem.count <= 0
                ? 'bg-[#EAE6DC] text-[#7A726A] cursor-not-allowed'
                : 'bg-[#D97543] hover:bg-[#C46332] text-white'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>
              {target === 'kenchiko' ? 'けんちこにあげる' : `${companionNyan?.name || 'にゃん'}にあげる`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
