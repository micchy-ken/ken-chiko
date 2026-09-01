export type TransportMethod = 'walk' | 'bicycle' | 'car' | 'jinbei_nyan' | 'train';

export type LocationId =
  | 'living'
  | 'bedroom'
  | 'office'
  | 'beginner_forest'
  | 'lalaport'
  | 'aeon'
  | 'study'
  | 'camp'
  | 'hotspring';

export type ActivityType =
  | 'transit'
  | 'snacking'
  | 'nap'
  | 'play_with_nyan'
  | 'strolling'
  | 'spacing_out'
  | 'working'
  | 'shopping';

export interface NyanCharacter {
  no: number;
  name: string;
  reading: string;
  motif: string;
  firstAppeared: string;
  episode: string;
  promptJa: string;
  promptEn: string;
  discovered: boolean;
  discoveryDate?: string;
  playCount: number;
  friendshipLevel: number;
  customImageUrl?: string;
  favoriteItems?: string[];
  favoriteLocations?: LocationId[];
}

export interface LocationInfo {
  id: LocationId;
  name: string;
  reading: string;
  description: string;
  transitTimeMin: [number, number]; // [min, max] typically 5 to 10 min
  possibleNyanIds: number[];
  bgIcon: string;
  themeColor: string;
}

export interface KenchikoState {
  currentLocation: LocationId;
  targetLocation: LocationId | null;
  transportMethod: TransportMethod | null;
  currentActivity: ActivityType;
  currentActivityTitle: string;
  activityStartedAt: number; // timestamp in ms
  activityDurationSec: number; // duration in simulated seconds (e.g., 300s = 5min, 1800s = 30min, 3600s = 1hr)
  currentCompanionNyanId: number | null;
  mood: 'happy' | 'sleepy' | 'hungry' | 'chill' | 'excited' | 'zapped';
  stamina: number; // 0 - 100
  hunger: number; // 0 - 100
  happiness: number; // 0 - 100
  monologue: string;
  equippedItem: string | null;
  totalPlayTimeSec: number;
}

export interface GiftItem {
  id: string;
  name: string;
  category: 'snack' | 'goods' | 'ride' | 'drink';
  description: string;
  effectText: string;
  hungerRecovery: number;
  happinessGain: number;
  staminaGain: number;
  specialNyanAffinity?: number[];
  icon: string;
  count: number;
}

export interface DiaryEntry {
  id: string;
  timestamp: number;
  dateFormatted: string;
  locationName: string;
  activityTitle: string;
  nyanId: number | null;
  nyanName: string | null;
  itemUsed: string | null;
  mood: string;
  text: string;
}

export interface GameSaveData {
  version: number;
  kenchiko: KenchikoState;
  characters: NyanCharacter[];
  inventory: GiftItem[];
  diary: DiaryEntry[];
  stats: {
    totalEncounters: number;
    totalSnacksEaten: number;
    totalNapMinutes: number;
    totalTrips: number;
  };
  lastSaved: number;
  githubRepo: string;
  autoSyncGithub: boolean;
}
