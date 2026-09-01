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
import { loadGameData, saveGameData } from './services/storage';
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

import {
  Eye,
  BookOpen,
  Gift,
  BookMarked,
  Database,
  Heart,
  Zap,
  Coffee,
  Sparkles,
  FastForward,
  Play,
  RotateCcw,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Main Game Save Data State
  const [saveData, setSaveData] = useState<GameSaveData>(() => loadGameData());
  const [activeTab, setActiveTab] = useState<'stage' | 'zukan' | 'inventory' | 'diary' | 'sync'>('stage');

  // Time & Simulation Controls
  const [timeSpeed, setTimeSpeed] = useState<number>(1); // 1x, 5x, 30x, 60x
  const [remainingTimeSec, setRemainingTimeSec] = useState<number>(() => {
    const initial = loadGameData();
    const elapsedRealSec = Math.floor((Date.now() - initial.kenchiko.activityStartedAt) / 1000);
    return Math.max(0, initial.kenchiko.activityDurationSec - elapsedRealSec);
  });

  // Modal States
  const [selectedZukanNyan, setSelectedZukanNyan] = useState<NyanCharacter | null>(null);
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [showTravelModal, setShowTravelModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [newEncounterToast, setNewEncounterToast] = useState<NyanCharacter | null>(null);

  // Firestore sync listener
  useEffect(() => {
    const fbConfig = loadSavedFirebaseConfig();
    if (fbConfig?.apiKey && fbConfig?.projectId) {
      const unsub = subscribeToFirebaseState(fbConfig, (remoteData) => {
        if (remoteData.lastSaved > (saveData.lastSaved || 0)) {
          setSaveData(remoteData);
        }
      });
      return unsub;
    }
  }, []);

  // Pattern A: Auto-fetch and merge Google Docs/Sheets data on application launch
  useEffect(() => {
    const docUrl = getSavedGoogleDocUrl() || DEFAULT_GOOGLE_DOC_URL;
    if (docUrl && docUrl.trim().length > 0) {
      syncNyansFromGoogleDoc(docUrl, saveData.characters)
        .then((res) => {
          if (res.success && (res.addedCount > 0 || res.updatedCount > 0)) {
            setSaveData((prev) => ({
              ...prev,
              characters: res.updatedNyans,
              lastSaved: Date.now(),
            }));
            console.log(`[Google Doc Auto-Sync] Updated: ${res.updatedCount}, Added: ${res.addedCount}`);
          }
        })
        .catch((err) => {
          console.warn('[Google Doc Auto-Sync] Note:', err);
        });
    }
  }, []);

  // Save to local storage and sync to Firebase on state updates
  useEffect(() => {
    saveGameData(saveData);
    const timer = setTimeout(() => {
      syncSaveDataToFirebase(saveData).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [saveData]);

  // Current Companion Nyan
  const companionNyan = useMemo(() => {
    if (!saveData.kenchiko.currentCompanionNyanId) return null;
    return (
      saveData.characters.find((c) => c.no === saveData.kenchiko.currentCompanionNyanId) || null
    );
  }, [saveData.characters, saveData.kenchiko.currentCompanionNyanId]);

  // Primary Simulation Tick Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingTimeSec((prev) => {
        const nextTime = prev - timeSpeed;

        if (nextTime <= 0) {
          // Current activity has completed! Transition to next activity.
          handleActivityCompletion();
          return 300; // placeholder until updated
        }

        return nextTime;
      });

      // Gradually adjust hunger & stamina
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
  }, [timeSpeed, saveData.kenchiko.currentActivity, saveData.kenchiko.currentLocation]);

  // Activity Completion Handler
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

      // Case A: Just arrived from transit
      if (curK.currentActivity === 'transit' && curK.targetLocation) {
        nextLocation = curK.targetLocation;
        nextTargetLocation = null;
        nextTransport = null;
        updatedStats.totalTrips += 1;

        // Generate activity at destination
        const actResult = generateNextActivity(nextLocation, updatedCharacters, prev.asobiList);
        nextCompanionId = actResult.companionNyanId;

        // If new nyan discovered at destination!
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

        // Add arrival diary entry
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

        return {
          ...prev,
          characters: updatedCharacters,
          diary: updatedDiary.slice(0, 50),
          stats: updatedStats,
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
      }

      // Case B: Finished activity at current place -> either move to another place or continue new activity
      const shouldMove = Math.random() < 0.45;

      if (shouldMove) {
        // Pick new random destination & transport
        const dest = pickRandomLocation(curK.currentLocation);
        const transport = pickRandomTransport();
        const transitInfo = startTransit(curK.currentLocation, dest, transport);

        setRemainingTimeSec(transitInfo.durationSec);

        return {
          ...prev,
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
        // Stay and do another activity (snacking, nap, play, or custom asobi)
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

        // Add diary if generated
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

        return {
          ...prev,
          characters: updatedCharacters,
          diary: updatedDiary.slice(0, 50),
          stats: updatedStats,
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
    });
  };

  // User Actions: Petting
  const handlePetKenchiko = () => {
    setSaveData((prev) => ({
      ...prev,
      kenchiko: {
        ...prev.kenchiko,
        happiness: Math.min(100, prev.kenchiko.happiness + 10),
        monologue: 'なでてくれてありがとう〜！今日もいい日だなぁ。',
      },
    }));
  };

  // User Actions: Manual Monologue update
  const handleManualMonologue = () => {
    setSaveData((prev) => ({
      ...prev,
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
    }));
  };

  // User Actions: Start Travel to specific destination
  const handleStartTravel = (destination: LocationId, transport: TransportMethod) => {
    const transitInfo = startTransit(saveData.kenchiko.currentLocation, destination, transport);
    setRemainingTimeSec(transitInfo.durationSec);

    setSaveData((prev) => ({
      ...prev,
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
    }));
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

      // Add diary note
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

      return {
        ...prev,
        inventory: updatedInv,
        characters: updatedChars,
        diary: updatedDiary.slice(0, 50),
        kenchiko: {
          ...prev.kenchiko,
          hunger: Math.min(100, prev.kenchiko.hunger + item.hungerRecovery),
          happiness: Math.min(100, prev.kenchiko.happiness + item.happinessGain),
          stamina: Math.min(100, prev.kenchiko.stamina + item.staminaGain),
          monologue: `「${item.name}」をもらった！${item.effectText}`,
        },
      };
    });
  };

  // User Actions: Update Character Custom Image
  const handleUpdateCustomImage = (nyanNo: number, imageUrl: string) => {
    setSaveData((prev) => {
      const updated = prev.characters.map((c) =>
        c.no === nyanNo ? { ...c, customImageUrl: imageUrl || undefined } : c
      );
      return { ...prev, characters: updated };
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
    addedCount: number,
    updatedCount: number
  ) => {
    setSaveData((prev) => ({
      ...prev,
      characters: updatedNyans,
    }));
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

    setSaveData((prev) => ({
      ...prev,
      diary: [newEntry, ...prev.diary].slice(0, 50),
    }));

    confetti({ particleCount: 20, spread: 50, origin: { y: 0.8 } });
  };

  const discoveredCount = saveData.characters.filter((c) => c.discovered).length;
  const totalCharacters = saveData.characters.length;

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#4A443F] flex flex-col font-['M_PLUS_Rounded_1c',sans-serif]">
      {/* Top Navbar */}
      <header className="bg-[#FAF8F5] border-b border-[#DDD7C8] sticky top-0 z-30 shadow-[0_1px_4px_rgba(74,68,63,0.05)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <KenchikoAvatar size={42} className="shadow-sm" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-[#3A342F]">
                  けんちこワールド
                </h1>
                <span className="bg-[#EAF0EC] text-[#3D5447] text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#C6D8CD]">
                  放置型ペットシム
                </span>
              </div>
              <p className="text-[11px] text-[#7D756D] font-medium">
                オジサン「けんちこ」観察 ＆ 毎週増える◯◯にゃん図鑑
              </p>
            </div>
          </div>

          {/* Kenchiko Status Meters */}
          <div className="flex items-center gap-3 bg-[#EFECE4] px-3.5 py-1.5 rounded-2xl border border-[#DDD7C8]">
            {/* Hunger */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B6259]" title="満腹度">
              <Coffee className="w-3.5 h-3.5 text-[#C8744E]" />
              <div className="w-12 bg-[#DDD7C8] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#D9825B] h-full rounded-full transition-all duration-300"
                  style={{ width: `${saveData.kenchiko.hunger}%` }}
                />
              </div>
            </div>

            {/* Happiness */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B6259]" title="ごきげん度">
              <Heart className="w-3.5 h-3.5 fill-[#D4736A] text-[#D4736A]" />
              <div className="w-12 bg-[#DDD7C8] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#D4736A] h-full rounded-full transition-all duration-300"
                  style={{ width: `${saveData.kenchiko.happiness}%` }}
                />
              </div>
            </div>

            {/* Stamina */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B6259]" title="体力">
              <Zap className="w-3.5 h-3.5 text-[#5C7E6B]" />
              <div className="w-12 bg-[#DDD7C8] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#728C7E] h-full rounded-full transition-all duration-300"
                  style={{ width: `${saveData.kenchiko.stamina}%` }}
                />
              </div>
            </div>
          </div>

          {/* Time Speed Control & Quick Sync */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#EFECE4] p-1 rounded-xl border border-[#DDD7C8]">
              {[1, 5, 30, 60].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setTimeSpeed(spd)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                    timeSpeed === spd
                      ? 'bg-[#728C7E] text-white shadow-sm'
                      : 'text-[#6B6259] hover:text-[#3A342F]'
                  }`}
                  title={`${spd}倍速で時間を進める`}
                >
                  {spd === 1 ? '1x リアル' : `${spd}x`}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-1.5 bg-[#FAF8F5] hover:bg-[#EFECE4] text-[#4A443F] font-bold text-xs px-3 py-1.5 rounded-xl border border-[#DDD7C8] shadow-sm transition"
              title="週次CSV更新・GitHub連携・Firebase設定"
            >
              <Database className="w-3.5 h-3.5 text-[#728C7E]" />
              <span className="hidden sm:inline">データ連携</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="bg-[#EBE6DC] border-b border-[#DDD7C8]">
        <div className="max-w-6xl mx-auto px-4 flex gap-1.5 sm:gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('stage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition border ${
              activeTab === 'stage'
                ? 'bg-[#4A443F] text-[#FAF8F5] border-[#3A342F] shadow-sm'
                : 'bg-[#FAF8F5] text-[#6B6259] border-[#DDD7C8] hover:bg-white hover:text-[#3A342F]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>けんちこ観察</span>
          </button>

          <button
            onClick={() => setActiveTab('zukan')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition border ${
              activeTab === 'zukan'
                ? 'bg-[#4A443F] text-[#FAF8F5] border-[#3A342F] shadow-sm'
                : 'bg-[#FAF8F5] text-[#6B6259] border-[#DDD7C8] hover:bg-white hover:text-[#3A342F]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>◯◯にゃん図鑑 ({discoveredCount}/{totalCharacters})</span>
          </button>

          <button
            onClick={() => setActiveTab('diary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition border ${
              activeTab === 'diary'
                ? 'bg-[#4A443F] text-[#FAF8F5] border-[#3A342F] shadow-sm'
                : 'bg-[#FAF8F5] text-[#6B6259] border-[#DDD7C8] hover:bg-white hover:text-[#3A342F]'
            }`}
          >
            <BookMarked className="w-4 h-4" />
            <span>おもいで絵日記 ({saveData.diary.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition border ${
              activeTab === 'sync'
                ? 'bg-[#4A443F] text-[#FAF8F5] border-[#3A342F] shadow-sm'
                : 'bg-[#FAF8F5] text-[#6B6259] border-[#DDD7C8] hover:bg-white hover:text-[#3A342F]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>週次CSV更新 / GitHub</span>
          </button>
        </div>
      </div>

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
                週次CSVデータ更新 & GitHub / Firebase 連携
              </h2>
              <p className="text-xs text-[#7D756D]">
                毎週更新される「◯◯にゃん」CSVの取り込みや、GitHubリポジトリ (ken-chiko) への自動コミット設定を行います。
              </p>
            </div>

            <DataSyncModal
              characters={saveData.characters}
              saveData={saveData}
              onClose={() => setActiveTab('stage')}
              onImportNyans={handleImportNyans}
              onSaveFirebaseConfig={(cfg) => {
                // saved
              }}
              onUpdateSaveData={setSaveData}
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
          onGiftToNyan={(nyan) => {
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
          onSaveFirebaseConfig={(cfg) => {
            // saved
          }}
          onUpdateSaveData={setSaveData}
        />
      )}

      {/* Footer */}
      <footer className="bg-[#EFECE4] border-t border-[#DDD7C8] py-6 text-center text-xs text-[#7D756D]">
        <p className="font-bold text-[#4A443F]">けんちこワールド (ken-chiko)</p>
        <p className="mt-1 text-[11px]">
          5分刻みでセカイをうろつくオジサン観察 ＆ 毎週更新される脱力「◯◯にゃん」図鑑
        </p>
      </footer>
    </div>
  );
}
