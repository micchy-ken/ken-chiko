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
  | 'shopping'
  | 'custom_action';

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
  activityDurationSec: number; // duration in simulated seconds
  currentCompanionNyanId: number | null;
  customImageUrl?: string;
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

// Custom Asobi (Action / Play / Monologue Event)
export type AsobiConditionScope =
  | 'all' // すべて（滞在・移動を問わず）
  | 'all_locations' // すべての場所（滞在中ならどこでも）
  | 'all_transports' // すべての移動手段（移動中ならなんでも）
  | `loc_${LocationId}` // 特定の場所 (例: loc_living, loc_bedroom, loc_office)
  | `trans_${TransportMethod}`; // 特定の移動手段 (例: trans_walk, trans_bicycle)

export type AsobiFrequency = 'high' | 'normal' | 'rare'; // 頻度: 高い(よく出る) / 通常 / レア

export interface KenchikoAsobi {
  id: string;
  title: string; // あそび名 (例: けんちこはうたをうたった)
  content: string; // 内容・セリフ (例: 素敵なけんちこさん♪)
  condition: AsobiConditionScope; // 条件
  frequency: AsobiFrequency; // 頻度 (通常 / 高頻度 / レア)
  createdAt: number;
  updatedAt?: number;
}

export interface GameSaveData {
  version: number;
  kenchiko: KenchikoState;
  characters: NyanCharacter[];
  inventory: GiftItem[];
  diary: DiaryEntry[];
  asobiList: KenchikoAsobi[]; // カスタムあそびリスト
  kihonNyanCustomImageUrl?: string; // きほんのにゃんこ公式ベース透過画像 (Firebase / LocalStorage同期)
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
