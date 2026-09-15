import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Copy,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  TrafficLogEntry,
  TrafficStats,
  getTrafficLogs,
  getTrafficStats,
  clearTrafficLogs,
  resetCircuitBreakerManual,
  clearQuotaExhausted,
  subscribeTrafficChange,
} from '../services/firestoreTrafficLogger';

interface FirestoreTrafficModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirestoreTrafficModal: React.FC<FirestoreTrafficModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<TrafficLogEntry[]>(() => getTrafficLogs());
  const [stats, setStats] = useState<TrafficStats>(() => getTrafficStats());
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Refresh immediately
    setLogs(getTrafficLogs());
    setStats(getTrafficStats());

    const unsubscribe = subscribeTrafficChange((_entry, newStats) => {
      setLogs(getTrafficLogs());
      setStats(newStats);
    });

    // Refresh sliding window counts every second
    const timer = setInterval(() => {
      setStats(getTrafficStats());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType !== 'ALL') {
        if (filterType === 'BLOCKED' && log.status !== 'BLOCKED_CIRCUIT_BREAKER') return false;
        if (filterType === 'ERROR' && log.status !== 'ERROR' && log.status !== 'QUOTA_EXHAUSTED') return false;
        if (['READ', 'WRITE', 'DELETE'].includes(filterType) && log.type !== filterType) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.path.toLowerCase().includes(q) ||
          log.caller.toLowerCase().includes(q) ||
          (log.error && log.error.toLowerCase().includes(q)) ||
          log.status.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, filterType, searchQuery]);

  const handleCopyLogs = () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        stats,
        logs: filteredLogs,
      };
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col shadow-2xl border-2 border-[#3E3833]">
        {/* Header */}
        <div className="bg-[#2E2824] text-[#FAF8F4] px-5 py-3.5 flex items-center justify-between border-b-2 border-[#3E3833]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10 text-amber-300">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Firestore 通信生ログ ＆ サーキットブレーカー</h2>
                {stats.isQuotaExhausted ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-600 text-white animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    🛑 無料枠上限発動 (ローカル保護中)
                  </span>
                ) : stats.isBreakerTripped ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    🚨 遮断中 (残り {Math.max(0, Math.ceil((stats.breakerTrippedUntil - Date.now()) / 1000))}秒)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    正常稼働中 (安全弁 有効)
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">
                アプリから飛んだすべての生リクエストを完全追跡中（上限超過時は自動で物理遮断）
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-700 hover:bg-stone-600 text-white transition"
              title="JSONでクリップボードにコピー"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {isCopied ? 'コピー完了！' : '生ログコピー'}
            </button>
            <button
              onClick={clearTrafficLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-700 hover:bg-stone-600 text-white transition"
              title="ログ一覧をクリア"
            >
              <Trash2 className="w-3.5 h-3.5" />
              クリア
            </button>
            {stats.isQuotaExhausted && (
              <button
                onClick={clearQuotaExhausted}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white transition"
                title="クォータ保護を手動解除して通信を再試行"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                クォータ解除
              </button>
            )}
            {stats.isBreakerTripped && (
              <button
                onClick={resetCircuitBreakerManual}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition animate-bounce"
                title="サーキットブレーカーを即時手動リセット"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                強制解除
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-300 hover:text-white transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Warning banner if quota exhausted */}
        {stats.isQuotaExhausted && (
          <div className="bg-orange-50 border-b border-orange-200 px-5 py-2.5 text-xs text-orange-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-orange-600" />
              <span className="font-bold">Google Cloud 無料枠上限保護中：</span>
              <span>
                Firebaseの無料枠に達しているため、すべてのFirestoreアクセスをブラウザ側で即時遮断しローカルデータで保護運転しています（残り {Math.max(1, Math.ceil((stats.quotaExhaustedUntil - Date.now()) / 60000))}分）。
              </span>
            </div>
            <button
              onClick={clearQuotaExhausted}
              className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded text-[11px] shrink-0"
            >
              今すぐ解除
            </button>
          </div>
        )}

        {/* Warning banner if tripped */}
        {stats.isBreakerTripped && !stats.isQuotaExhausted && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="font-bold">サーキットブレーカーが発動しました：</span>
            <span>{stats.breakerTripReason}</span>
          </div>
        )}

        {/* Metric Cards */}
        <div className="bg-[#ECE7DC] px-5 py-3 border-b border-[#3E3833] grid grid-cols-2 sm:grid-cols-4 gap-3 text-stone-800">
          <div className="bg-white p-2.5 rounded-lg border border-stone-300 shadow-sm">
            <span className="text-[11px] font-bold text-stone-500 block">直近1分のRead (上限60)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-xl font-mono font-bold ${stats.readsLastMinute > 30 ? 'text-red-600' : 'text-stone-900'}`}>
                {stats.readsLastMinute}
              </span>
              <span className="text-xs text-stone-500">回/分</span>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-stone-300 shadow-sm">
            <span className="text-[11px] font-bold text-stone-500 block">直近1分のWrite (上限15)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-xl font-mono font-bold ${stats.writesLastMinute > 10 ? 'text-red-600' : 'text-stone-900'}`}>
                {stats.writesLastMinute}
              </span>
              <span className="text-xs text-stone-500">回/分</span>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-stone-300 shadow-sm">
            <span className="text-[11px] font-bold text-stone-500 block">セッション累計 (Read/Write)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-mono font-bold text-blue-700">{stats.totalReads}</span>
              <span className="text-xs text-stone-400">/</span>
              <span className="text-xl font-mono font-bold text-amber-700">{stats.totalWrites}</span>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-stone-300 shadow-sm">
            <span className="text-[11px] font-bold text-stone-500 block">安全弁で防いだ暴走回数</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-xl font-mono font-bold ${stats.totalBlocked > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {stats.totalBlocked}
              </span>
              <span className="text-xs text-stone-500">回ブロック</span>
            </div>
          </div>
        </div>

        {/* Top Requested Docs Ranking */}
        {stats.topRequestedDocs.length > 0 && (
          <div className="px-5 py-2.5 bg-[#FAF8F4] border-b border-stone-200">
            <div className="text-[11px] font-bold text-stone-500 mb-1.5 flex items-center gap-1.5">
              <span>🏆 通信集中ドキュメント TOPランキング</span>
              <span className="text-stone-400 font-normal">（どのファイルが多く叩かれているか）</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.topRequestedDocs.map((doc, idx) => (
                <div
                  key={doc.path}
                  onClick={() => setSearchQuery(doc.path)}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 border border-stone-300 text-xs text-stone-800 transition"
                  title="クリックで絞り込み"
                >
                  <span className="font-bold text-stone-500">#{idx + 1}</span>
                  <span className="font-mono truncate max-w-[220px]">{doc.path}</span>
                  <span className="px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800 font-mono text-[10px]">
                    {doc.count}回
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="px-5 py-2.5 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-stone-400 mr-1" />
            {(['ALL', 'READ', 'WRITE', 'BLOCKED', 'ERROR'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                  filterType === type
                    ? 'bg-[#3E3833] text-white shadow-sm'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                }`}
              >
                {type === 'ALL' ? 'すべて' : type}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="パス・関数名で絞り込み..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded border border-stone-300 bg-[#FAF8F4] focus:outline-none focus:border-stone-500 font-mono"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              記録されたリクエストはありません
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div
                    key={log.id}
                    className={`rounded border transition ${
                      log.status === 'BLOCKED_CIRCUIT_BREAKER'
                        ? 'bg-red-50 border-red-300'
                        : log.status === 'ERROR' || log.status === 'QUOTA_EXHAUSTED'
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <div
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="p-2.5 cursor-pointer flex items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Status tag */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'BLOCKED_CIRCUIT_BREAKER'
                              ? 'bg-red-600 text-white animate-pulse'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {log.status === 'BLOCKED_CIRCUIT_BREAKER'
                            ? '🚨 BLOCKED'
                            : log.status}
                        </span>

                        {/* Type badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            log.type === 'READ'
                              ? 'bg-blue-100 text-blue-800'
                              : log.type === 'WRITE' || log.type === 'BATCH_WRITE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {log.type}
                        </span>

                        {/* Time */}
                        <span className="text-stone-400 shrink-0 text-[11px]">
                          {log.timeFormatted}
                        </span>

                        {/* Document Path */}
                        <span className="font-bold text-stone-900 truncate">
                          {log.path}
                        </span>

                        {/* Caller summary */}
                        <span className="text-stone-500 text-[11px] truncate max-w-[240px]">
                          ← {log.caller}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {log.durationMs !== undefined && (
                          <span className="text-stone-400 text-[11px]">
                            {log.durationMs}ms
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-stone-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-stone-200/60 bg-stone-50/50 space-y-2 text-[11px]">
                        <div>
                          <span className="font-bold text-stone-600">呼び出し元（Caller）: </span>
                          <span className="text-stone-800">{log.caller}</span>
                        </div>
                        {log.payloadSummary && (
                          <div>
                            <span className="font-bold text-stone-600">ペイロード概要: </span>
                            <span className="text-stone-800">{log.payloadSummary}</span>
                          </div>
                        )}
                        {log.error && (
                          <div className="p-2 rounded bg-red-100/70 text-red-800 border border-red-200">
                            <span className="font-bold">エラー / 遮断理由: </span>
                            <span>{log.error}</span>
                          </div>
                        )}
                        {log.stackSnippet && (
                          <div>
                            <span className="font-bold text-stone-600 block mb-1">スタックトレース:</span>
                            <pre className="p-2 rounded bg-stone-900 text-stone-200 text-[10px] overflow-x-auto whitespace-pre">
                              {log.stackSnippet}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#ECE7DC] px-5 py-2.5 border-t border-[#3E3833] flex items-center justify-between text-xs text-stone-600">
          <div>
            表示中: <span className="font-bold font-mono">{filteredLogs.length}</span> 件 / 全{' '}
            <span className="font-bold font-mono">{logs.length}</span> 件
          </div>
          <div className="text-stone-500">
            自動安全弁: 1秒6回/10秒25回/1分60回のReadで即遮断
          </div>
        </div>
      </div>
    </div>
  );
};
