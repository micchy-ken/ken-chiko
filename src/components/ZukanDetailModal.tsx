import React from 'react';
import { NyanCharacter } from '../types';
import { NyanIllustration } from './NyanIllustration';
import {
  X,
  Heart,
  Calendar,
  Layers,
  Gift,
} from 'lucide-react';

interface ZukanDetailModalProps {
  nyan: NyanCharacter | null;
  onClose: () => void;
  onGiftToNyan?: (nyan: NyanCharacter) => void;
}

export const ZukanDetailModal: React.FC<ZukanDetailModalProps> = ({
  nyan,
  onClose,
  onGiftToNyan,
}) => {
  if (!nyan) return null;

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
              <NyanIllustration nyan={nyan} size={175} isDiscovered={true} />
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

          {/* Dialogue Section (I列: セリフ, J列: セリフの意味) */}
          {(nyan.dialogue || nyan.dialogueMeaning) && (
            <div className="p-4 bg-[#FFFDF9] sketch-card-subtle space-y-2">
              <h4 className="text-xs font-bold text-[#7A726A] font-handwriting flex items-center gap-1.5">
                <span>💬</span>
                <span>にゃんこのセリフ＆つぶやき</span>
              </h4>
              {nyan.dialogue && (
                <p className="text-base font-bold text-[#2E2824] leading-relaxed font-handwriting">
                  「{nyan.dialogue}」
                </p>
              )}
              {nyan.dialogueMeaning && (
                <p className="text-xs font-medium text-[#7A726A] font-handwriting">
                  意味: {nyan.dialogueMeaning}
                </p>
              )}
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
};
