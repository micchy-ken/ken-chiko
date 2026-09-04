import React, { useState, useEffect } from 'react';
import { Settings, RotateCcw, User, Check, X, AlertTriangle, Sparkles, RefreshCw, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { getActiveUserId, setActiveUserId } from '../services/userService';
import {
  getSavedGoogleDocUrl,
  saveGoogleDocUrl,
  syncNyansFromGoogleDoc,
  getLastGoogleDocSyncInfo,
  GoogleDocSyncInfo,
  DEFAULT_GOOGLE_DOC_URL,
} from '../services/googleDocSync';
import { NyanCharacter } from '../types';

interface UserSettingsModalProps {
  onClose: () => void;
  onResetUserData: () => void;
  onSwitchUser?: (newUserId: string | null) => void;
  currentUserId: string | null;
  characters?: NyanCharacter[];
  onImportNyans?: (updatedNyans: NyanCharacter[], addedCount: number, updatedCount: number) => void;
  onOpenDevConsole?: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  onClose,
  onResetUserData,
  onSwitchUser,
  currentUserId,
  characters,
  onImportNyans,
}) => {
  const [targetUserId, setTargetUserId] = useState(currentUserId || '');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState(false);

  // Sheet URL State
  const [sheetUrl, setSheetUrl] = useState<string>(() => getSavedGoogleDocUrl());
  const [isUrlSaved, setIsUrlSaved] = useState(false);

  // Zukan Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncInfo, setLastSyncInfo] = useState<GoogleDocSyncInfo | null>(() => getLastGoogleDocSyncInfo());

  useEffect(() => {
    setLastSyncInfo(getLastGoogleDocSyncInfo());
  }, []);

  const handleApplyUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = targetUserId.trim();
    if (cleanId) {
      setActiveUserId(cleanId);
      if (onSwitchUser) {
        onSwitchUser(cleanId);
      } else {
        window.location.reload();
      }
    } else {
      setActiveUserId(null);
      if (onSwitchUser) {
        onSwitchUser(null);
      } else {
        window.location.reload();
      }
    }
    onClose();
  };

  const handleSaveSheetUrl = () => {
    const clean = sheetUrl.trim() || DEFAULT_GOOGLE_DOC_URL;
    saveGoogleDocUrl(clean);
    setSheetUrl(clean);
    setIsUrlSaved(true);
    setTimeout(() => setIsUrlSaved(false), 2000);
  };

  const handleExecuteReset = () => {
    onResetUserData();
    setShowResetConfirm(false);
    setResetSuccessNotice(true);
    setTimeout(() => {
      setResetSuccessNotice(false);
      onClose();
    }, 1200);
  };

  const handleSyncZukan = async () => {
    if (!characters || !onImportNyans) {
      setSyncStatus('error');
      setSyncMessage('図鑑データの参照が見つかりません');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage(null);

    try {
      const docUrl = sheetUrl.trim() || getSavedGoogleDocUrl();
      const res = await syncNyansFromGoogleDoc(docUrl, characters);

      if (res.success) {
        onImportNyans(res.updatedNyans, res.addedCount, res.updatedCount);
        setSyncStatus('success');
        setSyncMessage(`図鑑データを同期しました（${res.updatedCount}件更新 / ${res.addedCount}件追加）`);
        setLastSyncInfo(getLastGoogleDocSyncInfo());
      } else {
        setSyncStatus('error');
        setSyncMessage(res.error || '同期に失敗しました');
        setLastSyncInfo(getLastGoogleDocSyncInfo());
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message || 'データ同期エラー');
      setLastSyncInfo(getLastGoogleDocSyncInfo());
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2E2824]/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md max-h-[90vh] bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-[#ECE7DC] px-5 py-3.5 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sketch-tag bg-[#3E3833] text-white">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2E2824] font-handwriting">設定</h3>
              <p className="text-[11px] text-[#7A726A] font-handwriting">
                ユーザー設定・スプレッドシート自動同期
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sketch-tag bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Active User Status & Switcher */}
          <div className="p-4 bg-[#F2EDE2] rounded-2xl border border-[#D5CDBC] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#5A524A] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#487560]" />
                現在のログインユーザー
              </span>
              <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-white border border-[#C4BCAB] text-[#2E2824]">
                {currentUserId ? currentUserId : '（デフォルト）'}
              </span>
            </div>

            <form onSubmit={handleApplyUser} className="space-y-2 pt-1">
              <label className="text-[11px] text-[#7D756D] font-bold block">
                ユーザー名（クエリパラメータ <code className="text-[#487560]">?user=名前</code> と連動）
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="例: yumi, taro, test1"
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#C4BCAB] rounded-xl text-[#2E2824] focus:outline-none focus:border-[#487560]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#487560] hover:bg-[#3B6150] text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  切り替え
                </button>
              </div>
              <p className="text-[10px] text-[#8C847B]">
                ※ ユーザー名を変更すると、そのユーザー専用の個別セーブデータ・Firebaseドキュメントに切り替わります。
              </p>
            </form>
          </div>

          {/* Google Spreadsheet Auto-Sync Section (スプレッドシート自動同期) */}
          <div className="p-4 bg-[#FAF8F4] rounded-2xl border border-[#DDD7C8] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#5A524A] flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#487560]" />
                スプレッドシート自動同期
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF7EE] text-[#2A7545] border border-[#BDE7C7]">
                起動時自動反映ON
              </span>
            </div>
            <p className="text-[11px] text-[#7D756D] leading-relaxed">
              アプリ起動時および定期的にスプレッドシートから最新のキャラクター（セリフ・新にゃん）を自動取得します。
            </p>

            {/* URL Input and Save */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#7A726A] font-bold block">
                連携スプレッドシートURL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-2.5 py-1 text-[11px] bg-white border border-[#C4BCAB] rounded-lg text-[#2E2824] focus:outline-none focus:border-[#487560]"
                />
                <button
                  type="button"
                  onClick={handleSaveSheetUrl}
                  className="px-3 py-1 bg-[#ECE7DC] hover:bg-[#DDD7C8] text-[#3E3833] text-xs font-bold rounded-lg transition flex-shrink-0"
                >
                  {isUrlSaved ? '保存完了' : '保存'}
                </button>
              </div>
            </div>

            {/* Last Sync Info Badge */}
            {lastSyncInfo && (
              <div className="p-2 bg-[#F5F2EA] rounded-xl text-[11px] text-[#5A524A] flex items-center justify-between">
                <span>最終同期: {formatDate(lastSyncInfo.timestamp)}</span>
                <span className={lastSyncInfo.success ? 'text-[#2A7545] font-bold' : 'text-[#B92B1B] font-bold'}>
                  {lastSyncInfo.success ? `同期済 (${lastSyncInfo.totalCount}匹)` : '要確認'}
                </span>
              </div>
            )}

            {syncMessage && (
              <div
                className={`p-2.5 text-xs rounded-xl flex items-center gap-1.5 animate-fadeIn ${
                  syncStatus === 'error'
                    ? 'bg-[#FDF2F0] text-[#B92B1B] border border-[#F5C7BD]'
                    : 'bg-[#EAF7EE] text-[#2A7545]'
                }`}
              >
                {syncStatus === 'error' ? (
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="text-[11px]">{syncMessage}</span>
              </div>
            )}

            <div className="pt-0.5">
              <button
                type="button"
                onClick={handleSyncZukan}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white hover:bg-[#F2EDE2] active:scale-[0.99] border border-[#C4BCAB] hover:border-[#487560] text-[#3E3833] rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#487560] ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'スプレッドシートから同期中...' : '今すぐ手動で同期する'}</span>
              </button>
            </div>
          </div>

          {/* User Data Reset (初期化) */}
          <div className="p-4 bg-[#FFF5F2] rounded-2xl border border-[#F5C7BD] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#B92B1B]">
                <RotateCcw className="w-3.5 h-3.5" />
                データの初期化（ゼロから始める）
              </div>
            </div>
            <p className="text-xs text-[#7D756D]">
              現在のユーザー（{currentUserId ? <strong className="text-[#B92B1B]">{currentUserId}</strong> : 'デフォルト'}）のゲーム進行度・図鑑・日記・所持品をすべて初期状態にリセットします。
            </p>

            {resetSuccessNotice ? (
              <div className="p-3 bg-[#EAF7EE] text-[#2A7545] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 animate-fadeIn">
                <Check className="w-4 h-4" />
                データを初期化しました！
              </div>
            ) : !showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white hover:bg-[#FEECE8] border border-[#F09F90] text-[#B92B1B] rounded-xl text-xs font-bold transition shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ユーザーデータを初期化する</span>
              </button>
            ) : (
              <div className="p-3 bg-white border border-[#E74C3C] rounded-xl space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#E74C3C]">
                  <AlertTriangle className="w-4 h-4" />
                  本当に初期化してもよろしいですか？
                </div>
                <p className="text-[11px] text-[#7A726A]">
                  この操作は取り消せません。Firebaseとローカルのセーブデータがリセットされます。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-1.5 text-xs font-bold text-[#5A524A] bg-[#ECE7DC] hover:bg-[#DDD7C8] rounded-lg transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    className="flex-1 py-1.5 text-xs font-bold text-white bg-[#D93829] hover:bg-[#B92B1B] rounded-lg shadow-sm transition"
                  >
                    はい、初期化する
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#ECE7DC] px-5 py-3 border-t border-[#DDD7C8] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#FAF8F4] hover:bg-white text-[#3E3833] text-xs font-bold sketch-card-subtle shadow-xs transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

