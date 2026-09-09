import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  XCircle,
  UploadCloud,
  RefreshCw,
  Trash2,
  Edit3,
  Search,
  Eye,
  Sparkles,
  AlertCircle,
  Filter,
  Check,
} from 'lucide-react';
import { NyanCharacter, NyankoStory } from '../types';
import {
  NyankoStoriesMeta,
  fetchStoriesMeta,
  parseStoryInputJson,
  uploadStoriesJsonToFirestore,
  saveSingleStoryToFirestore,
  deleteStoryFromFirestore,
  fetchNyankoStory,
} from '../services/nyankoStoryService';
import { NyankoStoryModal } from './NyankoStoryModal';

interface AdminStoryManagerProps {
  characters: NyanCharacter[];
  onUpdateCharacters?: (updated: NyanCharacter[]) => void;
}

const SAMPLE_STORY_JSON = `{
  "かがみもちにゃん / しょよがつにゃん": {
    "id": 1,
    "name": "かがみもちにゃん / しょよがつにゃん",
    "kana": "かがみもちにゃん",
    "motif": "お正月・鏡餅・門松",
    "debut_date": "2023/01/04",
    "voice": "うにゃーんにゃ！（すぽっ）",
    "translation": "「お正月だから鏡餅頭に乗せて三輪車で爆走するにゃ！お年玉もちょうだいにゃ！」",
    "episode_summary": "お正月のめでたい象徴として頭に鏡餅やしめ縄を乗せて登場。大晦日から正月気分が抜けず三輪車を漕ぎまくる。",
    "doc_link": "",
    "week_info": {
      "week_title": "1月 第1週（2023/01/04 〜 2023/01/06）",
      "week_start": "2023/01/04",
      "week_end": "2023/01/06",
      "days": [
        {
          "date_header": "2023年1月4日（水）",
          "messages": [
            {
              "time": "08:16",
              "sender": "由美さん",
              "body": "きょよはくもってるなー\\nそしてさむーい\\n（がこがこ）\\n\\nねんまつねんしは\\nわっしょーい\\nわっしょーい\\nだったなー\\nもうはたらけないんじゃ\\nないかと\\nふあんになるれべるだなー\\n（がこがこ）\\n\\nうにゃにゃん\\n\\nだれっ？\\nいやっ、きかなくても\\nわかったきがする…\\nそのあたまにのった\\nかがみもちは\\nしょよがつにゃん？"
            },
            {
              "time": "13:53",
              "sender": "健介さん",
              "body": "こんなとこにめでたそーなねこがいるー\\n\\nあたまにかどまつとしめなわとかがみもちー？\\n\\nめでたーいめでたーい"
            }
          ]
        }
      ]
    }
  }
}`;

export const AdminStoryManager: React.FC<AdminStoryManagerProps> = ({
  characters,
  onUpdateCharacters,
}) => {
  // State
  const [meta, setMeta] = useState<NyankoStoriesMeta | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_story' | 'no_story'>('all');

  // Import panel state
  const [jsonInput, setJsonInput] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<{
    valid: boolean;
    stories: NyankoStory[];
    error?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Single edit modal state
  const [editingNyan, setEditingNyan] = useState<NyanCharacter | null>(null);
  const [editingJsonText, setEditingJsonText] = useState<string>('');
  const [isLoadingSingleStory, setIsLoadingSingleStory] = useState<boolean>(false);
  const [isSavingSingleStory, setIsSavingSingleStory] = useState<boolean>(false);

  // Preview Story Modal state
  const [previewNyan, setPreviewNyan] = useState<NyanCharacter | null>(null);

  // Load Metadata
  const loadMeta = async (force: boolean = false) => {
    setIsLoadingMeta(true);
    try {
      const res = await fetchStoriesMeta(force);
      setMeta(res);

      // Sync character hasStory property if onUpdateCharacters provided
      if (res && onUpdateCharacters) {
        const registeredIds = new Set(Object.keys(res.stories).map((k) => parseInt(k, 10)));
        const updatedChars = characters.map((c) => ({
          ...c,
          hasStory: registeredIds.has(c.no),
        }));
        onUpdateCharacters(updatedChars);
      }
    } catch (err) {
      console.error('Failed to load stories meta:', err);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  useEffect(() => {
    loadMeta(false);
  }, []);

  // Parse JSON input in real time
  useEffect(() => {
    if (!jsonInput.trim()) {
      setParsedPreview(null);
      return;
    }
    const res = parseStoryInputJson(jsonInput);
    setParsedPreview(res);
  }, [jsonInput]);

  // Handle batch upload
  const handleUploadBatch = async () => {
    if (!parsedPreview || !parsedPreview.valid || parsedPreview.stories.length === 0) return;
    setIsUploading(true);
    setStatusMessage(null);
    setUploadProgress({ current: 0, total: parsedPreview.stories.length, percent: 0 });

    try {
      const res = await uploadStoriesJsonToFirestore(parsedPreview.stories, (p) => {
        setUploadProgress(p);
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `🎉 ${res.totalUploaded} 件の物語をFirestoreに保存・更新しました！`,
        });
        setJsonInput('');
        setParsedPreview(null);
        await loadMeta(true);
        setActiveTab('list');
      } else {
        setStatusMessage({
          type: 'error',
          text: `エラー: ${res.error || 'アップロードに失敗しました'}`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `アップロード失敗: ${err?.message || '不明なエラー'}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file drop / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setJsonInput(content);
      }
    };
    reader.readAsText(file);
  };

  // Open single edit modal
  const handleOpenSingleEdit = async (nyan: NyanCharacter) => {
    setEditingNyan(nyan);
    setIsLoadingSingleStory(true);
    setEditingJsonText('');
    setStatusMessage(null);

    try {
      const res = await fetchNyankoStory(nyan.no);
      if (res.story) {
        setEditingJsonText(JSON.stringify(res.story, null, 2));
      } else {
        // Create initial skeleton for this nyan
        const skeleton: NyankoStory = {
          id: nyan.no,
          name: nyan.name,
          kana: nyan.reading,
          motif: nyan.motif,
          firstAppeared: nyan.firstAppeared,
          debut_date: nyan.firstAppeared,
          voice: nyan.dialogue || 'うにゃーんにゃ！',
          translation: nyan.dialogueMeaning || '',
          episode_summary: nyan.episode || '',
          week_info: {
            week_title: `${nyan.name}の物語`,
            week_start: '',
            week_end: '',
            days: [
              {
                date_header: '第1日目',
                messages: [
                  {
                    time: '09:00',
                    sender: 'けんちこ',
                    body: `${nyan.name}と出会ったよ！`,
                  },
                ],
              },
            ],
          },
        } as any;
        setEditingJsonText(JSON.stringify(skeleton, null, 2));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSingleStory(false);
    }
  };

  // Save single story
  const handleSaveSingleStory = async () => {
    if (!editingNyan) return;
    try {
      const parseRes = parseStoryInputJson(editingJsonText);
      if (!parseRes.valid || parseRes.stories.length === 0) {
        alert(parseRes.error || '無効なJSONフォーマットです');
        return;
      }
      const story = parseRes.stories[0];
      story.id = editingNyan.no; // Ensure ID matches

      setIsSavingSingleStory(true);
      const res = await saveSingleStoryToFirestore(story);
      if (res.success) {
        await loadMeta(true);
        setEditingNyan(null);
        setStatusMessage({
          type: 'success',
          text: `🎉 No.${editingNyan.no} ${editingNyan.name} の物語を保存しました！`,
        });
      } else {
        alert(res.error || '保存に失敗しました');
      }
    } catch (err: any) {
      alert(`保存エラー: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsSavingSingleStory(false);
    }
  };

  // Delete single story
  const handleDeleteStory = async (nyanId: number, nyanName: string) => {
    if (!window.confirm(`本当に No.${nyanId}「${nyanName}」の物語をFirestoreから削除しますか？`)) {
      return;
    }
    try {
      const res = await deleteStoryFromFirestore(nyanId);
      if (res.success) {
        await loadMeta(true);
        setStatusMessage({
          type: 'success',
          text: `No.${nyanId}「${nyanName}」の物語を削除しました。`,
        });
      } else {
        alert(res.error || '削除に失敗しました');
      }
    } catch (err: any) {
      alert(`削除エラー: ${err?.message || '不明なエラー'}`);
    }
  };

  // Registered story IDs Set
  const registeredStoryMap = meta?.stories || {};
  const registeredCount = Object.keys(registeredStoryMap).length;
  const coveragePercent = characters.length > 0 ? Math.round((registeredCount / characters.length) * 100) : 0;

  // Filtered list
  const filteredNyans = useMemo(() => {
    return characters.filter((c) => {
      const hasStory = !!registeredStoryMap[String(c.no)];

      if (filterMode === 'has_story' && !hasStory) return false;
      if (filterMode === 'no_story' && hasStory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = String(c.no).includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        const matchReading = c.reading.toLowerCase().includes(q);
        const matchMotif = (c.motif || '').toLowerCase().includes(q);
        if (!matchNo && !matchName && !matchReading && !matchMotif) return false;
      }

      return true;
    });
  }, [characters, registeredStoryMap, filterMode, searchQuery]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Banner & Stat Summary */}
      <div className="bg-[#EAF0EC] p-4 rounded-2xl border border-[#C6D8CD] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#487560] text-white rounded-xl shadow-sm">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-sm font-black text-[#234A35] flex items-center gap-1.5">
                にゃんこ会話劇（物語）マスター管理
              </h4>
              <p className="text-xs text-[#487560]">
                Firestore（<code className="bg-[#D9E6DD] px-1.5 py-0.5 rounded text-[11px]">nyanko_stories</code>）に保存された各にゃんこの会話劇・長文エピソードを登録・更新・管理します。
              </p>
            </div>
          </div>
        </div>

        {/* Coverage Meter */}
        <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-[#C6D8CD] shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-bold text-[#7D756D]">物語登録率</div>
            <div className="font-mono font-bold text-sm text-[#487560]">
              {registeredCount} / {characters.length} 体 ({coveragePercent}%)
            </div>
          </div>
          <button
            onClick={() => loadMeta(true)}
            disabled={isLoadingMeta}
            title="最新状態を再読込"
            className="p-2 bg-[#F5F2EA] hover:bg-[#EAE6DC] text-[#4A443F] rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingMeta ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-[#EAF0EC] border-[#A8C7B4] text-[#245C3B]'
              : 'bg-[#FDF2F0] border-[#F2C0B8] text-[#A83226]'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 ml-2"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDD7C8] pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'list'
              ? 'bg-[#3A342F] text-white shadow-sm'
              : 'bg-[#EFECE4] text-[#6B6259] hover:text-[#3A342F]'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>全にゃんこ物語一覧 ({characters.length}体)</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'import'
              ? 'bg-[#3A342F] text-white shadow-sm'
              : 'bg-[#EFECE4] text-[#6B6259] hover:text-[#3A342F]'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>JSONから一括登録・更新</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* SUBTAB 1: Story Roster List & Status                         */}
      {/* ============================================================ */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Controls: Search and Filter */}
          <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#DDD7C8] flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-[#A8A096] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="No、名前、読み、モチーフで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3A342F] focus:outline-none focus:border-[#487560]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'all'
                    ? 'bg-[#487560] text-white shadow-sm'
                    : 'bg-[#EFECE4] text-[#6B6259] hover:text-[#3A342F]'
                }`}
              >
                すべて ({characters.length})
              </button>
              <button
                onClick={() => setFilterMode('has_story')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterMode === 'has_story'
                    ? 'bg-[#487560] text-white shadow-sm'
                    : 'bg-[#EFECE4] text-[#6B6259] hover:text-[#3A342F]'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-[#2E7D32]" />
                <span>登録済 ({registeredCount})</span>
              </button>
              <button
                onClick={() => setFilterMode('no_story')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterMode === 'no_story'
                    ? 'bg-[#D97543] text-white shadow-sm'
                    : 'bg-[#EFECE4] text-[#6B6259] hover:text-[#3A342F]'
                }`}
              >
                <XCircle className="w-3 h-3 text-[#A83226]" />
                <span>未登録 ({characters.length - registeredCount})</span>
              </button>
            </div>
          </div>

          {/* Table of Nyans */}
          <div className="bg-white rounded-xl border border-[#DDD7C8] overflow-hidden shadow-sm">
            <div className="max-h-[500px] overflow-y-auto divide-y divide-[#EFECE4]">
              {filteredNyans.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#A8A096]">
                  該当するにゃんこが見つかりませんでした
                </div>
              ) : (
                filteredNyans.map((nyan) => {
                  const storyMeta = registeredStoryMap[String(nyan.no)];
                  const hasStory = !!storyMeta;

                  return (
                    <div
                      key={nyan.no}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-[#FAF8F5] transition text-xs"
                    >
                      {/* Left: Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-[#F5F2EA] border border-[#DDD7C8] flex items-center justify-center shrink-0 overflow-hidden">
                          {nyan.customImageUrl ? (
                            <img
                              src={nyan.customImageUrl}
                              alt={nyan.name}
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="font-mono text-[11px] font-bold text-[#A8A096]">
                              #{nyan.no}
                            </span>
                          )}
                        </div>

                        {/* Text info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[11px] text-[#7D756D]">
                              No.{nyan.no}
                            </span>
                            <span className="font-black text-[#2E2824] truncate">
                              {nyan.name}
                            </span>
                            {nyan.reading && (
                              <span className="text-[10px] text-[#A8A096] hidden md:inline truncate">
                                （{nyan.reading}）
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            {hasStory ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#EAF0EC] text-[#235E3B] px-2 py-0.5 rounded-full border border-[#C2DACB]">
                                <Check className="w-3 h-3 text-[#2E7D32]" />
                                <span>登録済</span>
                                {storyMeta.daysCount > 0 && (
                                  <span className="opacity-80">（{storyMeta.daysCount}日分）</span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#FDF2F0] text-[#A83226] px-2 py-0.5 rounded-full border border-[#F5C2BA]">
                                <XCircle className="w-3 h-3" />
                                <span>物語未登録</span>
                              </span>
                            )}

                            {storyMeta?.week_title && (
                              <span className="text-[11px] text-[#7A726A] truncate max-w-xs hidden lg:inline">
                                {storyMeta.week_title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasStory && (
                          <button
                            onClick={() => setPreviewNyan(nyan)}
                            title="実際の物語モーダルでプレビュー表示"
                            className="p-1.5 bg-[#FAF8F5] hover:bg-[#EAE6DC] text-[#487560] border border-[#DDD7C8] rounded-lg transition flex items-center gap-1 text-[11px] font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">プレビュー</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenSingleEdit(nyan)}
                          title="このにゃんこの物語JSONを編集・登録"
                          className="p-1.5 bg-[#F5F2EA] hover:bg-[#E5DFD3] text-[#3A342F] border border-[#DDD7C8] rounded-lg transition flex items-center gap-1 text-[11px] font-bold"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#C8744E]" />
                          <span className="hidden sm:inline">
                            {hasStory ? '編集' : '登録'}
                          </span>
                        </button>

                        {hasStory && (
                          <button
                            onClick={() => handleDeleteStory(nyan.no, nyan.name)}
                            title="Firestoreから物語を削除"
                            className="p-1.5 bg-[#FDF2F0] hover:bg-[#FADCD8] text-[#A83226] border border-[#F5C2BA] rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUBTAB 2: Batch JSON Import Panel                           */}
      {/* ============================================================ */}
      {activeTab === 'import' && (
        <div className="space-y-4 bg-[#FAF8F5] p-4 rounded-2xl border border-[#DDD7C8]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-black text-[#3A342F] flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-[#487560]" />
                物語JSONの一括登録・更新
              </h5>
              <p className="text-[11px] text-[#7A726A] mt-0.5">
                JSONテキストを直接貼り付けるか、ファイルを選択してください。キー名形式（<code>&#123; "かがみもちにゃん": &#123; id: 1, ... &#125; &#125;</code>）や配列形式にも全対応しています。
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setJsonInput(SAMPLE_STORY_JSON)}
                className="px-3 py-1 bg-[#EFECE4] hover:bg-[#E2DDD3] text-[#5A524A] rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-[#D97543]" />
                <span>サンプルJSONを入力</span>
              </button>

              <label className="px-3 py-1 bg-white hover:bg-[#FAF8F5] text-[#487560] border border-[#C6D8CD] rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>.jsonファイル選択</span>
                <input
                  type="file"
                  accept=".json,application/json,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Text Area */}
          <div>
            <textarea
              rows={9}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="ここに物語JSONデータを貼り付けてください..."
              className="w-full p-3 font-mono text-xs bg-white border border-[#DDD7C8] rounded-xl text-[#2E2824] focus:outline-none focus:border-[#487560] leading-relaxed"
            />
          </div>

          {/* Real-time Parsing Validation Feedback */}
          {parsedPreview && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn ${
                parsedPreview.valid
                  ? 'bg-[#EAF0EC] border-[#C2DACB] text-[#245C3B]'
                  : 'bg-[#FDF2F0] border-[#F5C2BA] text-[#A83226]'
              }`}
            >
              <div className="flex items-center gap-2">
                {parsedPreview.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-[#2E7D32] shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[#A83226] shrink-0" />
                )}
                <div>
                  <div className="font-black text-xs">
                    {parsedPreview.valid
                      ? `✅ 有効な物語データを ${parsedPreview.stories.length} 件検出しました`
                      : '構文エラーまたはフォーマット違反'}
                  </div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {parsedPreview.valid
                      ? parsedPreview.stories
                          .slice(0, 4)
                          .map((s) => `No.${s.id}「${s.name}」`)
                          .join('、') + (parsedPreview.stories.length > 4 ? ` ほか計${parsedPreview.stories.length}件` : '')
                      : parsedPreview.error}
                  </div>
                </div>
              </div>

              {parsedPreview.valid && (
                <button
                  onClick={handleUploadBatch}
                  disabled={isUploading}
                  className="px-4 py-2 bg-[#487560] hover:bg-[#3B6350] text-white rounded-xl font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 active:scale-95"
                >
                  <UploadCloud className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
                  <span>
                    {isUploading
                      ? 'Firestoreへアップロード中...'
                      : `${parsedPreview.stories.length}件をFirestoreに登録・反映`}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {uploadProgress && (
            <div className="space-y-1.5 p-3 bg-white rounded-xl border border-[#DDD7C8]">
              <div className="flex justify-between text-xs font-bold text-[#487560]">
                <span>アップロード進行状況:</span>
                <span>
                  {uploadProgress.current} / {uploadProgress.total} 件 ({uploadProgress.percent}%)
                </span>
              </div>
              <div className="w-full bg-[#EAE6DC] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#487560] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: Single Story JSON Editor Modal                      */}
      {/* ============================================================ */}
      {editingNyan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF8F5] w-full max-w-2xl rounded-2xl border-2 border-[#DDD7C8] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="p-4 bg-[#EFECE4] border-b border-[#DDD7C8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#C8744E]" />
                <h4 className="text-sm font-black text-[#2E2824]">
                  No.{editingNyan.no}「{editingNyan.name}」の物語JSON編集
                </h4>
              </div>
              <button
                onClick={() => setEditingNyan(null)}
                className="p-1 hover:bg-[#DDD7C8] rounded-lg text-[#7A726A]"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {isLoadingSingleStory ? (
                <div className="p-12 text-center text-xs text-[#7A726A] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#487560]" />
                  <span>Firestoreから現在の物語を読み込み中...</span>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-[#7A726A]">
                    このにゃんこ専用の物語JSONです。メッセージのセリフや話数、登場人物などを直接編集して「保存」できます。
                  </p>
                  <textarea
                    rows={15}
                    value={editingJsonText}
                    onChange={(e) => setEditingJsonText(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-white border border-[#DDD7C8] rounded-xl text-[#2E2824] focus:outline-none focus:border-[#487560] leading-relaxed"
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#EFECE4] border-t border-[#DDD7C8] flex justify-between items-center">
              <button
                onClick={() => setEditingNyan(null)}
                className="px-4 py-2 bg-white hover:bg-[#FAF8F5] text-[#5A524A] border border-[#DDD7C8] rounded-xl text-xs font-bold transition"
              >
                キャンセル
              </button>

              <button
                onClick={handleSaveSingleStory}
                disabled={isSavingSingleStory || isLoadingSingleStory}
                className="px-5 py-2 bg-[#487560] hover:bg-[#3B6350] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isSavingSingleStory ? 'Firestoreへ保存中...' : 'Firestoreへ保存・更新'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: Live Preview in NyankoStoryModal                    */}
      {/* ============================================================ */}
      {previewNyan && (
        <NyankoStoryModal
          isOpen={true}
          nyan={previewNyan}
          onClose={() => setPreviewNyan(null)}
          onStoryReadCompleted={() => {}}
        />
      )}
    </div>
  );
};
