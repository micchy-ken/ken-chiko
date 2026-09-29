import React, { useState } from 'react';
import { Wrench, Database, KeyRound, Sparkles, Server, ArrowRight } from 'lucide-react';
import { ASSET_PATHS, getAssetUrl } from '../utils/assetPath';

interface MaintenanceScreenProps {
  onBypass: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ onBypass }) => {
  const [password, setPassword] = useState('');
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState(false);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'wakaro') {
      onBypass();
    } else {
      setErrorMsg(true);
      setTimeout(() => setErrorMsg(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F2EDE2] select-none">
      <div className="bg-[#FAF8F4] w-full max-w-lg rounded-3xl shadow-2xl border-4 border-[#3E3833] p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
        {/* Decorative corner icon */}
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-[#EADCC8] rounded-full opacity-40 blur-md pointer-events-none"></div>

        {/* Cute Icon / Illustration */}
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full bg-[#FFFBF5] border-2 border-[#DDD7C8] shadow-md flex items-center justify-center overflow-hidden">
            <img
              src={getAssetUrl(ASSET_PATHS.KIHON_NYAN_TRANSPARENT)}
              alt="けんちこ"
              className="w-18 h-18 object-contain animate-bounce"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#8C5A3E] text-white flex items-center justify-center shadow-sm">
            <Wrench className="w-4 h-4 animate-spin" />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF7EE] text-[#1E562F] border border-[#A8E0B6] text-xs font-bold mb-3">
          <Server className="w-3.5 h-3.5 text-emerald-600" />
          <span>Synology NAS データベース移行中 🐘</span>
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-black text-[#2E2824] font-handwriting mb-2">
          ただいまデータお引越し中だにゃ🐾
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[#6A6055] leading-relaxed mb-6 max-w-md">
          けんちこワールドは現在、大切なセーブデータ（図鑑・親密度・思い出絵日記・ガラポン）を専用サーバー（Synology NAS）へ安全にお引越しする作業を行っています。
          <br className="hidden sm:inline" />
          完了までしばらくお待ちください！
        </p>

        {/* Status progress pill */}
        <div className="w-full bg-[#F5F2EA] rounded-2xl p-4 border border-[#DDD7C8] mb-6 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold">
            <span className="text-[#3E3833] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              移行ステータス
            </span>
            <span className="text-emerald-700 font-mono">ステップ 4/5 進行中</span>
          </div>
          <div className="w-full bg-[#E5DFD3] rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full w-[80%] animate-pulse"></div>
          </div>
          <p className="text-[11px] text-[#7A726A]">
            マスターデータ移行完了 ➔ <strong>ユーザーセーブデータ移行作業中</strong>
          </p>
        </div>

        {/* Admin Bypass Toggle */}
        {!showAdminInput ? (
          <button
            onClick={() => setShowAdminInput(true)}
            className="text-[11px] text-[#8C5A3E] hover:text-[#5A3824] underline flex items-center gap-1 transition cursor-pointer font-bold"
          >
            <KeyRound className="w-3 h-3" />
            <span>管理者用確認ログイン（合言葉入力）</span>
          </button>
        ) : (
          <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-2 animate-fadeIn">
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理者の合言葉"
                autoFocus
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#C4BCAB] rounded-xl text-[#2E2824] focus:outline-none focus:border-[#487560]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#3E3833] hover:bg-[#2A2522] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>入る</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {errorMsg && (
              <p className="text-[11px] text-red-600 font-bold">
                合言葉が違います
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
