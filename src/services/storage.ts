import { GameSaveData } from '../types';
import { INITIAL_NYANS } from '../data/defaultNyans';
import { INITIAL_ITEMS } from '../data/items';
import { INITIAL_ASOBI_LIST } from '../data/defaultAsobi';

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
