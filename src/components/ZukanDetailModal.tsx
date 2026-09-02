import React, { useState } from 'react';
import { NyanCharacter } from '../types';
import { NyanIllustration } from './NyanIllustration';
import {
  X,
  Copy,
  Check,
  Upload,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col">
        {/* Header in Sketchbook Style */}
        <div className="bg-[#ECE7DC] px-6 py-4 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-sm bg-[#3E3833] text-[#FAF8F4] px-2.5 py-1 sketch-tag shadow-sm">
              No.{String(nyan.no).padStart(3, '0')}
            </span>
            <div>
              <h3 className="text-xl font-bold text-[#2E2824] leading-tight font-handwriting">
                {nyan.name}
              </h3>
              <p className="text-xs font-bold text-[#8C5A3E] font-handwriting">{nyan.reading}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sketch-tag bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Visual & Key Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center justify-center p-4 bg-[#FFFDF9] sketch-card-subtle">
              <NyanIllustration nyan={nyan} size={165} isDiscovered={true} />
              
              <div className="mt-3 flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-1.5 text-xs font-bold bg-[#FAF8F4] hover:bg-white text-[#2E2824] px-3 py-1.5 sketch-tag transition font-handwriting">
                  <Upload className="w-3.5 h-3.5 text-[#487560]" />
                  <span>画像を更新</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setShowImageInput(!showImageInput)}
                  className="flex items-center gap-1 text-xs font-bold bg-[#FAF8F4] hover:bg-white text-[#5A524A] px-2.5 py-1.5 sketch-tag transition font-handwriting"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#3C5C7A]" />
                  <span>URL</span>
                </button>

                {nyan.customImageUrl && (
                  <button
                    onClick={handleResetImage}
                    className="text-[11px] text-[#C85A53] hover:underline font-bold"
                  >
                    リセット
                  </button>
                )}
              </div>

              {showImageInput && (
                <form onSubmit={handleUrlSubmit} className="mt-2 w-full flex gap-1">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="画像URLを入力…"
                    className="flex-1 px-2.5 py-1 text-xs bg-[#FAF8F4] sketch-tag text-[#2E2824] focus:outline-none focus:border-[#487560]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs bg-[#3E3833] text-white sketch-tag font-bold font-handwriting"
                  >
                    適用
                  </button>
                </form>
              )}
            </div>

            {/* Profile Data */}
            <div className="space-y-3">
              <div className="p-3 bg-[#FFFDF9] sketch-card-subtle">
                <div className="flex items-center gap-2 text-xs font-bold text-[#7A726A] mb-1 font-handwriting">
                  <Layers className="w-3.5 h-3.5 text-[#8C5A3E]" />
                  <span>モチーフ / 出身</span>
                </div>
                <p className="text-sm font-bold text-[#2E2824]">{nyan.motif}</p>
                <p className="text-xs text-[#7A726A] mt-0.5">初登場: {nyan.firstAppeared}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-[#FFFDF9] sketch-card-subtle">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7A726A] mb-0.5 font-handwriting">
                    <Heart className="w-3.5 h-3.5 text-[#C85A53]" />
                    <span>なかよし度</span>
                  </div>
                  <p className="text-base font-bold text-[#C85A53] font-mono">Lv.{nyan.friendshipLevel}</p>
                </div>

                <div className="p-3 bg-[#FFFDF9] sketch-card-subtle">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7A726A] mb-0.5 font-handwriting">
                    <Calendar className="w-3.5 h-3.5 text-[#487560]" />
                    <span>遊んだ回数</span>
                  </div>
                  <p className="text-base font-bold text-[#487560] font-mono">{nyan.playCount}回</p>
                </div>
              </div>

              {onGiftToNyan && (
                <button
                  onClick={() => onGiftToNyan(nyan)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#D97543] hover:bg-[#C46332] text-white font-bold text-xs sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting"
                >
                  <Gift className="w-4 h-4 text-white" />
                  <span>このにゃんにプレゼントをあげる</span>
                </button>
              )}
            </div>
          </div>

          {/* Episode Story */}
          <div className="p-4 bg-[#FFFDF9] sketch-card-subtle space-y-2">
            <h4 className="text-xs font-bold text-[#7A726A] font-handwriting flex items-center gap-1.5">
              <span>📖</span>
              <span>観察エピソード・生態記録</span>
            </h4>
            <p className="text-sm font-medium text-[#2E2824] leading-relaxed font-handwriting whitespace-pre-wrap">
              {nyan.episode || 'けんちこがセカイのどこかで出会った、ゆるくて愛らしい仲間。'}
            </p>
          </div>

          {/* Generation Prompts */}
          <div className="space-y-3">
            <div className="p-3.5 bg-[#FFFDF9] sketch-card-subtle space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#7A726A] font-handwriting">日本語プロンプト</span>
                <button
                  onClick={handleCopyJa}
                  className="flex items-center gap-1 text-[11px] text-[#487560] hover:underline font-bold font-handwriting"
                >
                  {copiedJa ? <Check className="w-3 h-3 text-[#487560]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedJa ? 'コピー完了' : 'コピー'}</span>
                </button>
              </div>
              <p className="text-xs text-[#5A524A] font-mono bg-[#FAF8F4] p-2 rounded-lg border border-[#EAE6DC] break-all select-all">
                {nyan.promptJa}
              </p>
            </div>

            <div className="p-3.5 bg-[#FFFDF9] sketch-card-subtle space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#7A726A] font-handwriting">English Prompt</span>
                <button
                  onClick={handleCopyEn}
                  className="flex items-center gap-1 text-[11px] text-[#3C5C7A] hover:underline font-bold font-handwriting"
                >
                  {copiedEn ? <Check className="w-3 h-3 text-[#3C5C7A]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedEn ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs text-[#5A524A] font-mono bg-[#FAF8F4] p-2 rounded-lg border border-[#EAE6DC] break-all select-all">
                {nyan.promptEn}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
