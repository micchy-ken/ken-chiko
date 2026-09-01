import React, { useState } from 'react';
import { GiftItem, KenchikoState, NyanCharacter } from '../types';
import {
  X,
  Gift,
  Sparkles,
  Heart,
  UtensilsCrossed,
  Shield,
  Beer,
  Apple,
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
  kenchiko,
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
      colors: ['#f59e0b', '#ec4899', '#10b981'],
    });

    onUseItem(selectedItem, target);
    setFeedback(`「${selectedItem.name}」をプレゼントしました！ ${selectedItem.effectText}`);

    setTimeout(() => {
      setFeedback(null);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A342F]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_8px_30px_rgba(74,68,63,0.15)] overflow-hidden flex flex-col font-['M_PLUS_Rounded_1c',sans-serif]">
        {/* Header */}
        <div className="bg-[#4A443F] px-6 py-4 border-b border-[#3A342F] flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#728C7E] text-white shadow-sm">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">アイテム・おやつをあげる</h3>
              <p className="text-xs font-bold text-[#CCC4B2]">
                お腹を満たしたり、気分を高めたり、特定のにゃんと仲良くなれます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#3A342F] hover:bg-[#2B2724] text-[#CCC4B2] hover:text-white border border-[#5A524A] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Target Selection Tabs */}
          <div className="flex items-center gap-2 p-1 bg-[#EFECE4] rounded-2xl border border-[#DDD7C8]">
            <button
              onClick={() => setTarget('kenchiko')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                target === 'kenchiko'
                  ? 'bg-[#728C7E] text-white shadow-sm'
                  : 'text-[#6B6259] hover:text-[#3A342F]'
              }`}
            >
              <span>👨 けんちこにプレゼント</span>
            </button>
            <button
              onClick={() => setTarget('nyan')}
              disabled={!companionNyan}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                target === 'nyan'
                  ? 'bg-[#728C7E] text-white shadow-sm'
                  : !companionNyan
                  ? 'text-[#A8A096] opacity-50 cursor-not-allowed'
                  : 'text-[#6B6259] hover:text-[#3A342F]'
              }`}
            >
              <span>🐾 {companionNyan ? `${companionNyan.name}にあげる` : '近くににゃんがいません'}</span>
            </button>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
            {inventory.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isAvailable = item.count > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  disabled={!isAvailable}
                  className={`p-3 rounded-2xl border transition text-left flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#FAF8F5] border-[#728C7E] ring-2 ring-[#728C7E]/40 shadow-sm'
                      : isAvailable
                      ? 'bg-[#F5F2EA] border-[#DDD7C8] hover:border-[#8C837A]'
                      : 'bg-[#EFECE4]/50 border-[#DDD7C8] opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">
                      {item.category === 'snack' ? '🍡' : item.category === 'drink' ? '🍺' : '🎁'}
                    </span>
                    <span className="font-mono text-xs font-bold bg-[#4A443F] text-white px-2 py-0.5 rounded-full">
                      x{item.count}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#3A342F] truncate">{item.name}</h4>
                    <p className="text-[10px] text-[#7D756D] line-clamp-1">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Item Details */}
          {selectedItem && (
            <div className="bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8] space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-[#3A342F]">{selectedItem.name}</h4>
                <div className="flex items-center gap-3 text-xs font-bold">
                  {selectedItem.hungerRecovery > 0 && (
                    <span className="text-[#5C7E6B]">満腹度 +{selectedItem.hungerRecovery}</span>
                  )}
                  {selectedItem.happinessGain > 0 && (
                    <span className="text-[#D4736A]">機嫌 +{selectedItem.happinessGain}</span>
                  )}
                  {selectedItem.staminaGain > 0 && (
                    <span className="text-[#C8744E]">体力 +{selectedItem.staminaGain}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#6B6259] leading-relaxed">{selectedItem.description}</p>
            </div>
          )}

          {feedback && (
            <div className="p-3 bg-[#EAF0EC] text-[#3D5447] text-xs font-bold rounded-xl border border-[#C6D8CD] animate-fadeIn">
              {feedback}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#EFECE4] px-6 py-4 border-t border-[#DDD7C8] flex items-center justify-between">
          <div className="text-xs font-bold text-[#7D756D]">
            所持数: <span className="font-mono text-[#3A342F] font-bold">{selectedItem?.count || 0}</span> 個
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#FAF8F5] hover:bg-white text-[#6B6259] font-bold text-xs rounded-xl border border-[#DDD7C8] transition"
            >
              やめる
            </button>

            <button
              onClick={handleGive}
              disabled={!selectedItem || selectedItem.count <= 0}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-xs transition ${
                selectedItem && selectedItem.count > 0
                  ? 'bg-[#D9825B] hover:bg-[#C8744E] text-white shadow-sm active:translate-y-0.5'
                  : 'bg-[#DDD7C8] text-[#8C837A] cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>あげる</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
