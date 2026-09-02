import React, { useState } from 'react';
import {
  NyanCharacter,
  GameSaveData,
  KenchikoAsobi,
  AsobiConditionScope,
  AsobiFrequency,
  LocationId,
  TransportMethod,
  GiftItem,
} from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';
import { exportNyansToCsv, mergeImportedCsv } from '../utils/csvParser';
import {
  generateDeployGitHubPagesYaml,
  generateFirebaseDeployYaml,
  generateGitHubWorkflowYaml,
} from '../utils/githubSync';
import {
  loadSavedFirebaseConfig,
  saveFirebaseConfig,
  FirebaseCustomConfig,
  syncSaveDataToFirebase,
  getEnvFirebaseConfig,
  getFirebaseConnectionStatus,
  subscribeFirebaseConnectionStatus,
  testFirebaseConnection,
  FirebaseConnectionStatus,
} from '../services/firebaseSync';
import {
  getSavedGoogleDocUrl,
  saveGoogleDocUrl,
  syncNyansFromGoogleDoc,
} from '../services/googleDocSync';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';
import { EVENT_PRESET_TEMPLATES } from '../data/eventPresets';
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
  Cloud,
  CheckCircle2,
  Rocket,
  ShieldCheck,
  Globe,
  ExternalLink,
  Lock,
  Unlock,
  KeyRound,
  Plus,
  Trash2,
  Edit3,
  Save,
  Smile,
  Sliders,
  AlertTriangle,
  Search,
  Filter,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DataSyncModalProps {
  characters: NyanCharacter[];
  saveData: GameSaveData;
  onClose: () => void;
  onImportNyans: (updated: NyanCharacter[], addedCount: number, updatedCount: number) => void;
  onSaveFirebaseConfig: (config: FirebaseCustomConfig) => void;
  onUpdateSaveData: (updater: (prev: GameSaveData) => GameSaveData) => void;
}

const DEFAULT_AUTH_PASSWORD = 'wakaro';
const AUTH_SESSION_KEY = 'kenchiko_admin_authenticated';

export const DataSyncModal: React.FC<DataSyncModalProps> = ({
  characters,
  saveData,
  onClose,
  onImportNyans,
  onSaveFirebaseConfig,
  onUpdateSaveData,
}) => {
  // Password protection state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
  });
  const [inputPassword, setInputPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'asobi' | 'database' | 'googledoc' | 'firebase' | 'github' | 'csv'>('asobi');
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [githubWorkflowType, setGithubWorkflowType] = useState<'pages' | 'firebase' | 'data'>('pages');

  // Google Docs Auto-Sync State
  const [googleDocUrl, setGoogleDocUrl] = useState<string>(() => getSavedGoogleDocUrl());
  const [isSyncingGoogleDoc, setIsSyncingGoogleDoc] = useState(false);
  const [googleDocStatus, setGoogleDocStatus] = useState<string | null>(null);

  // Firebase state
  const existingFb = loadSavedFirebaseConfig();
  const envFb = getEnvFirebaseConfig();
  const [fbApiKey, setFbApiKey] = useState(existingFb?.apiKey || '');
  const [fbProjectId, setFbProjectId] = useState(existingFb?.projectId || '');
  const [fbAppId, setFbAppId] = useState(existingFb?.appId || '');
  const [fbDatabaseId, setFbDatabaseId] = useState(existingFb?.firestoreDatabaseId || '');
  const [fbSyncStatus, setFbSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<FirebaseConnectionStatus>(() => getFirebaseConnectionStatus());
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Subscribe to connection status changes
  React.useEffect(() => {
    const unsub = subscribeFirebaseConnectionStatus((status) => {
      setConnectionStatus(status);
    });
    return () => unsub();
  }, []);

  // Asobi Editor State
  const [asobiList, setAsobiList] = useState<KenchikoAsobi[]>(() => saveData.asobiList || INITIAL_ASOBI_LIST);
  const [editingAsobiId, setEditingAsobiId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCondition, setNewCondition] = useState<AsobiConditionScope>('all');
  const [newFrequency, setNewFrequency] = useState<AsobiFrequency>('normal');
  const [asobiNotice, setAsobiNotice] = useState<string | null>(null);
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [searchEventQuery, setSearchEventQuery] = useState('');

  // Database Inspector State
  const [dbSubTab, setDbSubTab] = useState<'characters' | 'inventory' | 'stats'>('characters');
  const [searchCharQuery, setSearchCharQuery] = useState('');
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  // Sync asobiList state if remote Firestore updates while modal is open
  React.useEffect(() => {
    if (saveData.asobiList && !editingAsobiId) {
      setAsobiList(saveData.asobiList);
    }
  }, [saveData.asobiList, editingAsobiId]);

  // Password Authentication Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPassword === DEFAULT_AUTH_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError(null);
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    } else {
      setAuthError('パスワードが違います。');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    setInputPassword('');
  };

  // Google Docs Sync
  const handleSyncGoogleDoc = async () => {
    if (!googleDocUrl.trim()) {
      setGoogleDocStatus('⚠️ Googleドキュメントまたはスプレッドシートの公開URLを入力してください。');
      return;
    }

    setIsSyncingGoogleDoc(true);
    setGoogleDocStatus('Googleドキュメントから最新データを取得中...');
    saveGoogleDocUrl(googleDocUrl);

    const res = await syncNyansFromGoogleDoc(googleDocUrl, characters);
    setIsSyncingGoogleDoc(false);

    if (res.success) {
      onImportNyans(res.updatedNyans, res.addedCount, res.updatedCount);
      setGoogleDocStatus(
        `✅ 自動連携が成功しました！ (新規追加: ${res.addedCount}体 / 更新: ${res.updatedCount}体 / 全${res.updatedNyans.length}体)`
      );
      confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } });
    } else {
      setGoogleDocStatus(`❌ 取得エラー: ${res.error}`);
    }
  };

  // Firebase Manual Sync & Push
  const handleManualSyncFirebase = async (customSaveData?: GameSaveData) => {
    setIsSyncing(true);
    setFbSyncStatus('Firebaseにクラウド同期中...');
    const config: FirebaseCustomConfig = {
      apiKey: fbApiKey.trim() || envFb.apiKey,
      projectId: fbProjectId.trim() || envFb.projectId,
      appId: fbAppId.trim() || envFb.appId,
      firestoreDatabaseId: fbDatabaseId.trim() || envFb.firestoreDatabaseId,
    };
    saveFirebaseConfig(config);
    onSaveFirebaseConfig(config);

    const dataToSync = customSaveData || saveData;
    const res = await syncSaveDataToFirebase(dataToSync, config);
    setIsSyncing(false);
    if (res.success) {
      setFbSyncStatus(
        `✅ Firebase（プロジェクト: ${config.projectId}）へデータを同期・更新しました！`
      );
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
    } else {
      setFbSyncStatus(`⚠️ Firebase接続エラー: ${res.error}`);
    }
  };

  // --- ASOBI (あそび・イベント) Management Handlers ---
  const handleAddOrUpdateAsobi = () => {
    if (!newTitle.trim()) {
      setAsobiNotice('⚠️ イベント名・あそび名（例: けんちこはうたをうたった）を入力してください。');
      return;
    }
    if (!newContent.trim()) {
      setAsobiNotice('⚠️ 内容・セリフ（例: 素敵なけんちこさん♪）を入力してください。');
      return;
    }

    let updatedList: KenchikoAsobi[];

    if (editingAsobiId) {
      // Update existing
      updatedList = asobiList.map((item) =>
        item.id === editingAsobiId
          ? {
              ...item,
              title: newTitle.trim(),
              content: newContent.trim(),
              condition: newCondition,
              frequency: newFrequency,
              updatedAt: Date.now(),
            }
          : item
      );
      setAsobiNotice(`✅ イベント「${newTitle.trim()}」を更新しました。Firebaseへ同期中...`);
    } else {
      // Add new
      const newItem: KenchikoAsobi = {
        id: `asobi_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: newTitle.trim(),
        content: newContent.trim(),
        condition: newCondition,
        frequency: newFrequency,
        createdAt: Date.now(),
      };
      updatedList = [newItem, ...asobiList];
      setAsobiNotice(`✅ 新しいイベント「${newTitle.trim()}」を追加しました。Firebaseへ同期中...`);
    }

    setAsobiList(updatedList);
    setEditingAsobiId(null);
    setNewTitle('');
    setNewContent('');
    setNewCondition('all');
    setNewFrequency('normal');

    // Update global save state & Firebase
    onUpdateSaveData((prev) => ({
      ...prev,
      asobiList: updatedList,
      lastSaved: Date.now(),
    }));
  };

  const handleEditAsobi = (item: KenchikoAsobi) => {
    setEditingAsobiId(item.id);
    setNewTitle(item.title);
    setNewContent(item.content);
    setNewCondition(item.condition);
    setNewFrequency(item.frequency);
    setAsobiNotice(null);
    // Smooth scroll to top of edit panel
    const formEl = document.getElementById('asobi-form-anchor');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteAsobi = (id: string, title: string) => {
    if (!window.confirm(`イベント「${title}」を削除してもよろしいですか？`)) return;

    const updatedList = asobiList.filter((item) => item.id !== id);
    setAsobiList(updatedList);
    if (editingAsobiId === id) {
      setEditingAsobiId(null);
      setNewTitle('');
      setNewContent('');
    }
    setAsobiNotice(`🗑️ イベント「${title}」を削除しました。Firebaseへ反映中...`);

    onUpdateSaveData((prev) => ({
      ...prev,
      asobiList: updatedList,
      lastSaved: Date.now(),
    }));
  };

  const handleCancelAsobiEdit = () => {
    setEditingAsobiId(null);
    setNewTitle('');
    setNewContent('');
    setNewCondition('all');
    setNewFrequency('normal');
    setAsobiNotice(null);
  };

  const handleApplyPresetTemplate = (preset: typeof EVENT_PRESET_TEMPLATES[0]) => {
    setNewTitle(preset.title);
    setNewContent(preset.content);
    setNewCondition(preset.condition);
    setNewFrequency('normal');
    setAsobiNotice(`💡 テンプレート「${preset.name}」をフォームにセットしました。内容を調整して保存してください。`);
  };

  // --- Firebase CRUD for Characters & Items ---
  const handleToggleNyanDiscovery = (no: number) => {
    onUpdateSaveData((prev) => {
      const updatedChars = prev.characters.map((c) =>
        c.no === no
          ? {
              ...c,
              discovered: !c.discovered,
              discoveryDate: !c.discovered ? new Date().toLocaleString('ja-JP') : undefined,
            }
          : c
      );
      return {
        ...prev,
        characters: updatedChars,
        lastSaved: Date.now(),
      };
    });
    setDbNotice(`No.${no} の発見ステータスを更新しました。Firebaseへ保存しました。`);
  };

  const handleDeleteNyan = (no: number, name: string) => {
    if (!window.confirm(`本当に「No.${no} ${name}」を削除しますか？\n（Firebaseおよび図鑑から完全に削除されます）`)) return;

    onUpdateSaveData((prev) => {
      const updatedChars = prev.characters.filter((c) => c.no !== no);
      return {
        ...prev,
        characters: updatedChars,
        lastSaved: Date.now(),
      };
    });
    setDbNotice(`🗑️ No.${no} ${name} を削除しました。Firebaseを更新しました。`);
  };

  const handleUpdateItemCount = (id: string, delta: number) => {
    onUpdateSaveData((prev) => {
      const updatedInv = prev.inventory.map((item) =>
        item.id === id ? { ...item, count: Math.max(0, item.count + delta) } : item
      );
      return {
        ...prev,
        inventory: updatedInv,
        lastSaved: Date.now(),
      };
    });
  };

  // Helper condition label
  const getConditionLabel = (cond: AsobiConditionScope) => {
    if (cond === 'all') return 'すべて（常時）';
    if (cond === 'all_locations') return 'すべての場所（滞在中）';
    if (cond === 'all_transports') return 'すべての移動手段（移動中）';
    if (cond.startsWith('loc_')) {
      const locKey = cond.replace('loc_', '') as LocationId;
      return `場所: ${LOCATIONS[locKey]?.name || locKey}`;
    }
    if (cond.startsWith('trans_')) {
      const transKey = cond.replace('trans_', '') as TransportMethod;
      const t = TRANSPORT_METHODS.find((tm) => tm.id === transKey);
      return `移動: ${t?.name || transKey}`;
    }
    return cond;
  };

  const getFrequencyLabel = (freq: AsobiFrequency) => {
    if (freq === 'high') return '高頻度（出やすい）';
    if (freq === 'rare') return 'レア（めったに出ない）';
    return '通常';
  };

  // Filtered Events
  const filteredEvents = asobiList.filter((event) => {
    // Condition filter
    if (filterCondition !== 'all') {
      if (filterCondition === 'locations' && !event.condition.startsWith('loc_') && event.condition !== 'all_locations') return false;
      if (filterCondition === 'transports' && !event.condition.startsWith('trans_') && event.condition !== 'all_transports') return false;
      if (filterCondition.startsWith('loc_') && event.condition !== filterCondition) return false;
      if (filterCondition.startsWith('trans_') && event.condition !== filterCondition) return false;
    }
    // Search query
    if (searchEventQuery.trim()) {
      const q = searchEventQuery.toLowerCase();
      const matchTitle = event.title.toLowerCase().includes(q);
      const matchContent = event.content.toLowerCase().includes(q);
      if (!matchTitle && !matchContent) return false;
    }
    return true;
  });

  // CSV
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

  const getActiveWorkflowCode = () => {
    if (githubWorkflowType === 'pages') return generateDeployGitHubPagesYaml();
    if (githubWorkflowType === 'firebase') return generateFirebaseDeployYaml(fbProjectId || 'gen-lang-client-0027333270');
    return generateGitHubWorkflowYaml();
  };

  const getActiveWorkflowFileName = () => {
    if (githubWorkflowType === 'pages') return '.github/workflows/deploy-gh-pages.yml';
    if (githubWorkflowType === 'firebase') return '.github/workflows/deploy-firebase.yml';
    return '.github/workflows/sync-kenchiko.yml';
  };

  const handleCopyWorkflow = () => {
    navigator.clipboard.writeText(getActiveWorkflowCode());
    setCopiedWorkflow(true);
    setTimeout(() => setCopiedWorkflow(false), 2000);
  };

  // --- RENDER PASSWORD LOCK SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/70 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-md bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col">
          <div className="bg-[#ECE7DC] px-6 py-4 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 sketch-tag bg-[#D97543] text-white shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2E2824] font-handwriting">データ連携・管理ロック</h3>
                <p className="text-[11px] text-[#7A726A] font-handwriting">パスワードを入力して認証してください</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sketch-tag bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div className="text-center py-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F5EBE1] text-[#C8744E] flex items-center justify-center mb-3 shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-black text-[#3A342F]">管理者パスワード</h4>
              <p className="text-xs text-[#7D756D] mt-1">
                全イベント・あそびの編集、およびFirebaseデータ操作には認証が必要です。
              </p>
            </div>

            <div>
              <input
                type="password"
                placeholder="パスワードを入力 (初期: wakaro)"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 bg-white border border-[#DDD7C8] rounded-2xl text-center text-sm font-mono tracking-wider text-[#3A342F] focus:outline-none focus:border-[#728C7E] focus:ring-2 focus:ring-[#728C7E]/20"
              />
              {authError && (
                <p className="text-xs font-bold text-[#D05A3F] mt-2 text-center flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{authError}</span>
                </p>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#EFECE4] hover:bg-[#E2DDD3] text-[#6B6259] font-bold text-xs transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#728C7E] hover:bg-[#5E786A] text-white font-bold text-xs transition shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                <span>ロック解除</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN AUTHENTICATED MANAGEMENT CONSOLE ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2E2824]/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#ECE7DC] px-6 py-3.5 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
          <div className="flex items-center gap-3">
            <div className="p-2 sketch-tag bg-[#3E3833] text-white shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#2E2824] font-handwriting">データ連携・全イベント編集コンソール</h3>
                <span className="bg-[#487560] text-white text-[10px] font-bold px-2 py-0.5 sketch-tag flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  認証済み
                </span>
              </div>
              <p className="text-xs text-[#7A726A] font-handwriting">
                全イベント・行動・セリフ編集、FirebaseクラウドデータCRUD、Google Docs連携
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="text-[11px] font-bold text-[#5A524A] hover:text-[#2E2824] bg-[#FAF8F4] hover:bg-white px-2.5 py-1.5 sketch-tag transition flex items-center gap-1 font-handwriting"
              title="ロックする"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">再ロック</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sketch-tag bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#DDD7C8] bg-[#EFECE4] px-4 sm:px-6 pt-3 gap-1.5 overflow-x-auto">
          {/* TAB 1: Events & Asobi Editor (全イベント編集) */}
          <button
            onClick={() => setActiveTab('asobi')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'asobi'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#C8744E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Smile className="w-4 h-4 text-[#C8744E]" />
            <span>全イベント・あそび編集 ({asobiList.length}件)</span>
          </button>

          {/* TAB 2: Database CRUD */}
          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'database'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Database className="w-4 h-4 text-[#728C7E]" />
            <span>Firebaseデータ編集</span>
          </button>

          {/* TAB 3: Google Doc Sync */}
          <button
            onClick={() => setActiveTab('googledoc')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'googledoc'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Globe className="w-4 h-4 text-[#728C7E]" />
            <span>Google Docs 自動連携</span>
          </button>

          {/* TAB 4: Firebase Config */}
          <button
            onClick={() => setActiveTab('firebase')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'firebase'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Cloud className="w-4 h-4 text-[#728C7E]" />
            <span>Firebase設定</span>
          </button>

          {/* TAB 5: GitHub */}
          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'github'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Rocket className="w-4 h-4 text-[#C8744E]" />
            <span>GitHub YAML</span>
          </button>

          {/* TAB 6: CSV */}
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'csv'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#728C7E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#728C7E]" />
            <span>CSV出力</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[64vh]">
          {/* ========================================================= */}
          {/* TAB 1: ALL EVENTS & ASOBI CONFIGURATION (全イベント・あそび編集) */}
          {/* ========================================================= */}
          {activeTab === 'asobi' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#FAF2EB] p-4 rounded-2xl border border-[#F0D5C3]">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-black text-[#874A2E] flex items-center gap-1.5">
                    <Smile className="w-4 h-4 text-[#C8744E]" />
                    全イベント・行動・セリフ設定コンソール
                  </h4>
                  <span className="bg-[#C8744E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Firebase即時同期
                  </span>
                </div>
                <p className="text-xs text-[#874A2E] leading-relaxed">
                  現在アプリに実装されている<strong>「すべてのイベント（おやつ・睡眠・仕事・温泉・買い物・移動・歌・散歩など）」</strong>の内容、タイトル、発生条件、出現頻度をここで直接編集・追加・削除できます。変更内容はFirebase Firestoreへ即時反映されます。
                </p>
              </div>

              {/* Event Quick Preset Bar */}
              <div className="bg-[#F5EBE1] p-3 rounded-2xl border border-[#E8D7C7] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-[#874A2E] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#C8744E]" />
                    クイックイベント作成テンプレート
                  </span>
                  <span className="text-[10px] text-[#A66C52]">クリックでフォームに入力</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {EVENT_PRESET_TEMPLATES.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyPresetTemplate(preset)}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#FAF2EB] text-[#874A2E] border border-[#E8D7C7] text-[11px] font-bold whitespace-nowrap transition shadow-xs"
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add / Edit Form */}
              <div id="asobi-form-anchor" className="bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8] space-y-3">
                <div className="flex items-center justify-between border-b border-[#DDD7C8] pb-2">
                  <span className="text-xs font-black text-[#3A342F] flex items-center gap-1.5">
                    {editingAsobiId ? <Edit3 className="w-4 h-4 text-[#C8744E]" /> : <Plus className="w-4 h-4 text-[#728C7E]" />}
                    {editingAsobiId ? '選択中のイベントを編集' : '新しいイベント・あそびを追加'}
                  </span>
                  {editingAsobiId && (
                    <button
                      onClick={handleCancelAsobiEdit}
                      className="text-[11px] text-[#7D756D] hover:text-[#3A342F] underline"
                    >
                      編集をキャンセル
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                      イベント名 / 行動タイトル (例: けんちこはうたをうたった)
                    </label>
                    <input
                      type="text"
                      placeholder="例: けんちこはうたをうたった"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                      内容・セリフ・つぶやき (例: 素敵なけんちこさん♪)
                    </label>
                    <input
                      type="text"
                      placeholder="例: 素敵なけんちこさん♪"
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                      発生条件（場所・移動手段）
                    </label>
                    <select
                      value={newCondition}
                      onChange={(e) => setNewCondition(e.target.value as AsobiConditionScope)}
                      className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                    >
                      <optgroup label="全般条件">
                        <option value="all">すべて（滞在・移動を問わず常時）</option>
                        <option value="all_locations">すべての場所（滞在中ならどこでも）</option>
                        <option value="all_transports">すべての移動手段（移動中ならなんでも）</option>
                      </optgroup>
                      <optgroup label="特定の場所（滞在中）">
                        {Object.values(LOCATIONS).map((loc) => (
                          <option key={loc.id} value={`loc_${loc.id}`}>
                            場所: {loc.name}（{loc.reading}）
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="特定の移動手段（移動中）">
                        {TRANSPORT_METHODS.map((t) => (
                          <option key={t.id} value={`trans_${t.id}`}>
                            移動手段: {t.name}（{t.reading}）
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                      頻度（出現割合）
                    </label>
                    <select
                      value={newFrequency}
                      onChange={(e) => setNewFrequency(e.target.value as AsobiFrequency)}
                      className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                    >
                      <option value="high">高頻度（とてもよく出る）</option>
                      <option value="normal">通常（標準的な頻度）</option>
                      <option value="rare">レア（めったに出ない特別な行動）</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={handleAddOrUpdateAsobi}
                    className="flex items-center gap-1.5 bg-[#C8744E] hover:bg-[#B3623D] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editingAsobiId ? 'イベントを更新して保存' : 'イベントを追加して保存'}</span>
                  </button>
                </div>
              </div>

              {asobiNotice && (
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F] animate-fadeIn">
                  {asobiNotice}
                </div>
              )}

              {/* Event Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between bg-white p-3 rounded-2xl border border-[#DDD7C8]">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-[#7D756D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="イベント名やセリフで絞り込み..."
                    value={searchEventQuery}
                    onChange={(e) => setSearchEventQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#FAF8F5] border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-[#7D756D] shrink-0" />
                  <select
                    value={filterCondition}
                    onChange={(e) => setFilterCondition(e.target.value)}
                    className="flex-1 sm:flex-none px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] font-bold focus:outline-none"
                  >
                    <option value="all">全条件 ({asobiList.length}件)</option>
                    <option value="locations">場所イベント全般</option>
                    <option value="transports">移動イベント全般</option>
                    {Object.values(LOCATIONS).map((loc) => (
                      <option key={loc.id} value={`loc_${loc.id}`}>
                        場所: {loc.name}
                      </option>
                    ))}
                    {TRANSPORT_METHODS.map((t) => (
                      <option key={t.id} value={`trans_${t.id}`}>
                        移動: {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Registered Events List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-[#6B6259] px-1">
                  <span>登録済みイベント一覧 ({filteredEvents.length}件 / 全{asobiList.length}件)</span>
                  <span className="text-[10px] text-[#7D756D]">クリックで編集・削除</span>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredEvents.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        editingAsobiId === item.id
                          ? 'bg-[#FAF2EB] border-[#C8744E]'
                          : 'bg-white border-[#DDD7C8] hover:border-[#728C7E]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#3A342F]">{item.title}</span>
                          <span className="text-[10px] bg-[#EFECE4] text-[#6B6259] px-2 py-0.5 rounded-full font-bold">
                            {getConditionLabel(item.condition)}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              item.frequency === 'high'
                                ? 'bg-[#EAF0EC] text-[#5C7E6B]'
                                : item.frequency === 'rare'
                                ? 'bg-[#FAF2EB] text-[#C8744E]'
                                : 'bg-[#EFECE4] text-[#7D756D]'
                            }`}
                          >
                            {getFrequencyLabel(item.frequency)}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B6259] font-serif italic">
                          「{item.content}」
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleEditAsobi(item)}
                          className="p-1.5 bg-[#EFECE4] hover:bg-[#E2DDD3] text-[#4A443F] rounded-lg transition"
                          title="編集"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAsobi(item.id, item.title)}
                          className="p-1.5 bg-[#FAF0ED] hover:bg-[#F5D8CE] text-[#D05A3F] rounded-lg transition"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredEvents.length === 0 && (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-[#DDD7C8] text-xs text-[#7D756D]">
                      該当するイベントが見つかりません。
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: FIREBASE DATABASE CRUD (キャラクター・アイテム直接編集) */}
          {/* ========================================================= */}
          {activeTab === 'database' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#EAF0EC] p-4 rounded-2xl border border-[#C6D8CD] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-[#3D5447] flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[#5C7E6B]" />
                    Firebase Firestore クラウドデータ操作コンソール
                  </h4>
                  <p className="text-xs text-[#5C7E6B] mt-0.5">
                    Firestore上の保存データを直接変更・追加・削除できます。変更は即時クラウドへ書き込まれます。
                  </p>
                </div>
                <button
                  onClick={() => handleManualSyncFirebase()}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 bg-[#728C7E] hover:bg-[#5E786A] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? '同期中...' : 'クラウド最新化'}</span>
                </button>
              </div>

              {dbNotice && (
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F]">
                  {dbNotice}
                </div>
              )}

              {/* Sub tabs */}
              <div className="flex gap-2 border-b border-[#DDD7C8] pb-2">
                <button
                  onClick={() => setDbSubTab('characters')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    dbSubTab === 'characters'
                      ? 'bg-[#4A443F] text-white shadow-sm'
                      : 'bg-[#EFECE4] text-[#6B6259] hover:text-[#3A342F]'
                  }`}
                >
                  キャラクター図鑑 ({characters.length}体)
                </button>
                <button
                  onClick={() => setDbSubTab('inventory')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    dbSubTab === 'inventory'
                      ? 'bg-[#4A443F] text-white shadow-sm'
                      : 'bg-[#EFECE4] text-[#6B6259] hover:text-[#3A342F]'
                  }`}
                >
                  所持アイテム ({saveData.inventory.length}種)
                </button>
              </div>

              {/* Sub Tab: Characters CRUD */}
              {dbSubTab === 'characters' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="キャラクター名やNoで検索..."
                      value={searchCharQuery}
                      onChange={(e) => setSearchCharQuery(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {characters
                      .filter(
                        (c) =>
                          c.name.includes(searchCharQuery) ||
                          c.reading.includes(searchCharQuery) ||
                          String(c.no).includes(searchCharQuery)
                      )
                      .map((char) => (
                        <div
                          key={char.no}
                          className="p-2.5 bg-white rounded-xl border border-[#DDD7C8] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span className="font-mono text-[11px] font-bold text-[#7D756D] shrink-0">
                              No.{char.no}
                            </span>
                            <span className="font-bold text-[#3A342F] truncate">{char.name}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                char.discovered
                                  ? 'bg-[#EAF0EC] text-[#5C7E6B]'
                                  : 'bg-[#EFECE4] text-[#8C837A]'
                              }`}
                            >
                              {char.discovered ? '発見済み' : '未発見'}
                            </span>
                            <span className="text-[10px] text-[#7D756D] hidden sm:inline truncate">
                              仲良し度: Lv.{char.friendshipLevel} (遭遇: {char.playCount}回)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleToggleNyanDiscovery(char.no)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                char.discovered
                                  ? 'bg-[#EFECE4] hover:bg-[#DDD7C8] text-[#6B6259]'
                                  : 'bg-[#728C7E] hover:bg-[#5E786A] text-white'
                              }`}
                            >
                              {char.discovered ? '未発見に戻す' : '発見済みにする'}
                            </button>
                            <button
                              onClick={() => handleDeleteNyan(char.no, char.name)}
                              className="p-1.5 bg-[#FAF0ED] hover:bg-[#F5D8CE] text-[#D05A3F] rounded-lg transition"
                              title="キャラクターを削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Sub Tab: Inventory CRUD */}
              {dbSubTab === 'inventory' && (
                <div className="space-y-2">
                  {saveData.inventory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-xl border border-[#DDD7C8] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#3A342F]">{item.name}</span>
                          <span className="text-[10px] bg-[#EFECE4] text-[#6B6259] px-2 py-0.5 rounded-full font-bold">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7D756D] mt-0.5">{item.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleUpdateItemCount(item.id, -1)}
                          disabled={item.count <= 0}
                          className="w-7 h-7 bg-[#EFECE4] hover:bg-[#E2DDD3] disabled:opacity-30 rounded-lg font-black text-sm flex items-center justify-center transition"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold w-8 text-center text-sm">
                          {item.count}
                        </span>
                        <button
                          onClick={() => handleUpdateItemCount(item.id, 1)}
                          className="w-7 h-7 bg-[#728C7E] hover:bg-[#5E786A] text-white rounded-lg font-black text-sm flex items-center justify-center transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: Google Docs Automatic Realtime Sync */}
          {/* ========================================================= */}
          {activeTab === 'googledoc' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#EAF0EC] p-4 rounded-2xl border border-[#C6D8CD]">
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-black text-[#3D5447] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#5C7E6B]" />
                    Google ドキュメント / スプレッドシート自動取り込み（パターンA）
                  </h4>
                  <span className="bg-[#5C7E6B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    自動同期対応
                  </span>
                </div>
                <p className="text-xs text-[#5C7E6B] leading-relaxed">
                  Googleドキュメントまたはスプレッドシート（共有設定:「リンクを知っている全員が閲覧可」）のURLを登録すると、<strong>アプリ起動時や更新ボタンを押した際に、新しいにゃんこキャラクターが自動で図鑑へマージされます。</strong>
                </p>
              </div>

              <div className="space-y-3 bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8]">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                    Google ドキュメント / スプレッドシート公開URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://docs.google.com/document/d/... または spreadsheets/d/..."
                      value={googleDocUrl}
                      onChange={(e) => setGoogleDocUrl(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                    />
                    {googleDocUrl && (
                      <a
                        href={googleDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-[#EFECE4] hover:bg-[#E2DDD3] text-[#4A443F] rounded-xl border border-[#DDD7C8] flex items-center justify-center transition"
                        title="ドキュメントを開く"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-[#7D756D] mt-1.5">
                    ※ ドキュメント内にCSV形式またはカンマ区切りでキャラクター情報（No, 名前, よみ, モチーフ...）が記載されている場合に自動抽出されます。
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-[#7D756D]">
                    現在の図鑑登録数: <strong className="text-[#3A342F]">{characters.length}体</strong>
                  </span>
                  <button
                    onClick={handleSyncGoogleDoc}
                    disabled={isSyncingGoogleDoc}
                    className="flex items-center gap-1.5 bg-[#728C7E] hover:bg-[#5E786A] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogleDoc ? 'animate-spin' : ''}`} />
                    <span>{isSyncingGoogleDoc ? '取得・同期中...' : '今すぐ最新ドキュメントを取り込む'}</span>
                  </button>
                </div>
              </div>

              {googleDocStatus && (
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F] animate-fadeIn">
                  {googleDocStatus}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: Firebase Multi-device Realtime Sync */}
          {/* ========================================================= */}
          {activeTab === 'firebase' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Connection Status Banner with Lamp */}
              <div
                className={`p-4 rounded-2xl border transition ${
                  connectionStatus.isOffline
                    ? 'bg-[#FFF2EE] border-[#F5A898]'
                    : 'bg-[#EAF0EC] border-[#C6D8CD]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    {connectionStatus.isOffline ? (
                      <span className="relative flex h-3.5 w-3.5 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.9)] ring-2 ring-red-300"></span>
                      </span>
                    ) : (
                      <span className="relative flex h-3.5 w-3.5 flex-shrink-0">
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-600 ring-2 ring-emerald-300"></span>
                      </span>
                    )}
                    <h4
                      className={`text-xs font-black flex items-center gap-1.5 ${
                        connectionStatus.isOffline ? 'text-[#9A2214]' : 'text-[#3D5447]'
                      }`}
                    >
                      {connectionStatus.isOffline
                        ? 'オフラインモード（Firebase未接続 / メモリ上動作中）'
                        : 'Firebase Firestore 常時接続（オンライン）'}
                    </h4>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      connectionStatus.isOffline
                        ? 'bg-[#C0392B] text-white'
                        : 'bg-[#5C7E6B] text-white'
                    }`}
                  >
                    {connectionStatus.isOffline ? 'オフライン' : '接続稼働中'}
                  </span>
                </div>

                <p
                  className={`text-xs leading-relaxed ${
                    connectionStatus.isOffline ? 'text-[#7D281F]' : 'text-[#5C7E6B]'
                  }`}
                >
                  {connectionStatus.isOffline ? (
                    <>
                      現在Firebaseサーバーと通信できていません。ローカルメモリ上で継続動作し、再接続時に自動保存されます。
                      {connectionStatus.lastError && (
                        <span className="block mt-1 font-mono text-[11px] text-[#A93226]">
                          エラー詳細: {connectionStatus.lastError}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      接続先プロジェクト: <strong className="font-mono text-[#3D5447]">{fbProjectId || 'gen-lang-client-0027333270'}</strong><br />
                      Google Cloud コンソールのHTTPリファラー制限により、GitHub PagesおよびAI Studio環境から安全に直接通信されます。
                    </>
                  )}
                </p>

                <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between">
                  <span className="text-[10px] text-[#7D756D]">
                    接続状態: {connectionStatus.isConnected ? '接続成功' : '切断中'}
                  </span>
                  <button
                    onClick={async () => {
                      setIsTestingConnection(true);
                      const res = await testFirebaseConnection({
                        apiKey: fbApiKey,
                        projectId: fbProjectId,
                        appId: fbAppId,
                        firestoreDatabaseId: fbDatabaseId,
                      });
                      setIsTestingConnection(false);
                      setFbSyncStatus(
                        res.success
                          ? '✅ Firebaseへの接続テストに成功しました！'
                          : `⚠️ 接続テスト失敗: ${res.error || '通信エラー'}`
                      );
                    }}
                    disabled={isTestingConnection}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition disabled:opacity-60 ${
                      connectionStatus.isOffline
                        ? 'bg-[#C0392B] hover:bg-[#A93226] text-white'
                        : 'bg-[#5C7E6B] hover:bg-[#4A6657] text-white'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                    <span>{isTestingConnection ? '接続確認中...' : '接続テストを実行'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 bg-[#F5F2EA] p-4 rounded-2xl border border-[#DDD7C8]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                      Project ID
                    </label>
                    <input
                      type="text"
                      value={fbProjectId}
                      onChange={(e) => setFbProjectId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                      Database ID
                    </label>
                    <input
                      type="text"
                      value={fbDatabaseId}
                      onChange={(e) => setFbDatabaseId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={fbApiKey}
                    onChange={(e) => setFbApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#728C7E]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-[#7D756D]">
                    最終同期: {new Date(saveData.lastSaved).toLocaleTimeString('ja-JP')}
                  </span>
                  <button
                    onClick={() => handleManualSyncFirebase()}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 bg-[#728C7E] hover:bg-[#5E786A] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? '同期中...' : '手動で今すぐ同期'}</span>
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

          {/* ========================================================= */}
          {/* TAB 5: GitHub Actions YAML */}
          {/* ========================================================= */}
          {activeTab === 'github' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#FAF2EB] p-4 rounded-2xl border border-[#F0D5C3]">
                <h4 className="text-xs font-black text-[#874A2E] flex items-center gap-1.5 mb-1">
                  <Github className="w-4 h-4 text-[#C8744E]" />
                  GitHub Actions 自動デプロイ設定
                </h4>
                <p className="text-xs text-[#874A2E] leading-relaxed">
                  リポジトリの <code>.github/workflows/deploy-gh-pages.yml</code> に以下の設定を配置すると、GitHubへコミットするだけで自動ビルド＆Pages公開が完了します。
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setGithubWorkflowType('pages')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    githubWorkflowType === 'pages'
                      ? 'bg-[#C8744E] text-white shadow-sm'
                      : 'bg-[#EFECE4] text-[#6B6259]'
                  }`}
                >
                  GitHub Pages 自動公開
                </button>
                <button
                  onClick={() => setGithubWorkflowType('firebase')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    githubWorkflowType === 'firebase'
                      ? 'bg-[#C8744E] text-white shadow-sm'
                      : 'bg-[#EFECE4] text-[#6B6259]'
                  }`}
                >
                  Firebase Hosting 自動公開
                </button>
              </div>

              <div className="relative bg-[#2B2724] rounded-2xl p-4 text-xs font-mono text-[#CCC4B2] overflow-x-auto max-h-56">
                <div className="flex items-center justify-between border-b border-[#3A342F] pb-2 mb-2">
                  <span className="text-[11px] text-[#A69B8D]">{getActiveWorkflowFileName()}</span>
                  <button
                    onClick={handleCopyWorkflow}
                    className="flex items-center gap-1 bg-[#3A342F] hover:bg-[#4A443F] text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition"
                  >
                    {copiedWorkflow ? <Check className="w-3 h-3 text-[#728C7E]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWorkflow ? 'コピー完了' : 'YAMLをコピー'}</span>
                  </button>
                </div>
                <pre>{getActiveWorkflowCode()}</pre>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: CSV Export & Import */}
          {/* ========================================================= */}
          {activeTab === 'csv' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-[#F5F2EA] rounded-2xl border border-[#DDD7C8] flex flex-col justify-between">
                  <div>
                    <h5 className="font-black text-xs text-[#3A342F] mb-1">CSV ダウンロード</h5>
                    <p className="text-xs text-[#7D756D]">
                      現在の全キャラクター図鑑（{characters.length}体）をCSVファイルとして保存します。
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadCsv}
                    className="mt-3 w-full py-2 bg-[#728C7E] hover:bg-[#5E786A] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>図鑑CSVを保存</span>
                  </button>
                </div>

                <div className="p-4 bg-[#F5F2EA] rounded-2xl border border-[#DDD7C8] flex flex-col justify-between">
                  <div>
                    <h5 className="font-black text-xs text-[#3A342F] mb-1">全体セーブデータ JSON</h5>
                    <p className="text-xs text-[#7D756D]">
                      けんちこの状態・あそび一覧・日記・アイテムすべてを含むバックアップJSONです。
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadSaveJson}
                    className="mt-3 w-full py-2 bg-[#4A443F] hover:bg-[#3A342F] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>セーブJSONを保存</span>
                  </button>
                </div>
              </div>

              {/* CSV Upload Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleCsvFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`p-6 border-2 border-dashed rounded-2xl text-center transition ${
                  dragActive
                    ? 'border-[#728C7E] bg-[#EAF0EC]'
                    : 'border-[#DDD7C8] bg-white hover:border-[#728C7E]'
                }`}
              >
                <Upload className="w-6 h-6 mx-auto text-[#7D756D] mb-2" />
                <p className="text-xs font-bold text-[#3A342F]">
                  CSVファイルをここにドラッグ＆ドロップ
                </p>
                <p className="text-[11px] text-[#7D756D] mt-1">または</p>
                <label className="mt-2 inline-block px-4 py-1.5 bg-[#EFECE4] hover:bg-[#E2DDD3] text-[#4A443F] font-bold text-xs rounded-xl cursor-pointer transition border border-[#DDD7C8]">
                  ファイルを選択
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCsvFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              {importStatus && (
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F]">
                  {importStatus}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#EFECE4] px-6 py-3 border-t border-[#DDD7C8] flex items-center justify-between text-xs text-[#7D756D]">
          <span>パスワード保護コンソール (ログイン中)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#4A443F] hover:bg-[#3A342F] text-white rounded-xl font-bold transition shadow-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
