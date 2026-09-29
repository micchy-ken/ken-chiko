import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  BookOpen,
  Sparkles,
  HeartHandshake,
  MessageCircle,
  X,
} from 'lucide-react';
import {
  getSynologyConnectionInfo,
  testSynologyConnection,
  SynologyConnectionInfo,
} from '../services/postgrestMasterService';
import { getPostgrestBaseUrl } from '../services/postgrestConfig';

interface SynologyStatusModalProps {
  onClose: () => void;
}

export const SynologyStatusModal: React.FC<SynologyStatusModalProps> = ({ onClose }) => {
  const [info, setInfo] = useState<SynologyConnectionInfo>(() => getSynologyConnectionInfo());
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await testSynologyConnection();
      setInfo(res);
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    handleTest();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#FAF8F4] w-full max-w-lg rounded-3xl shadow-2xl border-2 border-[#DDD7C8] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#3E3833] text-[#FAF8F4] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-400/50 flex items-center justify-center">
              <Server className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-handwriting font-bold text-base sm:text-lg flex items-center gap-2">
                Synology クラウド接続ステータス
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  PostgreSQL 🐘
                </span>
              </h3>
              <p className="text-[11px] text-[#C4BCAB]">
                自前サーバー（Synology NAS）による完全独立マスター管理
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#C4BCAB] hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Main Status Hero */}
          <div className={`p-4 rounded-2xl border-2 transition ${
            info.online
              ? 'bg-[#EBF7EE] border-[#A8E0B6] text-[#1E562F]'
              : 'bg-[#FDF2F0] border-[#F6C6BE] text-[#9E2A1E]'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                {info.online ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm sm:text-base">
                    {info.online ? 'Synology NAS 正常接続中（稼働中）' : 'Synology NAS 接続エラー'}
                  </h4>
                  <p className="text-xs opacity-90 font-mono mt-0.5 truncate max-w-xs sm:max-w-sm">
                    {info.endpoint}
                  </p>
                </div>
              </div>
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="px-2.5 py-1 bg-white hover:bg-neutral-50 active:scale-95 text-[#2E2824] rounded-lg border border-[#C4BCAB] text-xs font-bold shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-emerald-600 ${isTesting ? 'animate-spin' : ''}`} />
                <span>再テスト</span>
              </button>
            </div>

            {info.error && (
              <div className="mt-2.5 p-2 bg-white/80 rounded-xl text-xs font-mono text-red-700 border border-red-200">
                エラー詳細: {info.error}
              </div>
            )}
          </div>

          {/* Master Data Metrics Grid */}
          <div>
            <h5 className="text-xs font-bold text-[#5A524A] mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              Synology PostgreSQL 同期マスターデータ一覧
            </h5>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-white rounded-2xl border border-[#DDD7C8] shadow-xs">
                <div className="flex items-center gap-1.5 text-xs text-[#7A726A] font-bold">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>ねこ図鑑マスター</span>
                </div>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="font-mono text-lg font-black text-[#2E2824]">268 匹</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    全件同期済
                  </span>
                </div>
                <span className="text-[10px] text-[#A39B91] block mt-1">テーブル: api.master_nyans</span>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#DDD7C8] shadow-xs">
                <div className="flex items-center gap-1.5 text-xs text-[#7A726A] font-bold">
                  <MessageCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ねこ物語・会話劇</span>
                </div>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="font-mono text-lg font-black text-[#2E2824]">266 件</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    全件同期済
                  </span>
                </div>
                <span className="text-[10px] text-[#A39B91] block mt-1">テーブル: api.master_stories</span>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#DDD7C8] shadow-xs">
                <div className="flex items-center gap-1.5 text-xs text-[#7A726A] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                  <span>あそびマスター</span>
                </div>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="font-mono text-lg font-black text-[#2E2824]">31 件</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    全件同期済
                  </span>
                </div>
                <span className="text-[10px] text-[#A39B91] block mt-1">テーブル: api.master_asobi</span>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#DDD7C8] shadow-xs">
                <div className="flex items-center gap-1.5 text-xs text-[#7A726A] font-bold">
                  <HeartHandshake className="w-3.5 h-3.5 text-pink-600" />
                  <span>応援メッセージ</span>
                </div>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="font-mono text-lg font-black text-[#2E2824]">40 件</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    4カテゴリ
                  </span>
                </div>
                <span className="text-[10px] text-[#A39B91] block mt-1">テーブル: api.master_ouen_*</span>
              </div>
            </div>
          </div>

          {/* Synology NAS Dedicated Badge */}
          <div className="p-3.5 bg-[#F2F8F5] rounded-2xl border border-[#C5E3D2] space-y-1.5 text-[#215E39]">
            <div className="flex items-center gap-2 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Synology NAS 自前サーバー完全稼働</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#2D7349]">
              公式マスターデータ（図鑑・あそび・応援・ストーリー）および全ユーザーセーブデータはすべて <strong>Synology NAS (PostgreSQL / PostgREST)</strong> で保存・配信されています。外部クラウド依存ゼロで高速かつ無制限に稼働しています。
            </p>
          </div>

          {/* Direct Link to Adminer / PostgREST */}
          <div className="p-3 bg-white rounded-2xl border border-[#DDD7C8] flex items-center justify-between text-xs">
            <span className="text-[#5A524A] font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              Adminer DB管理ツール
            </span>
            <a
              href="https://micchy.synology.me:9944/?pgsql=postgre"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 hover:underline"
            >
              <span>開く (ポート9944)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#F5F2EA] border-t border-[#DDD7C8] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#3E3833] hover:bg-[#2A2522] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
