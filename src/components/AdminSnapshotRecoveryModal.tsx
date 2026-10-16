/**
 * AdminSnapshotRecoveryModal.tsx
 * 
 * 優位に変更のあるスナップショット（10日分、1日以上古いものは最新1件のみ）の
 * 閲覧・管理・ローカルデータとの安全マージ復旧を行う管理画面コンポーネント。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  X,
  Sparkles,
  RefreshCw,
  Eye,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Info,
  Ticket,
  BookOpen,
  Image as ImageIcon,
  Flame,
  Check,
  Upload,
} from 'lucide-react';
import { GameSaveData, NyanCharacter } from '../types';
import {
  GameSaveSnapshot,
  RestoreDiffSummary,
  getSnapshotsForUser,
  saveSnapshotIfAdvantageous,
  createManualSnapshot,
  deleteSnapshot,
  restoreSnapshotWithLocalMerge,
  ensureInitialSnapshot,
  getLocalDateString,
  getLocalTimeString,
  pruneSnapshots,
  extractSaveMetrics,
  hydrateSeedSnapshots,
} from '../services/snapshotService';
import { saveUserSaveToPostgrest } from '../services/postgrestUserService';
import confetti from '../utils/confetti';

interface AdminSnapshotRecoveryModalProps {
  userId: string;
  characters: NyanCharacter[];
  currentSaveData: GameSaveData;
  onUpdateSaveData: (updater: (prev: GameSaveData) => GameSaveData, isImmediate?: boolean) => void;
  onClose: () => void;
  openConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

export const AdminSnapshotRecoveryModal: React.FC<AdminSnapshotRecoveryModalProps> = ({
  userId,
  characters,
  currentSaveData,
  onUpdateSaveData,
  onClose,
  openConfirm,
}) => {
  const [snapshots, setSnapshots] = useState<GameSaveSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<GameSaveSnapshot | null>(null);
  const [previewingSnapshot, setPreviewingSnapshot] = useState<GameSaveSnapshot | null>(null);
  const [confirmRestoreSnap, setConfirmRestoreSnap] = useState<GameSaveSnapshot | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<{
    snapshot: GameSaveSnapshot;
    summary: RestoreDiffSummary;
  } | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualReasonInput, setManualReasonInput] = useState('');
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // 現在のローカルセーブのメトリクス
  const currentMetrics = useMemo(() => {
    return extractSaveMetrics(currentSaveData);
  }, [currentSaveData]);

  // 今日の日付文字列
  const todayStr = useMemo(() => getLocalDateString(), []);

  // スナップショット一覧の読み込み（初回初期化 & シード取り込み含む）
  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. 初回スナップショット（現在データ・ローカルバックアップ）の確保
      ensureInitialSnapshot(userId, currentSaveData, characters);
      // 2. サーバー側シードスナップショットがあれば非同期でマージ取り込み
      await hydrateSeedSnapshots(userId);
      // 3. 最新一覧をステートにセット
      const list = getSnapshotsForUser(userId);
      setSnapshots(list);
    } catch (e) {
      console.error('Error loading snapshots:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentSaveData, characters]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // 日付ごとにグルーピング
  const groupedSnapshots = useMemo(() => {
    const map = new Map<string, GameSaveSnapshot[]>();
    for (const snap of snapshots) {
      const list = map.get(snap.dateStr) || [];
      list.push(snap);
      map.set(snap.dateStr, list);
    }
    // 日付降順
    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return sortedDates.map((dateStr) => ({
      dateStr,
      isToday: dateStr === todayStr,
      snapshots: map.get(dateStr)!.sort((a, b) => b.timestamp - a.timestamp),
    }));
  }, [snapshots, todayStr]);

  // 手動スナップショット作成
  const handleCreateManualSnapshot = () => {
    const reason = manualReasonInput.trim() || '管理画面からの手動バックアップ';
    const snap = createManualSnapshot(userId, currentSaveData, reason);
    if (snap) {
      setManualReasonInput('');
      setIsCreatingManual(false);
      setActionMessage({ type: 'success', text: `📸 新しいスナップショット「${reason}」を記録しました` });
      loadSnapshots();
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // スナップショット削除
  const handleDeleteSnapshot = (snap: GameSaveSnapshot, e: React.MouseEvent) => {
    e.stopPropagation();
    const execute = () => {
      deleteSnapshot(userId, snap.id);
      setActionMessage({ type: 'success', text: `スナップショット（${snap.dateStr} ${snap.timeStr}）を削除しました` });
      loadSnapshots();
      if (previewingSnapshot?.id === snap.id) setPreviewingSnapshot(null);
      setTimeout(() => setActionMessage(null), 3000);
    };

    if (openConfirm) {
      openConfirm(
        'スナップショットの削除',
        `${snap.dateStr} ${snap.timeStr} のスナップショットを削除しますか？`,
        execute
      );
    } else {
      if (window.confirm(`${snap.dateStr} ${snap.timeStr} のスナップショットを削除しますか？`)) {
        execute();
      }
    }
  };

  // JSONダウンロード
  const handleDownloadSnapshot = (snap: GameSaveSnapshot, e: React.MouseEvent) => {
    e.stopPropagation();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snap, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kenchiko_snapshot_${userId}_${snap.dateStr}_${snap.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 外部JSONバックアップファイルのインポート
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('無効なJSONフォーマットです');
        }

        let targetSave: GameSaveData | null = null;
        let reason = `ファイルインポート (${file.name})`;
        let snapTimestamp = Date.now();

        // 1. スナップショット形式か判定
        if (parsed.saveData && parsed.metrics) {
          targetSave = parsed.saveData;
          reason = parsed.reason ? `インポート: ${parsed.reason}` : reason;
          snapTimestamp = parsed.timestamp || snapTimestamp;
        } else if (parsed.characters || parsed.nyanProgress || parsed.kenchiko) {
          // 2. 直接の GameSaveData 形式
          targetSave = parsed as GameSaveData;
          snapTimestamp = parsed.lastSaved || snapTimestamp;
        } else {
          // 3. LocalStorage ダンプ形式（キーにセーブデータが含まれる場合）
          const candidateKey = Object.keys(parsed).find(
            (k) => k.includes('user') || k.includes('backup') || k.includes('save')
          );
          if (candidateKey && parsed[candidateKey]?.kenchiko) {
            targetSave = parsed[candidateKey];
            reason = `バックアップから復元 (${candidateKey})`;
          }
        }

        if (!targetSave) {
          throw new Error('セーブデータ構造が見つかりませんでした');
        }

        const metrics = extractSaveMetrics(targetSave);
        const dateStr = getLocalDateString(snapTimestamp);
        const timeStr = getLocalTimeString(snapTimestamp);

        const newSnap: GameSaveSnapshot = {
          id: `snap_${userId}_import_${Date.now()}`,
          userId,
          timestamp: snapTimestamp,
          dateStr,
          timeStr,
          reason,
          metrics,
          saveData: targetSave,
        };

        const existing = getSnapshotsForUser(userId);
        const updated = pruneSnapshots([newSnap, ...existing], getLocalDateString());
        localStorage.setItem(`kenchiko_snapshots_${userId}`, JSON.stringify(updated));

        setActionMessage({
          type: 'success',
          text: `📁 「${file.name}」からスナップショットを取り込みました（にゃんこ: ${metrics.discoveredCount}匹, チケット: ${metrics.totalTicketCount}枚）`,
        });
        loadSnapshots();
        setTimeout(() => setActionMessage(null), 5000);
      } catch (err: any) {
        console.error('Import error:', err);
        setActionMessage({ type: 'error', text: `ファイルの取り込みに失敗しました: ${err.message || err}` });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // 復旧の実行（ローカルデータと安全マージ）
  const executeRestore = async (snap: GameSaveSnapshot) => {
    setIsRestoring(true);
    setActionMessage(null);
    try {
      // 1. ローカルデータと安全マージ
      const { mergedSave, diffSummary } = restoreSnapshotWithLocalMerge(
        currentSaveData,
        snap.saveData,
        characters
      );

      // 2. React親ステートを即時更新
      onUpdateSaveData(() => mergedSave, true);

      // 3. LocalStorage を即時更新
      const localKey = `kenchiko_save_state_user_${userId}`;
      localStorage.setItem(localKey, JSON.stringify(mergedSave));

      // 4. Synology PostgREST へ即座にプッシュ同期
      await saveUserSaveToPostgrest(userId, mergedSave).catch((err) => {
        console.warn('Synology PostgREST sync returned warning during restore:', err);
      });

      // 5. 復旧アクション自体のスナップショットも記録
      saveSnapshotIfAdvantageous(
        userId,
        mergedSave,
        `スナップショット復旧（${snap.dateStr} ${snap.timeStr} 分を安全マージ）`
      );

      // 6. 結果表示 & 紙吹雪
      setRestoreResult({ snapshot: snap, summary: diffSummary });
      setConfirmRestoreSnap(null);
      confetti();
      loadSnapshots();
    } catch (err: any) {
      console.error('Error restoring snapshot:', err);
      setActionMessage({ type: 'error', text: `復旧処理中にエラーが発生しました: ${err.message || err}` });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-amber-50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border-4 border-amber-300 overflow-hidden text-amber-950 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/40 rounded-xl border border-amber-300/40">
              <Camera className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-wide">スナップショット復旧モード</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-900/60 text-amber-200 border border-amber-400/40">
                  ユーザー: {userId}
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5">
                過去10日分の優位な進捗を自動保持（1日以上前の日は最新1件のみ）/ ローカルと安全マージ復旧
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-100 hover:text-white hover:bg-amber-500/50 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Current State Summary Banner */}
        <div className="bg-amber-100/80 border-b border-amber-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              現在のローカル進捗:
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-900">
              🐱 発見 {currentMetrics.discoveredCount}匹
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-900">
              🎫 チケット 未使用{currentMetrics.ticketCount}枚 / 計{currentMetrics.totalTicketCount}枚
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-900">
              📖 絵日記 {currentMetrics.diaryCount}件
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-900">
              📚 物語 {currentMetrics.storyCount}話
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-900">
              🎒 お出かけ {currentMetrics.totalTrips}回
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isCreatingManual ? (
              <button
                onClick={() => setIsCreatingManual(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1.5 shadow-sm transition-colors text-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                今すぐスナップショット作成
              </button>
            ) : (
              <div className="flex items-center gap-1.5 animate-in fade-in">
                <input
                  type="text"
                  placeholder="メモ（任意）"
                  value={manualReasonInput}
                  onChange={(e) => setManualReasonInput(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                />
                <button
                  onClick={handleCreateManualSnapshot}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs shadow-sm"
                >
                  保存
                </button>
                <button
                  onClick={() => setIsCreatingManual(false)}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs"
                >
                  キャンセル
                </button>
              </div>
            )}

            {/* Hidden file input for backup JSON import */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".json"
              onChange={handleImportJsonFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold flex items-center gap-1.5 border border-amber-300 shadow-xs transition-colors text-xs"
              title="過去のJSONバックアップファイルを直接取り込んでスナップショットに追加"
            >
              <Upload className="w-3.5 h-3.5 text-amber-700" />
              JSON取込
            </button>

            <button
              onClick={loadSnapshots}
              title="再読み込み"
              className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action / Error Banner */}
        {actionMessage && (
          <div
            className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border-b border-emerald-300'
                : 'bg-rose-100 text-rose-900 border-b border-rose-300'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Info Explainer */}
        <div className="px-5 py-2 bg-amber-50/60 border-b border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              保存ルール: 過去10日分を管理。1日以上前の日はその日の<strong>最新の1件のみ</strong>
              を保持し、容量を最適化しています。復旧時はローカルデータと<strong>安全マージ</strong>
              され、どちらの進捗も消えません。
            </span>
          </div>
          <span className="font-bold text-amber-900 shrink-0 ml-2">
            保持日数: {groupedSnapshots.length}日分 / 合計 {snapshots.length}件
          </span>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center text-amber-700 space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
              <p className="text-sm">スナップショットを読み込み中...</p>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-16 text-center text-amber-800 bg-white rounded-xl border border-amber-200 p-6 space-y-3">
              <Camera className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-base font-bold">スナップショットがまだ記録されていません</p>
              <p className="text-xs text-amber-600 max-w-md mx-auto">
                にゃんこ発見やお出かけ、チケット獲得などの優位な変更があると自動的にスナップショットが保存されます。
                「今すぐスナップショット作成」ボタンから手動で記録することもできます。
              </p>
              <button
                onClick={() => handleCreateManualSnapshot()}
                className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow"
              >
                現在データを最初のスナップショットとして保存
              </button>
            </div>
          ) : (
            groupedSnapshots.map((group) => (
              <div key={group.dateStr} className="space-y-2">
                {/* Date Group Header */}
                <div className="flex items-center justify-between bg-amber-200/70 px-3.5 py-1.5 rounded-lg border border-amber-300">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-700" />
                    <span className="font-bold text-sm text-amber-950">{group.dateStr}</span>
                    {group.isToday ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white">
                        本日（複数記録あり）
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300">
                        過去日（最新1件のみ保持）
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-amber-800 font-medium">
                    {group.snapshots.length} 件のスナップショット
                  </span>
                </div>

                {/* Snapshots in this date */}
                <div className="grid grid-cols-1 gap-2.5">
                  {group.snapshots.map((snap) => {
                    const isNewerThanLocal =
                      snap.metrics.discoveredCount > currentMetrics.discoveredCount ||
                      snap.metrics.totalTicketCount > currentMetrics.totalTicketCount ||
                      snap.metrics.diaryCount > currentMetrics.diaryCount;

                    return (
                      <div
                        key={snap.id}
                        className="bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition-all p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        {/* Left: Time, Reason, Metrics */}
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1 border border-amber-300">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              {snap.timeStr}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                              {snap.reason}
                            </span>
                            {isNewerThanLocal && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 flex items-center gap-1 animate-pulse">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                未反映データあり
                              </span>
                            )}
                          </div>

                          {/* Metrics chips */}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-amber-900">
                            <span className="px-2 py-0.5 bg-amber-50/80 rounded border border-amber-200 flex items-center gap-1">
                              🐱 <strong>{snap.metrics.discoveredCount}</strong> 匹
                              {snap.metrics.discoveredCount > currentMetrics.discoveredCount && (
                                <span className="text-emerald-600 font-bold">
                                  (+{snap.metrics.discoveredCount - currentMetrics.discoveredCount})
                                </span>
                              )}
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50/80 rounded border border-amber-200 flex items-center gap-1">
                              🎫 チケット <strong>{snap.metrics.ticketCount}</strong> 枚
                              <span className="text-amber-600 text-[10px]">(計{snap.metrics.totalTicketCount}枚)</span>
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50/80 rounded border border-amber-200">
                              📖 日記 <strong>{snap.metrics.diaryCount}</strong> 件
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50/80 rounded border border-amber-200">
                              📚 物語 <strong>{snap.metrics.storyCount}</strong> 話
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50/80 rounded border border-amber-200">
                              🎒 お出かけ <strong>{snap.metrics.totalTrips}</strong> 回
                            </span>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => setPreviewingSnapshot(snap)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1 border border-amber-300 transition-colors"
                            title="詳細内容を確認"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            プレビュー
                          </button>
                          <button
                            onClick={(e) => handleDownloadSnapshot(snap, e)}
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs border border-gray-300 transition-colors"
                            title="JSONバックアップをダウンロード"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmRestoreSnap(snap)}
                            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all transform active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            ローカルと安全マージ復旧
                          </button>
                          <button
                            onClick={(e) => handleDeleteSnapshot(snap, e)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors"
                            title="スナップショットを削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-amber-100/90 border-t border-amber-200 px-5 py-3 flex items-center justify-between text-xs text-amber-800 shrink-0">
          <span>
            💡 スナップショット復旧は<strong>「有利マージ」</strong>
            されます。古いスナップショットを選んでも、現在遊んだ分のにゃんこや日記が失われることはありません。
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-semibold shadow-sm transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {previewingSnapshot && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-amber-300 overflow-hidden text-amber-950">
            <div className="bg-amber-600 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">スナップショット詳細プレビュー</h3>
              </div>
              <button
                onClick={() => setPreviewingSnapshot(null)}
                className="text-white hover:text-amber-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
                <div>
                  <span className="text-amber-600 font-semibold block">記録日時:</span>
                  <span className="font-bold text-sm">
                    {previewingSnapshot.dateStr} {previewingSnapshot.timeStr}
                  </span>
                </div>
                <div>
                  <span className="text-amber-600 font-semibold block">記録理由:</span>
                  <span className="font-bold text-sm">{previewingSnapshot.reason}</span>
                </div>
              </div>

              {/* Metrics table */}
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-amber-100 text-amber-900 font-bold border-b border-amber-200">
                    <tr>
                      <th className="py-2 px-3">項目</th>
                      <th className="py-2 px-3">スナップショット</th>
                      <th className="py-2 px-3">現在のローカル</th>
                      <th className="py-2 px-3">安全マージ後の見込み</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    <tr>
                      <td className="py-2 px-3 font-semibold">🐱 発見にゃんこ数</td>
                      <td className="py-2 px-3 font-bold">{previewingSnapshot.metrics.discoveredCount} 匹</td>
                      <td className="py-2 px-3 text-gray-600">{currentMetrics.discoveredCount} 匹</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">
                        {Math.max(previewingSnapshot.metrics.discoveredCount, currentMetrics.discoveredCount)} 匹以上
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold">🎫 チケット総数</td>
                      <td className="py-2 px-3 font-bold">{previewingSnapshot.metrics.totalTicketCount} 枚</td>
                      <td className="py-2 px-3 text-gray-600">{currentMetrics.totalTicketCount} 枚</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">
                        {Math.max(previewingSnapshot.metrics.totalTicketCount, currentMetrics.totalTicketCount)} 枚以上
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold">📖 絵日記件数</td>
                      <td className="py-2 px-3 font-bold">{previewingSnapshot.metrics.diaryCount} 件</td>
                      <td className="py-2 px-3 text-gray-600">{currentMetrics.diaryCount} 件</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">
                        {Math.max(previewingSnapshot.metrics.diaryCount, currentMetrics.diaryCount)} 件以上
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold">📚 読了物語</td>
                      <td className="py-2 px-3 font-bold">{previewingSnapshot.metrics.storyCount} 話</td>
                      <td className="py-2 px-3 text-gray-600">{currentMetrics.storyCount} 話</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">
                        {Math.max(previewingSnapshot.metrics.storyCount, currentMetrics.storyCount)} 話以上
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold">🎒 総お出かけ回数</td>
                      <td className="py-2 px-3 font-bold">{previewingSnapshot.metrics.totalTrips} 回</td>
                      <td className="py-2 px-3 text-gray-600">{currentMetrics.totalTrips} 回</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">
                        {Math.max(previewingSnapshot.metrics.totalTrips, currentMetrics.totalTrips)} 回
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tickets in snapshot */}
              <div>
                <h4 className="font-bold text-amber-900 mb-1 flex items-center gap-1">
                  <Ticket className="w-4 h-4 text-amber-600" />
                  スナップショット内のチケット一覧 ({previewingSnapshot.saveData.rewards?.tickets?.length || 0}枚):
                </h4>
                <div className="max-h-36 overflow-y-auto bg-amber-50/60 p-2.5 rounded-lg border border-amber-200 space-y-1">
                  {(previewingSnapshot.saveData.rewards?.tickets || []).map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-0.5 text-[11px]">
                      <span className="font-medium text-amber-950">{t.title}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          t.isUsed ? 'bg-gray-200 text-gray-600' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {t.isUsed ? '使用済' : '未使用'}
                      </span>
                    </div>
                  ))}
                  {(previewingSnapshot.saveData.rewards?.tickets || []).length === 0 && (
                    <p className="text-gray-500 italic">チケットはありません</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 px-5 py-3 border-t border-amber-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => setPreviewingSnapshot(null)}
                className="px-3.5 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium text-xs"
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  setConfirmRestoreSnap(previewingSnapshot);
                  setPreviewingSnapshot(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                このスナップショットと安全マージ復旧
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Restore Dialog */}
      {confirmRestoreSnap && (
        <div className="fixed inset-0 z-70 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border-2 border-emerald-400 text-amber-950 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
                <RotateCcw className="w-6 h-6 animate-spin-reverse" />
              </div>
              <div>
                <h3 className="text-lg font-bold">スナップショット復旧の確認</h3>
                <p className="text-xs text-amber-700">ローカルデータとの安全マージ</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-2">
              <p className="font-bold flex items-center gap-1 text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                安全マージ（Advantageous Merge）が適用されます
              </p>
              <p className="text-emerald-800">
                スナップショット（<strong>{confirmRestoreSnap.dateStr} {confirmRestoreSnap.timeStr}</strong>）の進捗と、
                現在のローカル進捗を合算統合します。
                どちらの進捗も消えることなく、より進んでいる値（発見状態・親密度・チケット・日記等）が確実に保護・復旧されます。
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmRestoreSnap(null)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold"
              >
                キャンセル
              </button>
              <button
                onClick={() => executeRestore(confirmRestoreSnap)}
                disabled={isRestoring}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    安全マージ復旧中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    安全マージ復旧を実行する
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Result Modal */}
      {restoreResult && (
        <div className="fixed inset-0 z-80 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border-4 border-emerald-400 text-amber-950 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-emerald-900">✨ 復旧・安全マージが完了しました！</h3>
              <p className="text-xs text-amber-700">
                スナップショットとローカルデータが有利マージされ、クラウド（Synology NAS）にも即時保存されました。
              </p>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                <span className="font-semibold text-amber-800">🐱 発見にゃんこ</span>
                <span className="font-bold text-sm text-emerald-800">
                  {restoreResult.summary.nyanTotalAfter} 匹
                  {restoreResult.summary.nyanAddedCount > 0 && (
                    <span className="text-emerald-600 text-xs ml-1 font-semibold">
                      (+{restoreResult.summary.nyanAddedCount}匹 復旧)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                <span className="font-semibold text-amber-800">🎫 チケット総数</span>
                <span className="font-bold text-sm text-emerald-800">
                  {restoreResult.summary.ticketsTotalAfter} 枚
                  {restoreResult.summary.ticketsAddedCount > 0 && (
                    <span className="text-emerald-600 text-xs ml-1 font-semibold">
                      (+{restoreResult.summary.ticketsAddedCount}枚 復旧)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                <span className="font-semibold text-amber-800">📖 絵日記件数</span>
                <span className="font-bold text-sm text-emerald-800">
                  {restoreResult.summary.diaryTotalAfter} 件
                  {restoreResult.summary.diaryAddedCount > 0 && (
                    <span className="text-emerald-600 text-xs ml-1 font-semibold">
                      (+{restoreResult.summary.diaryAddedCount}件 復旧)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                <span className="font-semibold text-amber-800">📚 読了物語</span>
                <span className="font-bold text-sm text-emerald-800">
                  {restoreResult.summary.storiesTotalAfter} 話
                </span>
              </div>

              {restoreResult.summary.restoredNyanDetails.length > 0 && (
                <div className="pt-1">
                  <span className="font-semibold text-amber-800 block mb-1">
                    新たに復旧されたにゃんこ一覧:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {restoreResult.summary.restoredNyanDetails.map((n) => (
                      <span
                        key={n.no}
                        className="px-2 py-0.5 rounded bg-white border border-amber-300 font-bold text-[10px] text-amber-900"
                      >
                        No.{n.no} {n.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setRestoreResult(null)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md"
              >
                確認して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
