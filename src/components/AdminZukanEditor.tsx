import React, { useState, useMemo } from 'react';
import { NyanCharacter, GameSaveData } from '../types';
import { NyanIllustration } from './NyanIllustration';
import {
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Eye,
  EyeOff,
  Heart,
  Calendar,
  Layers,
  Wand2,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  RotateCcw,
  BookOpen,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  compressAndResizeImage,
  TransparencyOptions,
} from '../services/imageCompression';

interface AdminZukanEditorProps {
  characters: NyanCharacter[];
  onUpdateSaveData: (updater: (prev: GameSaveData) => GameSaveData, isImmediate?: boolean) => void;
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

type FilterType = 'all' | 'discovered' | 'undiscovered' | 'custom_image' | 'default_image';
type SortType = 'no_asc' | 'no_desc' | 'name_asc' | 'friendship_desc' | 'play_desc';

export const AdminZukanEditor: React.FC<AdminZukanEditorProps> = ({
  characters,
  onUpdateSaveData,
  openConfirm,
}) => {
  // Search, Filter, Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('no_asc');

  // Edit/Create Modal State
  const [editingNyan, setEditingNyan] = useState<NyanCharacter | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form Fields
  const [formNo, setFormNo] = useState<number>(1);
  const [formName, setFormName] = useState('');
  const [formReading, setFormReading] = useState('');
  const [formMotif, setFormMotif] = useState('');
  const [formEpisode, setFormEpisode] = useState('');
  const [formPromptJa, setFormPromptJa] = useState('');
  const [formPromptEn, setFormPromptEn] = useState('');
  const [formFirstAppeared, setFormFirstAppeared] = useState('');
  const [formDiscovered, setFormDiscovered] = useState(true);
  const [formFriendshipLevel, setFormFriendshipLevel] = useState(1);
  const [formPlayCount, setFormPlayCount] = useState(1);
  const [formCustomImageUrl, setFormCustomImageUrl] = useState('');
  const [formUrlInput, setFormUrlInput] = useState('');

  // Image Processing State
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [autoTransparent, setAutoTransparent] = useState(true);
  const [transparencyTolerance, setTransparencyTolerance] = useState(30);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Quick Stats
  const totalCount = characters.length;
  const discoveredCount = characters.filter((c) => c.discovered).length;
  const customImageCount = characters.filter((c) => Boolean(c.customImageUrl)).length;

  // Open Edit Modal
  const handleOpenEdit = (nyan: NyanCharacter) => {
    setEditingNyan(nyan);
    setIsAddingNew(false);
    setFormNo(nyan.no);
    setFormName(nyan.name);
    setFormReading(nyan.reading || '');
    setFormMotif(nyan.motif || '');
    setFormEpisode(nyan.episode || '');
    setFormPromptJa(nyan.promptJa || '');
    setFormPromptEn(nyan.promptEn || '');
    setFormFirstAppeared(nyan.firstAppeared || '');
    setFormDiscovered(nyan.discovered);
    setFormFriendshipLevel(nyan.friendshipLevel || 1);
    setFormPlayCount(nyan.playCount || 0);
    setFormCustomImageUrl(nyan.customImageUrl || '');
    setFormUrlInput(nyan.customImageUrl || '');
    setFormNotice(null);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    const nextNo = characters.length > 0 ? Math.max(...characters.map((c) => c.no)) + 1 : 1;
    setEditingNyan(null);
    setIsAddingNew(true);
    setFormNo(nextNo);
    setFormName('');
    setFormReading('');
    setFormMotif('');
    setFormEpisode('');
    setFormPromptJa('');
    setFormPromptEn('');
    setFormFirstAppeared(new Date().toLocaleDateString('ja-JP'));
    setFormDiscovered(true);
    setFormFriendshipLevel(1);
    setFormPlayCount(1);
    setFormCustomImageUrl('');
    setFormUrlInput('');
    setFormNotice(null);
  };

  // Close Modal
  const handleCloseModal = () => {
    setEditingNyan(null);
    setIsAddingNew(false);
    setFormNotice(null);
  };

  // Upload & Process Image File
  const handleFileUpload = async (file: File) => {
    try {
      setIsProcessingImage(true);
      setFormNotice('画像を自動最適化中...');
      const opts: TransparencyOptions = {
        enableTransparency: autoTransparent,
        tolerance: transparencyTolerance,
        feather: 2,
        trimPadding: true,
      };
      const processed = await compressAndResizeImage(file, 600, 600, 0.92, opts);
      setFormCustomImageUrl(processed);
      setFormUrlInput(processed);
      setIsProcessingImage(false);
      setFormNotice('✨ 画像をセットしました。「保存してFirebaseに反映」を押して完了してください。');
    } catch (err: any) {
      setIsProcessingImage(false);
      setFormNotice(`❌ 画像の処理に失敗しました: ${err.message}`);
    }
  };

  // Apply Direct URL
  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (formUrlInput.trim()) {
      setFormCustomImageUrl(formUrlInput.trim());
      setFormNotice('🔗 画像URLをセットしました。');
    }
  };

  // Clear / Reset Image
  const handleResetImage = () => {
    setFormCustomImageUrl('');
    setFormUrlInput('');
    setFormNotice('🖌️ デフォルトイラストに戻しました。');
  };

  // Save Character Changes
  const handleSaveCharacter = () => {
    if (!formName.trim()) {
      setFormNotice('⚠️ にゃんこの名前を入力してください。');
      return;
    }

    const nyanData: NyanCharacter = {
      no: formNo,
      name: formName.trim(),
      reading: formReading.trim() || formName.trim(),
      motif: formMotif.trim() || '日常',
      episode: formEpisode.trim() || 'けんちこがセカイのどこかで出会った、ゆるくて愛らしい仲間。',
      promptJa: formPromptJa.trim() || formName.trim(),
      promptEn: formPromptEn.trim() || 'cute cat character',
      firstAppeared: formFirstAppeared.trim() || new Date().toLocaleDateString('ja-JP'),
      discovered: formDiscovered,
      discoveryDate: formDiscovered ? (editingNyan?.discoveryDate || new Date().toLocaleString('ja-JP')) : undefined,
      friendshipLevel: Math.max(1, formFriendshipLevel),
      playCount: Math.max(0, formPlayCount),
      customImageUrl: formCustomImageUrl.trim() || undefined,
    };

    let updatedCharacters: NyanCharacter[];
    if (isAddingNew) {
      // Check for duplicate No
      const existsIndex = characters.findIndex((c) => c.no === formNo);
      if (existsIndex >= 0) {
        updatedCharacters = characters.map((c) => (c.no === formNo ? nyanData : c));
      } else {
        updatedCharacters = [...characters, nyanData].sort((a, b) => a.no - b.no);
      }
      setNotice(`🎉 新しいにゃんこ「No.${formNo} ${formName}」を追加・保存しました！`);
    } else {
      updatedCharacters = characters.map((c) => (c.no === formNo ? nyanData : c));
      setNotice(`✅ 「No.${formNo} ${formName}」の図鑑情報と画像を更新・保存しました！`);
    }

    onUpdateSaveData((prev) => ({
      ...prev,
      characters: updatedCharacters,
      lastSaved: Date.now(),
    }), true);

    handleCloseModal();
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
  };

  // Quick Toggle Discovery
  const handleQuickToggleDiscovery = (no: number, current: boolean) => {
    onUpdateSaveData((prev) => {
      const updated = prev.characters.map((c) =>
        c.no === no
          ? {
              ...c,
              discovered: !current,
              discoveryDate: !current ? new Date().toLocaleString('ja-JP') : undefined,
            }
          : c
      );
      return {
        ...prev,
        characters: updated,
        lastSaved: Date.now(),
      };
    }, true);
    setNotice(`No.${no} の発見状態を「${!current ? '発見済み' : '未発見'}」に変更しました。`);
  };

  // Delete Character
  const handleDeleteCharacter = (no: number, name: string) => {
    openConfirm(
      'にゃんこキャラクターの削除',
      `「No.${no} ${name}」を図鑑およびFirebaseから完全に削除しますか？\n（この操作は取り消せません）`,
      () => {
        onUpdateSaveData((prev) => {
          const updated = prev.characters.filter((c) => c.no !== no);
          return {
            ...prev,
            characters: updated,
            lastSaved: Date.now(),
          };
        }, true);
        if (editingNyan && editingNyan.no === no) {
          handleCloseModal();
        }
        setNotice(`🗑️ 「No.${no} ${name}」を削除しました。`);
      }
    );
  };

  // Batch Unlock All
  const handleBatchUnlockAll = () => {
    openConfirm(
      '全にゃんこ発見済みに設定',
      'すべての◯◯にゃんを発見済み状態にしますか？（図鑑の全シルエットが解放されます）',
      () => {
        onUpdateSaveData((prev) => {
          const updated = prev.characters.map((c) => ({
            ...c,
            discovered: true,
            discoveryDate: c.discoveryDate || new Date().toLocaleString('ja-JP'),
          }));
          return {
            ...prev,
            characters: updated,
            lastSaved: Date.now(),
          };
        }, true);
        setNotice('🎉 全ての◯◯にゃんを発見済みに更新しました！');
        confetti({ particleCount: 40, spread: 70, origin: { y: 0.5 } });
      }
    );
  };

  // Batch Lock Undiscovered (Reset discovery to No.1~8 only)
  const handleBatchResetDiscovery = () => {
    openConfirm(
      '発見状態のリセット',
      '初期キャラクター（No.1〜8）以外の発見状態をリセット（未発見）にしますか？',
      () => {
        onUpdateSaveData((prev) => {
          const updated = prev.characters.map((c) => ({
            ...c,
            discovered: c.no <= 8,
            discoveryDate: c.no <= 8 ? c.discoveryDate || new Date().toLocaleString('ja-JP') : undefined,
          }));
          return {
            ...prev,
            characters: updated,
            lastSaved: Date.now(),
          };
        }, true);
        setNotice('🔄 発見状態を初期状態（No.1〜8発見済み）にリセットしました。');
      }
    );
  };

  // Filtered & Sorted Characters List
  const filteredCharacters = useMemo(() => {
    return characters
      .filter((c) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.reading?.toLowerCase().includes(q) ||
          c.motif?.toLowerCase().includes(q) ||
          c.episode?.toLowerCase().includes(q) ||
          String(c.no).includes(q);
        if (!matchesQuery) return false;

        if (filterType === 'discovered') return c.discovered;
        if (filterType === 'undiscovered') return !c.discovered;
        if (filterType === 'custom_image') return Boolean(c.customImageUrl);
        if (filterType === 'default_image') return !c.customImageUrl;
        return true;
      })
      .sort((a, b) => {
        if (sortType === 'no_desc') return b.no - a.no;
        if (sortType === 'name_asc') return a.name.localeCompare(b.name, 'ja');
        if (sortType === 'friendship_desc') return (b.friendshipLevel || 1) - (a.friendshipLevel || 1);
        if (sortType === 'play_desc') return (b.playCount || 0) - (a.playCount || 0);
        return a.no - b.no;
      });
  }, [characters, searchQuery, filterType, sortType]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Banner Notice */}
      <div className="bg-[#FAF2EB] p-4 rounded-2xl border border-[#F0D5C3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-black text-[#874A2E] flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#C8744E]" />
            にゃんこ図鑑マスター管理・画像修正コンソール
          </h4>
          <p className="text-xs text-[#9E5D3B] mt-0.5">
            各◯◯にゃんのイラスト画像差し替え、基本情報・エピソードの修正、発見状態の変更が行えます。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C8744E] hover:bg-[#B3633E] text-white text-xs font-black rounded-xl shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>新規にゃんこ追加</span>
          </button>
        </div>
      </div>

      {/* Global Status Notice */}
      {notice && (
        <div className="p-3 bg-[#EAF5EC] border border-[#C2E3C8] text-[#2B663B] text-xs font-bold rounded-xl flex items-center justify-between animate-fadeIn">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-[#2B663B] hover:text-[#1E4A2A]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats & Batch Controls Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#DDD7C8]">
          <span className="text-[10px] font-bold text-[#7D756D] block">登録キャラクター総数</span>
          <span className="text-base font-black text-[#3A342F] font-mono">{totalCount} 体</span>
        </div>
        <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#DDD7C8]">
          <span className="text-[10px] font-bold text-[#7D756D] block">発見済み</span>
          <span className="text-base font-black text-[#487560] font-mono">
            {discoveredCount} 体 ({totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0}%)
          </span>
        </div>
        <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#DDD7C8]">
          <span className="text-[10px] font-bold text-[#7D756D] block">画像登録済み</span>
          <span className="text-base font-black text-[#C8744E] font-mono">{customImageCount} 体</span>
        </div>
        <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#DDD7C8] flex flex-col justify-center gap-1">
          <span className="text-[10px] font-bold text-[#7D756D] block">一括ステータス操作</span>
          <div className="flex gap-1.5">
            <button
              onClick={handleBatchUnlockAll}
              className="text-[10px] font-bold px-2 py-0.5 bg-[#EAF5EC] hover:bg-[#D8EDDC] text-[#2B663B] rounded-lg border border-[#C2E3C8] transition"
            >
              全発見
            </button>
            <button
              onClick={handleBatchResetDiscovery}
              className="text-[10px] font-bold px-2 py-0.5 bg-[#F5F2EA] hover:bg-[#EFECE4] text-[#7D756D] rounded-lg border border-[#DDD7C8] transition"
            >
              初期化
            </button>
          </div>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#DDD7C8] space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E958C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="No、名前、よみ、モチーフ、エピソードで検索…"
              className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] focus:outline-none focus:border-[#C8744E] font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9E958C] hover:text-[#3A342F]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-4 h-4 text-[#7D756D]" />
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as SortType)}
              className="px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] font-bold focus:outline-none focus:border-[#C8744E]"
            >
              <option value="no_asc">No. 昇順 (1 → 100)</option>
              <option value="no_desc">No. 降順 (100 → 1)</option>
              <option value="name_asc">五十音順 (あいうえお)</option>
              <option value="friendship_desc">なかよし度順 (高 → 低)</option>
              <option value="play_desc">遭遇回数順 (多 → 少)</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-bold text-[#7D756D] shrink-0 mr-1">絞り込み:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
              filterType === 'all'
                ? 'bg-[#3A342F] text-white shadow-sm'
                : 'bg-white text-[#7D756D] border border-[#DDD7C8] hover:bg-[#F5F2EA]'
            }`}
          >
            すべて ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('discovered')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
              filterType === 'discovered'
                ? 'bg-[#487560] text-white shadow-sm'
                : 'bg-white text-[#7D756D] border border-[#DDD7C8] hover:bg-[#F5F2EA]'
            }`}
          >
            発見済み ({discoveredCount})
          </button>
          <button
            onClick={() => setFilterType('undiscovered')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
              filterType === 'undiscovered'
                ? 'bg-[#8C5A3E] text-white shadow-sm'
                : 'bg-white text-[#7D756D] border border-[#DDD7C8] hover:bg-[#F5F2EA]'
            }`}
          >
            未発見 ({totalCount - discoveredCount})
          </button>
          <button
            onClick={() => setFilterType('custom_image')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
              filterType === 'custom_image'
                ? 'bg-[#C8744E] text-white shadow-sm'
                : 'bg-white text-[#7D756D] border border-[#DDD7C8] hover:bg-[#F5F2EA]'
            }`}
          >
            🎨 画像設定済み ({customImageCount})
          </button>
          <button
            onClick={() => setFilterType('default_image')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition ${
              filterType === 'default_image'
                ? 'bg-[#6B6259] text-white shadow-sm'
                : 'bg-white text-[#7D756D] border border-[#DDD7C8] hover:bg-[#F5F2EA]'
            }`}
          >
            🖌️ デフォルトイラスト ({totalCount - customImageCount})
          </button>
        </div>
      </div>

      {/* Characters Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {filteredCharacters.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-[#FAF8F5] rounded-2xl border border-dashed border-[#DDD7C8] text-[#7D756D]">
            <p className="text-sm font-bold">該当するにゃんこが見つかりませんでした。</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
              }}
              className="mt-2 text-xs font-bold text-[#C8744E] hover:underline"
            >
              検索条件をリセット
            </button>
          </div>
        ) : (
          filteredCharacters.map((nyan) => (
            <div
              key={nyan.no}
              className="bg-white rounded-2xl border border-[#DDD7C8] p-3 flex flex-col justify-between hover:shadow-md transition group"
            >
              <div>
                {/* Header: No & Discovery Switch */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold bg-[#FAF2EB] text-[#874A2E] px-2 py-0.5 rounded-md border border-[#F0D5C3]">
                    No.{String(nyan.no).padStart(3, '0')}
                  </span>
                  <button
                    onClick={() => handleQuickToggleDiscovery(nyan.no, nyan.discovered)}
                    title={nyan.discovered ? '未発見にする' : '発見済みにする'}
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
                      nyan.discovered
                        ? 'bg-[#EAF5EC] text-[#2B663B] hover:bg-[#D8EDDC]'
                        : 'bg-[#F5F2EA] text-[#8C837A] hover:bg-[#EAE5D9]'
                    }`}
                  >
                    {nyan.discovered ? (
                      <>
                        <Eye className="w-3 h-3 text-[#2B663B]" />
                        <span>発見済</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3 text-[#8C837A]" />
                        <span>未発見</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Character Visual Preview */}
                <div className="flex justify-center my-2 p-2 bg-[#FAF8F5] rounded-xl border border-[#EFECE4] overflow-hidden">
                  <NyanIllustration nyan={nyan} size={110} isDiscovered={true} />
                </div>

                {/* Info Text */}
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-baseline justify-between">
                    <h5 className="text-sm font-black text-[#3A342F] truncate">{nyan.name}</h5>
                    <span className="text-[10px] text-[#8C5A3E] truncate max-w-[80px]">
                      {nyan.reading}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#7D756D] truncate flex items-center gap-1">
                    <Layers className="w-3 h-3 text-[#C8744E] shrink-0" />
                    <span>{nyan.motif || '日常'}</span>
                  </p>
                </div>

                {/* Image Status Badge */}
                <div className="mt-2">
                  {nyan.customImageUrl ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-[#FAF2EB] text-[#C8744E] px-2 py-0.5 rounded-md border border-[#F0D5C3]">
                      🎨 画像設定済み
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-[#F5F2EA] text-[#8C837A] px-2 py-0.5 rounded-md">
                      🖌️ デフォルト
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3 pt-2.5 border-t border-[#EFECE4] flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(nyan)}
                  className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF2EB] text-[#3A342F] hover:text-[#C8744E] border border-[#DDD7C8] hover:border-[#C8744E] rounded-xl text-xs font-black transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>修正・画像設定</span>
                </button>
                <button
                  onClick={() => handleDeleteCharacter(nyan.no, nyan.name)}
                  title="削除"
                  className="p-1.5 text-[#C85A53] hover:bg-[#FDF2F2] rounded-xl transition border border-transparent hover:border-[#F8D7D7]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================= */}
      {/* EDIT / CREATE NYANKO MODAL */}
      {/* ========================================================= */}
      {(editingNyan || isAddingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2E2824]/65 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="bg-[#ECE7DC] px-5 py-3.5 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#C8744E] text-white rounded-lg shadow-sm">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#2E2824] leading-tight font-handwriting">
                    {isAddingNew
                      ? '新規◯◯にゃんの追加'
                      : `No.${formNo} ${formName || 'にゃんこ'} の修正・画像設定`}
                  </h3>
                  <p className="text-[11px] text-[#7D756D]">
                    画像アップロード、名前・エピソード・発見状態をいつでも変更・Firebase同期できます
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 sketch-tag bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {formNotice && (
                <div className="p-3 bg-[#FAF2EB] border border-[#F0D5C3] text-[#874A2E] text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#C8744E]" />
                  <span>{formNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                {/* Left Column: Image Management Studio (2 cols) */}
                <div className="md:col-span-2 space-y-3.5">
                  <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-[#DDD7C8] flex flex-col items-center">
                    <span className="text-[11px] font-bold text-[#7D756D] mb-2">
                      現在のイラスト・画像プレビュー
                    </span>

                    {/* Preview Box with Checkerboard Background */}
                    <div
                      className="w-44 h-44 rounded-2xl border-2 border-[#3A342F] p-2 flex items-center justify-center overflow-hidden shadow-inner relative"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #E2DFD8 25%, transparent 25%), linear-gradient(-45deg, #E2DFD8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E2DFD8 75%), linear-gradient(-45deg, transparent 75%, #E2DFD8 75%)',
                        backgroundSize: '14px 14px',
                        backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
                        backgroundColor: '#FAF8F4',
                      }}
                    >
                      {formCustomImageUrl ? (
                        <img
                          src={formCustomImageUrl}
                          alt={formName || 'にゃんこ'}
                          className="max-w-full max-h-full object-contain filter drop-shadow-md"
                        />
                      ) : (
                        <NyanIllustration
                          nyan={{
                            no: formNo,
                            name: formName || 'にゃんこ',
                            reading: formReading,
                            motif: formMotif,
                            firstAppeared: formFirstAppeared,
                            episode: formEpisode,
                            promptJa: formPromptJa,
                            promptEn: formPromptEn,
                            discovered: true,
                            playCount: formPlayCount,
                            friendshipLevel: formFriendshipLevel,
                          }}
                          size={135}
                          isDiscovered={true}
                        />
                      )}
                    </div>

                    <span className="text-[10px] text-[#9E958C] mt-1.5 text-center">
                      {formCustomImageUrl
                        ? '※ 市松模様は透明（背景透過）部分です'
                        : '※ 未設定時はプログラム生成イラストが表示されます'}
                    </span>

                    {formCustomImageUrl && (
                      <button
                        onClick={handleResetImage}
                        className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#C85A53] hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>デフォルトイラストに戻す</span>
                      </button>
                    )}
                  </div>

                  {/* Image Upload Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setImageDragActive(true);
                    }}
                    onDragLeave={() => setImageDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setImageDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`p-4 border-2 border-dashed rounded-2xl text-center transition flex flex-col items-center justify-center ${
                      imageDragActive
                        ? 'border-[#C8744E] bg-[#FAF2EB]'
                        : 'border-[#DDD7C8] bg-white hover:border-[#C8744E]'
                    }`}
                  >
                    <Upload className="w-6 h-6 mx-auto text-[#C8744E] mb-1" />
                    <p className="text-xs font-bold text-[#3A342F]">
                      画像をドラッグ＆ドロップ
                    </p>
                    <label className="mt-2 inline-block px-4 py-1.5 bg-[#C8744E] hover:bg-[#B3633E] text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-sm">
                      {isProcessingImage ? '処理中...' : 'ファイルから選択'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={isProcessingImage}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Auto Transparency Controls */}
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#DDD7C8] space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoTransparent}
                        onChange={(e) => setAutoTransparent(e.target.checked)}
                        className="w-3.5 h-3.5 text-[#C8744E] rounded border-[#DDD7C8] focus:ring-[#C8744E]"
                      />
                      <span className="text-[11px] font-bold text-[#3A342F] flex items-center gap-1">
                        <Wand2 className="w-3 h-3 text-[#C8744E]" />
                        白背景の自動透過（白抜き）
                      </span>
                    </label>

                    {autoTransparent && (
                      <div className="space-y-1 pt-1 border-t border-[#EAE5D9]">
                        <div className="flex justify-between text-[10px] text-[#7D756D]">
                          <span>透過しきい値: {transparencyTolerance}</span>
                          <span>(標準: 30)</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="60"
                          step="1"
                          value={transparencyTolerance}
                          onChange={(e) => setTransparencyTolerance(Number(e.target.value))}
                          className="w-full h-1 bg-[#DDD7C8] rounded-lg appearance-none cursor-pointer accent-[#C8744E]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Direct Image URL Form */}
                  <form onSubmit={handleApplyUrl} className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#5A524A] block">
                      または画像URL / パスを直接入力
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={formUrlInput}
                        onChange={(e) => setFormUrlInput(e.target.value)}
                        placeholder="https://... または /images/..."
                        className="flex-1 px-3 py-1.5 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#3A342F] text-white text-xs font-bold rounded-xl hover:bg-black transition shrink-0"
                      >
                        適用
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Metadata Form (3 cols) */}
                <div className="md:col-span-3 space-y-3.5">
                  {/* Row 1: No, Name, Reading */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                        図鑑 No. <span className="text-[#C8744E]">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={formNo}
                        onChange={(e) => setFormNo(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] font-mono font-bold text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                        名前 <span className="text-[#C8744E]">*</span>
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="例: ほむらにゃん"
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] font-bold text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                        よみ（ふりがな）
                      </label>
                      <input
                        type="text"
                        value={formReading}
                        onChange={(e) => setFormReading(e.target.value)}
                        placeholder="例: ほむらにゃん"
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                  </div>

                  {/* Row 2: Motif, FirstAppeared */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                        モチーフ / 出身
                      </label>
                      <input
                        type="text"
                        value={formMotif}
                        onChange={(e) => setFormMotif(e.target.value)}
                        placeholder="例: アニメ「魔法少女まどか☆マギカ」"
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                        初登場日
                      </label>
                      <input
                        type="text"
                        value={formFirstAppeared}
                        onChange={(e) => setFormFirstAppeared(e.target.value)}
                        placeholder="例: 2024/09/01"
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                  </div>

                  {/* Row 3: Episode Story */}
                  <div>
                    <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                      観察エピソード・生態記録
                    </label>
                    <textarea
                      rows={3}
                      value={formEpisode}
                      onChange={(e) => setFormEpisode(e.target.value)}
                      placeholder="図鑑で表示される紹介文やけんちことの出会いエピソードを入力してください…"
                      className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] focus:outline-none focus:border-[#C8744E] leading-relaxed resize-none"
                    />
                  </div>

                  {/* Row 4: Prompts (JA / EN) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                        生成プロンプト (日本語)
                      </label>
                      <input
                        type="text"
                        value={formPromptJa}
                        onChange={(e) => setFormPromptJa(e.target.value)}
                        placeholder="例: 黒髪ツインテールのクールな猫"
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#5A524A] block mb-1">
                        Prompt (English)
                      </label>
                      <input
                        type="text"
                        value={formPromptEn}
                        onChange={(e) => setFormPromptEn(e.target.value)}
                        placeholder="e.g. cool black haired cat character"
                        className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#DDD7C8] text-[#3A342F] focus:outline-none focus:border-[#C8744E]"
                      />
                    </div>
                  </div>

                  {/* Row 5: Game Discovery & Stats */}
                  <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#DDD7C8] space-y-3">
                    <span className="text-[11px] font-black text-[#3A342F] block">
                      ゲーム内ステータス設定
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formDiscovered}
                          onChange={(e) => setFormDiscovered(e.target.checked)}
                          className="w-4 h-4 text-[#C8744E] rounded border-[#DDD7C8] focus:ring-[#C8744E]"
                        />
                        <span className="text-xs font-bold text-[#3A342F]">
                          図鑑で発見済みにする
                        </span>
                      </label>

                      <div>
                        <label className="text-[10px] font-bold text-[#7D756D] block mb-0.5">
                          なかよし度 (1〜99)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={formFriendshipLevel}
                          onChange={(e) => setFormFriendshipLevel(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2.5 py-1 text-xs bg-white rounded-lg border border-[#DDD7C8] font-bold text-[#C85A53] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-[#7D756D] block mb-0.5">
                          遭遇・遊んだ回数
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="999"
                          value={formPlayCount}
                          onChange={(e) => setFormPlayCount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1 text-xs bg-white rounded-lg border border-[#DDD7C8] font-bold text-[#487560] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-[#ECE7DC] px-5 py-3.5 border-t-1.5 border-[#3E3833] flex items-center justify-between">
              <div>
                {!isAddingNew && (
                  <button
                    onClick={() => handleDeleteCharacter(formNo, formName)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#C85A53] hover:underline"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>このにゃんこを削除</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-[#FAF8F4] hover:bg-white text-[#5A524A] text-xs font-bold rounded-xl border border-[#DDD7C8] transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveCharacter}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#C8744E] hover:bg-[#B3633E] text-white text-xs font-black rounded-xl shadow-md transition active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>図鑑に保存 & Firebase同期</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
