import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  User,
  UserCheck,
  UserPlus,
  Trash2,
  RotateCcw,
  Eye,
  Search,
  Sparkles,
  RefreshCw,
  Database,
  Cloud,
  HardDrive,
  Clock,
  MapPin,
  Heart,
  Smile,
  Coffee,
  Plane,
  BookOpen,
  Package,
  Code,
  Copy,
  Check,
  Download,
  AlertTriangle,
  X,
  CheckCircle2,
  ChevronRight,
  Activity,
  Zap,
  Flame,
  Info,
  ExternalLink,
} from 'lucide-react';
import { NyanCharacter, GameSaveData, LocationId } from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';
import {
  UserDetailData,
  fetchAllRegisteredUsers,
  deleteUserAccount,
  resetUserAccount,
  createNewUserAccount,
  setActiveUserId,
  getActiveUserId,
  sanitizeUserId,
  isSystemUserId,
} from '../services/userService';
import { NyanIllustration } from './NyanIllustration';
import { getAssetUrl } from '../utils/assetPath';
import confetti from 'canvas-confetti';

interface AdminUserManagementProps {
  characters: NyanCharacter[];
  saveData?: GameSaveData;
  onUpdateSaveData: (updater: (prev: GameSaveData) => GameSaveData, isImmediate?: boolean) => void;
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onSwitchUser?: (newUserId: string | null) => void;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  characters,
  saveData,
  onUpdateSaveData,
  openConfirm,
  onSwitchUser,
}) => {
  const [users, setUsers] = useState<UserDetailData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Inspector & Modal States
  const [selectedUser, setSelectedUser] = useState<UserDetailData | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'nyans' | 'diary' | 'inventory' | 'json'>('overview');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserIdInput, setNewUserIdInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const activeUserId = getActiveUserId();

  // Load all users
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const data = await fetchAllRegisteredUsers(characters);
      setUsers(data);
      // If a user detail modal is open, refresh its data
      if (selectedUser) {
        const refreshed = data.find((u) => u.userId === selectedUser.userId);
        if (refreshed) {
          setSelectedUser(refreshed);
        }
      }
    } catch (err: any) {
      console.error('Error loading users:', err);
      setStatusMessage({ type: 'error', text: 'ユーザー一覧の読み込みに失敗しました' });
    } finally {
      setIsLoading(false);
    }
  }, [characters, selectedUser]);

  useEffect(() => {
    loadUsers();
  }, []);

  // Filtered users by search query (strictly excluding system metadata IDs)
  const filteredUsers = useMemo(() => {
    const validUsers = users.filter((u) => !isSystemUserId(u.userId));
    if (!searchQuery.trim()) return validUsers;
    const q = searchQuery.trim().toLowerCase();
    return validUsers.filter(
      (u) =>
        u.userId.toLowerCase().includes(q) ||
        u.kenchiko.currentLocation.toLowerCase().includes(q) ||
        (u.companionNyan && u.companionNyan.name.toLowerCase().includes(q)) ||
        u.kenchiko.currentActivityTitle.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // Aggregate stats across all users (strictly excluding system metadata IDs)
  const totalStats = useMemo(() => {
    const validUsers = users.filter((u) => !isSystemUserId(u.userId));
    const totalUsersCount = validUsers.length;
    const totalEncounters = validUsers.reduce((sum, u) => sum + (u.stats.totalEncounters || 0), 0);
    const totalSnacks = validUsers.reduce((sum, u) => sum + (u.stats.totalSnacksEaten || 0), 0);
    const totalTrips = validUsers.reduce((sum, u) => sum + (u.stats.totalTrips || 0), 0);
    const maxDiscovered = Math.max(0, ...validUsers.map((u) => u.discoveredCount));
    return {
      totalUsersCount,
      totalEncounters,
      totalSnacks,
      totalTrips,
      maxDiscovered,
    };
  }, [users]);

  // Handle Switch User
  const handleSwitchToUser = (targetUserId: string) => {
    const isDef = targetUserId === 'default';
    const newId = isDef ? null : targetUserId;
    setActiveUserId(newId);
    if (onSwitchUser) {
      onSwitchUser(newId);
    } else {
      window.location.reload();
    }
  };

  // Handle Delete User
  const handleDeleteUser = (userToDelete: UserDetailData) => {
    if (isSystemUserId(userToDelete.userId)) {
      setStatusMessage({ type: 'error', text: 'システム管理ドキュメントは削除できません' });
      return;
    }

    if (userToDelete.userId === 'default') {
      openConfirm(
        'デフォルトユーザーの初期化',
        '「default」ユーザーはシステムの基本ユーザーです。完全削除の代わりに、データを新規初期状態にリセット（初期化）しますか？',
        async () => {
          try {
            const res = await resetUserAccount(
              'default',
              characters,
              saveData?.asobiList
            );
            if (res.success && res.freshData) {
              if (userToDelete.isCurrent) {
                onUpdateSaveData(() => res.freshData!, true);
              }
              setStatusMessage({ type: 'success', text: 'defaultユーザーを初期状態にリセットしました' });
              loadUsers();
            } else {
              setStatusMessage({ type: 'error', text: res.error || '初期化に失敗しました' });
            }
          } catch (err: any) {
            setStatusMessage({ type: 'error', text: err?.message || '初期化エラー' });
          }
        }
      );
      return;
    }

    openConfirm(
      `ユーザー「${userToDelete.userId}」の削除`,
      `ユーザー「${userToDelete.userId}」を完全に消去しますか？\n・FirestoreクラウドDB (${userToDelete.docId})\n・端末ローカルバックアップ\nのすべてのゲーム進行データ（図鑑・日記・持ち物）が完全に消去されます。この操作は取り消せません。`,
      async () => {
        try {
          const res = await deleteUserAccount(userToDelete.userId);
          if (res.success) {
            confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
            setStatusMessage({ type: 'success', text: `ユーザー「${userToDelete.userId}」を正常に削除しました` });
            if (selectedUser?.userId === userToDelete.userId) {
              setSelectedUser(null);
            }
            if (userToDelete.isCurrent) {
              // Reset current user to default
              setActiveUserId(null);
              if (onSwitchUser) onSwitchUser(null);
              else window.location.reload();
            } else {
              loadUsers();
            }
          } else {
            setStatusMessage({ type: 'error', text: res.error || '削除に失敗しました' });
          }
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err?.message || '削除エラー' });
        }
      }
    );
  };

  // Handle Reset User
  const handleResetUser = (userToReset: UserDetailData) => {
    openConfirm(
      `ユーザー「${userToReset.userId}」のデータ初期化`,
      `ユーザー「${userToReset.userId}」のゲームデータを初期状態にリセットしますか？\n・発見したにゃんこ図鑑\n・思い出絵日記\n・所持アイテム\nが初期状態（はじまりの状態）に戻ります。共通のけんちこ画像やあそびリストは保持されます。`,
      async () => {
        try {
          const res = await resetUserAccount(
            userToReset.userId,
            characters,
            saveData?.asobiList
          );
          if (res.success && res.freshData) {
            confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
            if (userToReset.isCurrent) {
              onUpdateSaveData(() => res.freshData!, true);
            }
            setStatusMessage({
              type: 'success',
              text: `ユーザー「${userToReset.userId}」のデータを初期化しました`,
            });
            loadUsers();
          } else {
            setStatusMessage({ type: 'error', text: res.error || '初期化に失敗しました' });
          }
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err?.message || '初期化エラー' });
        }
      }
    );
  };

  // Handle Create User
  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const clean = sanitizeUserId(newUserIdInput);
    if (!clean || isSystemUserId(clean)) {
      setCreateError('英数字、ひらがな、カタカナ、漢字等で1文字以上入力してください（システム予約名は使用できません）');
      return;
    }

    // Check if exists
    if (users.some((u) => u.userId.toLowerCase() === clean.toLowerCase())) {
      setCreateError(`ユーザー「${clean}」は既に存在します`);
      return;
    }

    try {
      const res = await createNewUserAccount(
        clean,
        characters,
        saveData?.asobiList
      );
      if (res.success && res.userId) {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
        setStatusMessage({
          type: 'success',
          text: `新規ユーザー「${res.userId}」を作成しました`,
        });
        setIsCreatingUser(false);
        setNewUserIdInput('');
        loadUsers();
      } else {
        setCreateError(res.error || '作成に失敗しました');
      }
    } catch (err: any) {
      setCreateError(err?.message || '作成エラー');
    }
  };

  // Copy raw JSON to clipboard
  const handleCopyJson = (user: UserDetailData) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(user.rawSaveData, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (_e) {
      // Fallback
    }
  };

  // Download raw JSON file
  const handleDownloadJson = (user: UserDetailData) => {
    try {
      const blob = new Blob([JSON.stringify(user.rawSaveData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kenchiko_user_${user.userId}_backup.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_e) {
      // Ignore
    }
  };

  const formatDateTime = (ts?: number) => {
    if (!ts) return '未記録';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}`;
  };

  const formatRelativeTime = (ts?: number) => {
    if (!ts) return '';
    const diffMs = Date.now() - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'たった今';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日前`;
  };

  const formatPlayTime = (sec: number) => {
    if (!sec || sec < 60) return `${sec || 0}秒`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}分`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}時間${m}分`;
  };

  const getLocationLabel = (locId: string) => {
    const loc = LOCATIONS[locId as LocationId];
    return loc ? loc.reading || loc.name : locId;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-[#FAF8F5] p-5 sm:p-6 rounded-2xl border border-[#DCD6C8] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#3E7B68] text-white shadow-sm shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-[#2E2824]">
                  ユーザー管理・データ分析コンソール
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAE5D9] text-[#5A524A] border border-[#D5CEBF]">
                  全 {users.length} ユーザー
                </span>
              </div>
              <p className="text-xs text-[#7A726A] mt-0.5">
                作成済みユーザーの一覧、進行状況・収集データ分析、データ初期化や削除の管理を行えます。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EFECE4] hover:bg-[#E4DFD3] text-[#3E3833] text-xs font-bold transition border border-[#D5CEBF] disabled:opacity-50"
              title="最新データを再読み込み"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>再読込</span>
            </button>
            <button
              onClick={() => {
                setIsCreatingUser(true);
                setCreateError(null);
                setNewUserIdInput('');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3E7B68] hover:bg-[#346757] text-white text-xs font-black shadow-sm transition active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>新規ユーザー作成</span>
            </button>
          </div>
        </div>

        {/* Global Stats Snapshot Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#EAE5D9]">
          <div className="p-3 bg-[#F4EFE6] rounded-xl border border-[#E0D9CB] flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#3E7B68]/10 text-[#3E7B68]">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-[#7A726A] font-bold">現在のプレイ中</div>
              <div className="text-xs font-black text-[#2E2824] truncate">
                @{activeUserId || 'default'}
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#F4EFE6] rounded-xl border border-[#E0D9CB] flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#C8744E]/10 text-[#C8744E]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-[#7A726A] font-bold">最高にゃんこ発見数</div>
              <div className="text-xs font-black text-[#2E2824]">
                {totalStats.maxDiscovered} / {characters.length} 匹
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#F4EFE6] rounded-xl border border-[#E0D9CB] flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#557A95]/10 text-[#557A95]">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-[#7A726A] font-bold">全ユーザー総おやつ回数</div>
              <div className="text-xs font-black text-[#2E2824]">
                {totalStats.totalSnacks} 回
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#F4EFE6] rounded-xl border border-[#E0D9CB] flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#8E6E53]/10 text-[#8E6E53]">
              <Plane className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-[#7A726A] font-bold">全ユーザー総おでかけ</div>
              <div className="text-xs font-black text-[#2E2824]">
                {totalStats.totalTrips} 回
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-[#EBF5EE] border-[#B7DECE] text-[#25664B]'
              : 'bg-[#FDF0EE] border-[#F2C7C2] text-[#A6372D]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:opacity-75 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9187]" />
          <input
            type="text"
            placeholder="ユーザーID、現在地、行動で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D5CEBF] focus:outline-none focus:border-[#3E7B68] text-[#2E2824]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A9187] hover:text-[#2E2824]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs text-[#7A726A] font-bold">
          {filteredUsers.length} 件 表示中
        </div>
      </div>

      {/* User Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#DCD6C8] space-y-3">
          <RefreshCw className="w-8 h-8 text-[#3E7B68] animate-spin mx-auto" />
          <p className="text-xs font-bold text-[#7A726A]">
            ユーザー一覧と進行データを読み込み中...
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-[#DCD6C8] space-y-2">
          <Users className="w-8 h-8 text-[#9A9187] mx-auto opacity-50" />
          <p className="text-sm font-bold text-[#2E2824]">該当するユーザーが見つかりません</p>
          <p className="text-xs text-[#7A726A]">
            検索ワードを変更するか、「新規ユーザー作成」から新しいユーザーを追加してください。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredUsers.map((user) => {
            const locName = getLocationLabel(user.kenchiko.currentLocation);
            const targetLocName = user.kenchiko.targetLocation
              ? getLocationLabel(user.kenchiko.targetLocation)
              : null;
            const isMoving = Boolean(user.kenchiko.targetLocation);
            const discoveryRatio = user.totalNyans > 0 ? (user.discoveredCount / user.totalNyans) * 100 : 0;

            return (
              <div
                key={user.userId}
                className={`p-4 sm:p-5 rounded-2xl border transition shadow-sm hover:shadow-md flex flex-col justify-between bg-white relative ${
                  user.isCurrent
                    ? 'border-[#3E7B68] ring-2 ring-[#3E7B68]/20'
                    : 'border-[#DCD6C8] hover:border-[#BDB5A4]'
                }`}
              >
                {/* Header: User ID & Badges */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#F0EBE1] border border-[#DCD6C8] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                      {user.rawSaveData?.kenchiko?.customImageUrl ? (
                        <img
                          src={getAssetUrl(user.rawSaveData.kenchiko.customImageUrl)}
                          alt="kenchiko"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-[#5A524A]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-[#2E2824]">
                          @{user.userId}
                        </span>
                        {user.userId === 'default' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#EAE5D9] text-[#5A524A]">
                            標準
                          </span>
                        )}
                        {user.isCurrent && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded-full bg-[#3E7B68] text-white shadow-sm animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                            現在プレイ中
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#7A726A] mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#9A9187]" />
                          {formatRelativeTime(user.lastSaved)}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-[#9A9187]">
                          {(user.dataSizeEstimate / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Storage Source Tag */}
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        user.source === 'both'
                          ? 'bg-[#EBF5EE] text-[#2F7357] border-[#C2E3D4]'
                          : user.source === 'firestore'
                          ? 'bg-[#EEF5FB] text-[#296898] border-[#C4DCF0]'
                          : 'bg-[#FAF4EB] text-[#8C6226] border-[#EADAC3]'
                      }`}
                    >
                      {user.source === 'both' ? (
                        <>
                          <Cloud className="w-3 h-3" />
                          <HardDrive className="w-3 h-3" />
                          <span>クラウド同期</span>
                        </>
                      ) : user.source === 'firestore' ? (
                        <>
                          <Cloud className="w-3 h-3" />
                          <span>クラウド</span>
                        </>
                      ) : (
                        <>
                          <HardDrive className="w-3 h-3" />
                          <span>端末ローカル</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Kenchiko Current State Box */}
                <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE5D9] space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#3E3833]">
                      <MapPin className="w-3.5 h-3.5 text-[#C8744E]" />
                      {isMoving ? (
                        <span className="text-[#C8744E]">
                          {locName} → {targetLocName} へ移動中
                        </span>
                      ) : (
                        <span>{locName} に滞在中</span>
                      )}
                    </div>

                    {user.companionNyan ? (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#3E7B68] bg-[#E8F3EE] px-2 py-0.5 rounded-md border border-[#D0E7DC]">
                        <span>一緒:</span>
                        <span>{user.companionNyan.name}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#9A9187]">ひとり</span>
                    )}
                  </div>

                  <p className="text-xs text-[#5A524A] italic line-clamp-2">
                    {user.kenchiko.monologue ? `「${user.kenchiko.monologue}」` : (user.kenchiko.currentActivityTitle || 'のんびり過ごしている')}
                  </p>
                </div>

                {/* Progress & Data Metrics */}
                <div className="grid grid-cols-4 gap-1.5 text-center mb-3">
                  <div className="p-2 rounded-xl bg-[#F8F6F2] border border-[#EAE5D9]">
                    <div className="text-[10px] text-[#7A726A]">発見にゃん</div>
                    <div className="text-xs font-black text-[#2E2824] mt-0.5">
                      {user.discoveredCount}
                      <span className="text-[9px] font-normal text-[#9A9187]">/{user.totalNyans}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#F8F6F2] border border-[#EAE5D9]">
                    <div className="text-[10px] text-[#7A726A]">持ち物</div>
                    <div className="text-xs font-black text-[#2E2824] mt-0.5">
                      {user.inventoryCount}
                      <span className="text-[9px] font-normal text-[#9A9187]">個</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#F8F6F2] border border-[#EAE5D9]">
                    <div className="text-[10px] text-[#7A726A]">絵日記</div>
                    <div className="text-xs font-black text-[#2E2824] mt-0.5">
                      {user.diaryCount}
                      <span className="text-[9px] font-normal text-[#9A9187]">冊</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#F8F6F2] border border-[#EAE5D9]">
                    <div className="text-[10px] text-[#7A726A]">おでかけ</div>
                    <div className="text-xs font-black text-[#2E2824] mt-0.5">
                      {user.stats.totalTrips || 0}
                      <span className="text-[9px] font-normal text-[#9A9187]">回</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EAE5D9]">
                  <div className="flex items-center gap-1.5">
                    {!user.isCurrent && (
                      <button
                        onClick={() => handleSwitchToUser(user.userId)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3E7B68] hover:bg-[#346757] text-white text-xs font-bold transition shadow-xs"
                        title="このユーザーに切り替えてプレイ"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>切り替え</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setDetailTab('overview');
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EFECE4] hover:bg-[#E2DDD0] text-[#3E3833] text-xs font-bold transition border border-[#D5CEBF]"
                      title="詳細データ・収集ログを見る"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#5A524A]" />
                      <span>詳細データ</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleResetUser(user)}
                      className="p-1.5 rounded-lg text-[#9A9187] hover:text-[#C8744E] hover:bg-[#FAF2EE] transition"
                      title="データを初期化（リセット）"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="p-1.5 rounded-lg text-[#9A9187] hover:text-[#C85A53] hover:bg-[#FDF0EE] transition"
                      title={user.userId === 'default' ? 'デフォルトユーザーの初期化' : 'ユーザー完全削除'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Detail & Analytics Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#2E2824]/75 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#FAF8F5] rounded-3xl border border-[#3E3833] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#ECE7DC] px-5 py-4 border-b border-[#D5CEBF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#3E7B68] text-white flex items-center justify-center font-black">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-[#2E2824]">
                      ユーザー詳細: @{selectedUser.userId}
                    </h3>
                    {selectedUser.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#3E7B68] text-white">
                        現在操作中
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#7A726A] font-mono">
                    Firestore ID: {selectedUser.docId} • 最終更新: {formatDateTime(selectedUser.lastSaved)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-xl hover:bg-[#DCD6C8] text-[#5A524A] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Tabs Navigation */}
            <div className="flex border-b border-[#D5CEBF] bg-[#F2EDE2] px-5 pt-2 gap-2 overflow-x-auto">
              <button
                onClick={() => setDetailTab('overview')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-black transition border-t-2 border-x shrink-0 ${
                  detailTab === 'overview'
                    ? 'bg-[#FAF8F5] text-[#2E2824] border-t-[#3E7B68] border-x-[#D5CEBF] -mb-[1px]'
                    : 'text-[#7A726A] hover:text-[#2E2824] border-transparent'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-[#3E7B68]" />
                <span>ステータス & 統計</span>
              </button>

              <button
                onClick={() => setDetailTab('nyans')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-black transition border-t-2 border-x shrink-0 ${
                  detailTab === 'nyans'
                    ? 'bg-[#FAF8F5] text-[#2E2824] border-t-[#C8744E] border-x-[#D5CEBF] -mb-[1px]'
                    : 'text-[#7A726A] hover:text-[#2E2824] border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C8744E]" />
                <span>発見にゃんこ ({selectedUser.discoveredCount}匹)</span>
              </button>

              <button
                onClick={() => setDetailTab('diary')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-black transition border-t-2 border-x shrink-0 ${
                  detailTab === 'diary'
                    ? 'bg-[#FAF8F5] text-[#2E2824] border-t-[#557A95] border-x-[#D5CEBF] -mb-[1px]'
                    : 'text-[#7A726A] hover:text-[#2E2824] border-transparent'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-[#557A95]" />
                <span>思い出絵日記 ({selectedUser.diaryCount}件)</span>
              </button>

              <button
                onClick={() => setDetailTab('inventory')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-black transition border-t-2 border-x shrink-0 ${
                  detailTab === 'inventory'
                    ? 'bg-[#FAF8F5] text-[#2E2824] border-t-[#D99B3D] border-x-[#D5CEBF] -mb-[1px]'
                    : 'text-[#7A726A] hover:text-[#2E2824] border-transparent'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-[#D99B3D]" />
                <span>所持品 ({selectedUser.inventoryCount}個)</span>
              </button>

              <button
                onClick={() => setDetailTab('json')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs font-black transition border-t-2 border-x shrink-0 ${
                  detailTab === 'json'
                    ? 'bg-[#FAF8F5] text-[#2E2824] border-t-[#8E6E53] border-x-[#D5CEBF] -mb-[1px]'
                    : 'text-[#7A726A] hover:text-[#2E2824] border-transparent'
                }`}
              >
                <Code className="w-3.5 h-3.5 text-[#8E6E53]" />
                <span>生データ (JSON)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              {/* TAB 1: OVERVIEW */}
              {detailTab === 'overview' && (
                <div className="space-y-4">
                  {/* Kenchiko Live State */}
                  <div className="p-4 bg-white rounded-2xl border border-[#DCD6C8] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#2E2824] flex items-center gap-1.5">
                        <Smile className="w-4 h-4 text-[#3E7B68]" />
                        けんちこの現在のステータス
                      </span>
                      <span className="text-[11px] text-[#7A726A]">
                        {selectedUser.companionNyan ? `一緒: ${selectedUser.companionNyan.name}` : 'ひとり'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]">
                        <div className="text-[10px] text-[#7A726A]">現在地</div>
                        <div className="font-bold text-[#2E2824] mt-0.5">
                          📍 {getLocationLabel(selectedUser.kenchiko.currentLocation)}
                        </div>
                      </div>

                      <div className="p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]">
                        <div className="text-[10px] text-[#7A726A]">現在のあそび・行動</div>
                        <div className="font-bold text-[#2E2824] mt-0.5 truncate">
                          {selectedUser.kenchiko.currentActivityTitle}
                        </div>
                      </div>
                    </div>

                    {selectedUser.kenchiko.monologue && (
                      <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#EADAC3] text-xs text-[#5A524A] italic">
                        💭 「{selectedUser.kenchiko.monologue}」
                      </div>
                    )}
                  </div>

                  {/* Aggregate Lifetime Stats */}
                  <div className="p-4 bg-white rounded-2xl border border-[#DCD6C8] space-y-3">
                    <span className="text-xs font-black text-[#2E2824] flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[#C8744E]" />
                      プレイ記録・累計メトリクス
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                      <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]">
                        <div className="text-[10px] text-[#7A726A]">総遭遇回数</div>
                        <div className="text-sm font-black text-[#2E2824] mt-1">
                          {selectedUser.stats.totalEncounters || 0} <span className="text-xs font-normal">回</span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]">
                        <div className="text-[10px] text-[#7A726A]">食べたおやつ</div>
                        <div className="text-sm font-black text-[#2E2824] mt-1">
                          {selectedUser.stats.totalSnacksEaten || 0} <span className="text-xs font-normal">回</span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]">
                        <div className="text-[10px] text-[#7A726A]">おひるね合計</div>
                        <div className="text-sm font-black text-[#2E2824] mt-1">
                          {selectedUser.stats.totalNapMinutes || 0} <span className="text-xs font-normal">分</span>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9]">
                        <div className="text-[10px] text-[#7A726A]">おでかけ回数</div>
                        <div className="text-sm font-black text-[#2E2824] mt-1">
                          {selectedUser.stats.totalTrips || 0} <span className="text-xs font-normal">回</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE5D9] flex items-center justify-between text-xs">
                      <span className="text-[#7A726A]">累計プレイ時間</span>
                      <span className="font-bold text-[#2E2824]">
                        {formatPlayTime(selectedUser.kenchiko.totalPlayTimeSec)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DISCOVERED NYANS */}
              {detailTab === 'nyans' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#7A726A]">
                      全 {selectedUser.totalNyans} 匹中、
                      <strong className="text-[#2E2824] ml-1">{selectedUser.discoveredCount} 匹</strong> 発見済み
                    </span>
                    <span className="font-mono text-xs font-bold text-[#3E7B68]">
                      {((selectedUser.discoveredCount / (selectedUser.totalNyans || 1)) * 100).toFixed(1)}% 達成
                    </span>
                  </div>

                  {selectedUser.discoveredNyans.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-[#DCD6C8]">
                      <Sparkles className="w-8 h-8 text-[#9A9187] mx-auto opacity-40 mb-2" />
                      <p className="text-xs font-bold text-[#7A726A]">まだにゃんこに出会っていません</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {selectedUser.discoveredNyans.map((nyan) => (
                        <div
                          key={nyan.no}
                          className="p-2.5 bg-white rounded-xl border border-[#DCD6C8] flex items-center gap-2.5 shadow-2xs"
                        >
                          <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#EAE5D9] flex items-center justify-center shrink-0 overflow-hidden">
                            {nyan.imageUrl ? (
                              <img
                                src={getAssetUrl(nyan.imageUrl)}
                                alt={nyan.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Sparkles className="w-4 h-4 text-[#C8744E]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-mono text-[#9A9187]">No.{nyan.no}</div>
                            <div className="text-xs font-black text-[#2E2824] truncate">{nyan.name}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#C85A53] mt-0.5">
                              <Heart className="w-2.5 h-2.5 fill-current" />
                              <span>Lv.{nyan.friendshipLevel}</span>
                              <span className="text-[#7A726A]">({nyan.playCount}回)</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DIARY */}
              {detailTab === 'diary' && (
                <div className="space-y-3">
                  {selectedUser.diaries.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-[#DCD6C8]">
                      <BookOpen className="w-8 h-8 text-[#9A9187] mx-auto opacity-40 mb-2" />
                      <p className="text-xs font-bold text-[#7A726A]">まだ絵日記の記録がありません</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {selectedUser.diaries.map((diary, idx) => (
                        <div
                          key={diary.id || idx}
                          className="p-3.5 bg-white rounded-xl border border-[#DCD6C8] space-y-1.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-[#2E2824]">
                              <span>📅 {diary.dateFormatted}</span>
                              <span className="text-[#9A9187]">•</span>
                              <span>📍 {diary.locationName}</span>
                            </div>
                            {diary.nyanName && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF2EE] text-[#C8744E] border border-[#F0D5C9]">
                                🐾 {diary.nyanName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-[#3E3833]">
                            {diary.activityTitle}
                          </div>
                          <p className="text-xs text-[#5A524A] leading-relaxed bg-[#FAF8F5] p-2.5 rounded-lg border border-[#EAE5D9]">
                            {diary.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: INVENTORY */}
              {detailTab === 'inventory' && (
                <div className="space-y-3">
                  {selectedUser.inventory.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-[#DCD6C8]">
                      <Package className="w-8 h-8 text-[#9A9187] mx-auto opacity-40 mb-2" />
                      <p className="text-xs font-bold text-[#7A726A]">所持しているアイテムはありません</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {selectedUser.inventory.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-white rounded-xl border border-[#DCD6C8] flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{item.icon}</span>
                            <div>
                              <div className="text-xs font-black text-[#2E2824]">{item.name}</div>
                              {item.effectText && (
                                <div className="text-[10px] text-[#7A726A] line-clamp-1">
                                  {item.effectText}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-[#3E7B68] bg-[#E8F3EE] px-2 py-1 rounded-lg border border-[#D0E7DC]">
                              x {item.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: JSON RAW VIEW */}
              {detailTab === 'json' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#7A726A]">
                      生データJSON ({selectedUser.dataSizeEstimate} bytes)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyJson(selectedUser)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white border border-[#D5CEBF] hover:bg-[#FAF8F5] text-[#2E2824] transition font-bold"
                      >
                        {copiedJson ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#3E7B68]" />
                            <span>コピー完了</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>JSONコピー</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDownloadJson(selectedUser)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white border border-[#D5CEBF] hover:bg-[#FAF8F5] text-[#2E2824] transition font-bold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>保存</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-3.5 bg-[#2E2824] text-[#EFECE4] rounded-2xl text-[11px] font-mono overflow-x-auto max-h-[45vh] leading-relaxed">
                    {JSON.stringify(selectedUser.rawSaveData, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-[#ECE7DC] px-5 py-3.5 border-t border-[#D5CEBF] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResetUser(selectedUser)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#C8744E] text-xs font-bold border border-[#DCD6C8] transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>このユーザーを初期化</span>
                </button>
                <button
                  onClick={() => handleDeleteUser(selectedUser)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FDF0EE] text-[#C85A53] text-xs font-bold border border-[#DCD6C8] transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>削除</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!selectedUser.isCurrent && (
                  <button
                    onClick={() => {
                      handleSwitchToUser(selectedUser.userId);
                      setSelectedUser(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3E7B68] hover:bg-[#346757] text-white text-xs font-black shadow-sm transition"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>このユーザーに切り替えてプレイ</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 rounded-xl bg-[#EFECE4] hover:bg-[#E4DFD3] text-[#3E3833] text-xs font-bold border border-[#D5CEBF] transition"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New User Modal */}
      {isCreatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/75 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#FAF8F5] rounded-3xl border border-[#3E3833] shadow-2xl overflow-hidden">
            <div className="bg-[#ECE7DC] px-5 py-4 border-b border-[#D5CEBF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#3E7B68] text-white">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-[#2E2824]">新規ユーザーの作成</h3>
              </div>
              <button
                onClick={() => setIsCreatingUser(false)}
                className="p-1.5 rounded-xl hover:bg-[#DCD6C8] text-[#5A524A] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#2E2824]">
                  ユーザーID (識別名)
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: ken, chiko, yumi, taro, ゲスト1..."
                  value={newUserIdInput}
                  onChange={(e) => setNewUserIdInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D5CEBF] text-xs font-bold focus:outline-none focus:border-[#3E7B68] text-[#2E2824]"
                  autoFocus
                />
                <p className="text-[11px] text-[#7A726A]">
                  英数字、ひらがな、カタカナ、漢字が使えます。URLパラメータ（?user=名前）としても連携されます。
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#7A726A]">クイック候補:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['ken', 'chiko', 'yumi', 'taro', 'guest'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewUserIdInput(preset)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-[#D5CEBF] hover:border-[#3E7B68] text-[#3E3833] transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-[#FDF0EE] border border-[#F2C7C2] text-[#A6372D] text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFECE4] hover:bg-[#E4DFD3] text-[#3E3833] text-xs font-bold border border-[#D5CEBF] transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3E7B68] hover:bg-[#346757] text-white text-xs font-black shadow-sm transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>作成する</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
