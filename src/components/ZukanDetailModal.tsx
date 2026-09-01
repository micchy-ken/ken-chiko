import React, { useState } from 'react';
import { NyanCharacter, GiftItem } from '../types';
import { NyanIllustration } from './NyanIllustration';
import {
  X,
  Copy,
  Check,
  Upload,
  Sparkles,
  Heart,
  Calendar,
  Layers,
  Image as ImageIcon,
  Gift,
} from 'lucide-react';

interface ZukanDetailModalProps {
  nyan: NyanCharacter | null;
  onClose: () => void;
  onUpdateCustomImage: (nyanNo: number, imageUrl: string) => void;
  onGiftToNyan?: (nyan: NyanCharacter) => void;
}

export const ZukanDetailModal: React.FC<ZukanDetailModalProps> = ({
  nyan,
  onClose,
  onUpdateCustomImage,
  onGiftToNyan,
}) => {
  const [copiedJa, setCopiedJa] = useState(false);
  const [copiedEn, setCopiedEn] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  if (!nyan) return null;

  const handleCopyJa = () => {
    navigator.clipboard.writeText(nyan.promptJa);
    setCopiedJa(true);
    setTimeout(() => setCopiedJa(false), 2000);
  };

  const handleCopyEn = () => {
    navigator.clipboard.writeText(nyan.promptEn);
    setCopiedEn(true);
    setTimeout(() => setCopiedEn(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onUpdateCustomImage(nyan.no, result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrlInput.trim()) {
      onUpdateCustomImage(nyan.no, customUrlInput.trim());
      setCustomUrlInput('');
      setShowImageInput(false);
    }
  };

  const handleResetImage = () => {
    onUpdateCustomImage(nyan.no, '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A342F]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_8px_30px_rgba(74,68,63,0.15)] overflow-hidden flex flex-col font-['M_PLUS_Rounded_1c',sans-serif]">
        {/* Header */}
        <div className="bg-[#4A443F] px-6 py-4 border-b border-[#3A342F] flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-sm bg-[#728C7E] text-white px-2.5 py-1 rounded-xl shadow-sm">
              No.{String(nyan.no).padStart(3, '0')}
            </span>
            <div>
              <h3 className="text-xl font-black text-white leading-tight">
                {nyan.name}
              </h3>
              <p className="text-xs font-bold text-[#D4B996]">{nyan.reading}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#3A342F] hover:bg-[#2B2724] text-[#CCC4B2] hover:text-white border border-[#5A524A] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Visual & Key Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center justify-center p-4 bg-[#F5F2EA] rounded-2xl border border-[#DDD7C8]">
              <NyanIllustration nyan={nyan} size={160} isDiscovered={true} />
              
              <div className="mt-3 flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-[#FAF8F5] hover:bg-[#EFECE4] text-[#4A443F] px-3 py-1.5 rounded-xl border border-[#DDD7C8] shadow-sm transition">
                  <Upload className="w-3.5 h-3.5 text-[#728C7E]" />
                  <span>画像を更新</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>

                {nyan.customImageUrl && (
                  <button
                    onClick={handleResetImage}
                    className="text-xs font-bold text-[#7D756D] hover:text-[#4A443F] underline"
                  >
                    初期絵に戻す
                  </button>
                )}
              </div>
            </div>

            {/* Quick Lore & Friendship Info */}
            <div className="space-y-3">
              <div className="bg-[#EFECE4] p-3.5 rounded-2xl border border-[#DDD7C8]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#7D756D] mb-1">
                  <Layers className="w-4 h-4 text-[#728C7E]" />
                  <span>モチーフ・元ネタ</span>
                </div>
                <p className="text-sm font-black text-[#3A342F]">{nyan.motif}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#EFECE4] p-3 rounded-xl border border-[#DDD7C8]">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7D756D] mb-0.5">
                    <Calendar className="w-3.5 h-3.5 text-[#4B6882]" />
                    <span>初登場時期</span>
                  </div>
                  <p className="text-xs font-bold text-[#3A342F]">{nyan.firstAppeared || '2025年'}</p>
                </div>

                <div className="bg-[#EFECE4] p-3 rounded-xl border border-[#DDD7C8]">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#D4736A] mb-0.5">
                    <Heart className="w-3.5 h-3.5 fill-[#D4736A]" />
                    <span>なかよし度</span>
                  </div>
                  <p className="text-xs font-black text-[#3A342F]">
                    Lv.{nyan.friendshipLevel} ({nyan.playCount}回あそんだ)
                  </p>
                </div>
              </div>

              {onGiftToNyan && (
                <button
                  onClick={() => onGiftToNyan(nyan)}
                  className="w-full flex items-center justify-center gap-2 bg-[#D9825B] hover:bg-[#C8744E] text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition active:translate-y-0.5"
                >
                  <Gift className="w-4 h-4" />
                  <span>この子におやつ・アイテムをプレゼント</span>
                </button>
              )}
            </div>
          </div>

          {/* Episode Story Lore */}
          <div className="bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8]">
            <h4 className="text-xs font-black text-[#6B6259] tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#C8744E]" />
              設定・主なエピソード
            </h4>
            <p className="text-sm font-medium text-[#3A342F] leading-relaxed whitespace-pre-wrap">
              {nyan.episode}
            </p>
          </div>

          {/* AI Image Generation Prompts Extensibility */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black text-[#6B6259] tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-[#728C7E]" />
              画像生成プロンプト (AIで新しいイラストを作成・更新)
            </h4>

            {/* Japanese Prompt */}
            <div className="bg-[#EFECE4] p-3.5 rounded-2xl border border-[#DDD7C8]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-[#7D756D]">
                  日本語プロンプト (B-1 ゆるかわ脱力ペン画風)
                </span>
                <button
                  onClick={handleCopyJa}
                  className="flex items-center gap-1 text-xs font-bold text-[#3D5447] hover:text-[#2B3B32] bg-[#EAF0EC] px-2 py-0.5 rounded-lg border border-[#C6D8CD] transition"
                >
                  {copiedJa ? <Check className="w-3.5 h-3.5 text-[#5C7E6B]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJa ? 'コピー完了' : 'コピー'}</span>
                </button>
              </div>
              <p className="text-xs font-mono text-[#4A443F] bg-[#FAF8F5] p-2.5 rounded-xl border border-[#DDD7C8]">
                {nyan.promptJa || 'プロンプト未登録'}
              </p>
            </div>

            {/* English Prompt */}
            <div className="bg-[#EFECE4] p-3.5 rounded-2xl border border-[#DDD7C8]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-[#7D756D]">
                  英語プロンプト (ImageFX / Midjourney 等)
                </span>
                <button
                  onClick={handleCopyEn}
                  className="flex items-center gap-1 text-xs font-bold text-[#2F495E] hover:text-[#1F3342] bg-[#EAF0F4] px-2 py-0.5 rounded-lg border border-[#C2D3DF] transition"
                >
                  {copiedEn ? <Check className="w-3.5 h-3.5 text-[#5C7E6B]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEn ? 'コピー完了' : 'コピー'}</span>
                </button>
              </div>
              <p className="text-xs font-mono text-[#4A443F] bg-[#FAF8F5] p-2.5 rounded-xl border border-[#DDD7C8] break-words">
                {nyan.promptEn || 'Prompt not registered'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#EFECE4] px-6 py-3.5 border-t border-[#DDD7C8] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#4A443F] hover:bg-[#3A342F] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
};
