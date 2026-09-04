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
  syncSaveDataToFirebase,
  fetchInitialFirebaseState,
  saveLocalBackup,
  setQuotaStatusCallback,
  getIsQuotaExhausted,
  getFirebaseConnectionStatus,
  subscribeFirebaseConnectionStatus,
  testFirebaseConnection,
  endInitialConnectionPhase,
  FirebaseConnectionStatus,
} from './services/firebaseSync';
import {
  getSavedGoogleDocUrl,
  syncNyansFromGoogleDoc,
  DEFAULT_GOOGLE_DOC_URL,
} from './services/googleDocSync';
import {
  getSavedGoogleDriveFolderUrl,
  syncImagesFromGoogleDriveFolder,
  DEFAULT_GOOGLE_DRIVE_FOLDER_URL,
} from './services/googleDriveFolderSync';

import { KenchikoStage } from './components/KenchikoStage';
import { KenchikoAvatar } from './components/KenchikoAvatar';
import { ZukanView } from './components/ZukanView';
import { ZukanDetailModal } from './components/ZukanDetailModal';
import { GiftItemModal } from './components/GiftItemModal';
import { TravelModal } from './components/TravelModal';
import { DiaryView } from './components/DiaryView';
import { DataSyncModal, AdminTab } from './components/DataSyncModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { PencilSketchFilters } from './utils/pencilFilters';
import { saveLocalKenchikoImage, loadLocalKenchikoImage } from './services/imageCompression';
import { getActiveUserId, setActiveUserId } from './services/userService';

import {
  Eye,
  BookOpen,
  Gift,
  BookMarked,
  Settings,
  Code2,
  User,
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

  // User Management State (Multi-user support via ?user=yumi etc.)
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => getActiveUserId());

  // Time & Simulation Controls
  const [timeSpeed, setTimeSpeed] = useState<number>(1); // 1x, 5x, 30x, 60x
  const [remainingTimeSec, setRemainingTimeSec] = useState<number>(300);

  // Modal States
  const [selectedZukanNyan, setSelectedZukanNyan] = useState<NyanCharacter | null>(null);
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [showTravelModal, setShowTravelModal] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [showUserSettingsModal, setShowUserSettingsModal] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab | undefined>(undefined);
  const [newEncounterToast, setNewEncounterToast] = useState<NyanCharacter | null>(null);

  // URL Query Parameter Handling on App Launch
  // Supports: ?user=yumi, ?admin=true, ?admin=asobi, ?tab=zukan, ?tab=diary, ?pass=wakaro, ?dev=true, etc.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') || params.get('page') || params.get('view');
      const modalParam = params.get('modal');
      const adminParam = params.get('admin');
      const devParam = params.get('dev') || params.get('develop');
      const modeParam = params.get('mode');
      const subtabParam = params.get('subtab') || params.get('admintab') || params.get('section');
      const userParam = params.get('user') || params.get('uid') || params.get('player');

      if (userParam) {
        const active = getActiveUserId();
        if (active) setCurrentUserId(active);
      }

      const validAdminTabs: AdminTab[] = ['avatar', 'kihon_nyan', 'asobi', 'database', 'googledoc', 'firebase', 'github', 'csv'];

      // Direct tab navigation (?tab=zukan, ?tab=diary, ?tab=stage)
      if (tabParam === 'stage' || tabParam === 'zukan' || tabParam === 'diary') {
        setActiveTab(tabParam);
      }

      // Development / Admin console direct navigation
      // Triggers: ?dev=true, ?admin=true, ?admin=1, ?admin=asobi, ?modal=admin, ?mode=admin, ?tab=admin, ?tab=sync
      const isDevTrigger =
        adminParam !== null ||
        devParam !== null ||
        modalParam === 'admin' ||
        modalParam === 'dev' ||
        modalParam === 'sync' ||
        modeParam === 'admin' ||
        modeParam === 'dev' ||
        tabParam === 'admin' ||
        tabParam === 'dev' ||
        tabParam === 'sync';

      if (isDevTrigger) {
        if (adminParam && validAdminTabs.includes(adminParam as AdminTab)) {
          setAdminInitialTab(adminParam as AdminTab);
        } else if (subtabParam && validAdminTabs.includes(subtabParam as AdminTab)) {
          setAdminInitialTab(subtabParam as AdminTab);
        }
        setShowSyncModal(true);
      }
    } catch (_e) {
      // Ignore URL parsing errors
    }
  }, []);

  // Reference for avoiding echo saves from remote snapshot updates
  const isRemoteUpdateRef = useRef<boolean>(false);

  // 1. Initial Load from Firestore (Smooth startup: local backup first, then graceful delayed remote fetch)
  useEffect(() => {
    setQuotaStatusCallback((exhausted) => {
      setIsQuotaLimited(exhausted);
    });

    const unsubStatus = subscribeFirebaseConnectionStatus((status) => {
      setConnectionStatus(status);
    });

    let isMounted = true;

    // A. Immediate local image hydrate
    const localImg = loadLocalKenchikoImage();
    if (localImg) {
      setSaveData((prev) => ({
        ...prev,
        kenchiko: {
          ...prev.kenchiko,
          customImageUrl: prev.kenchiko.customImageUrl || localImg,
        },
      }));
    }

    // B. Delay initial cloud connection by ~1.5s to let UI and browser network settle
    const initialFetchTimer = setTimeout(() => {
      fetchInitialFirebaseState()
        .then((res) => {
          if (!isMounted) return;
          if (res.success && res.data) {
            isRemoteUpdateRef.current = true;
            const mergedData = { ...res.data };
            // If remote image is absent but locally saved, prioritize local image
            if (!mergedData.kenchiko.customImageUrl && localImg) {
              mergedData.kenchiko.customImageUrl = localImg;
            } else if (mergedData.kenchiko.customImageUrl) {
              saveLocalKenchikoImage(mergedData.kenchiko.customImageUrl);
            }
            setSaveData(mergedData);
            const elapsedRealSec = Math.floor((Date.now() - res.data.kenchiko.activityStartedAt) / 1000);
            setRemainingTimeSec(Math.max(0, res.data.kenchiko.activityDurationSec - elapsedRealSec));
            setIsFirebaseSynced(true);
          }
          endInitialConnectionPhase();
          setIsLoadingFirebase(false);
        })
        .catch((err) => {
          console.warn('Firebase initial load note:', err);
          endInitialConnectionPhase();
          if (isMounted) setIsLoadingFirebase(false);
        });
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(initialFetchTimer);
      unsubStatus();
    };
  }, []);

  // 2. Controlled Google Docs/Sheets auto-sync (Runs gently on initial launch once per session, throttled)
  const hasAttemptedInitialSyncRef = useRef<boolean>(false);

  useEffect(() => {
    if (isLoadingFirebase || hasAttemptedInitialSyncRef.current) return;
    hasAttemptedInitialSyncRef.current = true;

    const executeSheetAutoSync = async () => {
      // 2-a: Google Docs/Sheets auto-sync
      const docUrl = getSavedGoogleDocUrl() || DEFAULT_GOOGLE_DOC_URL;
      if (docUrl && docUrl.trim().length > 0) {
        try {
          const res = await syncNyansFromGoogleDoc(docUrl, saveData.characters);
          if (res.success && (res.addedCount > 0 || res.updatedCount > 0)) {
            setSaveData((prev) => {
              const nextData: GameSaveData = {
                ...prev,
                characters: res.updatedNyans,
                lastSaved: Date.now(),
              };
              syncSaveDataToFirebase(nextData, false).catch(() => {});
              return nextData;
            });
          }
        } catch {}
      }

      // 2-b: Google Drive Folder image auto-sync
      const driveFolderUrl = saveData.googleDriveFolderUrl || getSavedGoogleDriveFolderUrl() || DEFAULT_GOOGLE_DRIVE_FOLDER_URL;
      if (driveFolderUrl && driveFolderUrl.trim().length > 0) {
        try {
          const res = await syncImagesFromGoogleDriveFolder(driveFolderUrl, saveData.characters);
          if (res.success && (res.matchedCount > 0 || (res.kihonNyanImageUrl && res.kihonNyanImageUrl !== saveData.kihonNyanCustomImageUrl))) {
            setSaveData((prev) => {
              const nextData: GameSaveData = {
                ...prev,
                characters: res.updatedNyans,
                googleDriveFolderUrl: driveFolderUrl,
                kihonNyanCustomImageUrl: res.kihonNyanImageUrl || prev.kihonNyanCustomImageUrl,
                lastSaved: Date.now(),
              };
              syncSaveDataToFirebase(nextData, false).catch(() => {});
              return nextData;
            });
          }
        } catch {}
      }
    };

    // Delay 3 seconds after launch to ensure initial render is fast and calm
    const timer = setTimeout(executeSheetAutoSync, 3000);

    return () => {
      clearTimeout(timer);
    };
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

      saveLocalBackup(nextData);
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
    saveLocalKenchikoImage(imageUrl);
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

  // User Actions: Reset Current User's Game Data to Initial State (初期化)
  const handleResetUserData = () => {
    const freshState: GameSaveData = {
      ...DEFAULT_INITIAL_STATE,
      lastSaved: Date.now(),
      kenchiko: {
        ...DEFAULT_INITIAL_STATE.kenchiko,
        activityStartedAt: Date.now(),
      },
    };
    setSaveData(freshState);
    setRemainingTimeSec(300);
    syncSaveDataToFirebase(freshState, true).catch(() => {});
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
  };

  // User Actions: Switch Active User Profile
  const handleSwitchUser = (newUid: string | null) => {
    setCurrentUserId(newUid);
    setIsLoadingFirebase(true);
    fetchInitialFirebaseState()
      .then((res) => {
        if (res.success && res.data) {
          isRemoteUpdateRef.current = true;
          setSaveData(res.data);
          const elapsed = Math.floor((Date.now() - res.data.kenchiko.activityStartedAt) / 1000);
          setRemainingTimeSec(Math.max(0, res.data.kenchiko.activityDurationSec - elapsed));
          setIsFirebaseSynced(true);
        } else {
          // New user starting from zero
          const freshData: GameSaveData = {
            ...DEFAULT_INITIAL_STATE,
            lastSaved: Date.now(),
            kenchiko: {
              ...DEFAULT_INITIAL_STATE.kenchiko,
              activityStartedAt: Date.now(),
            },
          };
          setSaveData(freshData);
          setRemainingTimeSec(300);
          syncSaveDataToFirebase(freshData, true).catch(() => {});
        }
        setIsLoadingFirebase(false);
      })
      .catch(() => {
        setIsLoadingFirebase(false);
      });
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

          {/* Top-Right Status Lamp, User Indicator, Dev & Settings Button */}
          <div className="flex items-center gap-2">
            {/* Subtle Current Username Indicator */}
            {currentUserId && (
              <div
                className="flex items-center gap-1 px-2 py-1 sketch-tag bg-[#FAF8F4] text-[#4A433D] text-[11px] font-bold border border-[#DDD7C8]"
                title={`ログイン中のユーザー: ${currentUserId}`}
              >
                <User className="w-3 h-3 text-[#487560]" />
                <span className="font-mono text-[11px] text-[#4A433D]">{currentUserId}</span>
              </div>
            )}

            {/* Connection Status Lamp Indicator */}
            {connectionStatus.isOffline ? (
              <button
                onClick={() => setShowUserSettingsModal(true)}
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
                title="Firebase Firestore 自動クラウド同期中"
              >
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#487560]"></span>
                </span>
                <span className="font-handwriting text-[11px] text-[#487560]">接続中</span>
              </div>
            )}

            {/* Former Settings now renamed to '開発' (Hidden unless query param ?dev or ?admin is accessed) */}
            {showSyncModal && (
              <button
                onClick={() => setShowSyncModal(true)}
                className="flex-shrink-0 flex items-center gap-1 bg-[#EAE5D9] hover:bg-[#DDD7C8] text-[#635A52] font-black text-xs px-2.5 py-1.5 sketch-card-subtle shadow-xs transition"
                title="開発・データ連携コンソール"
              >
                <Code2 className="w-3.5 h-3.5 text-[#635A52]" />
                <span className="font-handwriting text-xs">開発</span>
              </button>
            )}

            {/* New User Settings Button */}
            <button
              onClick={() => setShowUserSettingsModal(true)}
              className="flex-shrink-0 flex items-center gap-1.5 bg-[#FAF8F4] hover:bg-white text-[#3E3833] font-black text-xs px-3.5 py-2 sketch-card-subtle shadow-sm transition"
              title="設定・ユーザーデータ管理"
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
                  Firebaseクラウドデータベースと接続待機中、または一時的に未接続です。数秒ごとに自動で再接続を試行しています（ゲームの進行はローカル上でそのまま継続でき、接続時に自動保存されます）。
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
              initialTab={adminInitialTab}
              onClose={() => setActiveTab('stage')}
              onImportNyans={handleImportNyans}
              onSaveFirebaseConfig={(_cfg) => {}}
              onUpdateSaveData={(updater, isImmediate = false) => {
                setSaveData((prev) => {
                  const next = updater(prev);
                  syncSaveDataToFirebase(next, isImmediate).catch(() => {});
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

      {showUserSettingsModal && (
        <UserSettingsModal
          currentUserId={currentUserId}
          characters={saveData.characters}
          onImportNyans={handleImportNyans}
          onClose={() => setShowUserSettingsModal(false)}
          onResetUserData={handleResetUserData}
          onSwitchUser={handleSwitchUser}
          onOpenDevConsole={() => {
            setShowUserSettingsModal(false);
            setShowSyncModal(true);
          }}
        />
      )}

      {showSyncModal && (
        <DataSyncModal
          characters={saveData.characters}
          saveData={saveData}
          initialTab={adminInitialTab}
          onClose={() => {
            setShowSyncModal(false);
            if (typeof window !== 'undefined') {
              try {
                const url = new URL(window.location.href);
                let changed = false;
                ['admin', 'modal', 'mode', 'subtab', 'admintab', 'section', 'pass', 'key', 'password'].forEach((k) => {
                  if (url.searchParams.has(k)) {
                    url.searchParams.delete(k);
                    changed = true;
                  }
                });
                if (changed) {
                  window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
                }
              } catch (_e) {}
            }
          }}
          onImportNyans={handleImportNyans}
          onSaveFirebaseConfig={(_cfg) => {}}
          onUpdateSaveData={(updater, isImmediate = false) => {
            setSaveData((prev) => {
              const next = updater(prev);
              syncSaveDataToFirebase(next, isImmediate).catch(() => {});
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
