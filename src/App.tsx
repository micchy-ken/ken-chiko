import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  startNewActivity,
  rollEncounterForActivity,
  startTransit,
  pickRandomLocation,
  pickRandomTransport,
} from './services/simulation';
import { LOCATIONS, TRANSPORT_METHODS } from './data/locations';
import {
  loadSavedFirebaseConfig,
  syncSaveDataToFirebase,
  saveOnUserAction,
  saveOnAppExit,
  fetchInitialFirebaseState,
  saveLocalBackup,
  setQuotaStatusCallback,
  getIsQuotaExhausted,
  getFirebaseConnectionStatus,
  subscribeFirebaseConnectionStatus,
  testFirebaseConnection,
  endInitialConnectionPhase,
  FirebaseConnectionStatus,
  deduplicateDiary,
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
import { NyanIllustration } from './components/NyanIllustration';
import { GiftItemModal } from './components/GiftItemModal';
import { TravelModal } from './components/TravelModal';
import { DiaryView } from './components/DiaryView';
import { DataSyncModal, AdminTab } from './components/DataSyncModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { TutorialModal } from './components/TutorialModal';
import { OuenModal } from './components/OuenModal';
import { INITIAL_OUEN_CATEGORIES, INITIAL_OUEN_LIST } from './data/defaultOuen';
import { PencilSketchFilters } from './utils/pencilFilters';
import { saveLocalKenchikoImage, loadLocalKenchikoImage } from './services/imageCompression';
import { getActiveUserId, setActiveUserId } from './services/userService';

import {
  Eye,
  BookOpen,
  Gift,
  BookMarked,
  Settings,
  HelpCircle,
  Code2,
  User,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * Safely parse date string or numeric timestamp into milliseconds
 */
function parseTimestampSafe(val?: string | number): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) return parsed;
  const match = val.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const [, y, m, d, h = '0', min = '0', s = '0'] = match;
    const time = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s)).getTime();
    if (!isNaN(time)) return time;
  }
  return 0;
}

/**
 * Format encounter relative badge text
 */
function formatEncounterTimeBadge(timestamp: number, isCurrent: boolean): string {
  if (isCurrent) return 'いま一緒🐾';
  if (!timestamp || timestamp <= 0) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'たった今';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Safely merge newly synced master character definitions with current user progress
 * Strictly protects discovered status, encounter history, friendship, and custom attributes.
 */
function mergeMasterWithCurrentProgress(
  currentNyans: NyanCharacter[],
  masterNyans: NyanCharacter[]
): NyanCharacter[] {
  const map = new Map(currentNyans.map((c) => [c.no, c]));
  return masterNyans.map((up) => {
    const cur = map.get(up.no);
    if (!cur) return up;
    return {
      ...up,
      discovered: Boolean(cur.discovered || up.discovered),
      discoveryDate: cur.discoveryDate || up.discoveryDate,
      lastMetAt: Math.max(cur.lastMetAt || 0, up.lastMetAt || 0),
      friendshipLevel: Math.max(cur.friendshipLevel || 0, up.friendshipLevel || 0),
      playCount: Math.max(cur.playCount || 0, up.playCount || 0),
      customImageUrl: cur.customImageUrl || up.customImageUrl,
      rawImageUrl: cur.rawImageUrl || up.rawImageUrl,
      transparency: cur.transparency ?? up.transparency,
    };
  });
}

export default function App() {
  // Main Game Save Data State (Pure Firestore Source of Truth)
  const [saveData, setSaveData] = useState<GameSaveData>(DEFAULT_INITIAL_STATE);
  const saveDataRef = useRef<GameSaveData>(saveData);
  useEffect(() => {
    saveDataRef.current = saveData;
  }, [saveData]);

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
  const remainingTimeSecRef = useRef<number>(300);
  const isCompletingActivityRef = useRef<boolean>(false);
  const handleActivityCompletionRef = useRef<() => void>(() => {});
  const handleEncounterLotteryRef = useRef<() => void>(() => {});
  const isRollingEncounterRef = useRef<boolean>(false);
  const lastCompletionTimestampRef = useRef<number>(0);
  const nextEncounterCheckTimeRef = useRef<number>(0);

  const getRandomEncounterIntervalMs = () => {
    // 15 to 60 seconds (15000ms to 60000ms)
    return Math.floor(Math.random() * (60000 - 15000 + 1) + 15000);
  };

  // Modal States
  const [selectedZukanNyan, setSelectedZukanNyan] = useState<NyanCharacter | null>(null);
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [showTravelModal, setShowTravelModal] = useState<boolean>(false);
  const [showOuenModal, setShowOuenModal] = useState<boolean>(false);
  const [currentOuenCategoryId, setCurrentOuenCategoryId] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [isStandaloneAdmin, setIsStandaloneAdmin] = useState<boolean>(false);
  const [showUserSettingsModal, setShowUserSettingsModal] = useState<boolean>(false);
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(false);
  const [tutorialInitialStep, setTutorialInitialStep] = useState<number>(0);
  const [isNewFeatureTutorialOnly, setIsNewFeatureTutorialOnly] = useState<boolean>(false);
  const showTutorialModalRef = useRef<boolean>(false);
  const tutorialOpenTimestampRef = useRef<number | null>(null);
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab | undefined>(undefined);
  const [newEncounterToast, setNewEncounterToast] = useState<NyanCharacter | null>(null);

  // Guard flag: Ensure the encounter/activity lottery never begins until initial sync has fully settled
  const [isInitialSyncCompleted, setIsInitialSyncCompleted] = useState<boolean>(false);
  const isInitialSyncCompletedRef = useRef<boolean>(false);

  // Auto-dismiss new encounter toast after 12 seconds so it never lingers indefinitely
  useEffect(() => {
    if (!newEncounterToast) return;
    const timer = setTimeout(() => {
      setNewEncounterToast(null);
    }, 12000);
    return () => clearTimeout(timer);
  }, [newEncounterToast]);

  // Synchronize ref states
  useEffect(() => {
    showTutorialModalRef.current = showTutorialModal;
  }, [showTutorialModal]);

  useEffect(() => {
    remainingTimeSecRef.current = remainingTimeSec;
  }, [remainingTimeSec]);

  // Pause game progression while tutorial modal is visible
  // When closing tutorial, shift activityStartedAt forward by the exact paused duration
  useEffect(() => {
    if (showTutorialModal) {
      tutorialOpenTimestampRef.current = Date.now();
    } else if (tutorialOpenTimestampRef.current !== null) {
      const pausedDurationMs = Date.now() - tutorialOpenTimestampRef.current;
      tutorialOpenTimestampRef.current = null;
      if (pausedDurationMs > 300) {
        setSaveData((prev) => {
          const currentStartedAt = prev.kenchiko.activityStartedAt || Date.now();
          return {
            ...prev,
            kenchiko: {
              ...prev.kenchiko,
              activityStartedAt: currentStartedAt + pausedDurationMs,
            },
          };
        });
      }
    }
  }, [showTutorialModal]);

  // Check if first-time user tutorial or new feature announcement should be shown on app launch
  useEffect(() => {
    try {
      const tutorialSeen = localStorage.getItem('kenchiko_tutorial_seen');
      const ouenSeen = localStorage.getItem('kenchiko_ouen_tutorial_seen');
      const isDevOrAdmin = typeof window !== 'undefined' && (
        window.location.search.includes('admin') ||
        window.location.search.includes('dev') ||
        window.location.search.includes('modal=admin') ||
        window.location.search.includes('tab=admin')
      );
      if (!isDevOrAdmin) {
        if (!tutorialSeen) {
          // Brand new user: Show full tutorial starting from step 0 (steps 1 to 4)
          setTutorialInitialStep(0);
          setIsNewFeatureTutorialOnly(false);
          setShowTutorialModal(true);
        } else if (!ouenSeen) {
          // Existing user who hasn't seen the cheer feature announcement: Show Step 4 directly
          setTutorialInitialStep(3);
          setIsNewFeatureTutorialOnly(true);
          setShowTutorialModal(true);
        }
      }
    } catch (_e) {
      // Ignore local storage errors
    }
  }, []);

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

      const validAdminTabs: AdminTab[] = ['zukan', 'avatar', 'kihon_nyan', 'asobi', 'users', 'database', 'googledoc', 'firebase', 'github', 'csv'];

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
        setIsStandaloneAdmin(true);
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

    // B. Immediate cloud connection & master synchronization pipeline
    const runInitialBootSync = async () => {
      let activeData = saveDataRef.current;

      try {
        const res = await fetchInitialFirebaseState();
        if (!isMounted) return;
        if (res.success && res.data) {
          isRemoteUpdateRef.current = true;
          const mergedData = { ...res.data };
          if (!mergedData.kenchiko.customImageUrl && localImg) {
            mergedData.kenchiko.customImageUrl = localImg;
          } else if (mergedData.kenchiko.customImageUrl) {
            saveLocalKenchikoImage(mergedData.kenchiko.customImageUrl);
          }
          activeData = mergedData;
          setSaveData(mergedData);
          setIsFirebaseSynced(true);
        }
      } catch (err) {
        console.warn('Firebase initial load note:', err);
      }

      // Master Data Refresh Check (at most once every 12 hours)
      const lastCheckStr = localStorage.getItem(LAST_MASTER_CHECK_KEY);
      const lastCheckTime = lastCheckStr ? parseInt(lastCheckStr, 10) || 0 : 0;
      const now = Date.now();
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;

      if (now - lastCheckTime >= TWELVE_HOURS) {
        localStorage.setItem(LAST_MASTER_CHECK_KEY, String(now));
        try {
          const masterCheckPromise = async () => {
            let workingCharacters = activeData.characters;
            // 1. Google Docs Master Read
            const docUrl = getSavedGoogleDocUrl() || DEFAULT_GOOGLE_DOC_URL;
            if (docUrl && docUrl.trim().length > 0) {
              try {
                const docRes = await syncNyansFromGoogleDoc(docUrl, workingCharacters);
                if (docRes.success && (docRes.addedCount > 0 || docRes.updatedCount > 0)) {
                  workingCharacters = mergeMasterWithCurrentProgress(workingCharacters, docRes.updatedNyans);
                }
              } catch {}
            }

            // 2. Google Drive Images Master Read
            const driveFolderUrl =
              activeData.googleDriveFolderUrl ||
              getSavedGoogleDriveFolderUrl() ||
              DEFAULT_GOOGLE_DRIVE_FOLDER_URL;
            let newKihonImg = activeData.kihonNyanCustomImageUrl;
            if (driveFolderUrl && driveFolderUrl.trim().length > 0) {
              try {
                const driveRes = await syncImagesFromGoogleDriveFolder(driveFolderUrl, workingCharacters);
                if (driveRes.success) {
                  if (driveRes.matchedCount > 0) {
                    workingCharacters = mergeMasterWithCurrentProgress(workingCharacters, driveRes.updatedNyans);
                  }
                  if (driveRes.kihonNyanImageUrl && driveRes.kihonNyanImageUrl !== activeData.kihonNyanCustomImageUrl) {
                    newKihonImg = driveRes.kihonNyanImageUrl;
                  }
                }
              } catch {}
            }

            if (workingCharacters !== activeData.characters || newKihonImg !== activeData.kihonNyanCustomImageUrl) {
              const nextData: GameSaveData = {
                ...activeData,
                characters: workingCharacters,
                googleDriveFolderUrl: driveFolderUrl,
                kihonNyanCustomImageUrl: newKihonImg || activeData.kihonNyanCustomImageUrl,
                lastSaved: Date.now(),
              };
              activeData = nextData;
              setSaveData(nextData);
              saveLocalBackup(nextData);
            }
          };

          // Limit master sync during boot to 3.5s so game never stalls
          await Promise.race([
            masterCheckPromise(),
            new Promise((resolve) => setTimeout(resolve, 3500)),
          ]);
        } catch (err) {
          console.warn('Master check during startup note:', err);
        }
      }

      if (!isMounted) return;

      // Synchronization is now 100% complete!
      endInitialConnectionPhase();
      setIsLoadingFirebase(false);
      isInitialSyncCompletedRef.current = true;
      setIsInitialSyncCompleted(true);

      // If in transit, ensure duration is strictly 20s (normalize any legacy saved data)
      if (activeData.kenchiko.currentActivity === 'transit' && activeData.kenchiko.activityDurationSec !== 20) {
        activeData = {
          ...activeData,
          kenchiko: {
            ...activeData.kenchiko,
            activityDurationSec: 20,
          },
        };
        setSaveData(activeData);
      }

      // Now calculate remaining time
      const transitCap = activeData.kenchiko.currentActivity === 'transit' ? 20 : activeData.kenchiko.activityDurationSec;
      const elapsedRealSec = Math.floor((Date.now() - activeData.kenchiko.activityStartedAt) / 1000);
      const initialRemaining = Math.max(0, transitCap - elapsedRealSec);
      remainingTimeSecRef.current = initialRemaining;
      setRemainingTimeSec(initialRemaining);

      // If activity finished while user was away, trigger completion now that sync has settled!
      if (initialRemaining <= 0) {
        setTimeout(() => {
          if (isMounted) handleActivityCompletionRef.current();
        }, 150);
      } else {
        nextEncounterCheckTimeRef.current = 0;
      }
    };

    runInitialBootSync();

    // Fallback timer: guarantee sync completion flag is set within 5 seconds even under total network cutoff
    const fallbackTimer = setTimeout(() => {
      if (!isInitialSyncCompletedRef.current) {
        isInitialSyncCompletedRef.current = true;
        setIsInitialSyncCompleted(true);
        setIsLoadingFirebase(false);
        endInitialConnectionPhase();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsubStatus();
    };
  }, []);

  // Master Data Refresh key
  const LAST_MASTER_CHECK_KEY = 'kenchiko_last_master_check_time_v2';

  // Hook up exit save (beforeunload)
  useEffect(() => {
    const handleUnload = () => {
      if (saveDataRef.current) {
        saveOnAppExit(saveDataRef.current);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Current Companion Nyan
  const companionNyan = useMemo(() => {
    if (!saveData.kenchiko.currentCompanionNyanId) return null;
    return (
      saveData.characters.find((c) => c.no === saveData.kenchiko.currentCompanionNyanId) || null
    );
  }, [saveData.characters, saveData.kenchiko.currentCompanionNyanId]);

  // Recently encountered nyans (strictly ordered by most recently encountered first)
  const recentlyEncounteredNyans = useMemo(() => {
    // 1. Build a lookup map of the latest encounter timestamp from diary entries
    const diaryEncounterMap = new Map<number, number>();
    for (const entry of saveData.diary) {
      if (entry.nyanId) {
        const prev = diaryEncounterMap.get(entry.nyanId) || 0;
        if (entry.timestamp > prev) {
          diaryEncounterMap.set(entry.nyanId, entry.timestamp);
        }
      }
    }

    const currentCompanionId = saveData.kenchiko.currentCompanionNyanId;

    return saveData.characters
      .filter((c) => c.discovered)
      .map((c) => {
        const isCurrent = currentCompanionId === c.no;
        const diaryTime = diaryEncounterMap.get(c.no) || 0;
        const lastMetTime = c.lastMetAt || 0;
        const discoveryTime = parseTimestampSafe(c.discoveryDate);

        // If currently accompanying Kenchiko right now, highest priority
        const effectiveTime = isCurrent
          ? Date.now() + 100000000
          : Math.max(diaryTime, lastMetTime, discoveryTime);

        return {
          nyan: c,
          effectiveTime,
          isCurrent,
        };
      })
      .sort((a, b) => {
        if (b.effectiveTime !== a.effectiveTime) {
          return b.effectiveTime - a.effectiveTime; // Most recently encountered first
        }
        return b.nyan.no - a.nyan.no;
      })
      .map((item) => ({
        ...item.nyan,
        isCurrentCompanion: item.isCurrent,
        lastEncounterTime: item.effectiveTime,
      }));
  }, [saveData.characters, saveData.diary, saveData.kenchiko.currentCompanionNyanId]);

  // Encounter Lottery Handler (Fires after 5s has elapsed, then every 15-60s at 30% chance. Once a cat appears, no more cats in this location)
  const handleEncounterLottery = useCallback(() => {
    if (!isInitialSyncCompletedRef.current || isStandaloneAdmin || showSyncModal || showTutorialModalRef.current) return;
    if (isRollingEncounterRef.current) return;

    isRollingEncounterRef.current = true;

    try {
      setSaveData((prev) => {
        const curK = prev.kenchiko;
        // Do not roll if in transit, cheering, or if a cat has already appeared at this location
        if (
          curK.currentActivity === 'transit' ||
          curK.currentActivity === 'cheering' ||
          curK.encounterChecked ||
          curK.currentCompanionNyanId !== null
        ) {
          nextEncounterCheckTimeRef.current = Infinity;
          return prev;
        }

        const updatedCharacters = [...prev.characters];
        const updatedDiary = [...prev.diary];
        const updatedStats = { ...prev.stats };
        let isNewlyDiscoveredNyan = false;

        const encounterRes = rollEncounterForActivity(
          curK.currentLocation,
          updatedCharacters,
          { type: curK.currentActivity, title: curK.currentActivityTitle },
          prev.asobiList
        );

        if (encounterRes.companionNyan) {
          // HIT (30% success): A cat appeared!
          const comp = encounterRes.companionNyan;
          const nextCompanionId = comp.no;
          const nextTitle = encounterRes.updatedTitle || curK.currentActivityTitle;

          // Set check time to Infinity so no further checks happen at this location
          nextEncounterCheckTimeRef.current = Infinity;

          if (curK.currentActivity === 'snacking') updatedStats.totalSnacksEaten += 1;
          if (curK.currentActivity === 'nap') updatedStats.totalNapMinutes += Math.round(curK.activityDurationSec / 60);

          const compIdx = updatedCharacters.findIndex((c) => c.no === comp.no);
          if (compIdx >= 0) {
            updatedCharacters[compIdx] = {
              ...updatedCharacters[compIdx],
              lastMetAt: Date.now(),
              playCount: (updatedCharacters[compIdx].playCount || 0) + 1,
            };
          }

          if (encounterRes.newDiscoveredNyan) {
            isNewlyDiscoveredNyan = true;
            const charIndex = updatedCharacters.findIndex((c) => c.no === encounterRes.newDiscoveredNyan!.no);
            if (charIndex >= 0) {
              updatedCharacters[charIndex] = {
                ...updatedCharacters[charIndex],
                discovered: true,
                discoveryDate: new Date().toLocaleString('ja-JP'),
                lastMetAt: Date.now(),
                playCount: 1,
                friendshipLevel: 1,
              };
              updatedStats.totalEncounters += 1;
              setNewEncounterToast(updatedCharacters[charIndex]);
              try {
                confetti({ particleCount: 35, spread: 80, origin: { y: 0.5 } });
              } catch {}
            }
          }

          if (encounterRes.diaryText) {
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
              activityTitle: nextTitle,
              nyanId: nextCompanionId,
              nyanName: comp.name,
              itemUsed: null,
              mood: curK.mood,
              text: encounterRes.diaryText,
            });
          }

          const nextData: GameSaveData = {
            ...prev,
            characters: updatedCharacters,
            diary: deduplicateDiary(updatedDiary).slice(0, 50),
            stats: updatedStats,
            lastSaved: Date.now(),
            kenchiko: {
              ...curK,
              currentCompanionNyanId: nextCompanionId,
              encounterChecked: true, // Marked as encountered at this location
              currentActivityTitle: nextTitle,
              monologue: curK.monologue,
            },
          };

          saveLocalBackup(nextData);
          if (isNewlyDiscoveredNyan) {
            syncSaveDataToFirebase(nextData, true).catch((err) => {
              console.warn('Discovered nyan cloud sync note:', err);
            });
          }
          return nextData;
        } else {
          // MISS (70%): No cat appeared yet. Schedule next check in 15-60 seconds.
          nextEncounterCheckTimeRef.current = Date.now() + getRandomEncounterIntervalMs();
          return prev;
        }
      });
    } finally {
      setTimeout(() => {
        isRollingEncounterRef.current = false;
      }, 500);
    }
  }, [isStandaloneAdmin, showSyncModal]);

  useEffect(() => {
    handleEncounterLotteryRef.current = handleEncounterLottery;
  }, [handleEncounterLottery]);

  // Activity Completion Handler (Discrete Firebase push on activity change)
  const handleActivityCompletion = useCallback(() => {
    // CRITICAL: Never advance game simulation or write to DB if initial sync is running or modal is open!
    if (!isInitialSyncCompletedRef.current || isStandaloneAdmin || showSyncModal || showTutorialModalRef.current) return;

    const now = Date.now();
    // Re-entrancy guard to prevent multiple parallel or near-simultaneous triggers
    if (isCompletingActivityRef.current) return;
    if (now - lastCompletionTimestampRef.current < 1200) return;

    isCompletingActivityRef.current = true;
    lastCompletionTimestampRef.current = now;

    try {
      setSaveData((prev) => {
        const curK = prev.kenchiko;
        const updatedStats = { ...prev.stats };
        let nextData: GameSaveData;

        // Case A: Just arrived from transit -> Immediately begin full 5-minute activity at target location!
        if (curK.currentActivity === 'transit' && curK.targetLocation) {
          const nextLocation = curK.targetLocation;
          updatedStats.totalTrips += 1;
          setNewEncounterToast(null);
          nextEncounterCheckTimeRef.current = 0; // Reset timer for new location

          const newAct = startNewActivity(nextLocation, prev.asobiList);
          setRemainingTimeSec(newAct.durationSec);

          nextData = {
            ...prev,
            stats: updatedStats,
            lastSaved: Date.now(),
            kenchiko: {
              ...curK,
              currentLocation: nextLocation,
              targetLocation: null,
              transportMethod: null,
              currentActivity: newAct.type,
              currentActivityTitle: newAct.title,
              activityStartedAt: Date.now(),
              lastArrivedAt: Date.now(),
              activityDurationSec: newAct.durationSec,
              currentCompanionNyanId: null,
              encounterChecked: false,
              monologue:
                newAct.customMonologue ||
                getRandomMonologue(
                  newAct.type,
                  nextLocation,
                  null,
                  prev.asobiList
                ),
            },
          };
        } else {
          // Case B: Finished activity at current location -> 45% travel to new place, 55% start another activity here
          const shouldMove = Math.random() < 0.45;

          if (shouldMove) {
            setNewEncounterToast(null); // Clear toast when departing
            nextEncounterCheckTimeRef.current = 0;
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
                encounterChecked: false,
                monologue: getRandomMonologue(
                  'transit',
                  curK.currentLocation,
                  transport,
                  prev.asobiList
                ),
              },
            };
          } else {
            // Case C: Start next activity at current location
            setNewEncounterToast(null);
            const newAct = startNewActivity(curK.currentLocation, prev.asobiList);
            setRemainingTimeSec(newAct.durationSec);

            // If a cat already appeared during this location stay, keep encounterChecked true so no more appear
            const alreadyEncountered = curK.encounterChecked || curK.currentCompanionNyanId !== null;

            nextData = {
              ...prev,
              stats: updatedStats,
              lastSaved: Date.now(),
              kenchiko: {
                ...curK,
                currentActivity: newAct.type,
                currentActivityTitle: newAct.title,
                activityStartedAt: Date.now(),
                activityDurationSec: newAct.durationSec,
                encounterChecked: alreadyEncountered,
                monologue:
                  newAct.customMonologue ||
                  getRandomMonologue(
                    newAct.type,
                    curK.currentLocation,
                    null,
                    prev.asobiList
                  ),
              },
            };
          }
        }

        saveLocalBackup(nextData);
        return nextData;
      });
    } finally {
      setTimeout(() => {
        isCompletingActivityRef.current = false;
      }, 800);
    }
  }, []);

  useEffect(() => {
    handleActivityCompletionRef.current = handleActivityCompletion;
  }, [handleActivityCompletion]);

  // Primary Simulation Tick Loop (UI countdown display & 15-60s encounter trigger)
  useEffect(() => {
    // Completely freeze simulation loop until initial sync is 100% complete, or if admin / sync modal / tutorial is open
    if (!isInitialSyncCompleted || isLoadingFirebase || isStandaloneAdmin || showSyncModal || showTutorialModal) return;

    const interval = setInterval(() => {
      let isCompleted = false;

      setRemainingTimeSec((prev) => {
        const nextTime = prev - timeSpeed;
        if (nextTime <= 0) {
          isCompleted = true;
          return 0;
        }
        return nextTime;
      });

      // Encounter Check: After 5 seconds elapsed, then every 15-60s with 30% chance.
      // Once a cat appears, no more cats appear in this location.
      const curK = saveDataRef.current.kenchiko;
      const now = Date.now();
      const elapsedSinceStart = now - (curK.activityStartedAt || now);

      if (
        curK.currentActivity !== 'transit' &&
        curK.currentActivity !== 'cheering' &&
        !curK.encounterChecked &&
        curK.currentCompanionNyanId === null &&
        isInitialSyncCompletedRef.current &&
        elapsedSinceStart >= 5000
      ) {
        if (nextEncounterCheckTimeRef.current === 0) {
          // Initialize first check time (15-60s from now)
          nextEncounterCheckTimeRef.current = now + getRandomEncounterIntervalMs();
        } else if (now >= nextEncounterCheckTimeRef.current) {
          handleEncounterLotteryRef.current();
        }
      }

      if (isCompleted) {
        handleActivityCompletion();
      }
    }, 1000);

    // Reconcile remaining time when returning to the tab / window focus
    const handleVisibilityOrFocus = () => {
      if (!isInitialSyncCompletedRef.current || isStandaloneAdmin || showSyncModal || showTutorialModalRef.current) return;
      if (document.visibilityState === 'visible') {
        const startedAt = saveData.kenchiko.activityStartedAt || Date.now();
        const durationSec = saveData.kenchiko.currentActivity === 'transit'
          ? 20
          : (saveData.kenchiko.activityDurationSec || 300);
        const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, durationSec - elapsedSec);
        setRemainingTimeSec(remaining);

        // Check if encounter check should fire upon return
        const curK = saveDataRef.current.kenchiko;
        const now = Date.now();
        if (
          curK.currentActivity !== 'transit' &&
          curK.currentActivity !== 'cheering' &&
          !curK.encounterChecked &&
          curK.currentCompanionNyanId === null &&
          elapsedSec >= 5 &&
          (nextEncounterCheckTimeRef.current === 0 || now >= nextEncounterCheckTimeRef.current)
        ) {
          handleEncounterLotteryRef.current();
        }

        if (remaining <= 0) {
          handleActivityCompletion();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [timeSpeed, saveData.kenchiko.currentActivity, saveData.kenchiko.currentLocation, saveData.kenchiko.activityStartedAt, saveData.kenchiko.activityDurationSec, isInitialSyncCompleted, isLoadingFirebase, isStandaloneAdmin, showSyncModal, showTutorialModal, handleActivityCompletion, handleEncounterLottery]);

  // User Actions: Cheer Me Up (応援して - 15 seconds, no cats during cheer)
  const handleSelectOuenCategory = (categoryId: string) => {
    setShowOuenModal(false);
    setCurrentOuenCategoryId(categoryId);

    const categories = saveData.ouenCategories && saveData.ouenCategories.length > 0
      ? saveData.ouenCategories
      : INITIAL_OUEN_CATEGORIES;
    const catObj = categories.find((c) => c.id === categoryId);
    const catLabel = catObj ? catObj.label : 'つかれた';

    const list = saveData.ouenList && saveData.ouenList.length > 0
      ? saveData.ouenList
      : INITIAL_OUEN_LIST;

    const matched = list.filter((item) => item.categoryId === categoryId);
    const chosenItem = matched.length > 0
      ? matched[Math.floor(Math.random() * matched.length)]
      : (list[0] || { message: 'よしよし' });

    const cheerMessage = chosenItem.message || 'よしよし';
    const cheerDurationSec = 15; // 15 seconds

    setRemainingTimeSec(cheerDurationSec);
    setNewEncounterToast(null);

    setSaveData((prev) => {
      const curK = prev.kenchiko;
      const updatedStats = { ...prev.stats };
      updatedStats.totalPetCount = (updatedStats.totalPetCount || 0) + 1;

      const locInfo = LOCATIONS[curK.currentLocation] || LOCATIONS.living;
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
          activityTitle: `けんちこに応援してもらった（${catLabel}）`,
          nyanId: null,
          nyanName: null,
          itemUsed: null,
          mood: 'happy',
          text: `${locInfo.name}でけんちこに応援してもらった。「${cheerMessage}」と寄り添ってくれて心がぽかぽか温かくなった。`,
        },
        ...prev.diary,
      ];

      const nextData: GameSaveData = {
        ...prev,
        diary: updatedDiary.slice(0, 50),
        stats: updatedStats,
        lastSaved: Date.now(),
        kenchiko: {
          ...curK,
          currentActivity: 'cheering',
          currentActivityTitle: 'けんちこが応援中',
          activityStartedAt: Date.now(),
          activityDurationSec: cheerDurationSec,
          currentCompanionNyanId: null, // No cat during cheer
          encounterChecked: true, // Mark encounter checked so no cat spawns
          monologue: cheerMessage,
          happiness: Math.min(100, curK.happiness + 20),
        },
      };

      saveLocalBackup(nextData);
      return nextData;
    });

    try {
      confetti({
        particleCount: 35,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D4736A', '#FFB3BA', '#FFE4E1', '#E7CBA9', '#E06D53'],
      });
    } catch {}
  };

  // User Actions: "もっと！" (More Cheer - picks a new cheer message & waits another 15s)
  const handleCheerMore = () => {
    const categories = saveData.ouenCategories && saveData.ouenCategories.length > 0
      ? saveData.ouenCategories
      : INITIAL_OUEN_CATEGORIES;
    const targetCatId = currentOuenCategoryId || (categories[0] ? categories[0].id : 'tired');
    const catObj = categories.find((c) => c.id === targetCatId);
    const catLabel = catObj ? catObj.label : '応援';

    const list = saveData.ouenList && saveData.ouenList.length > 0
      ? saveData.ouenList
      : INITIAL_OUEN_LIST;

    const matched = list.filter((item) => item.categoryId === targetCatId);
    const available = matched.length > 1
      ? matched.filter((item) => item.message !== saveData.kenchiko.monologue)
      : matched;

    const chosenItem = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : (matched[0] || list[Math.floor(Math.random() * list.length)] || { message: 'ぎゅーっ！' });

    const cheerMessage = chosenItem.message || 'ぎゅーっ！';
    const cheerDurationSec = 15; // 15 seconds

    setRemainingTimeSec(cheerDurationSec);

    setSaveData((prev) => {
      const curK = prev.kenchiko;
      const updatedStats = { ...prev.stats };
      updatedStats.totalPetCount = (updatedStats.totalPetCount || 0) + 1;

      const locInfo = LOCATIONS[curK.currentLocation] || LOCATIONS.living;
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
          activityTitle: `けんちこにもっと応援してもらった（${catLabel}）`,
          nyanId: null,
          nyanName: null,
          itemUsed: null,
          mood: 'happy',
          text: `${locInfo.name}で「もっと！」とお願いしたら、けんちこが「${cheerMessage}」とさらに応援してくれた。`,
        },
        ...prev.diary,
      ];

      const nextData: GameSaveData = {
        ...prev,
        diary: updatedDiary.slice(0, 50),
        stats: updatedStats,
        lastSaved: Date.now(),
        kenchiko: {
          ...curK,
          currentActivity: 'cheering',
          currentActivityTitle: 'けんちこが応援中',
          activityStartedAt: Date.now(),
          activityDurationSec: cheerDurationSec,
          currentCompanionNyanId: null,
          encounterChecked: true,
          monologue: cheerMessage,
          happiness: Math.min(100, curK.happiness + 15),
        },
      };

      saveLocalBackup(nextData);
      return nextData;
    });

    try {
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#D4736A', '#FFB3BA', '#FFE4E1', '#E7CBA9', '#E06D53'],
      });
    } catch {}
  };

  // User Actions: "気がすんだ" (Cheer Done - finishes cheering and proceeds to next activity immediately)
  const handleCheerDone = () => {
    handleActivityCompletion();
  };

  // User Actions: Petting (local update only, zero Firestore writes)
  const handlePetKenchiko = () => {
    setSaveData((prev) => {
      const nextData: GameSaveData = {
        ...prev,
        lastSaved: Date.now(),
        kenchiko: {
          ...prev.kenchiko,
          happiness: Math.min(100, prev.kenchiko.happiness + 10),
        },
      };
      saveLocalBackup(nextData);
      return nextData;
    });
  };

  // User Actions: Manual Monologue update (strictly local, zero cloud writes)
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
      saveLocalBackup(nextData);
      return nextData;
    });
  };

  // User Actions: Start Random Travel (random destination & transport, 20s)
  const handleStartRandomTravel = () => {
    if (saveData.kenchiko.currentActivity === 'transit') return;
    if (
      saveData.kenchiko.lastArrivedAt &&
      Date.now() - saveData.kenchiko.lastArrivedAt < 120 * 1000
    ) {
      return;
    }
    const destination = pickRandomLocation(saveData.kenchiko.currentLocation);
    const transport = pickRandomTransport();
    handleStartTravel(destination, transport);
  };

  // User Actions: Start Travel to specific destination (20s)
  const handleStartTravel = (destination: LocationId, transport: TransportMethod) => {
    if (saveData.kenchiko.currentActivity === 'transit') return;
    if (
      saveData.kenchiko.lastArrivedAt &&
      Date.now() - saveData.kenchiko.lastArrivedAt < 120 * 1000
    ) {
      return;
    }

    setNewEncounterToast(null);
    nextEncounterCheckTimeRef.current = 0;
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
          encounterChecked: false,
          monologue: getRandomMonologue(
            'transit',
            prev.kenchiko.currentLocation,
            transport,
            prev.asobiList
          ),
        },
      };
      saveOnUserAction(nextData).catch(() => {});
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

      saveOnUserAction(nextData).catch(() => {});
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
      saveOnUserAction(nextData).catch(() => {});
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
      saveOnUserAction(nextData).catch(() => {});
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
      saveOnUserAction(nextData).catch(() => {});
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
      saveOnUserAction(nextData).catch(() => {});
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
    try {
      localStorage.removeItem('kenchiko_tutorial_seen');
      localStorage.removeItem('kenchiko_ouen_tutorial_seen');
    } catch (_e) {}
    setTutorialInitialStep(0);
    setIsNewFeatureTutorialOnly(false);
    setShowTutorialModal(true);
    saveOnUserAction(freshState).catch(() => {});
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
          const duration = res.data.kenchiko.currentActivity === 'transit'
            ? 20
            : (res.data.kenchiko.activityDurationSec || 300);
          const elapsed = Math.floor((Date.now() - res.data.kenchiko.activityStartedAt) / 1000);
          setRemainingTimeSec(Math.max(0, duration - elapsed));
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
          saveOnUserAction(freshData).catch(() => {});
        }
        setIsLoadingFirebase(false);
      })
      .catch(() => {
        setIsLoadingFirebase(false);
      });
  };

  const handleCloseAdmin = () => {
    setIsStandaloneAdmin(false);
    setShowSyncModal(false);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        let changed = false;
        ['admin', 'dev', 'develop', 'modal', 'mode', 'subtab', 'admintab', 'section', 'pass', 'key', 'password'].forEach((k) => {
          if (url.searchParams.has(k)) {
            url.searchParams.delete(k);
            changed = true;
          }
        });
        if (url.searchParams.get('tab') === 'admin' || url.searchParams.get('tab') === 'dev' || url.searchParams.get('tab') === 'sync') {
          url.searchParams.delete('tab');
          changed = true;
        }
        if (changed) {
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch (_e) {}
    }
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

  // Standalone Admin Screen (When accessed via ?admin= or ?dev=)
  // No game screen or stage is rendered in the background!
  if (isStandaloneAdmin) {
    return (
      <div className="min-h-screen bg-[#F4EFE6] text-[#2E2824] font-['Zen_Maru_Gothic','M_PLUS_Rounded_1c',sans-serif]">
        <PencilSketchFilters />
        <DataSyncModal
          isStandalone={true}
          characters={saveData.characters}
          saveData={saveData}
          initialTab={adminInitialTab}
          onClose={handleCloseAdmin}
          onImportNyans={handleImportNyans}
          onSaveFirebaseConfig={(_cfg) => {}}
          onUpdateSaveData={(updater, isImmediate = false) => {
            setSaveData((prev) => {
              const next = updater(prev);
              if (isImmediate) {
                syncSaveDataToFirebase(next, true).catch(() => {});
              } else {
                saveOnUserAction(next).catch(() => {});
              }
              return next;
            });
          }}
        />
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

      {/* Mode Alert Bar (Offline or Local Protection Mode) */}
      {!connectionStatus.isAutoSyncEnabled ? (
        <div className="bg-[#F4F9F5] border-b border-[#C6D8CD] px-4 py-2.5 shadow-inner">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3 flex-shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#487560]"></span>
              </span>
              <div>
                <span className="font-handwriting font-bold text-xs text-[#2A4839] mr-2">
                  【クラウド自動書き込み停止中・ローカル完全保護】
                </span>
                <span className="text-xs text-[#3E6350]">
                  意図しないクラウド書き込みは行われません。ゲームの進行はローカルに安全保存され、必要な時に「設定」から手動保存できます。
                </span>
              </div>
            </div>
            <div className="text-[11px] font-mono font-bold text-[#487560] self-end sm:self-auto bg-white px-2.5 py-1 rounded-lg border border-[#C6D8CD]">
              本日書き込み: {connectionStatus.dailyWriteCount || 0} / {connectionStatus.maxDailyWrites || 60} 回
            </div>
          </div>
        </div>
      ) : connectionStatus.isOffline ? (
        <div className="bg-[#FFF4F2] border-b-2 border-[#E74C3C]/40 px-4 py-3 shadow-inner">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="relative flex h-3.5 w-3.5 mt-0.5 sm:mt-0 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.9)] ring-2 ring-red-300"></span>
              </span>
              <div>
                <span className="font-handwriting font-black text-sm text-[#922B21] mr-2">
                  【ローカル保持中 / オフライン】
                </span>
                <span className="text-xs text-[#78281F]">
                  Firebaseと未接続です。意図しない書き込みは発生せず、ゲームの進行は端末内で安全に保持されています。
                </span>
                {connectionStatus.lastError && (
                  <span className="block text-[10px] text-[#A93226] font-mono mt-0.5 opacity-80 truncate max-w-xl">
                    詳細: {connectionStatus.lastError}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
              <span className="text-[11px] font-mono font-bold text-[#922B21] bg-white px-2.5 py-1 rounded-lg border border-red-200">
                本日: {connectionStatus.dailyWriteCount || 0} / {connectionStatus.maxDailyWrites || 60} 回
              </span>
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
      ) : null}

      {/* Discovery Toast Notification */}
      {newEncounterToast && (
        <div className="fixed top-20 right-4 z-40 max-w-sm bg-[#3A342F] text-[#FAF8F5] p-3.5 rounded-2xl border-2 border-[#D4B996] shadow-2xl animate-bounce">
          <div className="flex items-center justify-between gap-2.5">
            <button
              onClick={() => {
                setSelectedZukanNyan(newEncounterToast);
                setNewEncounterToast(null);
              }}
              title="クリックして図鑑詳細を見る"
              className="flex items-center gap-3 text-left flex-1 min-w-0 group hover:opacity-90 transition"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-[#FAF8F4] p-1 flex items-center justify-center border border-[#D4B996]/50 shadow-inner group-hover:scale-105 transition transform">
                <NyanIllustration
                  nyan={newEncounterToast}
                  size={42}
                  isDiscovered={true}
                  transparent={true}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[#E5C9A4] font-black tracking-wider flex items-center gap-1 font-handwriting">
                  <span>🎉 新しいにゃんを発見！</span>
                </div>
                <h4 className="text-sm font-black text-white truncate font-handwriting">
                  {newEncounterToast.name}
                </h4>
                <p className="text-[11px] text-[#D4C8B5] font-bold underline decoration-dotted font-handwriting">
                  タップして詳細を見る →
                </p>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNewEncounterToast(null);
              }}
              title="閉じる"
              className="w-7 h-7 rounded-full bg-[#4E463F] hover:bg-[#625950] text-[#D4C8B5] hover:text-white flex items-center justify-center text-xs font-bold transition shrink-0 ml-1"
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
              characters={saveData.characters}
              remainingTimeSec={remainingTimeSec}
              timeSpeed={timeSpeed}
              onPet={handlePetKenchiko}
              onOpenOuenModal={() => setShowOuenModal(true)}
              onCheerMore={handleCheerMore}
              onCheerDone={handleCheerDone}
              onOpenGiftModal={() => setShowGiftModal(true)}
              onStartRandomTravel={handleStartRandomTravel}
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

              {recentlyEncounteredNyans.length === 0 ? (
                <div className="text-center py-4 bg-[#F5F2EA] rounded-2xl border border-dashed border-[#DDD7C8]">
                  <p className="text-xs font-bold text-[#8C837A]">
                    まだ出会った◯◯にゃんはいません。けんちこと一緒にお出かけしてみよう！
                  </p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
                  {recentlyEncounteredNyans.slice(0, 15).map((nyan) => {
                    const isCurrent = nyan.isCurrentCompanion;
                    const timeBadge = formatEncounterTimeBadge(nyan.lastEncounterTime, isCurrent);

                    return (
                      <button
                        key={nyan.no}
                        onClick={() => setSelectedZukanNyan(nyan)}
                        title={`${nyan.name}（クリックして詳細を見る）`}
                        className={`group relative flex-shrink-0 w-28 p-2.5 rounded-2xl border text-center transition hover:-translate-y-0.5 active:translate-y-0 flex flex-col items-center justify-between ${
                          isCurrent
                            ? 'bg-[#FFF9EE] border-[#D97543] shadow-[0_2px_10px_rgba(217,117,67,0.18)] ring-1 ring-[#D97543]/60'
                            : 'bg-[#F5F2EA] hover:bg-[#EFECE4] border-[#DDD7C8] shadow-sm'
                        }`}
                      >
                        {timeBadge && (
                          <div
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full mb-1 ${
                              isCurrent
                                ? 'bg-[#D97543] text-white animate-pulse'
                                : 'bg-[#E5DFD3] text-[#6E665C]'
                            }`}
                          >
                            {timeBadge}
                          </div>
                        )}

                        <div className="w-full flex items-center justify-between text-[10px] font-mono text-[#7D756D] font-bold">
                          <span>No.{String(nyan.no).padStart(3, '0')}</span>
                          {nyan.playCount > 0 && (
                            <span className="text-[#D97543] text-[9px] font-bold">★{nyan.playCount}</span>
                          )}
                        </div>

                        <div className="my-1 flex items-center justify-center h-12 w-12 group-hover:scale-105 transition transform">
                          <NyanIllustration
                            nyan={nyan}
                            size={44}
                            isDiscovered={true}
                            transparent={true}
                          />
                        </div>

                        <div className="w-full">
                          <div className="text-xs font-black text-[#3A342F] truncate">
                            {nyan.name}
                          </div>
                          <div className="text-[9px] text-[#8C837A] truncate">
                            {nyan.motif}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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
                  if (isImmediate) {
                    syncSaveDataToFirebase(next, true).catch(() => {});
                  } else {
                    saveOnUserAction(next).catch(() => {});
                  }
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
          onStartRandomTravel={handleStartRandomTravel}
        />
      )}

      {showOuenModal && (
        <OuenModal
          categories={
            saveData.ouenCategories && saveData.ouenCategories.length > 0
              ? saveData.ouenCategories
              : INITIAL_OUEN_CATEGORIES
          }
          kenchiko={saveData.kenchiko}
          onClose={() => setShowOuenModal(false)}
          onSelectCategory={handleSelectOuenCategory}
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
          onOpenTutorial={() => {
            setTutorialInitialStep(0);
            setIsNewFeatureTutorialOnly(false);
            setShowTutorialModal(true);
          }}
          onOpenDevConsole={() => {
            setShowUserSettingsModal(false);
            setShowSyncModal(true);
          }}
        />
      )}

      {/* Tutorial / How to Play Modal */}
      <TutorialModal
        isOpen={showTutorialModal}
        initialStep={tutorialInitialStep}
        isNewFeatureOnly={isNewFeatureTutorialOnly}
        onClose={() => setShowTutorialModal(false)}
      />

      {showSyncModal && (
        <DataSyncModal
          characters={saveData.characters}
          saveData={saveData}
          initialTab={adminInitialTab}
          onClose={handleCloseAdmin}
          onImportNyans={handleImportNyans}
          onSaveFirebaseConfig={(_cfg) => {}}
          onUpdateSaveData={(updater, isImmediate = false) => {
            setSaveData((prev) => {
              const next = updater(prev);
              if (isImmediate) {
                syncSaveDataToFirebase(next, true).catch(() => {});
              } else {
                saveOnUserAction(next).catch(() => {});
              }
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
