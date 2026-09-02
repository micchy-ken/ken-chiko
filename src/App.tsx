import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  GameSaveData,
  KenchikoState,
  NyanCharacter,
  GiftItem,
  DiaryEntry,
  LocationId,
  TransportMethod,
} from './types';
import { DEFAULT_INITIAL_STATE } from './services/storage';
import {
  getRandomMonologue,
  generateNextActivity,
  startTransit,
  pickRandomLocation,
  pickRandomTransport,
} from './services/simulation';
import { LOCATIONS, TRANSPORT_METHODS } from './data/locations';
import {
  loadSavedFirebaseConfig,
  subscribeToFirebaseState,
  syncSaveDataToFirebase,
  fetchInitialFirebaseState,
  purgeLocalData,
  setQuotaStatusCallback,
  getIsQuotaExhausted,
  getFirebaseConnectionStatus,
  subscribeFirebaseConnectionStatus,
  testFirebaseConnection,
  FirebaseConnectionStatus,
} from './services/firebaseSync';
import {
  getSavedGoogleDocUrl,
  syncNyansFromGoogleDoc,
  DEFAULT_GOOGLE_DOC_URL,
} from './services/googleDocSync';

import { KenchikoStage } from './components/KenchikoStage';
import { KenchikoAvatar } from './components/KenchikoAvatar';
import { ZukanView } from './components/ZukanView';
import { ZukanDetailModal } from './components/ZukanDetailModal';
import { GiftItemModal } from './components/GiftItemModal';
import { TravelModal } from './components/TravelModal';
import { DiaryView } from './components/DiaryView';
import { DataSyncModal } from './components/DataSyncModal';
import { PencilSketchFilters } from './utils/pencilFilters';

import {
  Eye,
  BookOpen,
  Gift,
  BookMarked,
  Settings,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Main Game Save Data State (Pure Firestore Source of Truth)
  const [saveData, setSaveData] = useState<GameSaveData>(DEFAULT_INITIAL_STATE);
  const [isLoadingFirebase, setIsLoadingFirebase] = useState<boolean>(true);
  const [isFirebaseSynced, setIsFirebaseSynced] = useState<boolean>(false);
  const [isQuotaLimited, setIsQuotaLimited] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<FirebaseConnectionStatus>(getFirebaseConnectionStatus());
  const [isRetryingConnection, setIsRetryingConnection] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'stage' | 'zukan' | 'inventory' | 'diary' | 'sync'>('stage');

  // Time & Simulation Controls
  const [timeSpeed, setTimeSpeed] = useState<number>(1); // 1x, 5x, 30x, 60x
  const [remainingTimeSec, setRemainingTimeSec] = useState<number>(300);

  // Modal States
  const [selectedZukanNyan, setSelectedZukanNyan] = useState<NyanCharacter | null>(null);
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [showTravelModal, setShowTravelModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [newEncounterToast, setNewEncounterToast] = useState<NyanCharacter | null>(null);

  // Reference for avoiding echo saves from remote snapshot updates
  const isRemoteUpdateRef = useRef<boolean>(false);

  // 1. Initial Load & Realtime Firestore Subscription (Zero Local Cache)
  useEffect(() => {
    purgeLocalData();

    setQuotaStatusCallback((exhausted) => {
      setIsQuotaLimited(exhausted);
    });

    const unsubStatus = subscribeFirebaseConnectionStatus((status) => {
      setConnectionStatus(status);
    });

    let isMounted = true;

    // Fetch initial state from Firestore
    fetchInitialFirebaseState()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          isRemoteUpdateRef.current = true;
          setSaveData(res.data);
          const elapsedRealSec = Math.floor((Date.now() - res.data.kenchiko.activityStartedAt) / 1000);
          setRemainingTimeSec(Math.max(0, res.data.kenchiko.activityDurationSec - elapsedRealSec));
          setIsFirebaseSynced(true);
        }
        setIsLoadingFirebase(false);
      })
      .catch((err) => {
        console.warn('Firebase initial load note:', err);
        if (isMounted) setIsLoadingFirebase(false);
      });

    // Realtime listener with echo prevention
    const unsub = subscribeToFirebaseState(
      loadSavedFirebaseConfig(),
      (remoteData) => {
        if (!isMounted) return;
        isRemoteUpdateRef.current = true;
        setSaveData(remoteData);
        setIsFirebaseSynced(true);
        setIsLoadingFirebase(false);
      },
      (err) => {
        if (err?.name === 'FirebaseError' && (err.message.includes('Quota') || err.message.includes('resource-exhausted'))) {
          setIsQuotaLimited(true);
        }
      }
    );

    return () => {
      isMounted = false;
      unsub();
      unsubStatus();
    };
  }, []);

  // 2. Auto-sync Google Docs/Sheets on launch if configured (Triggered once on ready)
  useEffect(() => {
    if (isLoadingFirebase) return;
    const docUrl = getSavedGoogleDocUrl() || DEFAULT_GOOGLE_DOC_URL;
    if (docUrl && docUrl.trim().length > 0) {
      syncNyansFromGoogleDoc(docUrl, saveData.characters)
        .then((res) => {
          if (res.success && (res.addedCount > 0 || res.updatedCount > 0)) {
            const nextData: GameSaveData = {
              ...saveData,
              characters: res.updatedNyans,
              lastSaved: Date.now(),
            };
            setSaveData(nextData);
            syncSaveDataToFirebase(nextData).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [isLoadingFirebase]);

  // Current Companion Nyan
  const companionNyan = useMemo(() => {
    if (!saveData.kenchiko.currentCompanionNyanId) return null;
    return (
      saveData.characters.find((c) => c.no === saveData.kenchiko.currentCompanionNyanId) || null
    );
  }, [saveData.characters, saveData.kenchiko.currentCompanionNyanId]);

  // Primary Simulation Tick Loop (Local in-memory ticking without constant Firebase writes)
  useEffect(() => {
    if (isLoadingFirebase) return;

    const interval = setInterval(() => {
      setRemainingTimeSec((prev) => {
        const nextTime = prev - timeSpeed;

        if (nextTime <= 0) {
          // Current activity has completed! Transition to next activity.
          handleActivityCompletion();
          return 300;
        }

        return nextTime;
      });

      // Adjust hunger & stamina in memory for smooth animations
      setSaveData((prev) => {
        const curKenchiko = prev.kenchiko;
        const hungerDelta = curKenchiko.currentActivity === 'snacking' ? 0.05 : -0.02 * timeSpeed;
        const staminaDelta = curKenchiko.currentActivity === 'nap' ? 0.08 : -0.01 * timeSpeed;

        return {
          ...prev,
          kenchiko: {
            ...curKenchiko,
            hunger: Math.max(0, Math.min(100, curKenchiko.hunger + hungerDelta)),
            stamina: Math.max(0, Math.min(100, curKenchiko.stamina + staminaDelta)),
            totalPlayTimeSec: curKenchiko.totalPlayTimeSec + timeSpeed,
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeSpeed, saveData.kenchiko.currentActivity, saveData.kenchiko.currentLocation, isLoadingFirebase]);

  // Activity Completion Handler (Discrete Firebase push on activity change)
  const handleActivityCompletion = () => {
    setSaveData((prev) => {
      const curK = prev.kenchiko;
      let nextLocation = curK.currentLocation;
      let nextTargetLocation: LocationId | null = null;
      let nextTransport: TransportMethod | null = null;
      let nextCompanionId = curK.currentCompanionNyanId;

      const updatedCharacters = [...prev.characters];
      const updatedDiary = [...prev.diary];
      const updatedStats = { ...prev.stats };

      let nextData: GameSaveData;

      // Case A: Just arrived from transit
      if (curK.currentActivity === 'transit' && curK.targetLocation) {
        nextLocation = curK.targetLocation;
        nextTargetLocation = null;
        nextTransport = null;
        updatedStats.totalTrips += 1;

        const actResult = generateNextActivity(nextLocation, updatedCharacters, prev.asobiList);
        nextCompanionId = actResult.companionNyanId;

        if (actResult.newDiscoveredNyan) {
          const charIndex = updatedCharacters.findIndex(
            (c) => c.no === actResult.newDiscoveredNyan!.no
          );
          if (charIndex >= 0) {
            updatedCharacters[charIndex] = {
              ...updatedCharacters[charIndex],
              discovered: true,
              discoveryDate: new Date().toLocaleString('ja-JP'),
              playCount: 1,
              friendshipLevel: 1,
            };
            updatedStats.totalEncounters += 1;
            setNewEncounterToast(updatedCharacters[charIndex]);
            confetti({ particleCount: 35, spread: 80, origin: { y: 0.5 } });
          }
        }

        if (actResult.diaryText) {
          const locInfo = LOCATIONS[nextLocation] || LOCATIONS.living;
          updatedDiary.unshift({
            id: `diary_${Date.now()}`,
            timestamp: Date.now(),
            dateFormatted: new Date().toLocaleDateString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            locationName: locInfo.name,
            activityTitle: actResult.title,
            nyanId: nextCompanionId,
            nyanName: actResult.companionNyanId
              ? updatedCharacters.find((c) => c.no === actResult.companionNyanId)?.name || null
              : null,
            itemUsed: null,
            mood: curK.mood,
            text: actResult.diaryText,
          });
        }

        setRemainingTimeSec(actResult.durationSec);

        const compChar = nextCompanionId
          ? updatedCharacters.find((c) => c.no === nextCompanionId)
          : null;

        nextData = {
          ...prev,
          characters: updatedCharacters,
          diary: updatedDiary.slice(0, 50),
          stats: updatedStats,
          lastSaved: Date.now(),
          kenchiko: {
            ...curK,
            currentLocation: nextLocation,
            targetLocation: null,
            transportMethod: null,
            currentActivity: actResult.type,
            currentActivityTitle: actResult.title,
            activityStartedAt: Date.now(),
            activityDurationSec: actResult.durationSec,
            currentCompanionNyanId: nextCompanionId,
            monologue:
              actResult.customMonologue ||
              getRandomMonologue(
                actResult.type,
                nextLocation,
                null,
                prev.asobiList,
                compChar?.name
              ),
          },
        };
      } else {
        // Case B: Finished activity at current place
        const shouldMove = Math.random() < 0.45;

        if (shouldMove) {
          const dest = pickRandomLocation(curK.currentLocation);
          const transport = pickRandomTransport();
          const transitInfo = startTransit(curK.currentLocation, dest, transport);

          setRemainingTimeSec(transitInfo.durationSec);

          nextData = {
            ...prev,
            lastSaved: Date.now(),
            kenchiko: {
              ...curK,
              targetLocation: dest,
              transportMethod: transport,
              currentActivity: 'transit',
              currentActivityTitle: transitInfo.title,
              activityStartedAt: Date.now(),
              activityDurationSec: transitInfo.durationSec,
              currentCompanionNyanId: null,
              monologue: getRandomMonologue(
                'transit',
                curK.currentLocation,
                transport,
                prev.asobiList
              ),
            },
          };
        } else {
          const actResult = generateNextActivity(curK.currentLocation, updatedCharacters, prev.asobiList);
          nextCompanionId = actResult.companionNyanId;

          if (actResult.type === 'snacking') updatedStats.totalSnacksEaten += 1;
          if (actResult.type === 'nap') updatedStats.totalNapMinutes += Math.round(actResult.durationSec / 60);

          if (actResult.newDiscoveredNyan) {
            const charIndex = updatedCharacters.findIndex(
              (c) => c.no === actResult.newDiscoveredNyan!.no
            );
            if (charIndex >= 0) {
              updatedCharacters[charIndex] = {
                ...updatedCharacters[charIndex],
                discovered: true,
                discoveryDate: new Date().toLocaleString('ja-JP'),
                playCount: 1,
                friendshipLevel: 1,
              };
              updatedStats.totalEncounters += 1;
              setNewEncounterToast(updatedCharacters[charIndex]);
              confetti({ particleCount: 35, spread: 80, origin: { y: 0.5 } });
            }
          }

          if (actResult.diaryText) {
            const locInfo = LOCATIONS[curK.currentLocation] || LOCATIONS.living;
            updatedDiary.unshift({
              id: `diary_${Date.now()}`,
              timestamp: Date.now(),
              dateFormatted: new Date().toLocaleDateString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              locationName: locInfo.name,
              activityTitle: actResult.title,
              nyanId: nextCompanionId,
              nyanName: actResult.companionNyanId
                ? updatedCharacters.find((c) => c.no === actResult.companionNyanId)?.name || null
                : null,
              itemUsed: null,
              mood: curK.mood,
              text: actResult.diaryText,
            });
          }

          setRemainingTimeSec(actResult.durationSec);

          const compChar = nextCompanionId
            ? updatedCharacters.find((c) => c.no === nextCompanionId)
            : null;

          nextData = {
            ...prev,
            characters: updatedCharacters,
            diary: updatedDiary.slice(0, 50),
            stats: updatedStats,
            lastSaved: Date.now(),
            kenchiko: {
              ...curK,
              currentActivity: actResult.type,
              currentActivityTitle: actResult.title,
              activityStartedAt: Date.now(),
              activityDurationSec: actResult.durationSec,
              currentCompanionNyanId: nextCompanionId,
              monologue:
                actResult.customMonologue ||
                getRandomMonologue(
                  actResult.type,
                  curK.currentLocation,
                  null,
                  prev.asobiList,
                  compChar?.name
                ),
            },
          };
        }
      }

      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });
  };

  // User Actions: Petting
  const handlePetKenchiko = () => {
    setSaveData((prev) => {
      const nextData: GameSaveData = {
        ...prev,
        lastSaved: Date.now(),
        kenchiko: {
          ...prev.kenchiko,
          happiness: Math.min(100, prev.kenchiko.happiness + 10),
          monologue: 'なでてくれてありがとう〜！今日もいい日だなぁ。',
        },
      };
      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });
  };

  // User Actions: Manual Monologue update
  const handleManualMonologue = () => {
    setSaveData((prev) => {
      const nextData: GameSaveData = {
        ...prev,
        lastSaved: Date.now(),
        kenchiko: {
          ...prev.kenchiko,
          monologue: getRandomMonologue(
            prev.kenchiko.currentActivity,
            prev.kenchiko.currentLocation,
            prev.kenchiko.transportMethod,
            prev.asobiList,
            companionNyan ? companionNyan.name : undefined
          ),
        },
      };
      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });
  };

  // User Actions: Start Travel to specific destination
  const handleStartTravel = (destination: LocationId, transport: TransportMethod) => {
    const transitInfo = startTransit(saveData.kenchiko.currentLocation, destination, transport);
    setRemainingTimeSec(transitInfo.durationSec);

    setSaveData((prev) => {
      const nextData: GameSaveData = {
        ...prev,
        lastSaved: Date.now(),
        kenchiko: {
          ...prev.kenchiko,
          targetLocation: destination,
          transportMethod: transport,
          currentActivity: 'transit',
          currentActivityTitle: transitInfo.title,
          activityStartedAt: Date.now(),
          activityDurationSec: transitInfo.durationSec,
          currentCompanionNyanId: null,
          monologue: getRandomMonologue(
            'transit',
            prev.kenchiko.currentLocation,
            transport,
            prev.asobiList
          ),
        },
      };
      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });
  };

  // User Actions: Present Gift Item
  const handleUseItem = (item: GiftItem, target: 'kenchiko' | 'nyan') => {
    setSaveData((prev) => {
      const updatedInv = prev.inventory.map((invItem) =>
        invItem.id === item.id ? { ...invItem, count: Math.max(0, invItem.count - 1) } : invItem
      );

      const updatedChars = [...prev.characters];
      if (target === 'nyan' && companionNyan) {
        const charIdx = updatedChars.findIndex((c) => c.no === companionNyan.no);
        if (charIdx >= 0) {
          updatedChars[charIdx] = {
            ...updatedChars[charIdx],
            friendshipLevel: updatedChars[charIdx].friendshipLevel + 1,
            playCount: updatedChars[charIdx].playCount + 1,
          };
        }
      }

      const locInfo = LOCATIONS[prev.kenchiko.currentLocation] || LOCATIONS.living;
      const updatedDiary = [
        {
          id: `diary_${Date.now()}`,
          timestamp: Date.now(),
          dateFormatted: new Date().toLocaleDateString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          locationName: locInfo.name,
          activityTitle: `「${item.name}」をプレゼントした`,
          nyanId: target === 'nyan' && companionNyan ? companionNyan.no : null,
          nyanName: target === 'nyan' && companionNyan ? companionNyan.name : null,
          itemUsed: item.name,
          mood: 'happy',
          text: `${locInfo.name}で「${item.name}」を${
            target === 'nyan' && companionNyan ? companionNyan.name : 'けんちこ'
          }にあげた。${item.effectText}`,
        },
        ...prev.diary,
      ];

      const nextData: GameSaveData = {
        ...prev,
        inventory: updatedInv,
        characters: updatedChars,
        diary: updatedDiary.slice(0, 50),
        lastSaved: Date.now(),
        kenchiko: {
          ...prev.kenchiko,
          hunger: Math.min(100, prev.kenchiko.hunger + item.hungerRecovery),
          happiness: Math.min(100, prev.kenchiko.happiness + item.happinessGain),
          stamina: Math.min(100, prev.kenchiko.stamina + item.staminaGain),
          monologue: `「${item.name}」をもらった！${item.effectText}`,
        },
      };

      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });
  };

  // User Actions: Update Character Custom Image
  const handleUpdateCustomImage = (nyanNo: number, imageUrl: string) => {
    setSaveData((prev) => {
      const updated = prev.characters.map((c) =>
        c.no === nyanNo ? { ...c, customImageUrl: imageUrl || undefined } : c
      );
      const nextData: GameSaveData = {
        ...prev,
        characters: updated,
        lastSaved: Date.now(),
      };
      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });

    if (selectedZukanNyan && selectedZukanNyan.no === nyanNo) {
      setSelectedZukanNyan((prev) =>
        prev ? { ...prev, customImageUrl: imageUrl || undefined } : null
      );
    }
  };

  // User Actions: Import Nyans from weekly CSV
  const handleImportNyans = (
    updatedNyans: NyanCharacter[],
    _addedCount: number,
    _updatedCount: number
  ) => {
    setSaveData((prev) => {
      const nextData: GameSaveData = {
        ...prev,
        characters: updatedNyans,
        lastSaved: Date.now(),
      };
      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });
  };

  // User Actions: Update Kenchiko custom image
  const handleUpdateKenchikoImage = (imageUrl: string) => {
    setSaveData((prev) => {
      const nextData: GameSaveData = {
        ...prev,
        lastSaved: Date.now(),
        kenchiko: {
          ...prev.kenchiko,
          customImageUrl: imageUrl ? imageUrl : undefined,
        },
      };
      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });
  };

  // User Actions: Take Picture Snapshot for Diary
  const handleTakeSnapshot = () => {
    const locInfo = LOCATIONS[saveData.kenchiko.currentLocation] || LOCATIONS.living;
    const newEntry: DiaryEntry = {
      id: `diary_snap_${Date.now()}`,
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      locationName: locInfo.name,
      activityTitle: `${locInfo.name}での日常の1コマを撮影`,
      nyanId: companionNyan ? companionNyan.no : null,
      nyanName: companionNyan ? companionNyan.name : null,
      itemUsed: null,
      mood: saveData.kenchiko.mood,
      text: `${locInfo.name}で${
        companionNyan ? `${companionNyan.name}と一緒に` : ''
      }まったりしているところをパシャリと撮影。けんちこは「${saveData.kenchiko.monologue}」とつぶやいていた。`,
    };

    setSaveData((prev) => {
      const nextData: GameSaveData = {
        ...prev,
        diary: [newEntry, ...prev.diary].slice(0, 50),
        lastSaved: Date.now(),
      };
      syncSaveDataToFirebase(nextData).catch(() => {});
      return nextData;
    });

    confetti({ particleCount: 20, spread: 50, origin: { y: 0.8 } });
  };

  // Loading Screen while connecting to Firestore
  if (isLoadingFirebase) {
    return (
      <div className="min-h-screen bg-[#F5F2EA] flex flex-col items-center justify-center p-4 font-['M_PLUS_Rounded_1c',sans-serif]">
        <div className="text-center space-y-4 max-w-sm">
          <KenchikoAvatar size={72} className="mx-auto animate-bounce shadow-md" />
          <div className="space-y-1">
            <h2 className="text-base font-black text-[#3A342F]">けんちこの世界とクラウド同期中...</h2>
            <p className="text-xs text-[#7D756D]">Firebase Firestoreから最新データを取得しています</p>
          </div>
          <div className="w-36 h-2 bg-[#DDD7C8] rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-[#728C7E] animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const discoveredCount = saveData.characters.filter((c) => c.discovered).length;
  const totalCharacters = saveData.characters.length;

  return (
    <div className="min-h-screen bg-[#F4F1EA] text-[#3E3833] flex flex-col font-['Zen_Maru_Gothic','M_PLUS_Rounded_1c',sans-serif]">
      {/* Global SVG Pencil Filter Definitions */}
      <PencilSketchFilters />

      {/* Top Navigation Bar with Tabs and Top-Right Settings Button */}
      <div className="bg-[#ECE7DC] border-b-1.5 border-[#3E3833] sticky top-0 z-30 shadow-[0_2px_6px_rgba(46,40,36,0.06)]">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-2 py-2.5">
          {/* Main Tab Navigation */}
          <div className="flex gap-1.5 sm:gap-2.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('stage')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black transition ${
                activeTab === 'stage'
                  ? 'bg-[#3E3833] text-[#FAF8F4] sketch-border shadow-sm'
                  : 'bg-[#FAF8F4] text-[#5A524A] hover:bg-white hover:text-[#2E2824] sketch-card-subtle'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span className="font-handwriting text-sm">けんちこ観察</span>
            </button>

            <button
              onClick={() => setActiveTab('zukan')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black transition ${
                activeTab === 'zukan'
                  ? 'bg-[#3E3833] text-[#FAF8F4] sketch-border shadow-sm'
                  : 'bg-[#FAF8F4] text-[#5A524A] hover:bg-white hover:text-[#2E2824] sketch-card-subtle'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="font-handwriting text-sm">◯◯にゃん図鑑 ({discoveredCount}/{totalCharacters})</span>
            </button>

            <button
              onClick={() => setActiveTab('diary')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-black transition ${
                activeTab === 'diary'
                  ? 'bg-[#3E3833] text-[#FAF8F4] sketch-border shadow-sm'
                  : 'bg-[#FAF8F4] text-[#5A524A] hover:bg-white hover:text-[#2E2824] sketch-card-subtle'
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span className="font-handwriting text-sm">おもいで絵日記 ({saveData.diary.length})</span>
            </button>
          </div>

          {/* Top-Right Status Lamp & Settings Button */}
          <div className="flex items-center gap-2">
            {/* Connection Status Lamp Indicator */}
            {connectionStatus.isOffline ? (
              <button
                onClick={() => setShowSyncModal(true)}
                className="flex-shrink-0 flex items-center gap-2 bg-[#FDECE8] hover:bg-[#FCDFD8] border border-[#F5A898] text-[#B92B1B] px-3 py-1.5 sketch-tag shadow-sm transition"
                title="Firebaseと接続できていません（オフラインモード動作中）。タップして設定を確認"
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.9)] ring-2 ring-red-200"></span>
                </span>
                <span className="font-handwriting text-xs sm:text-sm font-black text-[#9A2214]">
                  オフラインモード
                </span>
              </button>
            ) : (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 sketch-tag bg-[#FAF8F4] text-[#487560] text-xs font-bold"
                title="Firebase Firestore クラウド同期中（オンライン）"
              >
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#487560]"></span>
                </span>
                <span className="font-handwriting text-[11px] text-[#487560]">接続中</span>
              </div>
            )}

            {/* Top-Right Settings Button */}
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex-shrink-0 flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-white text-[#3E3833] font-black text-xs px-3.5 py-2 sketch-card-subtle shadow-sm transition"
              title="設定・データ管理"
            >
              <Settings className="w-4 h-4 text-[#487560]" />
              <span className="font-handwriting text-sm">設定</span>
            </button>
          </div>
        </div>
      </div>

      {/* Offline Mode Alert Bar with Pulsing Red Lamp */}
      {connectionStatus.isOffline && (
        <div className="bg-[#FFF4F2] border-b-2 border-[#E74C3C]/40 px-4 py-3 shadow-inner">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="relative flex h-3.5 w-3.5 mt-0.5 sm:mt-0 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.9)] ring-2 ring-red-300"></span>
              </span>
              <div>
                <span className="font-handwriting font-black text-sm text-[#922B21] mr-2">
                  【オフラインモードで動作中】
                </span>
                <span className="text-xs text-[#78281F]">
                  Firebaseクラウドデータベースと接続できていません。ゲームの進行や観察はローカル上でそのまま継続でき、再接続時に自動保存されます。
                </span>
                {connectionStatus.lastError && (
                  <span className="block text-[10px] text-[#A93226] font-mono mt-0.5 opacity-80 truncate max-w-xl">
                    詳細: {connectionStatus.lastError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
              <button
                onClick={async () => {
                  setIsRetryingConnection(true);
                  await testFirebaseConnection();
                  setTimeout(() => setIsRetryingConnection(false), 600);
                }}
                disabled={isRetryingConnection}
                className="flex items-center gap-1.5 bg-[#C0392B] hover:bg-[#A93226] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-sm transition disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetryingConnection ? 'animate-spin' : ''}`} />
                <span>{isRetryingConnection ? '接続確認中...' : '再接続を試す'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Toast Notification */}
      {newEncounterToast && (
        <div className="fixed top-20 right-4 z-40 max-w-sm bg-[#3A342F] text-[#FAF8F5] p-4 rounded-2xl border border-[#D4B996] shadow-xl animate-bounce">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <div className="text-[11px] text-[#D4B996] font-black tracking-wider">
                  新しいにゃんを図鑑に登録！
                </div>
                <h4 className="text-sm font-black text-white">{newEncounterToast.name}</h4>
                <p className="text-[10px] text-[#CCC4B2] line-clamp-1">{newEncounterToast.motif}</p>
              </div>
            </div>
            <button
              onClick={() => setNewEncounterToast(null)}
              className="text-[#A8A096] hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content View Container */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full">
        {activeTab === 'stage' && (
          <div className="space-y-6">
            <KenchikoStage
              kenchiko={saveData.kenchiko}
              companionNyan={companionNyan}
              remainingTimeSec={remainingTimeSec}
              timeSpeed={timeSpeed}
              onPet={handlePetKenchiko}
              onOpenGiftModal={() => setShowGiftModal(true)}
              onOpenTravelModal={() => setShowTravelModal(true)}
              onSelectNyan={(nyan) => setSelectedZukanNyan(nyan)}
              onManualMonologue={handleManualMonologue}
              onTakeSnapshot={handleTakeSnapshot}
              onUpdateKenchikoImage={handleUpdateKenchikoImage}
            />

            {/* Quick Mini Zukan Strip */}
            <div className="bg-[#FAF8F5] p-5 rounded-3xl border border-[#DDD7C8] shadow-[0_2px_8px_rgba(74,68,63,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-[#3A342F]">
                    最近出会った◯◯にゃん
                  </span>
                  <span className="text-xs text-[#7D756D]">
                    ({discoveredCount} / {totalCharacters} 匹 発見中)
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('zukan')}
                  className="text-xs font-bold text-[#728C7E] hover:text-[#5C7366] hover:underline flex items-center gap-1"
                >
                  図鑑をすべて見る ➔
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {saveData.characters
                  .filter((c) => c.discovered)
                  .slice(0, 8)
                  .map((nyan) => (
                    <button
                      key={nyan.no}
                      onClick={() => setSelectedZukanNyan(nyan)}
                      className="group flex-shrink-0 w-28 p-2.5 rounded-2xl bg-[#F5F2EA] hover:bg-[#EFECE4] border border-[#DDD7C8] text-center transition"
                    >
                      <div className="text-[10px] font-mono text-[#7D756D] font-bold">
                        No.{String(nyan.no).padStart(3, '0')}
                      </div>
                      <div className="text-xs font-black text-[#3A342F] truncate mt-1">
                        {nyan.name}
                      </div>
                      <div className="text-[9px] text-[#8C837A] truncate">{nyan.motif}</div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'zukan' && (
          <ZukanView
            characters={saveData.characters}
            onSelectCharacter={(nyan) => setSelectedZukanNyan(nyan)}
          />
        )}

        {activeTab === 'diary' && <DiaryView diary={saveData.diary} />}

        {activeTab === 'sync' && (
          <div className="bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_2px_8px_rgba(74,68,63,0.04)] p-6 space-y-6">
            <div>
              <h2 className="text-xl font-black text-[#3A342F] mb-1">
                データ連携・全イベント編集コンソール
              </h2>
              <p className="text-xs text-[#7D756D]">
                Firestoreクラウド同期、全イベント・あそびの編集、毎週更新される「◯◯にゃん」CSVの取り込み設定を行います。
              </p>
            </div>

            <DataSyncModal
              characters={saveData.characters}
              saveData={saveData}
              onClose={() => setActiveTab('stage')}
              onImportNyans={handleImportNyans}
              onSaveFirebaseConfig={(_cfg) => {}}
              onUpdateSaveData={(updater) => {
                setSaveData((prev) => {
                  const next = updater(prev);
                  syncSaveDataToFirebase(next).catch(() => {});
                  return next;
                });
              }}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedZukanNyan && (
        <ZukanDetailModal
          nyan={selectedZukanNyan}
          onClose={() => setSelectedZukanNyan(null)}
          onUpdateCustomImage={handleUpdateCustomImage}
          onGiftToNyan={(_nyan) => {
            setSelectedZukanNyan(null);
            setShowGiftModal(true);
          }}
        />
      )}

      {showGiftModal && (
        <GiftItemModal
          inventory={saveData.inventory}
          kenchiko={saveData.kenchiko}
          companionNyan={companionNyan}
          onClose={() => setShowGiftModal(false)}
          onUseItem={handleUseItem}
        />
      )}

      {showTravelModal && (
        <TravelModal
          kenchiko={saveData.kenchiko}
          onClose={() => setShowTravelModal(false)}
          onStartTravel={handleStartTravel}
        />
      )}

      {showSyncModal && (
        <DataSyncModal
          characters={saveData.characters}
          saveData={saveData}
          onClose={() => setShowSyncModal(false)}
          onImportNyans={handleImportNyans}
          onSaveFirebaseConfig={(_cfg) => {}}
          onUpdateSaveData={(updater) => {
            setSaveData((prev) => {
              const next = updater(prev);
              syncSaveDataToFirebase(next).catch(() => {});
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
