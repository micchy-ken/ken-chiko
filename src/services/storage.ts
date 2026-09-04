import { GameSaveData } from '../types';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ITEMS } from '../data/items';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';
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
    mood: 'happy',
    stamina: 100,
    hunger: 50,
    happiness: 100,
    monologue: '今日からけんちことのんびり生活がはじまるよ〜',
    equippedItem: null,
    totalPlayTimeSec: 0,
  },
  characters: INITIAL_NYANS,
  googleDriveFolderUrl: DEFAULT_GOOGLE_DRIVE_FOLDER_URL,
  inventory: INITIAL_ITEMS,
  asobiList: INITIAL_ASOBI_LIST,
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
