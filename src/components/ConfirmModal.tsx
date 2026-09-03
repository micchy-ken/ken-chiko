import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = '確認',
  message,
  confirmText = '実行する',
  cancelText = 'やめておく',
  isDanger = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div
        className="relative w-full max-w-sm bg-[#FAF8F4] border-2 border-[#2E2824] rounded-2xl p-5 shadow-xl text-[#2E2824] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon & Title */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#E8E2D8]">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isDanger ? 'bg-[#FDF2F2] text-[#BA4D4D]' : 'bg-[#F2F7F4] text-[#487560]'
            }`}
          >
            {isDanger ? <AlertTriangle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <h3 className="font-bold text-base font-handwriting">{title}</h3>
        </div>

        {/* Message */}
        <p className="text-sm text-[#5A524A] leading-relaxed whitespace-pre-wrap mb-6 font-medium">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#D5CFBF] bg-[#F2EDE4] text-[#5A524A] text-xs font-bold hover:bg-[#E8E2D8] transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5 ${
              isDanger
                ? 'bg-[#BA4D4D] hover:bg-[#A33E3E]'
                : 'bg-[#487560] hover:bg-[#395E4D]'
            }`}
          >
            {isDanger && <Trash2 className="w-3.5 h-3.5" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
