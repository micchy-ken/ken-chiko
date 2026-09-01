import { GameSaveData, KenchikoState, NyanCharacter } from '../types';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ITEMS } from '../data/items';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';

const STORAGE_KEY = 'kenchiko_pet_world_v1';

export const DEFAULT_INITIAL_STATE: GameSaveData = {
  version: 1,
  kenchiko: {
    currentLocation: 'living',
    targetLocation: null,
    transportMethod: null,
    currentActivity: 'snacking',
    currentActivityTitle: 'ピノアイスをもぐもぐ食べている',
    activityStartedAt: Date.now(),
    activityDurationSec: 300, // 5 minutes
    currentCompanionNyanId: 5, // すのうにゃん
    mood: 'happy',
    stamina: 85,
    hunger: 70,
    happiness: 90,
    monologue: 'ピノの星形が出たら何かいいことあるかなぁ…',
    equippedItem: 'pino_ice',
    totalPlayTimeSec: 0,
  },
  characters: INITIAL_NYANS,
  inventory: INITIAL_ITEMS,
  asobiList: INITIAL_ASOBI_LIST,
  diary: [
    {
      id: 'diary_init_1',
      timestamp: Date.now() - 3600 * 1000,
      dateFormatted: new Date(Date.now() - 3600 * 1000).toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      locationName: 'りびんぐ',
      activityTitle: 'すのうにゃんとピノアイスを食べた',
      nyanId: 5,
      nyanName: 'すのうにゃん',
      itemUsed: 'ピノアイス',
      mood: 'happy',
      text: 'リビングのコタツで、すのうにゃんが抱えてきたピノアイスを半分こした。冷たくて甘くて、最高のおやつタイムだった。',
    },
  ],
  stats: {
    totalEncounters: 3,
    totalSnacksEaten: 5,
    totalNapMinutes: 60,
    totalTrips: 2,
  },
  lastSaved: Date.now(),
  githubRepo: 'ken-chiko',
  autoSyncGithub: true,
};

export function loadGameData(): GameSaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INITIAL_STATE;
    const parsed = JSON.parse(raw);

    // Merge default nyans with saved nyans in case default was updated
    const savedNyans: NyanCharacter[] = parsed.characters || [];
    const savedMap = new Map<number, NyanCharacter>(savedNyans.map((n: NyanCharacter) => [n.no, n]));

    const mergedNyans = INITIAL_NYANS.map((defaultN) => {
      const saved = savedMap.get(defaultN.no);
      if (saved) {
        return {
          ...defaultN,
          ...saved,
          // preserve updated lore/prompts
          promptJa: defaultN.promptJa || saved.promptJa,
          promptEn: defaultN.promptEn || saved.promptEn,
          episode: defaultN.episode || saved.episode,
        };
      }
      return defaultN;
    });

    return {
      ...DEFAULT_INITIAL_STATE,
      ...parsed,
      characters: mergedNyans,
      inventory: parsed.inventory || INITIAL_ITEMS,
      asobiList: Array.isArray(parsed.asobiList) && parsed.asobiList.length > 0 ? parsed.asobiList : INITIAL_ASOBI_LIST,
      diary: parsed.diary || DEFAULT_INITIAL_STATE.diary,
      stats: parsed.stats || DEFAULT_INITIAL_STATE.stats,
      kenchiko: {
        ...DEFAULT_INITIAL_STATE.kenchiko,
        ...(parsed.kenchiko || {}),
      },
    };
  } catch (err) {
    console.error('Failed to load local storage data', err);
    return DEFAULT_INITIAL_STATE;
  }
}

export function saveGameData(data: GameSaveData): void {
  try {
    const toSave: GameSaveData = {
      ...data,
      lastSaved: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('Failed to save to local storage', err);
  }
}

export function resetGameData(): GameSaveData {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_INITIAL_STATE;
}
