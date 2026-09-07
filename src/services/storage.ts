import { GameSaveData } from '../types';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ITEMS } from '../data/items';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';
import { INITIAL_OUEN_CATEGORIES, INITIAL_OUEN_LIST } from '../data/defaultOuen';
import { DEFAULT_GOOGLE_DRIVE_FOLDER_URL } from './googleDriveFolderSync';

export const DEFAULT_INITIAL_STATE: GameSaveData = {
  version: 1,
  kenchiko: {
    currentLocation: 'living',
    targetLocation: null,
    transportMethod: null,
    currentActivity: 'spacing_out',
    currentActivityTitle: 'のんびり日向ぼっこしている',
    activityStartedAt: Date.now(),
    activityDurationSec: 300, // 5 minutes
    currentCompanionNyanId: null,
    encounterChecked: false,
    mood: 'happy',
    stamina: 100,
    hunger: 100,
    happiness: 100,
    monologue: '今日からけんちことのんびり生活がはじまるよ〜',
    equippedItem: null,
    totalPlayTimeSec: 0,
  },
  characters: INITIAL_NYANS,
  googleDriveFolderUrl: DEFAULT_GOOGLE_DRIVE_FOLDER_URL,
  inventory: INITIAL_ITEMS,
  asobiList: INITIAL_ASOBI_LIST,
  ouenCategories: INITIAL_OUEN_CATEGORIES,
  ouenList: INITIAL_OUEN_LIST,
  diary: [],
  stats: {
    totalEncounters: 0,
    totalSnacksEaten: 0,
    totalNapMinutes: 0,
    totalTrips: 0,
  },
  lastSaved: Date.now(),
  githubRepo: 'ken-chiko',
  autoSyncGithub: true,
};
