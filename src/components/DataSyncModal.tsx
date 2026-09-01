import React, { useState } from 'react';
import { NyanCharacter, GameSaveData } from '../types';
import { exportNyansToCsv, mergeImportedCsv } from '../utils/csvParser';
import { generateGitHubWorkflowYaml, formatDataForGitHub } from '../utils/githubSync';
import {
  loadSavedFirebaseConfig,
  saveFirebaseConfig,
  FirebaseCustomConfig,
  syncSaveDataToFirebase,
} from '../services/firebaseSync';
import {
  X,
  Upload,
  Download,
  Database,
  FileSpreadsheet,
  Github,
  Check,
  Copy,
  Sparkles,
  RefreshCw,
  Layers,
  Cloud,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DataSyncModalProps {
  characters: NyanCharacter[];
  saveData: GameSaveData;
  onClose: () => void;
  onImportNyans: (updated: NyanCharacter[], addedCount: number, updatedCount: number) => void;
  onSaveFirebaseConfig: (config: FirebaseCustomConfig) => void;
}

export const DataSyncModal: React.FC<DataSyncModalProps> = ({
  characters,
  saveData,
  onClose,
  onImportNyans,
  onSaveFirebaseConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'csv' | 'github' | 'firebase'>('csv');
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Firebase state
  const existingFb = loadSavedFirebaseConfig();
  const [fbApiKey, setFbApiKey] = useState(existingFb?.apiKey || '');
  const [fbProjectId, setFbProjectId] = useState(existingFb?.projectId || '');
  const [fbAppId, setFbAppId] = useState(existingFb?.appId || '');
  const [fbSyncStatus, setFbSyncStatus] = useState<string | null>(null);

  // Handle CSV file
  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        processCsvText(text);
      }
    };
    reader.readAsText(file);
  };

  const processCsvText = (csvText: string) => {
    try {
      const { updatedNyans, addedCount, updatedCount } = mergeImportedCsv(csvText, characters);
      onImportNyans(updatedNyans, addedCount, updatedCount);
      setImportStatus(
        `✅ CSVの取り込みが完了しました！ (新規追加: ${addedCount}体 / 更新: ${updatedCount}体 / 合計: ${updatedNyans.length}体)`
      );
      confetti({ particleCount: 30, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      setImportStatus(`❌ CSVの解析に失敗しました: ${err.message || 'フォーマットをご確認ください'}`);
    }
  };

  const handleDownloadCsv = () => {
    const csvContent = exportNyansToCsv(characters);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nyans_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSaveJson = () => {
    const jsonStr = JSON.stringify(saveData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kenchiko_pet_state_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyWorkflow = () => {
    navigator.clipboard.writeText(generateGitHubWorkflowYaml());
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2000);
  };

  const handleSaveFirebase = async () => {
    const config: FirebaseCustomConfig = {
      apiKey: fbApiKey.trim(),
      projectId: fbProjectId.trim(),
      appId: fbAppId.trim(),
    };
    saveFirebaseConfig(config);
    onSaveFirebaseConfig(config);

    if (config.apiKey && config.projectId) {
      setFbSyncStatus('クラウド同期テスト中...');
      const res = await syncSaveDataToFirebase(saveData, config);
      if (res.success) {
        setFbSyncStatus('✅ Firebaseへの同期が成功しました！全端末で同一状態が共有されます。');
      } else {
        setFbSyncStatus(`⚠️ Firebase接続エラー: ${res.error}`);
      }
    } else {
      setFbSyncStatus('Firebase設定を保存しました（未接続）');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A342F]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_8px_30px_rgba(74,68,63,0.15)] overflow-hidden flex flex-col max-h-[90vh] font-['M_PLUS_Rounded_1c',sans-serif]">
        {/* Header */}
        <div className="bg-[#4A443F] px-6 py-4 border-b border-[#3A342F] flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#728C7E] text-white shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">データ連携・週次CSV更新・GitHub設定</h3>
              <p className="text-xs text-[#CCC4B2]">
                毎週の◯◯にゃん更新、Firebase同期、GitHub (ken-chiko) 自動コミット
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#DDD7C8] bg-[#EFECE4] px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x ${
              activeTab === 'csv'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#728C7E]" />
            <span>毎週のCSV更新 ({characters.length}体)</span>
          </button>

          <button
            onClick={() => setActiveTab('firebase')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x ${
              activeTab === 'firebase'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Cloud className="w-4 h-4 text-[#C8744E]" />
            <span>Firebase クラウド同期</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x ${
              activeTab === 'github'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Github className="w-4 h-4 text-[#4A443F]" />
            <span>GitHub (ken-chiko) 自動コミット</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: CSV Update */}
          {activeTab === 'csv' && (
            <div className="space-y-5">
              <div className="bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8]">
                <h4 className="text-xs font-black text-[#3A342F] mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#C8744E]" />
                  添付ファイルの更新（毎週新しい〇〇にゃんを追加）
                </h4>
                <p className="text-xs text-[#6B6259] leading-relaxed">
                  毎週更新されたCSVファイルをドラッグ＆ドロップまたは選択すると、これまでの図鑑の発見状況や絵日記の進行を保持したまま、新しいキャラクターが自動マージされます。
                </p>
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleCsvFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`p-8 border-2 border-dashed rounded-3xl text-center transition ${
                  dragActive
                    ? 'border-[#728C7E] bg-[#EAF0EC]'
                    : 'border-[#DDD7C8] bg-[#F5F2EA]/60 hover:border-[#8C837A]'
                }`}
              >
                <FileSpreadsheet className="w-10 h-10 mx-auto text-[#728C7E] mb-2" />
                <p className="text-xs font-bold text-[#3A342F] mb-1">
                  新しいCSVファイルをここにドロップ
                </p>
                <p className="text-[11px] text-[#7D756D] mb-4">またはファイルを選択</p>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-[#728C7E] hover:bg-[#5E786A] text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm">
                  <Upload className="w-4 h-4 text-white" />
                  <span>CSVファイルを選択</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleCsvFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {importStatus && (
                <div className="p-3.5 bg-[#EAF0EC] rounded-xl border border-[#C6D8CD] text-xs font-bold text-[#3D5447] animate-fadeIn">
                  {importStatus}
                </div>
              )}

              {/* Export Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-[#DDD7C8]">
                <span className="text-xs font-bold text-[#7D756D]">現在の図鑑データを出力:</span>
                <button
                  onClick={handleDownloadCsv}
                  className="flex items-center gap-1.5 text-xs font-bold bg-[#FAF8F5] hover:bg-white text-[#4A443F] px-3.5 py-2 rounded-xl border border-[#DDD7C8] shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5 text-[#728C7E]" />
                  <span>現在の全{characters.length}体をCSVエクスポート</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Firebase Realtime Multi-device Sync */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="bg-[#EAF0EC] p-4 rounded-2xl border border-[#C6D8CD]">
                <h4 className="text-xs font-black text-[#3D5447] mb-1 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-[#728C7E]" />
                  Firebase Firestore マルチデバイス同期
                </h4>
                <p className="text-xs text-[#5C7E6B] leading-relaxed">
                  Firebaseのプロジェクト情報を登録すると、PC・スマホ・タブレットなどどの端末からアクセスしても、けんちこの現在地や図鑑が同一の状態でリアルタイム同期されます。
                </p>
              </div>

              <div className="space-y-3 bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8]">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                    Firebase API Key
                  </label>
                  <input
                    type="password"
                    value={fbApiKey}
                    onChange={(e) => setFbApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                    Firebase Project ID
                  </label>
                  <input
                    type="text"
                    value={fbProjectId}
                    onChange={(e) => setFbProjectId(e.target.value)}
                    placeholder="kenchiko-pet-world"
                    className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                    App ID (任意)
                  </label>
                  <input
                    type="text"
                    value={fbAppId}
                    onChange={(e) => setFbAppId(e.target.value)}
                    placeholder="1:123456789:web:abcdef..."
                    className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSaveFirebase}
                    className="flex items-center gap-1.5 bg-[#D9825B] hover:bg-[#C8744E] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Firebase設定を保存＆テスト同期</span>
                  </button>
                </div>
              </div>

              {fbSyncStatus && (
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F]">
                  {fbSyncStatus}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GitHub (ken-chiko) Repo Auto-commit */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8]">
                <h4 className="text-xs font-black text-[#3A342F] mb-1 flex items-center gap-1.5">
                  <Github className="w-4 h-4 text-[#4A443F]" />
                  GitHubリポジトリ (ken-chiko) との連携
                </h4>
                <p className="text-xs text-[#6B6259] leading-relaxed">
                  リポジトリ <code className="bg-[#EFECE4] px-1 py-0.5 rounded font-mono text-[#3A342F] border border-[#DDD7C8]">ken-chiko</code> に以下のワークフローYAML（<code className="bg-[#EFECE4] px-1 py-0.5 rounded font-mono text-[#3A342F] border border-[#DDD7C8]">.github/workflows/sync-kenchiko.yml</code>）を配置することで、定期コミットやデータ同期が自動実行されます。
                </p>
              </div>

              {/* YAML Workflow Box */}
              <div className="bg-[#3A342F] text-white p-4 rounded-2xl border border-[#5A524A] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#CCC4B2]">
                    .github/workflows/sync-kenchiko.yml
                  </span>
                  <button
                    onClick={handleCopyWorkflow}
                    className="flex items-center gap-1 text-xs font-bold text-[#FAF8F5] hover:text-white bg-[#4A443F] hover:bg-[#5A524A] px-2.5 py-1 rounded-lg border border-[#5A524A] transition"
                  >
                    {copiedWorkflow ? <Check className="w-3.5 h-3.5 text-[#728C7E]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWorkflow ? 'コピー完了' : 'YAMLをコピー'}</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-[#C6D8CD] max-h-48 overflow-y-auto bg-[#2B2724] p-3 rounded-xl">
                  {generateGitHubWorkflowYaml()}
                </pre>
              </div>

              {/* Download JSON Snapshot */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-[#7D756D]">
                  リポジトリ保管用JSONデータ:
                </span>
                <button
                  onClick={handleDownloadSaveJson}
                  className="flex items-center gap-1.5 text-xs font-bold bg-[#4A443F] hover:bg-[#3A342F] text-white px-4 py-2 rounded-xl transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-[#D4B996]" />
                  <span>pet-state.json をダウンロード</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#EFECE4] px-6 py-4 border-t border-[#DDD7C8] flex justify-end">
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
