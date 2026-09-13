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
  ListChecks,
  Archive,
  UserPlus,
  ArrowRight,
  ArrowRightLeft,
  Shuffle,
  RotateCcw,
  FolderInput,
  Layers,
  ChevronDown,
  Save,
  Zap,
  AlertTriangle,
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
  rebuildStoriesMetaFromFirestore,
  fetchUnmappedStoriesArchive,
  fetchUnmappedStoryFull,
  assignUnmappedStoryToNyan,
  saveStoriesMetaDoc,
  saveStoriesToUnmappedArchive,
  deleteFromUnmappedArchive,
} from '../services/nyankoStoryService';
import { NyankoStoryModal } from './NyankoStoryModal';
import { estimateObjectWriteCost } from '../services/writeCostEstimator';

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

  // Registered story IDs Set & Unregistered Nyans
  const registeredStoryMap = useMemo(() => meta?.stories || {}, [meta]);
  const totalFirestoreStoriesCount = useMemo(() => Object.keys(registeredStoryMap).length, [registeredStoryMap]);

  // Number of characters in current zukan that actually have a registered story
  const matchedRegisteredCount = useMemo(() => {
    return characters.filter((c) => !!registeredStoryMap[String(c.no)]).length;
  }, [characters, registeredStoryMap]);

  // Unregistered characters in current zukan
  const unregisteredNyans = useMemo(() => {
    return characters.filter((c) => !registeredStoryMap[String(c.no)]);
  }, [characters, registeredStoryMap]);
  const unregisteredCount = unregisteredNyans.length;

  // Stories existing in Firestore that don't match any current zukan character No
  const charNoSet = useMemo(() => new Set(characters.map((c) => String(c.no))), [characters]);
  const orphanStoryKeys = useMemo(() => {
    return Object.keys(registeredStoryMap).filter((k) => !charNoSet.has(k));
  }, [registeredStoryMap, charNoSet]);
  const orphanStoriesCount = orphanStoryKeys.length;

  const orphanStoryList = useMemo(() => {
    return orphanStoryKeys.map((key) => {
      const item = registeredStoryMap[key];
      return {
        key,
        id: parseInt(key, 10) || 0,
        name: item?.name || `旧ID #${key}`,
        motif: item?.motif || '',
        week_title: item?.week_title || '',
        daysCount: item?.daysCount || 0,
      };
    });
  }, [orphanStoryKeys, registeredStoryMap]);

  const coveragePercent = useMemo(
    () => (characters.length > 0 ? Math.min(100, Math.round((matchedRegisteredCount / characters.length) * 100)) : 0),
    [characters.length, matchedRegisteredCount]
  );

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_story' | 'no_story' | 'orphan'>('all');

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

  // Staged assignments for JSON batch import: storyIndex -> { targetNo, updateName }
  const [stagedAssignments, setStagedAssignments] = useState<Record<number, { targetNo: number; updateName: boolean }>>({});

  // Single edit modal state
  const [editingNyan, setEditingNyan] = useState<NyanCharacter | null>(null);
  const [editingJsonText, setEditingJsonText] = useState<string>('');
  const [isLoadingSingleStory, setIsLoadingSingleStory] = useState<boolean>(false);
  const [isSavingSingleStory, setIsSavingSingleStory] = useState<boolean>(false);

  // Single edit modal: stream from archive
  const [archiveSourceIdToLoad, setArchiveSourceIdToLoad] = useState<string>('');
  const [loadedArchiveOldId, setLoadedArchiveOldId] = useState<string | null>(null);
  const [deleteArchiveOnSave, setDeleteArchiveOnSave] = useState<boolean>(true);
  const [isLoadingArchiveDetail, setIsLoadingArchiveDetail] = useState<boolean>(false);

  // Preview Story Modal state
  const [previewNyan, setPreviewNyan] = useState<NyanCharacter | null>(null);

  // Rebuild metadata from Firestore state
  const [isRebuilding, setIsRebuilding] = useState<boolean>(false);
  const [rebuildProgress, setRebuildProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
  } | null>(null);
  const [syncedNyansList, setSyncedNyansList] = useState<{
    id: number;
    name: string;
    title: string;
    daysCount: number;
  }[] | null>(null);
  const [showSyncedModal, setShowSyncedModal] = useState<boolean>(false);

  // Unmapped legacy archive state
  const [unmappedList, setUnmappedList] = useState<{
    oldId: string;
    name: string;
    motif?: string;
    title?: string;
    daysCount: number;
  }[] | null>(null);
  const [showUnmappedModal, setShowUnmappedModal] = useState<boolean>(false);
  const [isLoadingUnmapped, setIsLoadingUnmapped] = useState<boolean>(false);

  // Archive story assignment modal state
  const [assigningArchiveStory, setAssigningArchiveStory] = useState<{
    oldId: string;
    name: string;
    motif?: string;
    title?: string;
    daysCount: number;
  } | null>(null);
  const [assignTargetNyanNo, setAssignTargetNyanNo] = useState<number | null>(null);
  const [assignSearchQuery, setAssignSearchQuery] = useState<string>('');
  const [assignRenameToMaster, setAssignRenameToMaster] = useState<boolean>(true);
  const [assignDeleteFromArchive, setAssignDeleteFromArchive] = useState<boolean>(true);
  const [isAssigningArchive, setIsAssigningArchive] = useState<boolean>(false);

  // Unsaved assigned count / pending metadata sync state (to conserve Firestore write quotas)
  const [pendingMetaCount, setPendingMetaCount] = useState<number>(0);
  const [isSavingPendingMeta, setIsSavingPendingMeta] = useState<boolean>(false);

  const handleOpenUnmappedArchive = async () => {
    setIsLoadingUnmapped(true);
    try {
      const res = await fetchUnmappedStoriesArchive();
      if (res.success) {
        setUnmappedList(res.stories);
        setShowUnmappedModal(true);
      } else {
        setStatusMessage({ type: 'error', text: `アーカイブ取得失敗: ${res.error}` });
      }
    } finally {
      setIsLoadingUnmapped(false);
    }
  };

  const handleStartAssignArchiveStory = (item: {
    oldId: string;
    name: string;
    motif?: string;
    title?: string;
    daysCount: number;
  }) => {
    setAssigningArchiveStory(item);
    setAssignSearchQuery('');
    setAssignRenameToMaster(true);
    setAssignDeleteFromArchive(true);

    // Auto-suggest match by name if any unregistered nyan matches, otherwise first unregistered nyan
    const nameMatch = unregisteredNyans.find(
      (c) => c.name.includes(item.name) || item.name.includes(c.name)
    );
    setAssignTargetNyanNo(nameMatch ? nameMatch.no : (unregisteredNyans[0]?.no || null));
  };

  const handleConfirmAssignArchiveStory = async () => {
    if (!assigningArchiveStory || !assignTargetNyanNo) return;
    const targetChar = characters.find((c) => c.no === assignTargetNyanNo);
    if (!targetChar) return;

    setIsAssigningArchive(true);
    try {
      // Pass syncMetaToFirestore: false so we don't consume writes on nyanko_stories_meta every single time!
      const res = await assignUnmappedStoryToNyan(
        assigningArchiveStory.oldId,
        targetChar,
        {
          renameToMasterName: assignRenameToMaster,
          deleteFromArchive: assignDeleteFromArchive,
          syncMetaToFirestore: false,
        }
      );

      if (res.success && res.updatedMeta) {
        // Immediately update React state with new metadata index in memory
        setMeta(res.updatedMeta);
        setPendingMetaCount((prev) => prev + 1);

        // Update characters' hasStory flag in parent state without reloading
        if (onUpdateCharacters) {
          const registeredIds = new Set(Object.keys(res.updatedMeta.stories).map((k) => parseInt(k, 10)));
          const updatedChars = characters.map((c) => ({
            ...c,
            hasStory: registeredIds.has(c.no),
          }));
          onUpdateCharacters(updatedChars);
        }

        setStatusMessage({
          type: 'success',
          text: `🎉 旧#${assigningArchiveStory.oldId}「${assigningArchiveStory.name}」を No.${targetChar.no}「${targetChar.name}」に正式登録しました！（書き込み枠節約中: 作業終了後に「目録をクラウド保存」を押してください）`,
        });

        if (assignDeleteFromArchive) {
          setUnmappedList((prev) =>
            prev ? prev.filter((x) => x.oldId !== assigningArchiveStory.oldId) : null
          );
        }
        setAssigningArchiveStory(null);
      } else {
        alert(`割り当てエラー: ${res.error || '不明なエラー'}`);
      }
    } catch (err: any) {
      alert(`割り当て失敗: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsAssigningArchive(false);
    }
  };

  // Explicitly saves accumulated metadata index to Firestore (1 write operation)
  const handleSavePendingMeta = async () => {
    if (!meta) return;
    setIsSavingPendingMeta(true);
    try {
      const res = await saveStoriesMetaDoc(meta);
      if (res.success) {
        setPendingMetaCount(0);
        setStatusMessage({
          type: 'success',
          text: `☁️ クラウド目録（nyanko_stories_meta）を最新化しました！全ユーザーに即時反映されます。`,
        });
      } else {
        alert(`目録保存エラー: ${res.error}`);
      }
    } catch (err: any) {
      alert(`目録保存失敗: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsSavingPendingMeta(false);
    }
  };

  // Rebuild stories metadata from Firestore nyanko_stories collection
  const handleRebuildMeta = async () => {
    if (isRebuilding) return;
    setIsRebuilding(true);
    setStatusMessage(null);
    setRebuildProgress({ current: 0, total: 0, currentName: 'Firestoreスキャン開始...' });

    try {
      const res = await rebuildStoriesMetaFromFirestore((progress) => {
        setRebuildProgress({
          current: progress.current,
          total: progress.total,
          currentName: `No.${progress.id} ${progress.name}`,
        });
      });

      if (!res.success) {
        setStatusMessage({ type: 'error', text: `再同期失敗: ${res.error}` });
        return;
      }

      setMeta(res.meta || null);
      setSyncedNyansList(res.syncedNyans);
      setShowSyncedModal(true);

      // Sync character hasStory property across all characters in state
      if (res.meta && onUpdateCharacters) {
        const registeredIds = new Set(Object.keys(res.meta.stories).map((k) => parseInt(k, 10)));
        const updatedChars = characters.map((c) => ({
          ...c,
          hasStory: registeredIds.has(c.no),
        }));
        onUpdateCharacters(updatedChars);
      }

      setStatusMessage({
        type: 'success',
        text: `🎉 Firestoreから全${res.totalCount}匹分の物語目録を完全に再同期しました！`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `再同期エラー: ${err?.message}` });
    } finally {
      setIsRebuilding(false);
      setRebuildProgress(null);
    }
  };

  // Load Metadata
  const loadMeta = async (force: boolean = false) => {
    setIsLoadingMeta(true);
    try {
      const res = await fetchStoriesMeta(force);
      setMeta(res);

      // Sync character hasStory property only if there are actual discrepancies
      if (res && onUpdateCharacters) {
        const registeredIds = new Set(Object.keys(res.stories).map((k) => parseInt(k, 10)));
        let hasChanges = false;
        const updatedChars = characters.map((c) => {
          const has = registeredIds.has(c.no);
          if (c.hasStory !== has) hasChanges = true;
          return {
            ...c,
            hasStory: has,
          };
        });
        if (hasChanges) {
          onUpdateCharacters(updatedChars);
        }
      }
    } catch (err) {
      console.error('Failed to load stories meta:', err);
    } finally {
      setIsLoadingMeta(false);
    }
  };

  useEffect(() => {
    loadMeta(false);
    // Pre-fetch unmapped stories in background for dropdown availability
    fetchUnmappedStoriesArchive().then((res) => {
      if (res.success) setUnmappedList(res.stories);
    });
  }, []);

  // Parse JSON input in real time and prepare staged assignments
  useEffect(() => {
    if (!jsonInput.trim()) {
      setParsedPreview(null);
      setStagedAssignments({});
      return;
    }
    const res = parseStoryInputJson(jsonInput);
    setParsedPreview(res);

    if (res.valid && res.stories.length > 0) {
      const initial: Record<number, { targetNo: number; updateName: boolean }> = {};
      res.stories.forEach((s, idx) => {
        const charMatch = characters.find((c) => c.no === s.id);
        if (charMatch) {
          initial[idx] = { targetNo: charMatch.no, updateName: false };
        } else {
          const candidate = unregisteredNyans[idx];
          initial[idx] = { targetNo: candidate ? candidate.no : s.id, updateName: true };
        }
      });
      setStagedAssignments(initial);
    }
  }, [jsonInput]);

  // Auto-assign batch parsed stories sequentially to unregistered nyankos
  const handleAutoAssignBatchToUnregistered = () => {
    if (!parsedPreview || !parsedPreview.valid || parsedPreview.stories.length === 0) return;
    const newAssignments: Record<number, { targetNo: number; updateName: boolean }> = {};
    parsedPreview.stories.forEach((_, idx) => {
      const targetChar = unregisteredNyans[idx] || characters[idx % characters.length];
      if (targetChar) {
        newAssignments[idx] = { targetNo: targetChar.no, updateName: true };
      }
    });
    setStagedAssignments(newAssignments);
    setStatusMessage({
      type: 'success',
      text: `未登録にゃんこ（${Math.min(parsedPreview.stories.length, unregisteredNyans.length)}体）に自動順次割り付けを設定しました`,
    });
  };

  // Handle batch upload with assigned target IDs and names
  const handleUploadBatch = async () => {
    if (!parsedPreview || !parsedPreview.valid || parsedPreview.stories.length === 0) return;
    setIsUploading(true);
    setStatusMessage(null);
    setUploadProgress({ current: 0, total: parsedPreview.stories.length, percent: 0 });

    try {
      const finalStories = parsedPreview.stories.map((story, idx) => {
        const assignment = stagedAssignments[idx];
        if (assignment) {
          const targetChar = characters.find((c) => c.no === assignment.targetNo);
          return {
            ...story,
            id: assignment.targetNo,
            name: assignment.updateName && targetChar ? targetChar.name : story.name,
            storyOriginalName: story.name,
            motif: targetChar?.motif || story.motif,
            kana: targetChar?.reading || story.kana,
          };
        }
        return story;
      });

      const res = await uploadStoriesJsonToFirestore(finalStories, (p) => {
        setUploadProgress(p);
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `🎉 ${res.totalUploaded} 件の物語をFirestoreに保存・更新しました！`,
        });
        setJsonInput('');
        setParsedPreview(null);
        setStagedAssignments({});
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

  // Handle batch saving directly to unmapped stories archive
  const handleSaveBatchToUnmapped = async () => {
    if (!parsedPreview || !parsedPreview.valid || parsedPreview.stories.length === 0) return;
    setIsUploading(true);
    setStatusMessage(null);
    try {
      const res = await saveStoriesToUnmappedArchive(parsedPreview.stories);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `📦 ${res.count} 件の物語を「未紐付け物語保管庫」に保存しました！`,
        });
        setJsonInput('');
        setParsedPreview(null);
        // Refresh unmapped list
        const unmappedRes = await fetchUnmappedStoriesArchive();
        if (unmappedRes.success) {
          setUnmappedList(unmappedRes.stories);
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: `エラー: ${res.error || '未紐づけ保管庫への保存に失敗しました'}`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `保存中にエラーが発生しました: ${err?.message || err}`,
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
    setArchiveSourceIdToLoad('');
    setLoadedArchiveOldId(null);
    setDeleteArchiveOnSave(true);

    // Ensure archive list is available for streaming
    if (!unmappedList) {
      fetchUnmappedStoriesArchive().then((res) => {
        if (res.success) setUnmappedList(res.stories);
      });
    }

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

  // Stream archived story into single story editor
  const handleLoadArchiveIntoSingleEditor = async () => {
    if (!archiveSourceIdToLoad || !editingNyan) return;
    setIsLoadingArchiveDetail(true);
    try {
      const story = await fetchUnmappedStoryFull(archiveSourceIdToLoad);
      if (!story) {
        alert('保管庫の物語データの取得に失敗しました');
        return;
      }
      const loaded: NyankoStory = {
        ...story,
        id: editingNyan.no,
        name: editingNyan.name,
        storyOriginalName: story.name,
        kana: editingNyan.reading || story.kana,
        motif: editingNyan.motif || story.motif,
      };
      setEditingJsonText(JSON.stringify(loaded, null, 2));
      setLoadedArchiveOldId(archiveSourceIdToLoad);
      setStatusMessage({
        type: 'success',
        text: `旧#${archiveSourceIdToLoad}「${story.name}」の物語を No.${editingNyan.no}「${editingNyan.name}」に流し込みました`,
      });
    } catch (err: any) {
      alert(`流し込み失敗: ${err?.message || '不明なエラー'}`);
    } finally {
      setIsLoadingArchiveDetail(false);
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
        // If loaded from unmapped archive and deletion is enabled
        if (loadedArchiveOldId && deleteArchiveOnSave) {
          try {
            await deleteFromUnmappedArchive(loadedArchiveOldId);
            setUnmappedList((prev) =>
              prev ? prev.filter((x) => x.oldId !== loadedArchiveOldId) : null
            );
          } catch (delErr) {
            console.warn('Failed to delete from unmapped after single save:', delErr);
          }
        }

        await loadMeta(true);
        setEditingNyan(null);
        setLoadedArchiveOldId(null);
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

        {/* Actions & Coverage Meter */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleRebuildMeta}
            disabled={isRebuilding}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#8C5A3E] hover:bg-[#784A30] active:translate-y-0.5 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Firestoreの全物語データを走査して目録を再同期します"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRebuilding ? 'animate-spin' : ''}`} />
            <span>{isRebuilding ? '走査・同期中...' : '🔄 目録を再同期'}</span>
          </button>

          <button
            onClick={handleOpenUnmappedArchive}
            disabled={isLoadingUnmapped}
            className="flex items-center gap-1 px-3 py-2 bg-[#F3ECE0] hover:bg-[#E8DFCA] border border-[#D5C7B4] text-[#6B543D] font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50 cursor-pointer"
            title="現在の図鑑に未紐付けの旧物語データ（アーカイブ）を確認します"
          >
            <Archive className={`w-3.5 h-3.5 text-[#8C5A3E] ${isLoadingUnmapped ? 'animate-spin' : ''}`} />
            <span>未紐付け保管庫</span>
          </button>

          {pendingMetaCount > 0 && (
            <button
              onClick={handleSavePendingMeta}
              disabled={isSavingPendingMeta}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer animate-pulse"
              title="作業した割り当て目録をFirestoreに一括確定保存します（1回の書き込みで完了）"
            >
              <Save className={`w-3.5 h-3.5 ${isSavingPendingMeta ? 'animate-spin' : ''}`} />
              <span>
                {isSavingPendingMeta
                  ? '目録保存中...'
                  : `☁️ 目録をクラウド保存 (${pendingMetaCount}件保留中)`}
              </span>
            </button>
          )}

          {syncedNyansList && syncedNyansList.length > 0 && (
            <button
              onClick={() => setShowSyncedModal(true)}
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-[#FAF8F4] border border-[#C6D8CD] text-[#3E3833] font-bold text-xs rounded-xl shadow-xs transition"
            >
              <ListChecks className="w-3.5 h-3.5 text-[#487560]" />
              <span>同期結果 ({syncedNyansList.length}体)</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#C6D8CD]">
            <div className="text-right">
              <div className="text-[10px] font-bold text-[#7D756D]">物語登録率</div>
              <div className="font-mono font-bold text-xs text-[#487560]">
                {matchedRegisteredCount} / {characters.length} 体 ({coveragePercent}%)
              </div>
              {orphanStoriesCount > 0 && (
                <div className="text-[9px] text-[#8C5A3E] font-bold">
                  ※未紐付け物語: {orphanStoriesCount}件
                </div>
              )}
            </div>
            <button
              onClick={() => loadMeta(true)}
              disabled={isLoadingMeta || isRebuilding}
              title="最新状態を再読込"
              className="p-1.5 bg-[#F5F2EA] hover:bg-[#EAE6DC] text-[#4A443F] rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMeta ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Rebuild Progress Live Box */}
      {isRebuilding && rebuildProgress && (
        <div className="p-3.5 bg-[#FFF9F2] rounded-xl border border-[#F4D9BD] space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#8C5A3E] flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 animate-spin text-[#8C5A3E]" />
              <span>Firestoreから物語目録を再同期中…</span>
            </span>
            <span className="font-mono font-bold text-[#8C5A3E]">
              {rebuildProgress.current} / {rebuildProgress.total || '?'} 体
              {rebuildProgress.total > 0 && ` (${Math.round((rebuildProgress.current / rebuildProgress.total) * 100)}%)`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-[#EFE3D3] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#8C5A3E] h-full transition-all duration-150"
              style={{
                width: `${rebuildProgress.total > 0 ? (rebuildProgress.current / rebuildProgress.total) * 100 : 5}%`,
              }}
            />
          </div>
          {/* Live Synced Nyan Name */}
          <div className="text-xs text-[#6B5745] font-medium flex items-center gap-1.5">
            <span className="text-[10px] bg-[#EFE3D3] text-[#8C5A3E] px-1.5 py-0.5 rounded font-bold">走査中</span>
            <span className="font-bold truncate text-[#3E3833]">{rebuildProgress.currentName}</span>
          </div>
        </div>
      )}

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
          {/* Prominent sync callout banner when stories are not indexed */}
          {(!meta || meta.storyCount === 0) && (
            <div className="p-4 bg-[#FFF8EE] border-2 border-[#E9BF8C] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-[#8C5A3E] text-white rounded-xl shrink-0">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h5 className="text-xs font-black text-[#5C381E]">
                    Firestoreに登録済みの物語データ（263匹分）の目録が未同期です
                  </h5>
                  <p className="text-[11px] text-[#8C5A3E] mt-0.5">
                    「目録を再同期」ボタンを押すと、Firestore内の全物語データを自動走査して目録を復元・同期します。
                  </p>
                </div>
              </div>
              <button
                onClick={handleRebuildMeta}
                disabled={isRebuilding}
                className="w-full sm:w-auto px-4 py-2 bg-[#8C5A3E] hover:bg-[#784A30] active:translate-y-0.5 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
                <span>{isRebuilding ? '走査・同期中...' : '今すぐ目録を再同期する (263匹)'}</span>
              </button>
            </div>
          )}

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

            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 flex-wrap">
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
                <span>登録済 ({matchedRegisteredCount})</span>
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
                <span>未登録 ({unregisteredCount})</span>
              </button>
              {orphanStoriesCount > 0 && (
                <button
                  onClick={() => setFilterMode('orphan')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    filterMode === 'orphan'
                      ? 'bg-[#8C5A3E] text-white shadow-sm ring-1 ring-[#8C5A3E]'
                      : 'bg-[#FFF3E0] text-[#8C5A3E] border border-[#FFE0B2] hover:bg-[#FFE0B2]'
                  }`}
                  title="現在の図鑑番号にまだ紐付いていないFirestore上の物語データです"
                >
                  <AlertCircle className="w-3 h-3 text-[#E65100]" />
                  <span>未紐付け物語 ({orphanStoriesCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Table of Nyans or Orphan Stories */}
          <div className="bg-white rounded-xl border border-[#DDD7C8] overflow-hidden shadow-sm">
            <div className="max-h-[500px] overflow-y-auto divide-y divide-[#EFECE4]">
              {filterMode === 'orphan' ? (
                orphanStoryList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#A8A096]">
                    未紐付けの物語データはありません（全て現在の図鑑に紐付いています）
                  </div>
                ) : (
                  orphanStoryList.map((orphan) => (
                    <div
                      key={orphan.key}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-[#FFF9F2] transition text-xs bg-[#FFFDF9]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-[#F5EBE1] border border-[#E5D2C0] flex items-center justify-center shrink-0 text-[#8C5A3E] font-mono text-[11px] font-bold">
                          #{orphan.id}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[11px] text-[#8C5A3E]">
                              旧ID #{orphan.id}
                            </span>
                            <span className="font-black text-[#2E2824] truncate">
                              {orphan.name}
                            </span>
                            <span className="bg-[#FFF0E0] text-[#8C5A3E] border border-[#FFD9B3] text-[10px] font-bold px-1.5 py-0.2 rounded">
                              未紐付け
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#7A726A]">
                            {orphan.week_title && (
                              <span className="truncate">{orphan.week_title}</span>
                            )}
                            {orphan.daysCount > 0 && (
                              <span className="text-[10px] text-[#8C5A3E] font-bold">
                                （{orphan.daysCount}日分）
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Direct Assignment to Zukan Nyan button */}
                        <button
                          onClick={() =>
                            handleStartAssignArchiveStory({
                              oldId: String(orphan.id),
                              name: orphan.name,
                              motif: orphan.motif,
                              title: orphan.week_title,
                              daysCount: orphan.daysCount,
                            })
                          }
                          className="px-2.5 py-1.5 bg-[#487560] hover:bg-[#3d6351] text-white font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="この未紐付け物語を図鑑のにゃんこに正式割り当て・紐付け"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>図鑑に紐付け</span>
                        </button>

                        <button
                          onClick={() => {
                            const mockNyan: NyanCharacter = {
                              no: orphan.id,
                              name: orphan.name,
                              reading: '',
                              motif: orphan.motif,
                              firstAppeared: '',
                              episode: '',
                              promptJa: '',
                              promptEn: '',
                              dialogue: '',
                              dialogueMeaning: '',
                              hasStory: true,
                              discovered: true,
                              playCount: 0,
                              friendshipLevel: 1,
                            };
                            setPreviewNyan(mockNyan);
                          }}
                          className="px-2.5 py-1.5 bg-[#F5F2EA] hover:bg-[#EAE6DC] text-[#4A443F] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                          title="物語をプレビュー"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#487560]" />
                          <span className="hidden sm:inline">閲覧</span>
                        </button>

                        <button
                          onClick={() => handleDeleteStory(orphan.id, orphan.name)}
                          className="p-1.5 bg-[#FDF2F0] hover:bg-[#FBE4E1] text-[#A83226] rounded-lg transition cursor-pointer"
                          title="この未紐付け物語を削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : filteredNyans.length === 0 ? (
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
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleSaveBatchToUnmapped}
                    disabled={isUploading}
                    className="px-3.5 py-2 bg-[#8C5A3E] hover:bg-[#784A30] text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer text-xs"
                    title="図鑑に紐づけず、後から自由に割り振れる未紐づけ保管庫に格納します"
                  >
                    <Archive className="w-4 h-4" />
                    <span>未紐づけ保管庫に投入</span>
                  </button>

                  <button
                    onClick={handleUploadBatch}
                    disabled={isUploading}
                    className="px-4 py-2 bg-[#487560] hover:bg-[#3B6350] text-white rounded-xl font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer text-xs"
                  >
                    <UploadCloud className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
                    <span>
                      {isUploading
                        ? 'Firestoreへアップロード中...'
                        : `${parsedPreview.stories.length}件を登録 (想定${parsedPreview.stories.length}回書込)`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Unregistered Nyanko Assignment Mapping Section for Batch Upload */}
          {parsedPreview && parsedPreview.valid && (
            <div className="bg-white rounded-xl border border-[#DDD7C8] p-3.5 space-y-3 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EFECE4] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#EAF0EC] text-[#245C3B] rounded-lg">
                    <UserPlus className="w-4 h-4" />
                  </span>
                  <div>
                    <h6 className="text-xs font-black text-[#2E2824]">
                      にゃんこ割り付け設定（未登録にゃんこへの紐付け）
                    </h6>
                    <p className="text-[11px] text-[#7A726A]">
                      物語をどの未登録にゃんこ（現在{unregisteredNyans.length}体）に登録するか個別に調整できます
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoAssignBatchToUnregistered}
                    className="px-3 py-1.5 bg-[#8C5A3E] hover:bg-[#784A30] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="未登録にゃんこに上から順番に自動で割り付けます"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>未登録にゃんこに自動順次割り付け</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const reset: Record<number, { targetNo: number; updateName: boolean }> = {};
                      parsedPreview.stories.forEach((s, idx) => {
                        const charMatch = characters.find((c) => c.no === s.id);
                        if (charMatch) {
                          reset[idx] = { targetNo: charMatch.no, updateName: false };
                        } else {
                          const candidate = unregisteredNyans[idx];
                          reset[idx] = { targetNo: candidate ? candidate.no : s.id, updateName: true };
                        }
                      });
                      setStagedAssignments(reset);
                    }}
                    className="p-1.5 hover:bg-[#EFECE4] text-[#7A726A] rounded-lg text-xs transition cursor-pointer"
                    title="初期設定に戻す"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Staged Stories List */}
              <div className="max-h-64 overflow-y-auto divide-y divide-[#EFECE4] text-xs">
                {parsedPreview.stories.map((story, idx) => {
                  const currentTarget = stagedAssignments[idx];
                  const targetNo = currentTarget ? currentTarget.targetNo : story.id;
                  const targetChar = characters.find((c) => c.no === targetNo);
                  const isUnregistered = targetChar && !registeredStoryMap[String(targetChar.no)];

                  return (
                    <div
                      key={idx}
                      className="py-2 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#FAF8F5] rounded-lg transition"
                    >
                      {/* Left: Original Story Info */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-[#EFECE4] text-[#5A524A] font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-[#2E2824] truncate flex items-center gap-1.5">
                            <span>{story.name}</span>
                            <span className="text-[10px] text-[#A8A096] font-mono">
                              (元JSON ID: {story.id})
                            </span>
                          </div>
                          <div className="text-[10px] text-[#7A726A] truncate">
                            {story.week_info?.week_title || `${story.week_info?.days?.length || 0}日分`}
                          </div>
                        </div>
                      </div>

                      {/* Right: Target Assignment Select */}
                      <div className="flex items-center gap-2 shrink-0">
                        <ArrowRight className="w-3.5 h-3.5 text-[#A8A096] hidden sm:inline" />
                        <div className="flex items-center gap-1.5">
                          <select
                            value={targetNo}
                            onChange={(e) => {
                              const newNo = parseInt(e.target.value, 10);
                              setStagedAssignments((prev) => ({
                                ...prev,
                                [idx]: {
                                  targetNo: newNo,
                                  updateName: prev[idx]?.updateName ?? true,
                                },
                              }));
                            }}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold focus:outline-none ${
                              isUnregistered
                                ? 'bg-[#FFF8EE] border-[#E9BF8C] text-[#8C5A3E]'
                                : 'bg-white border-[#DDD7C8] text-[#3A342F]'
                            }`}
                          >
                            <optgroup label="🌟 未登録のにゃんこ (優先)">
                              {unregisteredNyans.map((c) => (
                                <option key={c.no} value={c.no}>
                                  未登録 No.{c.no} {c.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="登録済みのにゃんこ">
                              {characters
                                .filter((c) => !!registeredStoryMap[String(c.no)])
                                .map((c) => (
                                  <option key={c.no} value={c.no}>
                                    登録済 No.{c.no} {c.name}
                                  </option>
                                ))}
                            </optgroup>
                          </select>

                          <label className="flex items-center gap-1 text-[11px] text-[#5A524A] cursor-pointer whitespace-nowrap pl-1">
                            <input
                              type="checkbox"
                              checked={currentTarget?.updateName ?? true}
                              onChange={(e) => {
                                setStagedAssignments((prev) => ({
                                  ...prev,
                                  [idx]: {
                                    targetNo: prev[idx]?.targetNo ?? targetNo,
                                    updateName: e.target.checked,
                                  },
                                }));
                              }}
                              className="rounded text-[#487560]"
                            />
                            <span>名前同期</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  {/* Stream from unmapped archive banner */}
                  {unmappedList && unmappedList.length > 0 && (
                    <div className="p-3 bg-[#F8F4EE] border border-[#DDD7C8] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Archive className="w-4 h-4 text-[#8C5A3E] shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-[#4E2E17]">
                            未紐付け保管庫から物語を流し込んで割り付け
                          </span>
                          <p className="text-[10px] text-[#8C5A3E] truncate">
                            保管庫（{unmappedList.length}件）の会話劇をこのにゃんこ（No.{editingNyan.no} {editingNyan.name}）に設定します
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <select
                          value={archiveSourceIdToLoad}
                          onChange={(e) => setArchiveSourceIdToLoad(e.target.value)}
                          className="text-xs bg-white border border-[#DDD7C8] rounded-lg px-2 py-1.5 text-[#3E3833] focus:outline-none focus:border-[#8C5A3E] flex-1 sm:w-56"
                        >
                          <option value="">-- 保管庫の物語を選択 --</option>
                          {unmappedList.map((u) => (
                            <option key={u.oldId} value={u.oldId}>
                              旧#{u.oldId} {u.name} ({u.daysCount}話)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleLoadArchiveIntoSingleEditor}
                          disabled={!archiveSourceIdToLoad || isLoadingArchiveDetail}
                          className="px-3 py-1.5 bg-[#8C5A3E] hover:bg-[#73472F] text-white rounded-lg text-xs font-bold transition disabled:opacity-50 shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          <FolderInput className={`w-3.5 h-3.5 ${isLoadingArchiveDetail ? 'animate-spin' : ''}`} />
                          <span>流し込む</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {loadedArchiveOldId && (
                    <div className="flex items-center justify-between p-2.5 bg-[#EAF0EC] border border-[#C2DACB] rounded-xl text-xs text-[#245C3B]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
                        <span>旧#{loadedArchiveOldId}の物語データを読み込みました</span>
                      </div>
                      <label className="flex items-center gap-1 text-[11px] font-bold text-[#245C3B] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deleteArchiveOnSave}
                          onChange={(e) => setDeleteArchiveOnSave(e.target.checked)}
                          className="rounded text-[#487560]"
                        />
                        <span>保存時に保管庫から削除する（推奨）</span>
                      </label>
                    </div>
                  )}

                  <p className="text-[11px] text-[#7A726A]">
                    このにゃんこ専用の物語JSONです。メッセージのセリフや話数、登場人物などを直接編集して「保存」できます。
                  </p>
                  <textarea
                    rows={13}
                    value={editingJsonText}
                    onChange={(e) => setEditingJsonText(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-white border border-[#DDD7C8] rounded-xl text-[#2E2824] focus:outline-none focus:border-[#487560] leading-relaxed"
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#EFECE4] border-t border-[#DDD7C8] flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingNyan(null)}
                  className="px-4 py-2 bg-white hover:bg-[#FAF8F5] text-[#5A524A] border border-[#DDD7C8] rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  キャンセル
                </button>
                {(() => {
                  const est = estimateObjectWriteCost('story', { id: editingNyan.no, text: editingJsonText });
                  return (
                    <span className="text-[11px] text-[#7A726A] bg-white px-2.5 py-1 rounded-lg border border-[#DDD7C8] font-mono">
                      想定書込: <strong className="text-[#487560]">{est.estimatedWrites}回</strong> ({est.kb} KB)
                    </span>
                  );
                })()}
              </div>

              <button
                onClick={handleSaveSingleStory}
                disabled={isSavingSingleStory || isLoadingSingleStory}
                className="px-5 py-2 bg-[#487560] hover:bg-[#3B6350] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
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

      {/* ============================================================ */}
      {/* MODAL 3: Synced Nyans List Display Modal                     */}
      {/* ============================================================ */}
      {showSyncedModal && syncedNyansList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FAF8F4] w-full max-w-2xl max-h-[85vh] rounded-2xl border-2 border-[#3E3833] shadow-[4px_4px_0px_#3E3833] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-[#EAF0EC] border-b border-[#C6D8CD] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#487560] text-white rounded-xl">
                  <ListChecks className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-bold text-sm text-[#234A35]">
                    同期したにゃんこ一覧（全{syncedNyansList.length}体）
                  </h4>
                  <p className="text-xs text-[#487560]">
                    Firestoreから目録に同期・確認できたにゃんこの名前と話数です
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncedModal(false)}
                className="p-1.5 hover:bg-[#D9E6DD] rounded-lg text-[#234A35] transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Nyans List Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2 max-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {syncedNyansList.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-white rounded-xl border border-[#DDD7C8] flex items-center justify-between text-xs hover:border-[#487560] transition shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-[#7D756D] text-[11px] shrink-0">
                        No.{String(item.id).padStart(3, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[#2E2824] truncate">
                          {item.name}
                        </div>
                        {item.title && (
                          <div className="text-[10px] text-[#7D756D] truncate">
                            {item.title}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 bg-[#EAF0EC] text-[#245C3B] font-bold text-[10px] px-2 py-0.5 rounded-full border border-[#C6D8CD]">
                      {item.daysCount}話
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-[#ECE7DC] border-t border-[#DDD7C8] flex justify-between items-center">
              <span className="text-xs text-[#6B6259] font-medium">
                全 <strong className="text-[#3E3833]">{syncedNyansList.length}</strong> 体が正常に目録化されています
              </span>
              <button
                onClick={() => setShowSyncedModal(false)}
                className="px-5 py-2 bg-[#3A342F] hover:bg-[#23201D] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: Unmapped Legacy Stories Archive Modal               */}
      {/* ============================================================ */}
      {showUnmappedModal && unmappedList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FAF8F4] w-full max-w-2xl max-h-[85vh] rounded-2xl border-2 border-[#3E3833] shadow-[4px_4px_0px_#3E3833] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-[#F5EDE1] border-b border-[#D8C7B0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#8C5A3E] text-white rounded-xl">
                  <Archive className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-bold text-sm text-[#4E2E17]">
                    未紐付け物語保管庫（全{unmappedList.length}件）
                  </h4>
                  <p className="text-xs text-[#8C5A3E]">
                    現在の図鑑（265体）に存在しない旧リストの物語データです。安全に退避・保管されています。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnmappedModal(false)}
                className="p-1.5 hover:bg-[#EADBCA] rounded-lg text-[#4E2E17] transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2 max-h-[60vh]">
              <div className="text-xs text-[#7D6B57] bg-[#FFF9F2] p-2.5 rounded-xl border border-[#EADBCA] mb-2 flex items-center justify-between gap-2">
                <div>
                  ※ 現在の図鑑（265体）に名前が一致しなかった旧物語データです。各物語の「割付」ボタンを押すと、現在物語が未登録のにゃんこを選んで正式に割り当て登録できます。
                </div>
                <div className="shrink-0 font-bold text-[#8C5A3E]">
                  未登録にゃんこ: {unregisteredNyans.length}体
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {unmappedList.map((item) => (
                  <div
                    key={item.oldId}
                    className="p-3 bg-white rounded-xl border border-[#DDD7C8] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-[#8C5A3E] transition shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[#8C5A3E] text-[10px] font-bold shrink-0 bg-[#F5EDE1] px-2 py-1 rounded-md border border-[#EADBCA]">
                        旧#{item.oldId}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[#2E2824] truncate flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <span className="shrink-0 bg-[#F5EDE1] text-[#8C5A3E] font-bold text-[10px] px-2 py-0.5 rounded-full border border-[#D8C7B0]">
                            {item.daysCount}話
                          </span>
                        </div>
                        {item.motif && (
                          <div className="text-[10px] text-[#7D756D] truncate">
                            {item.motif}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartAssignArchiveStory(item)}
                      className="px-3 py-1.5 bg-[#8C5A3E] hover:bg-[#73472F] text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer active:scale-95"
                      title="現在の未登録にゃんこを選んでこの物語を正式割り当て"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>未登録にゃんこに割付</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-[#ECE7DC] border-t border-[#DDD7C8] flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-[#6B6259]">
                <span>
                  残り保管: <strong className="text-[#3E3833]">{unmappedList.length}</strong> 件
                </span>
                {pendingMetaCount > 0 && (
                  <span className="bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
                    <Zap className="w-3 h-3 text-[#2E7D32]" />
                    {pendingMetaCount}件割付済 (省エネ保留中)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {pendingMetaCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSavePendingMeta}
                    disabled={isSavingPendingMeta}
                    className="px-3.5 py-1.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="これまでの割付結果を目録にまとめて1回でクラウド保存します"
                  >
                    <Save className={`w-3.5 h-3.5 ${isSavingPendingMeta ? 'animate-spin' : ''}`} />
                    <span>{isSavingPendingMeta ? '保存中...' : '目録をクラウド保存'}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowUnmappedModal(false)}
                  className="px-5 py-1.5 bg-[#3A342F] hover:bg-[#23201D] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: Assign Unmapped Archive Story to Unregistered Nyan  */}
      {/* ============================================================ */}
      {assigningArchiveStory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FAF8F4] w-full max-w-lg rounded-2xl border-2 border-[#3E3833] shadow-[4px_4px_0px_#3E3833] flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-[#F5EDE1] border-b border-[#D8C7B0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#8C5A3E] text-white rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-bold text-sm text-[#4E2E17]">
                    未登録にゃんこへの物語割り付け
                  </h4>
                  <p className="text-xs text-[#8C5A3E]">
                    保管庫の物語を正式なにゃんこに割り当てて登録します
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssigningArchiveStory(null)}
                className="p-1.5 hover:bg-[#EADBCA] rounded-lg text-[#4E2E17] transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Target story details */}
            <div className="p-3 bg-[#EFE6D8] border-b border-[#DDD7C8] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono bg-[#8C5A3E] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                  旧#{assigningArchiveStory.oldId}
                </span>
                <span className="font-black text-[#3E3833]">
                  {assigningArchiveStory.name}
                </span>
                {assigningArchiveStory.motif && (
                  <span className="text-[11px] text-[#6B5745]">
                    （{assigningArchiveStory.motif}）
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-[#8C5A3E]">
                {assigningArchiveStory.daysCount}話分
              </span>
            </div>

            {/* Body: Select unregistered nyan */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#3E3833]">
                  割り付け先のにゃんこを選択（未登録：{unregisteredNyans.length}体）:
                </span>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#A8A096] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Noや名前、モチーフで未登録にゃんこを絞り込み..."
                  value={assignSearchQuery}
                  onChange={(e) => setAssignSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#DDD7C8] rounded-xl text-xs text-[#3E3833] focus:outline-none focus:border-[#8C5A3E]"
                />
              </div>

              {/* Unregistered Nyans List */}
              <div className="max-h-56 overflow-y-auto border border-[#DDD7C8] rounded-xl divide-y divide-[#EFECE4] bg-white">
                {unregisteredNyans
                  .filter((c) => {
                    if (!assignSearchQuery.trim()) return true;
                    const q = assignSearchQuery.toLowerCase().trim();
                    return (
                      String(c.no).includes(q) ||
                      c.name.toLowerCase().includes(q) ||
                      c.reading.toLowerCase().includes(q) ||
                      (c.motif || '').toLowerCase().includes(q)
                    );
                  })
                  .map((nyan) => {
                    const isSelected = assignTargetNyanNo === nyan.no;
                    return (
                      <div
                        key={nyan.no}
                        onClick={() => setAssignTargetNyanNo(nyan.no)}
                        className={`p-2.5 flex items-center justify-between gap-2.5 cursor-pointer text-xs transition ${
                          isSelected
                            ? 'bg-[#FDF6ED] text-[#8C5A3E] font-bold border-l-4 border-[#8C5A3E]'
                            : 'hover:bg-[#FAF8F5] text-[#3E3833]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#DDD7C8] flex items-center justify-center shrink-0 overflow-hidden">
                            {nyan.customImageUrl ? (
                              <img
                                src={nyan.customImageUrl}
                                alt={nyan.name}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="font-mono text-[10px] font-bold text-[#A8A096]">
                                #{nyan.no}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[11px] text-[#7A726A]">
                                No.{nyan.no}
                              </span>
                              <span className="font-black truncate">{nyan.name}</span>
                            </div>
                            {nyan.motif && (
                              <div className="text-[10px] text-[#9A9288] truncate">
                                {nyan.motif}
                              </div>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="p-1 bg-[#8C5A3E] text-white rounded-full shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Options */}
              <div className="space-y-2 bg-[#F5EDE1] p-3 rounded-xl border border-[#EADBCA] text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#4E2E17]">
                  <input
                    type="checkbox"
                    checked={assignRenameToMaster}
                    onChange={(e) => setAssignRenameToMaster(e.target.checked)}
                    className="rounded text-[#8C5A3E]"
                  />
                  <span>
                    物語内の主役名をマスターの名前に同期する（推奨）
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#4E2E17]">
                  <input
                    type="checkbox"
                    checked={assignDeleteFromArchive}
                    onChange={(e) => setAssignDeleteFromArchive(e.target.checked)}
                    className="rounded text-[#8C5A3E]"
                  />
                  <span>
                    正式登録完了後に保管庫から削除する（推奨）
                  </span>
                </label>
                <div className="text-[11px] text-[#2E7D32] bg-[#E8F5E9] p-2 rounded-lg border border-[#C8E6C9] flex items-center gap-1.5 font-medium">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    💡 <strong>書き込み枠節約モード</strong>：目録の同期は手元で即座に行われ、クラウド全体の目録更新は作業の最後にまとめて1回のみ実行されます。
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-[#ECE7DC] border-t border-[#DDD7C8] flex justify-between items-center">
              <button
                type="button"
                onClick={() => setAssigningArchiveStory(null)}
                className="px-4 py-2 bg-white hover:bg-[#FAF8F5] text-[#5A524A] border border-[#DDD7C8] rounded-xl text-xs font-bold transition cursor-pointer"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={handleConfirmAssignArchiveStory}
                disabled={!assignTargetNyanNo || isAssigningArchive}
                className="px-5 py-2 bg-[#8C5A3E] hover:bg-[#73472F] text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className={`w-4 h-4 ${isAssigningArchive ? 'animate-spin' : ''}`} />
                <span>
                  {isAssigningArchive
                    ? '割り当て中...'
                    : assignTargetNyanNo
                    ? `No.${assignTargetNyanNo} に割り当てて正式登録`
                    : 'にゃんこを選択してください'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
