import React, { useState, useEffect } from 'react';
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
import { KihonNyanCat } from './KihonNyanCat';
import { ConfirmModal } from './ConfirmModal';
import { AdminZukanEditor } from './AdminZukanEditor';
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
  Camera,
  Image as ImageIcon,
  Wand2,
  Table,
  PlusCircle,
  Files,
  ArrowUpDown,
  CheckSquare,
  Square,
  CornerDownLeft,
  ListPlus,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  compressAndResizeImage,
  saveLocalKenchikoImage,
  loadLocalKenchikoImage,
  loadLocalKenchikoRawImage,
  saveLocalKihonNyanImage,
  loadLocalKihonNyanImage,
  loadLocalKihonNyanRawImage,
  TransparencyOptions,
} from '../services/imageCompression';

export type AdminTab = 'zukan' | 'avatar' | 'kihon_nyan' | 'asobi' | 'database' | 'googledoc' | 'firebase' | 'github' | 'csv';

interface DataSyncModalProps {
  characters: NyanCharacter[];
  saveData: GameSaveData;
  onClose: () => void;
  onImportNyans: (updated: NyanCharacter[], addedCount: number, updatedCount: number) => void;
  onSaveFirebaseConfig: (config: FirebaseCustomConfig) => void;
  onUpdateSaveData: (updater: (prev: GameSaveData) => GameSaveData, isImmediate?: boolean) => void;
  initialTab?: AdminTab;
  initialPass?: string;
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
  initialTab,
  initialPass,
}) => {
  // Password protection state - supports session storage, initialPass prop, or query params (?pass=wakaro or ?admin=wakaro)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPass = params.get('pass') || params.get('key') || params.get('password');
      const adminParam = params.get('admin');
      if (
        (initialPass && initialPass === DEFAULT_AUTH_PASSWORD) ||
        urlPass === DEFAULT_AUTH_PASSWORD ||
        adminParam === DEFAULT_AUTH_PASSWORD
      ) {
        sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        return true;
      }
      return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
    }
    return false;
  });
  const [inputPassword, setInputPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // App-side Custom Confirm Modal state
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Tab navigation - supports initialTab prop or URL query params (?admin=asobi or ?subtab=asobi)
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const validTabs: AdminTab[] = ['zukan', 'avatar', 'kihon_nyan', 'asobi', 'database', 'googledoc', 'firebase', 'github', 'csv'];
    if (initialTab && validTabs.includes(initialTab)) {
      return initialTab;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const adminVal = params.get('admin') as AdminTab;
      const subVal = (params.get('subtab') || params.get('admintab') || params.get('section')) as AdminTab;
      if (adminVal && validTabs.includes(adminVal)) return adminVal;
      if (subVal && validTabs.includes(subVal)) return subVal;
    }
    return 'zukan';
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [dragActive, setDragActive] = useState(false);
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [rawAvatarSource, setRawAvatarSource] = useState<string>(() => {
    return loadLocalKenchikoRawImage() || saveData.kenchiko.customImageUrl || loadLocalKenchikoImage() || '';
  });
  const [currentAvatarPreview, setCurrentAvatarPreview] = useState<string>(() => {
    return saveData.kenchiko.customImageUrl || loadLocalKenchikoImage() || '';
  });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [githubWorkflowType, setGithubWorkflowType] = useState<'pages' | 'firebase' | 'data'>('pages');

  // Background transparency options
  const [autoTransparent, setAutoTransparent] = useState(true);
  const [transparencyTolerance, setTransparencyTolerance] = useState(30);
  const [trimPadding, setTrimPadding] = useState(true);

  // Process and apply avatar image with transparency settings
  const processAndApplyAvatar = async (sourceImage: string | File, rawSourceForSave?: string) => {
    try {
      setIsProcessingAvatar(true);
      setAvatarStatus('イラスト画像の背景透過・最適化を実行中...');

      const opts: TransparencyOptions = {
        enableTransparency: autoTransparent,
        tolerance: transparencyTolerance,
        feather: 2,
        trimPadding: trimPadding,
      };

      const processedDataUrl = await compressAndResizeImage(sourceImage, 600, 600, 0.92, opts);
      
      const rawToSave = rawSourceForSave || (typeof sourceImage === 'string' ? sourceImage : processedDataUrl);
      setRawAvatarSource(rawToSave);
      saveLocalKenchikoImage(processedDataUrl, rawToSave);
      setCurrentAvatarPreview(processedDataUrl);

      // Save to GameState & Firebase
      onUpdateSaveData((prev) => ({
        ...prev,
        lastSaved: Date.now(),
        kenchiko: {
          ...prev.kenchiko,
          customImageUrl: processedDataUrl,
        },
      }));

      setIsProcessingAvatar(false);
      setAvatarStatus(
        autoTransparent
          ? '✨ 背景を綺麗に自動透過して登録しました！'
          : '✅ イラスト画像を登録しました！'
      );
      confetti({ particleCount: 35, spread: 70, origin: { y: 0.5 } });
    } catch (err: any) {
      setIsProcessingAvatar(false);
      setAvatarStatus(`❌ 処理に失敗しました: ${err.message || '別の画像をお試しください'}`);
    }
  };

  const handleKenchikoAvatarUpload = async (file: File) => {
    // Read raw file to DataURL first so we can re-process if user adjusts sliders
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = (e.target?.result as string) || '';
      setRawAvatarSource(rawDataUrl);
      await processAndApplyAvatar(rawDataUrl, rawDataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleReprocessWithSettings = async () => {
    if (!rawAvatarSource) return;
    await processAndApplyAvatar(rawAvatarSource, rawAvatarSource);
  };

  // ==========================================
  // Kihon Nyan (きほんのにゃんこ) Image & Transparency State
  // ==========================================
  const [kihonNyanDragActive, setKihonNyanDragActive] = useState(false);
  const [kihonNyanStatus, setKihonNyanStatus] = useState<string | null>(null);
  const [isProcessingKihonNyan, setIsProcessingKihonNyan] = useState(false);
  const [rawKihonNyanSource, setRawKihonNyanSource] = useState<string>(() => {
    return loadLocalKihonNyanRawImage() || saveData.kihonNyanCustomImageUrl || loadLocalKihonNyanImage() || '';
  });
  const [currentKihonNyanPreview, setCurrentKihonNyanPreview] = useState<string>(() => {
    return saveData.kihonNyanCustomImageUrl || loadLocalKihonNyanImage() || '';
  });

  const [kihonNyanAutoTransparent, setKihonNyanAutoTransparent] = useState(true);
  const [kihonNyanTolerance, setKihonNyanTolerance] = useState(30);
  const [kihonNyanTrimPadding, setKihonNyanTrimPadding] = useState(true);

  // Process and apply Kihon Nyan image with transparency settings
  const processAndApplyKihonNyan = async (sourceImage: string | File, rawSourceForSave?: string) => {
    try {
      setIsProcessingKihonNyan(true);
      setKihonNyanStatus('きほんのにゃんこ原画の背景透過・余白トリミングを実行中...');

      const opts: TransparencyOptions = {
        enableTransparency: kihonNyanAutoTransparent,
        tolerance: kihonNyanTolerance,
        feather: 2,
        trimPadding: kihonNyanTrimPadding,
      };

      const processedDataUrl = await compressAndResizeImage(sourceImage, 600, 600, 0.92, opts);
      
      const rawToSave = rawSourceForSave || (typeof sourceImage === 'string' ? sourceImage : processedDataUrl);
      setRawKihonNyanSource(rawToSave);
      saveLocalKihonNyanImage(processedDataUrl, rawToSave);
      setCurrentKihonNyanPreview(processedDataUrl);

      // Save to GameState & Firebase
      onUpdateSaveData((prev) => ({
        ...prev,
        lastSaved: Date.now(),
        kihonNyanCustomImageUrl: processedDataUrl,
      }));

      setIsProcessingKihonNyan(false);
      setKihonNyanStatus(
        kihonNyanAutoTransparent
          ? '✨ 余分な外枠をカットし、手描き線を活かして綺麗に透過登録しました！'
          : '✅ きほんのにゃんこ画像を登録しました！'
      );
      confetti({ particleCount: 35, spread: 70, origin: { y: 0.5 } });
    } catch (err: any) {
      setIsProcessingKihonNyan(false);
      setKihonNyanStatus(`❌ 処理に失敗しました: ${err.message || '別の画像をお試しください'}`);
    }
  };

  const handleKihonNyanUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = (e.target?.result as string) || '';
      setRawKihonNyanSource(rawDataUrl);
      await processAndApplyKihonNyan(rawDataUrl, rawDataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Helper to load and process existing default /images/base-nyanko-square.jpg
  const handleProcessDefaultBaseImage = async () => {
    try {
      setIsProcessingKihonNyan(true);
      setKihonNyanStatus('公式手描き原画（/images/base-nyanko-square.jpg）を読み込み中...');
      
      const response = await fetch('/images/base-nyanko-square.jpg');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = (e.target?.result as string) || '';
        setRawKihonNyanSource(rawDataUrl);
        await processAndApplyKihonNyan(rawDataUrl, rawDataUrl);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      setIsProcessingKihonNyan(false);
      setKihonNyanStatus(`❌ 原画読み込みに失敗しました: ${err.message}`);
    }
  };

  const handleKihonNyanReprocess = async () => {
    if (rawKihonNyanSource) {
      await processAndApplyKihonNyan(rawKihonNyanSource, rawKihonNyanSource);
    } else {
      await handleProcessDefaultBaseImage();
    }
  };

  const handleResetKihonNyan = () => {
    openConfirm(
      'きほんのにゃんこ画像の初期化',
      '登録した透過画像を解除し、初期の手描き正方形原画（未透過）に戻しますか？',
      () => {
        saveLocalKihonNyanImage('');
        setRawKihonNyanSource('');
        setCurrentKihonNyanPreview('');
        onUpdateSaveData((prev) => ({
          ...prev,
          lastSaved: Date.now(),
          kihonNyanCustomImageUrl: undefined,
        }));
        setKihonNyanStatus('🔄 初期のきほんのにゃんこ原画に戻しました。');
      }
    );
  };



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
  const [asobiViewMode, setAsobiViewMode] = useState<'sheet' | 'cards' | 'batch'>('sheet');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCondition, setNewCondition] = useState<AsobiConditionScope>('all');
  const [newFrequency, setNewFrequency] = useState<AsobiFrequency>('normal');
  const [batchRawText, setBatchRawText] = useState('');
  const [batchDefaultCondition, setBatchDefaultCondition] = useState<AsobiConditionScope>('all');
  const [batchDefaultFrequency, setBatchDefaultFrequency] = useState<AsobiFrequency>('normal');
  const [asobiNotice, setAsobiNotice] = useState<string | null>(null);
  const [filterCondition, setFilterCondition] = useState<string>('all');
  const [searchEventQuery, setSearchEventQuery] = useState('');
  const [selectedAsobiIds, setSelectedAsobiIds] = useState<Set<string>>(new Set());

  // Database Inspector State
  const [dbSubTab, setDbSubTab] = useState<'characters' | 'inventory' | 'stats'>('characters');
  const [searchCharQuery, setSearchCharQuery] = useState('');
  const [dbNotice, setDbNotice] = useState<string | null>(null);

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
    const res = await syncSaveDataToFirebase(dataToSync, true, config);
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
    }), true);
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
    openConfirm(
      'イベントの削除',
      `イベント「${title}」を削除してもよろしいですか？`,
      () => {
        const updatedList = asobiList.filter((item) => item.id !== id);
        setAsobiList(updatedList);
        if (editingAsobiId === id) {
          setEditingAsobiId(null);
          setNewTitle('');
          setNewContent('');
        }
        setAsobiNotice(`🗑️ イベント「${title}」を削除しました。`);

        onUpdateSaveData((prev) => ({
          ...prev,
          asobiList: updatedList,
          lastSaved: Date.now(),
        }), true);
      }
    );
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

  // Duplicate an existing event to create a quick variation
  const handleDuplicateAsobi = (item: KenchikoAsobi) => {
    const newItem: KenchikoAsobi = {
      id: `asobi_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: `${item.title} (コピー)`,
      content: item.content,
      condition: item.condition,
      frequency: item.frequency,
      createdAt: Date.now(),
    };
    const updatedList = [newItem, ...asobiList];
    setAsobiList(updatedList);
    onUpdateSaveData((prev) => ({
      ...prev,
      asobiList: updatedList,
      lastSaved: Date.now(),
    }), true);
    setAsobiNotice(`📋 「${item.title}」を複製しました。リスト上部でセリフを編集できます。`);
  };

  // Quick Inline cell update for Spreadsheet Table (Debounced, does not hammer Firestore on every keystroke)
  const handleInlineUpdateAsobi = (id: string, field: keyof KenchikoAsobi, value: any) => {
    const updatedList = asobiList.map((item) =>
      item.id === id
        ? {
            ...item,
            [field]: value,
            updatedAt: Date.now(),
          }
        : item
    );
    setAsobiList(updatedList);
    // Use debounced sync (isImmediate: false) so keystrokes are batched and don't consume write quota
    onUpdateSaveData((prev) => ({
      ...prev,
      asobiList: updatedList,
      lastSaved: Date.now(),
    }), false);
  };

  // Add blank row at top of spreadsheet
  const handleAddBlankSpreadsheetRow = () => {
    const newItem: KenchikoAsobi = {
      id: `asobi_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: '新しい行動タイトル',
      content: 'けんちこのセリフを入力してください',
      condition: 'all',
      frequency: 'normal',
      createdAt: Date.now(),
    };
    const updatedList = [newItem, ...asobiList];
    setAsobiList(updatedList);
    onUpdateSaveData((prev) => ({
      ...prev,
      asobiList: updatedList,
      lastSaved: Date.now(),
    }), true);
    setAsobiNotice('➕ 新しい行を追加しました。表のセルを直接クリックして文字を編集できます。');
  };

  // Batch Bulk Parse & Import
  const handleExecuteBatchTextImport = () => {
    if (!batchRawText.trim()) {
      setAsobiNotice('⚠️ テキストを入力してください。');
      return;
    }

    const lines = batchRawText.split('\n').filter((l) => l.trim().length > 0);
    const newItems: KenchikoAsobi[] = [];
    let count = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let title = '';
      let content = '';
      let condition = batchDefaultCondition;
      let frequency = batchDefaultFrequency;

      // Check delimiters: '|' or ':' or '：' or '\t' (TSV from Excel)
      if (line.includes('\t')) {
        const parts = line.split('\t').map((p) => p.trim());
        title = parts[0] || 'けんちこの行動';
        content = parts[1] || parts[0];
        if (parts[2]) {
          // parse condition
          const matchLoc = Object.values(LOCATIONS).find((l) => l.name === parts[2]);
          if (matchLoc) condition = `loc_${matchLoc.id}` as AsobiConditionScope;
        }
      } else if (line.includes('|')) {
        const parts = line.split('|').map((p) => p.trim());
        title = parts[0] || 'けんちこの行動';
        content = parts[1] || parts[0];
        if (parts[2]) {
          const matchLoc = Object.values(LOCATIONS).find((l) => l.name === parts[2]);
          if (matchLoc) condition = `loc_${matchLoc.id}` as AsobiConditionScope;
        }
      } else if (line.includes('：') || line.includes(':')) {
        const delim = line.includes('：') ? '：' : ':';
        const parts = line.split(delim).map((p) => p.trim());
        title = parts[0] || 'けんちこの行動';
        content = parts.slice(1).join(delim) || parts[0];
      } else {
        title = line;
        content = line;
      }

      // strip quotes if present
      content = content.replace(/^「|」$/g, '').replace(/^"|"$/g, '').trim();

      newItems.push({
        id: `asobi_${Date.now()}_${count}_${Math.random().toString(36).substr(2, 4)}`,
        title: title || 'けんちこの行動',
        content: content || 'るんるん♪',
        condition,
        frequency,
        createdAt: Date.now(),
      });
      count++;
    }

    if (newItems.length === 0) {
      setAsobiNotice('⚠️ 有効な行が見つかりませんでした。');
      return;
    }

    const updatedList = [...newItems, ...asobiList];
    setAsobiList(updatedList);
    setBatchRawText('');
    onUpdateSaveData((prev) => ({
      ...prev,
      asobiList: updatedList,
      lastSaved: Date.now(),
    }), true);
    setAsobiViewMode('sheet');
    setAsobiNotice(`🎉 ${newItems.length}件の遊びを一括登録しました！スプレッドシート表で即時確認・編集できます。`);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.5 } });
  };

  // Toggle selection for batch operations
  const handleToggleSelectAsobi = (id: string) => {
    setSelectedAsobiIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFilteredAsobi = () => {
    if (selectedAsobiIds.size >= filteredEvents.length && filteredEvents.length > 0) {
      setSelectedAsobiIds(new Set());
    } else {
      setSelectedAsobiIds(new Set(filteredEvents.map((e) => e.id)));
    }
  };

  const handleDeleteSelectedAsobi = () => {
    if (selectedAsobiIds.size === 0) return;
    openConfirm(
      '一括削除の確認',
      `選択中の ${selectedAsobiIds.size} 件のイベントを一括削除しますか？`,
      () => {
        const updatedList = asobiList.filter((item) => !selectedAsobiIds.has(item.id));
        setAsobiList(updatedList);
        setSelectedAsobiIds(new Set());
        onUpdateSaveData((prev) => ({
          ...prev,
          asobiList: updatedList,
          lastSaved: Date.now(),
        }), true);
        setAsobiNotice(`🗑️ 選択したイベントを一括削除しました。`);
      }
    );
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
    openConfirm(
      'にゃんこの削除',
      `本当に「No.${no} ${name}」を削除しますか？\n（Firebaseおよび図鑑から完全に削除されます）`,
      () => {
        onUpdateSaveData((prev) => {
          const updatedChars = prev.characters.filter((c) => c.no !== no);
          return {
            ...prev,
            characters: updatedChars,
            lastSaved: Date.now(),
          };
        });
        setDbNotice(`🗑️ No.${no} ${name} を削除しました。Firebaseを更新しました。`);
      }
    );
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
                placeholder="パスワードを入力"
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
          {/* TAB 0: Nyanko Zukan Master Editor (にゃんこ図鑑修正) */}
          <button
            onClick={() => setActiveTab('zukan')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'zukan'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#C8744E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#C8744E]" />
            <span>にゃんこ図鑑修正・画像設定 ({characters.length}体)</span>
          </button>

          {/* TAB 1: Kenchiko Avatar (けんちこ画像設定) */}
          <button
            onClick={() => setActiveTab('avatar')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'avatar'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#C8744E] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Camera className="w-4 h-4 text-[#C8744E]" />
            <span>けんちこ画像登録</span>
          </button>

          {/* TAB 2: Kihon Nyan Base Avatar (きほんのにゃんこ画像登録) */}
          <button
            onClick={() => setActiveTab('kihon_nyan')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t-2 border-x shrink-0 ${
              activeTab === 'kihon_nyan'
                ? 'bg-[#FAF8F5] text-[#3A342F] border-t-[#438363] border-x-[#DDD7C8] -mb-[1px]'
                : 'text-[#7D756D] hover:text-[#3A342F] border-transparent'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#438363]" />
            <span>きほんのにゃんこ画像登録</span>
          </button>

          {/* TAB 3: Events & Asobi Editor (全イベント編集) */}
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

          {/* TAB 4: Database CRUD */}
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

          {/* TAB 5: Google Doc Sync */}
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

          {/* TAB 6: Firebase Config */}
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

          {/* TAB 7: GitHub */}
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

          {/* TAB 8: CSV */}
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
          {/* TAB 0: NYANKO ZUKAN & CHARACTER MASTER EDITOR */}
          {/* ========================================================= */}
          {activeTab === 'zukan' && (
            <AdminZukanEditor
              characters={characters}
              saveData={saveData}
              onUpdateSaveData={onUpdateSaveData}
              openConfirm={openConfirm}
            />
          )}

          {/* ========================================================= */}
          {/* TAB 1: KENCHIKO AVATAR IMAGE SETTING */}
          {/* ========================================================= */}
          {activeTab === 'avatar' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#FAF2EB] p-4 rounded-2xl border border-[#F0D5C3]">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-black text-[#874A2E] flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[#C8744E]" />
                    けんちこのイラスト画像 完全差し替え
                  </h4>
                  <span className="bg-[#C8744E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    永続保存 & Firebase同期
                  </span>
                </div>
                <p className="text-xs text-[#9E5D3B]">
                  けんちこのイラストをアップロードして設定します。SVGは一切使われず、登録した画像がステージ・全画面に常時表示されます。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Left: Current Active Image Preview */}
                <div className="bg-[#FAF8F4] p-5 rounded-2xl border border-[#DDD7C8] flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-[#7D756D] mb-2">現在のけんちこ画像プレビュー</span>
                  <div
                    className="w-48 h-48 rounded-2xl border-2 border-[#2E2824] p-2 flex items-center justify-center overflow-hidden shadow-inner relative"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #E2DFD8 25%, transparent 25%), linear-gradient(-45deg, #E2DFD8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E2DFD8 75%), linear-gradient(-45deg, transparent 75%, #E2DFD8 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      backgroundColor: '#F7F5F0',
                    }}
                  >
                    {currentAvatarPreview ? (
                      <img
                        src={currentAvatarPreview}
                        alt="けんちこ"
                        className="max-w-full max-h-full object-contain filter drop-shadow-md"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full">
                        <KihonNyanCat size={140} />
                        <span className="text-[10px] text-[#487560] font-bold bg-[#EAF5EC] px-2 py-0.5 rounded-full mt-1">
                          きほんのにゃんこ（デフォルト）
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-[#9E958C] mt-1.5">
                    {currentAvatarPreview
                      ? '※ 市松模様の部分は透明（透過）になっています'
                      : '※ 画像未登録時は「きほんのにゃんこ」が自動表示されます'}
                  </span>

                  {/* Avatar reset button has been retired */}
                </div>

                {/* Right: Upload Dropzone & Transparency Controls */}
                <div className="md:col-span-2 space-y-3">
                  {/* Upload Box */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setAvatarDragActive(true);
                    }}
                    onDragLeave={() => setAvatarDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setAvatarDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleKenchikoAvatarUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`p-5 border-2 border-dashed rounded-2xl text-center transition flex flex-col items-center justify-center ${
                      avatarDragActive
                        ? 'border-[#C8744E] bg-[#FAF2EB]'
                        : 'border-[#DDD7C8] bg-white hover:border-[#C8744E]'
                    }`}
                  >
                    <Upload className="w-7 h-7 mx-auto text-[#C8744E] mb-1.5" />
                    <p className="text-xs font-bold text-[#3A342F]">
                      けんちこのイラスト画像をここにドラッグ＆ドロップ
                    </p>
                    <p className="text-[11px] text-[#7D756D] mt-0.5">
                      白背景の画像もプログラムが自動で自然に透明化します
                    </p>
                    <label className="mt-2.5 inline-block px-5 py-2 bg-[#C8744E] hover:bg-[#B3633E] text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-sm">
                      {isProcessingAvatar ? '処理中...' : '画像ファイルを選択'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={isProcessingAvatar}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleKenchikoAvatarUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Smart Transparency Settings Panel */}
                  <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#DDD7C8] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoTransparent}
                          onChange={(e) => setAutoTransparent(e.target.checked)}
                          className="w-4 h-4 text-[#C8744E] rounded border-[#DDD7C8] focus:ring-[#C8744E]"
                        />
                        <span className="text-xs font-bold text-[#3A342F] flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5 text-[#C8744E]" />
                          プログラムによる背景自動透過（白抜き）
                        </span>
                      </label>
                      <span className="text-[10px] bg-[#EFECE4] text-[#6B6259] px-2 py-0.5 rounded-full font-bold">
                        外側余白のみ安全抽出
                      </span>
                    </div>

                    {autoTransparent && (
                      <div className="space-y-2 pt-1 border-t border-[#EAE5D9]">
                        <div className="flex items-center justify-between text-xs text-[#5A524A]">
                          <span className="font-bold">透過の強さ（色の許容しきい値）: {transparencyTolerance}</span>
                          <span className="text-[10px] text-[#9E958C]">標準: 30 (20〜45推奨)</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="65"
                          step="1"
                          value={transparencyTolerance}
                          onChange={(e) => setTransparencyTolerance(Number(e.target.value))}
                          className="w-full h-1.5 bg-[#DDD7C8] rounded-lg appearance-none cursor-pointer accent-[#C8744E]"
                        />

                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-1.5 text-xs text-[#5A524A] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={trimPadding}
                              onChange={(e) => setTrimPadding(e.target.checked)}
                              className="w-3.5 h-3.5 text-[#C8744E] rounded border-[#DDD7C8]"
                            />
                            <span>余白の自動トリミング（綺麗に中央配置）</span>
                          </label>

                          {rawAvatarSource && (
                            <button
                              type="button"
                              onClick={handleReprocessWithSettings}
                              disabled={isProcessingAvatar}
                              className="flex items-center gap-1 px-3 py-1 bg-[#2E2824] hover:bg-[#453D37] text-white text-xs font-bold rounded-lg transition shadow-xs disabled:opacity-50"
                            >
                              <Sparkles className="w-3 h-3 text-[#E8C28A]" />
                              設定を再適用
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {avatarStatus && (
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F] animate-fadeIn">
                      {avatarStatus}
                    </div>
                  )}

                  <div className="p-3 bg-[#FAF8F4] rounded-xl border border-[#DDD7C8] text-[11px] text-[#6B6259] leading-relaxed">
                    💡 <strong>スマート透過の特長:</strong> 外側（背景）から繋がっている白やクリーム色の余白のみを自動認識して抜くため、けんちこの白いTシャツやメガネ・目の白い反射は消えずにそのまま残ります。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 0.5: KIHON NYAN (きほんのにゃんこ) IMAGE & SMART TRANSPARENCY */}
          {/* ========================================================= */}
          {activeTab === 'kihon_nyan' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Header Box */}
              <div className="bg-[#EEF5F1] p-4 rounded-2xl border border-[#D0E2D8] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-black text-[#2D5A43] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#438363]" />
                      きほんのにゃんこ公式原画の背景透過＆画像登録
                    </h4>
                    <span className="bg-[#438363] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      余白自動トリミング対応
                    </span>
                    <span className="bg-[#3A342F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Firebase同期
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4F6C5D] leading-relaxed">
                    ユーザー様の手描き原画から<strong>余分な外枠・背景を自動で綺麗に透過＆トリミング</strong>。
                    登録された透過原画は、お部屋ステージ・図鑑・全にゃんこ（◯◯にゃん）の公式ベースとして即座に美しく反映されます。
                  </p>
                </div>
              </div>

              {/* Main Content Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#FAF8F5] p-5 rounded-2xl border border-[#DDD7C8]">
                {/* Left: Current Preview on Transparency Checkerboard */}
                <div className="flex flex-col items-center justify-center p-4 bg-[#F2EFE9] rounded-2xl border border-[#DDD7C8]">
                  <p className="text-xs font-bold text-[#5A524A] mb-3 text-center">
                    {currentKihonNyanPreview
                      ? '✨ 透過処理済みきほんのにゃんこ'
                      : '手描き原画（未透過・初期状態）'}
                  </p>

                  <div
                    className="w-48 h-48 rounded-2xl border-2 border-dashed border-[#C4BCAB] overflow-hidden flex items-center justify-center relative shadow-inner p-2"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #e5e0d8 25%, transparent 25%), linear-gradient(-45deg, #e5e0d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e0d8 75%), linear-gradient(-45deg, transparent 75%, #e5e0d8 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      backgroundColor: '#FAF8F5',
                    }}
                  >
                    <img
                      src={currentKihonNyanPreview || '/images/base-nyanko-square.jpg'}
                      alt="きほんのにゃんこプレビュー"
                      className="max-w-full max-h-full object-contain filter drop-shadow-md select-none"
                    />
                  </div>

                  <p className="text-[10px] text-[#7D756D] mt-2 text-center leading-tight">
                    ※ 市松模様は透明（透過）部分です。<br />余分な外枠がカットされ、自然に表示されます。
                  </p>

                  {/* Reset button if custom preview exists */}
                  {currentKihonNyanPreview && (
                    <button
                      onClick={handleResetKihonNyan}
                      className="mt-3 px-3 py-1 bg-white hover:bg-[#FBEBEB] text-[#A63D2F] border border-[#E8C2BD] text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      初期の手描き原画（未透過）に戻す
                    </button>
                  )}
                </div>

                {/* Right: Actions and Sliders */}
                <div className="md:col-span-2 space-y-4">
                  {/* Action 1: One-click process existing official hand-drawn image */}
                  <div className="p-4 bg-[#F2F7F4] rounded-2xl border border-[#CDE3D6] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚀</span>
                        <h5 className="text-xs font-black text-[#2D5A43]">
                          既存の公式手描き原画をワンクリックで透過＆トリミング
                        </h5>
                      </div>
                      <span className="text-[10px] font-bold text-[#438363] bg-white px-2 py-0.5 rounded-full border border-[#CDE3D6]">
                        おすすめ
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4F6C5D] leading-relaxed">
                      アプリ内に組み込まれている公式原画（/images/base-nyanko-square.jpg）から、<strong>広い外枠の余白をカットし、紙の地色を自動透過</strong>してステージに馴染むキャラクター姿に仕上げます。
                    </p>
                    <button
                      onClick={handleProcessDefaultBaseImage}
                      disabled={isProcessingKihonNyan}
                      className="w-full py-2.5 px-4 bg-[#438363] hover:bg-[#346B50] text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessingKihonNyan ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>透過・トリミング処理中...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>【今すぐ公式手描き原画を透過処理する】</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Action 2: Or Upload New Custom Image File */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#4A443F]">
                      または別の原画・写真をアップロード
                    </label>
                    <div
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setKihonNyanDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setKihonNyanDragActive(false);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        setKihonNyanDragActive(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleKihonNyanUpload(e.dataTransfer.files[0]);
                        }
                      }}
                      className={`relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5 ${
                        kihonNyanDragActive
                          ? 'border-[#438363] bg-[#EAF3EE]'
                          : 'border-[#C4BCAB] bg-white hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleKihonNyanUpload(e.target.files[0]);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="w-5 h-5 text-[#728C7E]" />
                      <p className="text-xs font-bold text-[#3A342F]">
                        ここに新しい原画・イラスト画像をドラッグ＆ドロップ
                      </p>
                      <p className="text-[10px] text-[#7D756D]">
                        またはクリックして画像を選択（JPG / PNG / WebP）
                      </p>
                    </div>
                  </div>

                  {/* Smart Transparency Settings */}
                  <div className="p-3.5 bg-white rounded-xl border border-[#DDD7C8] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={kihonNyanAutoTransparent}
                          onChange={(e) => setKihonNyanAutoTransparent(e.target.checked)}
                          className="w-4 h-4 rounded text-[#438363] focus:ring-[#438363] accent-[#438363]"
                        />
                        <span className="text-xs font-bold text-[#3A342F]">
                          プログラムによる背景自動透過（白抜き）
                        </span>
                      </label>
                      <span className="text-[10px] text-[#7D756D] font-mono">
                        Flood-Fill BFS
                      </span>
                    </div>

                    {kihonNyanAutoTransparent && (
                      <div className="space-y-3 pt-1 border-t border-[#F0EBE1]">
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-[#5A524A] mb-1">
                            <span>透過の強さ（色の許容しきい値）</span>
                            <span className="font-mono text-[#438363] bg-[#EEF5F1] px-2 py-0.5 rounded">
                              {kihonNyanTolerance}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="65"
                            value={kihonNyanTolerance}
                            onChange={(e) => setKihonNyanTolerance(Number(e.target.value))}
                            className="w-full h-1.5 bg-[#E2DDCF] rounded-lg appearance-none cursor-pointer accent-[#438363]"
                          />
                          <div className="flex justify-between text-[9px] text-[#8C847A] mt-0.5">
                            <span>控えめ（線画保持）</span>
                            <span>標準（30）</span>
                            <span>強力（広域透過）</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={kihonNyanTrimPadding}
                              onChange={(e) => setKihonNyanTrimPadding(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-[#438363] focus:ring-[#438363] accent-[#438363]"
                            />
                            <span className="text-[11px] font-bold text-[#5A524A]">
                              余白の自動トリミング（余分な枠をカットして中央配置）
                            </span>
                          </label>

                          <button
                            onClick={handleKihonNyanReprocess}
                            disabled={isProcessingKihonNyan}
                            className="px-3 py-1 bg-[#3A342F] hover:bg-black text-white text-[11px] font-bold rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
                          >
                            設定を再適用
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Banner */}
                  {kihonNyanStatus && (
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F] animate-fadeIn">
                      {kihonNyanStatus}
                    </div>
                  )}

                  <div className="p-3 bg-[#FAF8F4] rounded-xl border border-[#DDD7C8] text-[11px] text-[#6B6259] leading-relaxed">
                    💡 <strong>スマート透過の特長:</strong> 原画の外側の余白紙（白〜クリーム色）のみを外周から認識して自動消去し、余分な四角い枠線をトリミングします。にゃんこ本体の手描き鉛筆の線画やジト目、愛嬌のある二足立ち姿は美しくそのまま残ります。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: ALL EVENTS & ASOBI CONFIGURATION (全イベント・あそび編集) */}
          {/* ========================================================= */}
          {activeTab === 'asobi' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Header & Mode Switcher */}
              <div className="bg-[#FAF2EB] p-4 rounded-2xl border border-[#F0D5C3] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-black text-[#874A2E] flex items-center gap-1.5">
                      <Smile className="w-4 h-4 text-[#C8744E]" />
                      全イベント・行動・セリフ設定コンソール
                    </h4>
                    <span className="bg-[#C8744E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Firestore即時同期
                    </span>
                  </div>
                  <p className="text-xs text-[#874A2E] leading-relaxed">
                    けんちこの行動・セリフ・場所を<strong>スプレッドシート形式</strong>で表から直接編集・追加・複製できます。
                  </p>
                </div>

                {/* View Mode Tabs */}
                <div className="flex items-center bg-[#EFECE4] p-1 rounded-xl border border-[#DDD7C8] shrink-0 self-start md:self-center">
                  <button
                    onClick={() => setAsobiViewMode('sheet')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      asobiViewMode === 'sheet'
                        ? 'bg-[#2E2824] text-white shadow-xs'
                        : 'text-[#6B6259] hover:text-[#2E2824]'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>スプレッドシート表</span>
                  </button>

                  <button
                    onClick={() => setAsobiViewMode('batch')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      asobiViewMode === 'batch'
                        ? 'bg-[#2E2824] text-white shadow-xs'
                        : 'text-[#6B6259] hover:text-[#2E2824]'
                    }`}
                  >
                    <ListPlus className="w-3.5 h-3.5 text-[#E8C28A]" />
                    <span>テキスト一括追加</span>
                  </button>

                  <button
                    onClick={() => setAsobiViewMode('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      asobiViewMode === 'cards'
                        ? 'bg-[#2E2824] text-white shadow-xs'
                        : 'text-[#6B6259] hover:text-[#2E2824]'
                    }`}
                  >
                    <Files className="w-3.5 h-3.5" />
                    <span>カード詳細一覧</span>
                  </button>
                </div>
              </div>

              {/* Mode: TEXT BATCH BULK IMPORT */}
              {asobiViewMode === 'batch' && (
                <div className="bg-[#FAF8F5] p-5 rounded-2xl border-2 border-[#C8744E] space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#DDD7C8] pb-2">
                    <span className="text-xs font-black text-[#874A2E] flex items-center gap-1.5">
                      <ListPlus className="w-4 h-4 text-[#C8744E]" />
                      テキスト・メモの一括まとめて登録モード
                    </span>
                    <button
                      onClick={() => setAsobiViewMode('sheet')}
                      className="text-xs text-[#7D756D] hover:text-[#2E2824] font-bold"
                    >
                      スプレッドシートへ戻る
                    </button>
                  </div>

                  <p className="text-xs text-[#6B6259] leading-relaxed">
                    メモ帳やExcelから<strong>1行に1つずつ</strong>貼り付けるだけで、一気に10〜30件登録できます。<br />
                    区切り文字（<code>|</code> または <code>:</code> または <code>タブ</code>）を使って「行動タイトル | セリフ」の形式で入力できます。
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-[#DDD7C8]">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                        共通の発生場所（未指定行に適用）
                      </label>
                      <select
                        value={batchDefaultCondition}
                        onChange={(e) => setBatchDefaultCondition(e.target.value as AsobiConditionScope)}
                        className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DDD7C8] rounded-lg text-xs text-[#3A342F]"
                      >
                        <option value="all">すべて（どこでも）</option>
                        <option value="all_locations">すべての場所（滞在中）</option>
                        <option value="all_transports">すべての移動手段（移動中）</option>
                        {Object.values(LOCATIONS).map((l) => (
                          <option key={l.id} value={`loc_${l.id}`}>
                            場所: {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#6B6259] mb-1">
                        共通の出現頻度
                      </label>
                      <select
                        value={batchDefaultFrequency}
                        onChange={(e) => setBatchDefaultFrequency(e.target.value as AsobiFrequency)}
                        className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#DDD7C8] rounded-lg text-xs text-[#3A342F]"
                      >
                        <option value="normal">通常</option>
                        <option value="high">高頻度（出やすい）</option>
                        <option value="rare">レア</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B6259] mb-1 flex items-center justify-between">
                      <span>テキスト貼り付けエリア (1行 = 1つのあそび)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBatchRawText(
                            `縁側で日向ぼっこ | ぽかぽかして気持ちいいなぁ…\n冷たい麦茶を飲む | ごくごく…ぷはーっ！\nお気に入りの本を読む | このページすごくワクワクする！\n鼻歌を口ずさむ | フンフンフ〜ン♪ 素敵な日〜\n猫じゃらしを振る | にゃんこ寄ってくるかな？`
                          );
                        }}
                        className="text-[11px] text-[#C8744E] hover:underline font-bold"
                      >
                        📋 サンプルを入力
                      </button>
                    </label>
                    <textarea
                      rows={8}
                      placeholder={`例:\n縁側で日向ぼっこ | ぽかぽかして気持ちいいなぁ…\n冷たい麦茶を飲む | ごくごく…ぷはーっ！\nお散歩に出かける | いい風が吹いてるね`}
                      value={batchRawText}
                      onChange={(e) => setBatchRawText(e.target.value)}
                      className="w-full p-3 bg-white border border-[#DDD7C8] rounded-xl text-xs font-mono text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setBatchRawText('')}
                      className="px-3 py-1.5 text-xs text-[#7D756D] hover:text-[#2E2824]"
                    >
                      クリア
                    </button>
                    <button
                      onClick={handleExecuteBatchTextImport}
                      className="flex items-center gap-1.5 bg-[#C8744E] hover:bg-[#B3633E] text-white text-xs font-bold px-5 py-2 rounded-xl shadow-sm transition"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>上記の内容を一括登録する</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Input Bar with Chips & Live Speech Bubble Preview */}
              <div id="asobi-form-anchor" className="bg-[#F7F4EC] p-4 rounded-2xl border border-[#DDD7C8] space-y-3">
                <div className="flex items-center justify-between border-b border-[#DDD7C8] pb-2">
                  <span className="text-xs font-black text-[#3A342F] flex items-center gap-1.5">
                    {editingAsobiId ? <Edit3 className="w-4 h-4 text-[#C8744E]" /> : <PlusCircle className="w-4 h-4 text-[#728C7E]" />}
                    {editingAsobiId ? '選択中のイベントを編集' : 'クイック追加フォーム（ワンタップ選択＆吹き出し確認）'}
                  </span>
                  <div className="flex items-center gap-2">
                    {editingAsobiId && (
                      <button
                        onClick={handleCancelAsobiEdit}
                        className="text-[11px] text-[#7D756D] hover:text-[#3A342F] underline"
                      >
                        編集をキャンセル
                      </button>
                    )}
                  </div>
                </div>

                {/* Location Quick Select Chips */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#7D756D]">発生場所のクイック選択チップ:</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setNewCondition('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                        newCondition === 'all'
                          ? 'bg-[#2E2824] text-white shadow-xs'
                          : 'bg-white border border-[#DDD7C8] text-[#6B6259] hover:bg-[#FAF2EB]'
                      }`}
                    >
                      🌟 常時（どこでも）
                    </button>
                    {Object.values(LOCATIONS).map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setNewCondition(`loc_${loc.id}` as AsobiConditionScope)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                          newCondition === `loc_${loc.id}`
                            ? 'bg-[#C8744E] text-white shadow-xs'
                            : 'bg-white border border-[#DDD7C8] text-[#6B6259] hover:bg-[#FAF2EB]'
                        }`}
                      >
                        {loc.name}
                      </button>
                    ))}
                    {TRANSPORT_METHODS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewCondition(`trans_${t.id}` as AsobiConditionScope)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                          newCondition === `trans_${t.id}`
                            ? 'bg-[#728C7E] text-white shadow-xs'
                            : 'bg-white border border-[#DDD7C8] text-[#6B6259] hover:bg-[#FAF2EB]'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inputs & Live Speech Bubble Preview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                  <div className="md:col-span-2 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B6259] mb-0.5">
                          行動タイトル
                        </label>
                        <input
                          type="text"
                          placeholder="例: けんちこは鼻歌をうたった"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#6B6259] mb-0.5">
                          出現頻度
                        </label>
                        <select
                          value={newFrequency}
                          onChange={(e) => setNewFrequency(e.target.value as AsobiFrequency)}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F]"
                        >
                          <option value="normal">通常（標準的な頻度）</option>
                          <option value="high">高頻度（とてもよく出る）</option>
                          <option value="rare">レア（特別な行動）</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#6B6259] mb-0.5">
                        けんちこのセリフ・つぶやき
                      </label>
                      <input
                        type="text"
                        placeholder="例: ルンルン気分〜♪ 今日もいい天気！"
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                  </div>

                  {/* Speech Bubble Live Preview Card */}
                  <div className="bg-white p-3 rounded-2xl border border-[#DDD7C8] flex flex-col justify-center shadow-xs">
                    <span className="text-[10px] font-bold text-[#7D756D] mb-1">💬 リアルタイム吹き出し見本</span>
                    <div className="bg-[#FAF8F5] p-2.5 rounded-xl border border-[#EAE5D9] relative">
                      <span className="text-[10px] font-bold text-[#C8744E] block">
                        {newTitle.trim() || 'けんちこの行動'}
                      </span>
                      <p className="text-xs text-[#2E2824] font-serif italic mt-0.5">
                        「{newContent.trim() || 'るんるん…♪'}」
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#9E958C]">
                        <span>{getConditionLabel(newCondition)}</span>
                        <span>{getFrequencyLabel(newFrequency)}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleAddOrUpdateAsobi}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 bg-[#C8744E] hover:bg-[#B3623D] text-white font-bold text-xs py-2 rounded-xl shadow-xs transition"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingAsobiId ? '更新して保存' : '行を追加して保存'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {asobiNotice && (
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3A342F] animate-fadeIn flex items-center justify-between">
                  <span>{asobiNotice}</span>
                  <button onClick={() => setAsobiNotice(null)} className="text-[#7D756D] hover:text-[#2E2824] text-xs">
                    ✕
                  </button>
                </div>
              )}

              {/* Search, Filter & Bulk Action Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between bg-white p-3 rounded-2xl border border-[#DDD7C8]">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-[#7D756D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="表のタイトルやセリフを検索..."
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

                  <button
                    onClick={handleAddBlankSpreadsheetRow}
                    className="flex items-center gap-1 bg-[#2E2824] hover:bg-[#453D37] text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-xs shrink-0"
                    title="表の先頭に空行を挿入"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">空行追加</span>
                  </button>
                </div>
              </div>

              {/* Bulk Selected Actions Bar */}
              {selectedAsobiIds.size > 0 && (
                <div className="bg-[#FAF2EB] px-4 py-2.5 rounded-2xl border border-[#F0D5C3] flex items-center justify-between animate-fadeIn">
                  <span className="text-xs font-bold text-[#874A2E]">
                    {selectedAsobiIds.size} 件を選択中
                  </span>
                  <button
                    onClick={handleDeleteSelectedAsobi}
                    className="flex items-center gap-1 bg-[#D05A3F] hover:bg-[#B3452C] text-white text-xs font-bold px-3 py-1 rounded-lg transition shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>選択した行を一括削除</span>
                  </button>
                </div>
              )}

              {/* ========================================================= */}
              {/* SPREADSHEET TABLE VIEW (インライン直接編集) */}
              {/* ========================================================= */}
              {asobiViewMode === 'sheet' && (
                <div className="bg-white rounded-2xl border border-[#DDD7C8] overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#F7F4EC] text-[#6B6259] font-bold sticky top-0 z-10 border-b border-[#DDD7C8]">
                        <tr>
                          <th className="p-2.5 w-10 text-center">
                            <button
                              onClick={handleSelectAllFilteredAsobi}
                              className="text-[#6B6259] hover:text-[#2E2824]"
                              title="すべて選択/解除"
                            >
                              {selectedAsobiIds.size >= filteredEvents.length && filteredEvents.length > 0 ? (
                                <CheckSquare className="w-4 h-4 text-[#C8744E]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </th>
                          <th className="p-2.5 min-w-[180px]">行動タイトル (クリックして編集)</th>
                          <th className="p-2.5 min-w-[260px]">セリフ・つぶやき (クリックして編集)</th>
                          <th className="p-2.5 min-w-[130px]">発生場所・条件</th>
                          <th className="p-2.5 min-w-[100px]">出現頻度</th>
                          <th className="p-2.5 w-24 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAE5D9]">
                        {filteredEvents.map((item, idx) => (
                          <tr
                            key={item.id}
                            className={`hover:bg-[#FAF8F5] transition ${
                              selectedAsobiIds.has(item.id) ? 'bg-[#FAF2EB]' : idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF9F6]'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => handleToggleSelectAsobi(item.id)}
                                className="text-[#9E958C] hover:text-[#C8744E]"
                              >
                                {selectedAsobiIds.has(item.id) ? (
                                  <CheckSquare className="w-4 h-4 text-[#C8744E]" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Title Cell */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => handleInlineUpdateAsobi(item.id, 'title', e.target.value)}
                                className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-[#DDD7C8] focus:border-[#C8744E] rounded-md text-xs font-bold text-[#3A342F] focus:outline-none transition"
                              />
                            </td>

                            {/* Content / Dialogue Cell */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.content}
                                onChange={(e) => handleInlineUpdateAsobi(item.id, 'content', e.target.value)}
                                className="w-full px-2 py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-[#DDD7C8] focus:border-[#C8744E] rounded-md text-xs text-[#5A524A] font-serif focus:outline-none transition"
                              />
                            </td>

                            {/* Condition Dropdown */}
                            <td className="p-2">
                              <select
                                value={item.condition}
                                onChange={(e) => handleInlineUpdateAsobi(item.id, 'condition', e.target.value as AsobiConditionScope)}
                                className="w-full px-2 py-1 bg-white border border-[#DDD7C8] rounded-md text-[11px] text-[#3A342F] font-bold focus:outline-none focus:border-[#C8744E]"
                              >
                                <option value="all">🌟 すべて（常時）</option>
                                <option value="all_locations">すべての場所</option>
                                <option value="all_transports">すべての移動</option>
                                {Object.values(LOCATIONS).map((loc) => (
                                  <option key={loc.id} value={`loc_${loc.id}`}>
                                    {loc.name}
                                  </option>
                                ))}
                                {TRANSPORT_METHODS.map((t) => (
                                  <option key={t.id} value={`trans_${t.id}`}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Frequency Dropdown */}
                            <td className="p-2">
                              <select
                                value={item.frequency}
                                onChange={(e) => handleInlineUpdateAsobi(item.id, 'frequency', e.target.value as AsobiFrequency)}
                                className="w-full px-2 py-1 bg-white border border-[#DDD7C8] rounded-md text-[11px] text-[#3A342F] font-bold focus:outline-none focus:border-[#C8744E]"
                              >
                                <option value="normal">通常</option>
                                <option value="high">高頻度</option>
                                <option value="rare">レア</option>
                              </select>
                            </td>

                            {/* Action Buttons */}
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleDuplicateAsobi(item)}
                                  className="p-1 text-[#7D756D] hover:text-[#C8744E] hover:bg-[#FAF2EB] rounded-md transition"
                                  title="この行を複製（コピー）"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAsobi(item.id, item.title)}
                                  className="p-1 text-[#D05A3F] hover:bg-[#FAF0ED] rounded-md transition"
                                  title="削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div className="bg-[#FAF8F5] p-3 border-t border-[#DDD7C8] flex items-center justify-between text-xs text-[#7D756D]">
                    <span>表示中: {filteredEvents.length} 件 / 全 {asobiList.length} 件</span>
                    <button
                      onClick={handleAddBlankSpreadsheetRow}
                      className="flex items-center gap-1 text-[#C8744E] hover:underline font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      一番下に新しい行を追加
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* CARD DETAILED VIEW (カード形式) */}
              {/* ========================================================= */}
              {asobiViewMode === 'cards' && (
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
                          onClick={() => handleDuplicateAsobi(item)}
                          className="p-1.5 bg-[#FAF2EB] hover:bg-[#F3E3D6] text-[#C8744E] rounded-lg transition"
                          title="複製して追加"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
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
              )}
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

              {/* Guide Card for Image Column & Base+Decoration Fallback */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#DDD7C8] space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <h5 className="text-xs font-bold text-[#3A342F]">
                    スプレッドシートの画像連携 ＆「きほんのにゃんこ」自動装飾について
                  </h5>
                </div>
                <div className="space-y-2 text-[11px] text-[#5C554E] leading-relaxed">
                  <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-[#DDD7C8]">
                    <span className="font-bold text-[#728C7E] shrink-0">① 右端の画像列:</span>
                    <span>
                      スプレッドシートの右端列に<strong>Googleドライブの画像共有リンク</strong>（例: <code>https://drive.google.com/file/d/◯◯/view</code>）を貼ると、アプリが自動でWeb表示用URLに変換して各にゃんこの画像として読み込みます。
                    </span>
                  </div>
                  <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-[#DDD7C8]">
                    <span className="font-bold text-[#728C7E] shrink-0">② 画像未登録の自動装飾:</span>
                    <span>
                      まだ画像URLのないにゃんこは、公式の<strong>「きほんのにゃんこ」の手描き原画</strong>をベースに、モチーフ（たいやき、おでん、ピノ、みかん、メガネ、マフラー等）に合わせた可愛い小物が自動でトッピングされて表示されます。
                    </span>
                  </div>
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

      {/* Custom App-side Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
