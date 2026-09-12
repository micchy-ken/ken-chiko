/**
 * AdminOuenEditor: Management console for Kenchiko's cheering messages and categories.
 * Allows editing, testing, resetting, and synchronizing with global Firestore.
 */
import React, { useState, useMemo } from 'react';
import { OuenCategory, OuenItem, GameSaveData } from '../types';
import { INITIAL_OUEN_CATEGORIES, INITIAL_OUEN_LIST } from '../data/defaultOuen';
import { saveGlobalOuenList, fetchGlobalOuenList } from '../services/firebaseSync';
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
    return saveData.ouenCategories && saveData.ouenCategories.length > 0
      ? saveData.ouenCategories
      : INITIAL_OUEN_CATEGORIES;
  }, [saveData.ouenCategories]);

  const currentList: OuenItem[] = useMemo(() => {
    return saveData.ouenList && saveData.ouenList.length > 0
      ? saveData.ouenList
      : INITIAL_OUEN_LIST;
  }, [saveData.ouenList]);

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

  // Save / Sync Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const handleSaveItem = () => {
    if (!formMessage.trim()) {
      setSaveStatus({ type: 'error', message: '応援メッセージを入力してください' });
      return;
    }

    const trimmedMsg = formMessage.trim();
    let updatedList: OuenItem[];

    if (editingItem) {
      updatedList = currentList.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              categoryId: formCategoryId,
              message: trimmedMsg,
              updatedAt: Date.now(),
            }
          : item
      );
    } else {
      const newItem: OuenItem = {
        id: `ouen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        categoryId: formCategoryId,
        message: trimmedMsg,
        createdAt: Date.now(),
      };
      updatedList = [newItem, ...currentList];
    }

    onUpdateSaveData((prev) => ({
      ...prev,
      ouenList: updatedList,
      ouenCategories: currentCategories,
      lastSaved: Date.now(),
    }));

    setIsAddingNew(false);
    setEditingItem(null);
    setFormMessage('');

    try {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } catch {}
  };

  const handleDeleteItem = (item: OuenItem) => {
    openConfirm(
      '応援メッセージの削除',
      `「${item.message}」を削除してもよろしいですか？`,
      () => {
        const updatedList = currentList.filter((i) => i.id !== item.id);
        onUpdateSaveData((prev) => ({
          ...prev,
          ouenList: updatedList,
          lastSaved: Date.now(),
        }));
      }
    );
  };

  const handleAddCategory = () => {
    if (!newCategoryLabel.trim()) return;
    const label = newCategoryLabel.trim();
    const id = `cat_${Date.now()}`;
    const updatedCategories = [...currentCategories, { id, label }];

    onUpdateSaveData((prev) => ({
      ...prev,
      ouenCategories: updatedCategories,
      lastSaved: Date.now(),
    }));

    setNewCategoryLabel('');
  };

  const handleDeleteCategory = (cat: OuenCategory) => {
    if (currentCategories.length <= 1) {
      setSaveStatus({ type: 'error', message: 'カテゴリーは最低1つ必要です' });
      return;
    }
    openConfirm(
      'カテゴリーの削除',
      `カテゴリー「${cat.label}」を削除しますか？\n（関連するメッセージは残りますが、別のカテゴリーへの変更が必要になります）`,
      () => {
        const updatedCategories = currentCategories.filter((c) => c.id !== cat.id);
        onUpdateSaveData((prev) => ({
          ...prev,
          ouenCategories: updatedCategories,
          lastSaved: Date.now(),
        }));
        if (selectedCategoryFilter === cat.id) {
          setSelectedCategoryFilter('all');
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
          message: `Firestoreから最新の応援メッセージ（${fetchedList.length} 件）を正常に復元・読み込みました！`,
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

  const handleSaveToFirebase = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await saveGlobalOuenList(currentList, currentCategories);
      if (res.success) {
        setSaveStatus({
          type: 'success',
          message: `Firestore（共通DB）に正常に保存しました！（全 ${currentList.length} 件）`,
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
      '初期設定へのリセット',
      '応援メッセージを初期状態（「よしよし」のみ）にリセットしますか？\n※追加したメッセージは消去されます。',
      () => {
        onUpdateSaveData((prev) => ({
          ...prev,
          ouenCategories: INITIAL_OUEN_CATEGORIES,
          ouenList: INITIAL_OUEN_LIST,
          lastSaved: Date.now(),
        }));
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
            <h3 className="font-handwriting font-black text-lg text-[#3E3833]">
              けんちこ「応援して」メッセージ管理
            </h3>
          </div>
          <p className="text-xs text-[#7A7166] mt-1">
            気分（つかれた、いらいらするなど）ごとにけんちこが返してくれる応援メッセージを設定・編集します。
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleFetchFromFirebase}
            disabled={isFetchingRemote || isSaving}
            title="Firestore共通DBからメッセージを再読み込み・復元します"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F0EBE1] hover:bg-[#E2DDD2] text-[#3E3833] font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            <CloudDownload className="w-4 h-4 text-[#487560]" />
            <span>{isFetchingRemote ? '読込中...' : 'DBから復元/読込'}</span>
          </button>
          <button
            onClick={handleSaveToFirebase}
            disabled={isSaving || isFetchingRemote}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#487560] hover:bg-[#3B614F] text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '保存中...' : 'Firestoreに保存'}</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4736A] hover:bg-[#C26259] text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>新規メッセージ</span>
          </button>
        </div>
      </div>

      {/* Save Notification */}
      {saveStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
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
          <button onClick={() => setSaveStatus(null)} className="text-xs opacity-70 hover:opacity-100">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
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

          <button
            onClick={() => setShowCategoryManager(!showCategoryManager)}
            className="text-xs font-bold text-[#487560] hover:text-[#3B614F] flex items-center gap-1 underline"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>カテゴリー編集</span>
          </button>
        </div>

        {/* Category Manager Drawer */}
        {showCategoryManager && (
          <div className="p-4 rounded-2xl bg-[#F8F6F0] border border-[#E2DDD2] space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-[#3E3833]">選択肢カテゴリーの追加・管理</h4>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-xs text-[#8C837A] hover:text-[#3E3833]"
              >
                閉じる ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {currentCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-[#DDD7C8] text-xs font-bold text-[#3E3833]"
                >
                  <span>{cat.label}</span>
                  {currentCategories.length > 1 && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-[#D4736A] hover:text-[#A8382E] p-0.5"
                      title="削除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#EAE5D9]">
              <input
                type="text"
                placeholder="新しいカテゴリー名（例: さみしい）"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                className="flex-1 bg-white border border-[#DDD7C8] rounded-xl px-3 py-1.5 text-xs text-[#3E3833]"
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryLabel.trim()}
                className="px-3 py-1.5 rounded-xl bg-[#487560] text-white font-bold text-xs hover:bg-[#3B614F] disabled:opacity-50"
              >
                追加
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A89F93] hover:text-[#3E3833]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages List */}
      <div className="space-y-2.5">
        {filteredList.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-[#DDD7C8] p-6">
            <p className="text-xs font-bold text-[#8C837A] mb-2">
              該当する応援メッセージがありません
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D4736A] text-white text-xs font-bold hover:bg-[#C26259]"
            >
              <Plus className="w-4 h-4" />
              <span>最初のメッセージを追加</span>
            </button>
          </div>
        ) : (
          filteredList.map((item) => {
            const cat = currentCategories.find((c) => c.id === item.categoryId);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white hover:bg-[#FFFDF9] border border-[#E7DECD] shadow-xs transition group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-[#FFF2F0] text-[#D4736A] font-bold text-[11px] border border-[#FAD6D2]">
                      {cat?.label || '未分類'}
                    </span>
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
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 rounded-xl hover:bg-[#F5F2EA] text-[#6E665C] hover:text-[#3E3833] transition"
                    title="編集"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="p-2 rounded-xl hover:bg-[#FFF2F0] text-[#D4736A] hover:text-[#B33E32] transition"
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

      {/* Footer Tools */}
      <div className="flex items-center justify-between pt-4 border-t border-[#EAE5D9] text-xs text-[#8C837A]">
        <span>登録件数: {currentList.length} 件</span>
        <button
          onClick={handleResetToDefault}
          className="hover:text-[#D4736A] flex items-center gap-1 text-[11px] underline"
        >
          <RotateCcw className="w-3 h-3" />
          <span>初期設定（よしよし）にリセット</span>
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
                  className="px-5 py-2 rounded-xl bg-[#D4736A] hover:bg-[#C26259] text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
                >
                  {editingItem ? '変更を保存' : '登録する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
