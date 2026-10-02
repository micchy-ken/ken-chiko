/**
 * AdminOuenEditor: Management console for Kenchiko's cheering messages and categories.
 * Exclusively uses Synology NAS PostgreSQL (api.master_ouen_items, api.master_ouen_categories).
 * Directly saves line-by-line in real time without Firebase quota limits.
 */
import React, { useState, useMemo, useRef } from 'react';
import { OuenCategory, OuenItem, GameSaveData } from '../types';
import { INITIAL_OUEN_CATEGORIES, INITIAL_OUEN_LIST, mergeOuenCategories, mergeOuenList } from '../data/defaultOuen';
import {
  saveSingleMasterOuenItemToPostgrest,
  deleteSingleMasterOuenItemFromPostgrest,
  saveSingleMasterOuenCategoryToPostgrest,
  deleteSingleMasterOuenCategoryFromPostgrest,
  saveGlobalOuenList,
  fetchGlobalOuenList,
} from '../services/cloudSync';
import {
  Heart,
  Plus,
  Edit3,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  X,
  MessageCircleHeart,
  Layers,
  CloudDownload,
  Table,
  Files,
  Copy,
  Check,
  Database,
} from 'lucide-react';
import confetti from '../utils/confetti';

interface AdminOuenEditorProps {
  saveData: GameSaveData;
  onUpdateSaveData: (updater: (prev: GameSaveData) => GameSaveData, isImmediate?: boolean) => void;
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export const AdminOuenEditor: React.FC<AdminOuenEditorProps> = ({
  saveData,
  onUpdateSaveData,
  openConfirm,
}) => {
  const currentCategories: OuenCategory[] = useMemo(() => {
    return mergeOuenCategories(saveData.ouenCategories);
  }, [saveData.ouenCategories]);

  const currentList: OuenItem[] = useMemo(() => {
    return mergeOuenList(saveData.ouenList);
  }, [saveData.ouenList]);

  // View Mode: 'cards' or 'sheet'
  const [viewMode, setViewMode] = useState<'cards' | 'sheet'>('sheet');

  // Filter & Search
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing / Creating State
  const [editingItem, setEditingItem] = useState<OuenItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState<string>('tired');
  const [formMessage, setFormMessage] = useState<string>('');

  // Category Management State
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState('');

  // Direct DB Save Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [recentlySavedIds, setRecentlySavedIds] = useState<Set<string>>(new Set());
  const ouenDebounceTimersRef = useRef<Record<string, any>>({});

  // Filtered List
  const filteredList = useMemo(() => {
    return currentList.filter((item) => {
      if (selectedCategoryFilter !== 'all' && item.categoryId !== selectedCategoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const cat = currentCategories.find((c) => c.id === item.categoryId);
        const catLabel = cat ? cat.label.toLowerCase() : '';
        return item.message.toLowerCase().includes(query) || catLabel.includes(query);
      }
      return true;
    });
  }, [currentList, selectedCategoryFilter, searchQuery, currentCategories]);

  const markItemRecentlySaved = (id: string) => {
    setRecentlySavedIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setRecentlySavedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormCategoryId(selectedCategoryFilter !== 'all' ? selectedCategoryFilter : currentCategories[0]?.id || 'tired');
    setFormMessage('');
    setIsAddingNew(true);
  };

  const handleOpenEdit = (item: OuenItem) => {
    setEditingItem(item);
    setFormCategoryId(item.categoryId);
    setFormMessage(item.message);
    setIsAddingNew(true);
  };

  // Direct 1-row save for modal
  const handleSaveItem = async () => {
    if (!formMessage.trim()) {
      setSaveStatus({ type: 'error', message: '応援メッセージを入力してください' });
      return;
    }

    const trimmedMsg = formMessage.trim();
    let updatedList: OuenItem[];
    let targetItem: OuenItem;

    if (editingItem) {
      targetItem = {
        ...editingItem,
        categoryId: formCategoryId,
        message: trimmedMsg,
        updatedAt: Date.now(),
      };
      updatedList = currentList.map((item) =>
        item.id === editingItem.id ? targetItem : item
      );
    } else {
      targetItem = {
        id: `ouen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        categoryId: formCategoryId,
        message: trimmedMsg,
        createdAt: Date.now(),
      };
      updatedList = [targetItem, ...currentList];
    }

    onUpdateSaveData((prev) => ({
      ...prev,
      ouenList: updatedList,
      ouenCategories: currentCategories,
      lastSaved: Date.now(),
    }));

    // Directly save single row to Synology PostgreSQL (api.master_ouen_items)
    const targetIdx = updatedList.findIndex((i) => i.id === targetItem.id);
    const postgrestRes = await saveSingleMasterOuenItemToPostgrest(
      targetItem,
      targetIdx >= 0 ? targetIdx + 1 : 1
    );

    setIsAddingNew(false);
    setEditingItem(null);
    setFormMessage('');

    if (postgrestRes.success) {
      markItemRecentlySaved(targetItem.id);
      setSaveStatus({
        type: 'success',
        message: `✅ 応援メッセージをSynology DB（master_ouen_items）に直接1行保存しました！`,
      });
    } else {
      setSaveStatus({
        type: 'error',
        message: `DB保存注意: ${postgrestRes.error || '一時的なエラー（ローカル保存完了）'}`,
      });
    }

    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } catch {}
  };

  // Quick Duplicate Row (Direct DB Save)
  const handleDuplicateItem = async (item: OuenItem) => {
    const newItem: OuenItem = {
      id: `ouen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      categoryId: item.categoryId,
      message: `${item.message}（コピー）`,
      createdAt: Date.now(),
    };
    const updatedList = [newItem, ...currentList];
    onUpdateSaveData((prev) => ({
      ...prev,
      ouenList: updatedList,
      lastSaved: Date.now(),
    }));

    const res = await saveSingleMasterOuenItemToPostgrest(newItem, 1);
    if (res.success) {
      markItemRecentlySaved(newItem.id);
      setSaveStatus({
        type: 'success',
        message: `📋 「${item.message.slice(0, 15)}...」を複製し、Synology DBへ直接保存しました！`,
      });
    }
  };

  // Add a blank row directly in spreadsheet table
  const handleAddBlankRow = async () => {
    const defaultCat = selectedCategoryFilter !== 'all' ? selectedCategoryFilter : (currentCategories[0]?.id || 'tired');
    const newItem: OuenItem = {
      id: `ouen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      categoryId: defaultCat,
      message: 'けんちこからの新しい応援メッセージを入力してください',
      createdAt: Date.now(),
    };
    const updatedList = [newItem, ...currentList];
    onUpdateSaveData((prev) => ({
      ...prev,
      ouenList: updatedList,
      lastSaved: Date.now(),
    }));

    const res = await saveSingleMasterOuenItemToPostgrest(newItem, 1);
    if (res.success) {
      markItemRecentlySaved(newItem.id);
      setSaveStatus({
        type: 'success',
        message: '➕ 新しい行を追加し、Synology DBに直接保存しました！表のセルで編集できます。',
      });
    }
  };

  // Direct inline cell update for spreadsheet table
  const handleInlineUpdateItem = (id: string, field: keyof OuenItem, value: any) => {
    const updatedList = currentList.map((item) =>
      item.id === id
        ? {
            ...item,
            [field]: value,
            updatedAt: Date.now(),
          }
        : item
    );
    onUpdateSaveData((prev) => ({
      ...prev,
      ouenList: updatedList,
      lastSaved: Date.now(),
    }));

    // Debounced direct DB save per row
    if (ouenDebounceTimersRef.current[id]) {
      clearTimeout(ouenDebounceTimersRef.current[id]);
    }
    ouenDebounceTimersRef.current[id] = setTimeout(() => {
      handleInlineSaveRow(id);
    }, 700);
  };

  // Direct single row save on blur or click
  const handleInlineSaveRow = async (id: string) => {
    const targetIdx = currentList.findIndex((i) => i.id === id);
    if (targetIdx < 0) return;
    const item = currentList[targetIdx];
    const res = await saveSingleMasterOuenItemToPostgrest(item, targetIdx + 1);
    if (res.success) {
      markItemRecentlySaved(id);
      setSaveStatus({
        type: 'success',
        message: `✅ 応援メッセージ「${item.message.slice(0, 16)}...」をDBへ直接保存しました！`,
      });
      setSaveStatus({
        type: 'error',
        message: `DB直接保存エラー: ${res.error || '保存に失敗しました'}`,
      });
    }
  };

  const handleDeleteItem = (item: OuenItem) => {
    openConfirm(
      '応援メッセージの削除',
      `「${item.message}」を削除してもよろしいですか？\n（Synology DBから直接1行削除されます）`,
      async () => {
        const updatedList = currentList.filter((i) => i.id !== item.id);
        onUpdateSaveData((prev) => ({
          ...prev,
          ouenList: updatedList,
          lastSaved: Date.now(),
        }));
        // Directly delete single row from Synology PostgreSQL
        const res = await deleteSingleMasterOuenItemFromPostgrest(item.id);
        if (res.success) {
          setSaveStatus({
            type: 'success',
            message: `🗑️ 応援メッセージをDBから直接削除しました（残り ${updatedList.length} 件）`,
          });
        } else {
          setSaveStatus({
            type: 'error',
            message: `DB削除エラー: ${res.error || '削除できませんでした'}`,
          });
        }
      }
    );
  };

  const handleAddCategory = async () => {
    if (!newCategoryLabel.trim()) return;
    const label = newCategoryLabel.trim();
    const id = `cat_${Date.now()}`;
    const newCategory: OuenCategory = { id, label };
    const updatedCategories = [...currentCategories, newCategory];

    onUpdateSaveData((prev) => ({
      ...prev,
      ouenCategories: updatedCategories,
      lastSaved: Date.now(),
    }));

    // Directly save single row to Synology PostgreSQL (api.master_ouen_categories)
    const res = await saveSingleMasterOuenCategoryToPostgrest(newCategory, updatedCategories.length);
    if (res.success) {
      setSaveStatus({
        type: 'success',
        message: `✅ カテゴリー「${label}」をDBに直接保存しました！`,
      });
    } else {
      setSaveStatus({
        type: 'error',
        message: `DB保存注意: ${res.error || '一時的なエラー'}`,
      });
    }
    setNewCategoryLabel('');
  };

  const handleDeleteCategory = (cat: OuenCategory) => {
    if (currentCategories.length <= 1) {
      setSaveStatus({ type: 'error', message: 'カテゴリーは最低1つ必要です' });
      return;
    }
    openConfirm(
      'カテゴリーの削除',
      `カテゴリー「${cat.label}」を削除しますか？\n（Synology DBから直接1行削除されます）`,
      async () => {
        const updatedCategories = currentCategories.filter((c) => c.id !== cat.id);
        onUpdateSaveData((prev) => ({
          ...prev,
          ouenCategories: updatedCategories,
          lastSaved: Date.now(),
        }));
        if (selectedCategoryFilter === cat.id) {
          setSelectedCategoryFilter('all');
        }
        // Directly delete single row from Synology PostgreSQL
        const res = await deleteSingleMasterOuenCategoryFromPostgrest(cat.id);
        if (res.success) {
          setSaveStatus({
            type: 'success',
            message: `🗑️ カテゴリー「${cat.label}」をDBから直接削除しました`,
          });
        } else {
          setSaveStatus({
            type: 'error',
            message: `DB削除エラー: ${res.error || '削除できませんでした'}`,
          });
        }
      }
    );
  };

  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  const handleFetchFromFirebase = async () => {
    setIsFetchingRemote(true);
    setSaveStatus(null);
    try {
      const res = await fetchGlobalOuenList();
      if (res.success && res.ouenList && res.ouenList.length > 0) {
        const fetchedList = res.ouenList;
        const fetchedCats = res.ouenCategories || currentCategories;
        onUpdateSaveData((prev) => ({
          ...prev,
          ouenList: fetchedList,
          ouenCategories: fetchedCats,
          lastSaved: Date.now(),
        }));
        setSaveStatus({
          type: 'success',
          message: `Synology DBから最新の応援メッセージ（${fetchedList.length} 件）を正常に復元・読み込みました！`,
        });
        try {
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        } catch {}
      } else {
        setSaveStatus({
          type: 'error',
          message: `データの取得に失敗しました: ${res.error || 'データが見つかりませんでした'}`,
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: `読み込みエラー: ${err?.message || String(err)}`,
      });
    } finally {
      setIsFetchingRemote(false);
    }
  };

  const handleUpdateCategoryLabel = async (cat: OuenCategory, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === cat.label) {
      setEditingCategoryId(null);
      return;
    }
    const updatedCategories = currentCategories.map((c) =>
      c.id === cat.id ? { ...c, label: trimmed } : c
    );
    onUpdateSaveData((prev) => ({
      ...prev,
      ouenCategories: updatedCategories,
      lastSaved: Date.now(),
    }));
    setEditingCategoryId(null);

    const targetIdx = updatedCategories.findIndex((c) => c.id === cat.id);
    const res = await saveSingleMasterOuenCategoryToPostgrest(
      { id: cat.id, label: trimmed },
      targetIdx >= 0 ? targetIdx + 1 : 1
    );
    if (res.success) {
      setSaveStatus({
        type: 'success',
        message: `✅ カテゴリー名を「${trimmed}」に更新し、Synology DBへ直接保存しました！`,
      });
    }
  };

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await saveGlobalOuenList(currentList, currentCategories);
      if (res.success) {
        setSaveStatus({
          type: 'success',
          message: `Synology DB（共通マスター）に正常に一括保存しました！（全 ${currentList.length} 件）`,
        });
        try {
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
        } catch {}
      } else {
        setSaveStatus({
          type: 'error',
          message: `保存に失敗しました: ${res.error || '不明なエラー'}`,
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: `保存エラー: ${err?.message || String(err)}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    openConfirm(
      '公式プリセット復元（全25件）',
      '公式の応援メッセージ（全25件：つかれた、いらいらする、はらがたつ、はげまして等）を一括復元して適用しますか？',
      async () => {
        const restoredList = mergeOuenList(INITIAL_OUEN_LIST);
        const restoredCats = mergeOuenCategories(INITIAL_OUEN_CATEGORIES);
        onUpdateSaveData((prev) => ({
          ...prev,
          ouenCategories: restoredCats,
          ouenList: restoredList,
          lastSaved: Date.now(),
        }));
        await saveGlobalOuenList(restoredList, restoredCats);
        setSaveStatus({
          type: 'success',
          message: `公式プリセット応援メッセージ全 ${restoredList.length} 件を正常に復元・同期しました！`,
        });
        try {
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        } catch {}
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#FFFDF9] p-4 rounded-2xl border border-[#E7DECD] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#FFF2F0] text-[#D4736A]">
              <MessageCircleHeart className="w-5 h-5" />
            </span>
            <h3 className="font-handwriting font-black text-lg text-[#3E3833] flex items-center gap-2">
              <span>けんちこ「応援して」メッセージ管理</span>
              <span className="text-[10px] bg-[#E8F3EE] text-[#2F7357] border border-[#C2E3D4] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                <Database className="w-3 h-3" />
                <span>1行ずつ直接DB即時保存</span>
              </span>
            </h3>
          </div>
          <p className="text-xs text-[#7A7166] mt-1 leading-relaxed">
            気分（つかれた、いらいらするなど）ごとにけんちこが返してくれる応援メッセージを直接編集できます。<br className="hidden sm:inline" />
            <strong>スプレッドシート表形式</strong>または<strong>カード形式</strong>で入力でき、追加・編集・削除は<strong>Synology DBへ1行ずつ直接リアルタイム保存</strong>されます。Firebase上限の心配はありません。
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleResetToDefault}
            disabled={isSaving || isFetchingRemote}
            title="公式プリセット全25件（つかれた、いらいら、はらがたつ等）を一括復元します"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#FFF8E7] hover:bg-[#FCE8BD] text-[#8C6414] font-bold text-xs shadow-xs transition border border-[#ECD9A8] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#C2881E]" />
            <span>全25件プリセット復元</span>
          </button>
          <button
            onClick={handleFetchFromFirebase}
            disabled={isFetchingRemote || isSaving}
            title="Synology DBからメッセージを再読み込み・復元します"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F0EBE1] hover:bg-[#E2DDD2] text-[#3E3833] font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <CloudDownload className="w-4 h-4 text-[#487560]" />
            <span>{isFetchingRemote ? '読込中...' : 'DBから復元/読込'}</span>
          </button>
          <button
            onClick={handleSaveToDatabase}
            disabled={isSaving || isFetchingRemote}
            title="全メッセージを一括でSynology DBへ同期します"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#487560] hover:bg-[#3B614F] text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '保存中...' : '全件DB一括保存'}</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4736A] hover:bg-[#C26259] text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新規メッセージ</span>
          </button>
        </div>
      </div>

      {/* Save Notification */}
      {saveStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold animate-fadeIn ${
            saveStatus.type === 'success'
              ? 'bg-[#EBF7F0] border-[#A8D5BA] text-[#2D5A3F]'
              : 'bg-[#FFF2F0] border-[#F0A8A0] text-[#8C2E24]'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#487560]" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#D4736A]" />
            )}
            <span>{saveStatus.message}</span>
          </div>
          <button onClick={() => setSaveStatus(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Category Tabs & Manager Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-[#3E3833] text-white shadow-xs'
                  : 'bg-white hover:bg-[#F5F2EA] text-[#6E665C] border border-[#DDD7C8]'
              }`}
            >
              <span>すべて</span>
              <span className="text-[10px] opacity-75 font-mono">({currentList.length})</span>
            </button>
            {currentCategories.map((cat) => {
              const count = currentList.filter((i) => i.categoryId === cat.id).length;
              const isSelected = selectedCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#D4736A] text-white shadow-xs'
                      : 'bg-white hover:bg-[#F5F2EA] text-[#6E665C] border border-[#DDD7C8]'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#EFECE4] p-1 rounded-xl border border-[#DDD7C8]">
              <button
                type="button"
                onClick={() => setViewMode('sheet')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'sheet'
                    ? 'bg-[#2E2824] text-white shadow-xs'
                    : 'text-[#6B6259] hover:text-[#2E2824]'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>スプレッドシート表</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-[#2E2824] text-white shadow-xs'
                    : 'text-[#6B6259] hover:text-[#2E2824]'
                }`}
              >
                <Files className="w-3.5 h-3.5" />
                <span>カード詳細一覧</span>
              </button>
            </div>

            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="text-xs font-bold text-[#487560] hover:text-[#3B614F] flex items-center gap-1 underline cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>カテゴリー編集</span>
            </button>
          </div>
        </div>

        {/* Category Manager Drawer */}
        {showCategoryManager && (
          <div className="p-4 rounded-2xl bg-[#F8F6F0] border border-[#E2DDD2] space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-[#3E3833]">選択肢カテゴリーの追加・名称変更・管理</h4>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-xs text-[#8C837A] hover:text-[#3E3833] cursor-pointer"
              >
                閉じる ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {currentCategories.map((cat) => {
                const isEditing = editingCategoryId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-[#DDD7C8] text-xs font-bold text-[#3E3833]"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingCategoryLabel}
                          onChange={(e) => setEditingCategoryLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateCategoryLabel(cat, editingCategoryLabel);
                            if (e.key === 'Escape') setEditingCategoryId(null);
                          }}
                          className="px-1.5 py-0.5 border border-[#487560] rounded text-xs w-28 bg-[#FAF8F4]"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateCategoryLabel(cat, editingCategoryLabel)}
                          className="text-[#487560] hover:text-[#3B614F] p-0.5 cursor-pointer"
                          title="確定"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCategoryId(null)}
                          className="text-[#8C837A] p-0.5 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span>{cat.label}</span>
                        <button
                          onClick={() => {
                            setEditingCategoryId(cat.id);
                            setEditingCategoryLabel(cat.label);
                          }}
                          className="text-[#8C837A] hover:text-[#3E3833] p-0.5 cursor-pointer"
                          title="名称変更"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        {currentCategories.length > 1 && (
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-[#D4736A] hover:text-[#A8382E] p-0.5 cursor-pointer"
                            title="削除"
                          >
                            ✕
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#EAE5D9]">
              <input
                type="text"
                placeholder="新しいカテゴリー名（例: さみしい）"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryLabel.trim()) handleAddCategory();
                }}
                className="flex-1 bg-white border border-[#DDD7C8] rounded-xl px-3 py-1.5 text-xs text-[#3E3833]"
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryLabel.trim()}
                className="px-3 py-1.5 rounded-xl bg-[#487560] text-white font-bold text-xs hover:bg-[#3B614F] disabled:opacity-50 cursor-pointer"
              >
                追加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Input & Quick Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#A89F93] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="応援メッセージを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-[#DDD7C8] text-xs text-[#3E3833] focus:outline-none focus:border-[#D4736A]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A89F93] hover:text-[#3E3833] cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {viewMode === 'sheet' && (
          <button
            onClick={handleAddBlankRow}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF8F5] hover:bg-[#FAF2EB] text-[#C8744E] text-xs font-black rounded-xl border border-[#F0D5C3] transition shadow-2xs whitespace-nowrap cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新しい行を追加</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* SPREADSHEET TABLE VIEW (表形式) */}
      {/* ========================================================= */}
      {viewMode === 'sheet' && (
        <div className="bg-white rounded-2xl border border-[#DDD7C8] overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#DDD7C8] text-[#7D756D] font-bold sticky top-0 z-10">
                <tr>
                  <th className="p-2.5 w-12 text-center">#</th>
                  <th className="p-2.5 w-40">気分（カテゴリー）</th>
                  <th className="p-2.5 min-w-[280px]">けんちこの応援セリフ（直接編集で即保存）</th>
                  <th className="p-2.5 w-24 text-center">DB保存状態</th>
                  <th className="p-2.5 w-28 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE5D9]">
                {filteredList.map((item, idx) => {
                  const isRecentlySaved = recentlySavedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#FFFDF9] transition ${
                        isRecentlySaved ? 'bg-[#EBF7F0]' : ''
                      }`}
                    >
                      <td className="p-2 text-center text-[11px] font-mono text-[#A89F93]">
                        {idx + 1}
                      </td>

                      {/* Category Dropdown */}
                      <td className="p-2">
                        <select
                          value={item.categoryId}
                          onChange={(e) => {
                            const newCat = e.target.value;
                            handleInlineUpdateItem(item.id, 'categoryId', newCat);
                            handleInlineSaveRow(item.id);
                          }}
                          className="w-full px-2 py-1 bg-white border border-[#DDD7C8] rounded-lg text-xs font-bold text-[#3E3833] focus:outline-none focus:border-[#D4736A]"
                        >
                          {currentCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Message Input */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.message}
                          onChange={(e) => handleInlineUpdateItem(item.id, 'message', e.target.value)}
                          onBlur={() => handleInlineSaveRow(item.id)}
                          placeholder="応援セリフを入力..."
                          title="編集して枠外をクリックまたは入力終了でSynology DBへ即座に自動保存されます"
                          className="w-full px-2 py-1.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-[#DDD7C8] focus:border-[#D4736A] rounded-lg text-xs font-handwriting font-bold text-[#3E3833] focus:outline-none transition"
                        />
                      </td>

                      {/* Save Status Badge */}
                      <td className="p-2 text-center">
                        {isRecentlySaved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-[#2F7357] text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                            <Check className="w-3 h-3" />
                            <span>DB保存済</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#A89F93] font-mono">
                            連携中
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleInlineSaveRow(item.id)}
                            className="p-1 text-[#2F7357] hover:bg-[#EBF5EE] rounded-md transition cursor-pointer"
                            title="この行をSynology DBに直接確定保存"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateItem(item)}
                            className="p-1 text-[#7D756D] hover:text-[#D4736A] hover:bg-[#FFF2F0] rounded-md transition cursor-pointer"
                            title="この行を複製して直接DB追加"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1 text-[#D4736A] hover:bg-[#FFF2F0] rounded-md transition cursor-pointer"
                            title="Synology DBから直接削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#FAF8F5] border-t border-[#DDD7C8] flex items-center justify-between text-xs text-[#7A7166]">
            <span>表示中: {filteredList.length} / 全 {currentList.length} 件</span>
            <button
              onClick={handleAddBlankRow}
              className="flex items-center gap-1 text-[#D4736A] hover:underline font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新しい行を追加
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CARD DETAILED VIEW (カード形式) */}
      {/* ========================================================= */}
      {viewMode === 'cards' && (
        <div className="space-y-2.5">
          {filteredList.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#DDD7C8] p-6">
              <p className="text-xs font-bold text-[#8C837A] mb-2">
                該当する応援メッセージがありません
              </p>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D4736A] text-white text-xs font-bold hover:bg-[#C26259] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>最初のメッセージを追加</span>
              </button>
            </div>
          ) : (
            filteredList.map((item) => {
              const cat = currentCategories.find((c) => c.id === item.categoryId);
              const isRecentlySaved = recentlySavedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-4 p-4 rounded-2xl bg-white hover:bg-[#FFFDF9] border transition group ${
                    isRecentlySaved ? 'border-[#A8D5BA] bg-[#EBF7F0]' : 'border-[#E7DECD] shadow-xs'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#FFF2F0] text-[#D4736A] font-bold text-[11px] border border-[#FAD6D2]">
                        {cat?.label || '未分類'}
                      </span>
                      {isRecentlySaved && (
                        <span className="text-[10px] bg-[#2F7357] text-white px-2 py-0.5 rounded-full font-bold">
                          DB保存済
                        </span>
                      )}
                      <span className="text-[10px] text-[#A89F93] font-mono">
                        {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <p className="text-sm font-handwriting font-bold text-[#3E3833] break-words">
                      「{item.message}」
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDuplicateItem(item)}
                      className="p-2 rounded-xl hover:bg-[#FAF2EB] text-[#7D756D] hover:text-[#C8744E] transition cursor-pointer"
                      title="複製してDB追加"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 rounded-xl hover:bg-[#F5F2EA] text-[#6E665C] hover:text-[#3E3833] transition cursor-pointer"
                      title="編集"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="p-2 rounded-xl hover:bg-[#FFF2F0] text-[#D4736A] hover:text-[#B33E32] transition cursor-pointer"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer Tools */}
      <div className="flex items-center justify-between pt-4 border-t border-[#EAE5D9] text-xs text-[#8C837A]">
        <span>登録件数: {currentList.length} 件</span>
        <button
          onClick={handleResetToDefault}
          className="hover:text-[#D4736A] flex items-center gap-1 text-[11px] underline cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>公式プリセット（全25件）を復元・同期</span>
        </button>
      </div>

      {/* Create / Edit Modal Dialog */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#FAF8F4] rounded-3xl border-2 border-[#DDD7C8] shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-handwriting font-black text-base text-[#3E3833] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4736A]" />
                <span>{editingItem ? '応援メッセージの編集' : '新しい応援メッセージの登録'}</span>
              </h3>
              <button
                onClick={() => setIsAddingNew(false)}
                className="p-1 rounded-full text-[#8C837A] hover:text-[#3E3833]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6E665C] mb-1.5">
                  対応する気分（カテゴリー）
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full bg-white border border-[#DDD7C8] rounded-xl px-3 py-2 text-xs font-bold text-[#3E3833] focus:outline-none focus:border-[#D4736A]"
                >
                  {currentCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E665C] mb-1.5">
                  けんちこの応援セリフ（メッセージ）
                </label>
                <textarea
                  rows={3}
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="例: よしよし、いつもよくがんばってるね"
                  className="w-full bg-white border border-[#DDD7C8] rounded-xl p-3 text-sm font-handwriting font-bold text-[#3E3833] focus:outline-none focus:border-[#D4736A]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFECE4] text-[#6E665C] font-bold text-xs hover:bg-[#E2DDD2]"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveItem}
                  disabled={!formMessage.trim()}
                  className="px-5 py-2 rounded-xl bg-[#D4736A] hover:bg-[#C26259] text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {editingItem ? 'DBに直接保存（1行更新）' : 'DBに直接登録（1行追加）'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
