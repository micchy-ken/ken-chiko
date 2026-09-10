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
  | 'arrived'
  | 'snacking'
  | 'nap'
  | 'play_with_nyan'
  | 'strolling'
  | 'spacing_out'
  | 'working'
  | 'shopping'
  | 'custom_action'
  | 'cheering';

export interface NyanTransparencyOptions {
  enableTransparency: boolean;
  tolerance: number; // 5 to 80 (default 30)
  trimPadding: boolean; // auto-crop outer padding
}

export interface NyankoStoryMessage {
  time: string;
  sender: string;
  body: string;
  content?: string;
}

export interface NyankoStoryDay {
  date_header: string;
  messages: NyankoStoryMessage[];
}

export interface NyankoStoryWeekInfo {
  week_title: string;
  week_start: string;
  week_end: string;
  days: NyankoStoryDay[];
}

export interface NyankoStory {
  id: number;
  name: string;
  kana?: string;
  motif?: string;
  storyOriginalName?: string;
  title?: string;
  debut_date?: string;
  voice?: string;
  translation?: string;
  episode_summary?: string;
  prompt_ja?: string;
  prompt_en?: string;
  doc_link?: string;
  week_info?: NyankoStoryWeekInfo;
  updatedAt?: string;
}

export interface NyanCharacter {
  no: number;
  name: string;
  reading: string;
  motif: string;
  firstAppeared: string;
  episode: string;
  promptJa: string;
  promptEn: string;
  dialogue?: string; // ねこのセリフ（I列）
  dialogueMeaning?: string; // ねこのセリフの意味・翻訳（J列）
  hasStory?: boolean; // 物語（会話劇）が登録されているかどうか
  discovered: boolean;
  discoveryDate?: string;
  lastMetAt?: number; // timestamp (ms) of the latest encounter
  playCount: number;
  friendshipLevel: number;
  customImageUrl?: string;
  rawImageUrl?: string; // Original URL before transparency processing (e.g. Google Drive link)
  transparency?: NyanTransparencyOptions; // Custom transparency settings per character (persisted on re-sync)
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
  encounterChecked?: boolean;
  lastArrivedAt?: number; // timestamp in ms when arrived from transit (2 min cooldown for travel)
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
  | 'all' // 常時（滞在中・移動時以外）
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

// Ouen (Cheer / 応援)
export interface OuenCategory {
  id: string; // e.g. 'tired', 'irritated', 'angry'
  label: string; // e.g. 'つかれた', 'いらいらする', 'はらがたつ'
}

export interface OuenItem {
  id: string;
  categoryId: string; // references OuenCategory.id
  message: string; // e.g. 'よしよし'
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
  ouenCategories?: OuenCategory[]; // 応援カテゴリー（選択肢）
  ouenList?: OuenItem[]; // 応援メッセージリスト
  kihonNyanCustomImageUrl?: string; // きほんのにゃんこ公式ベース透過画像 (Firebase / LocalStorage同期)
  googleDriveFolderUrl?: string; // Google Drive画像フォルダURL (Firebase / LocalStorage同期)
  stats: {
    totalEncounters: number;
    totalSnacksEaten: number;
    totalNapMinutes: number;
    totalTrips: number;
  };
  rewards?: import('./rewards').UserRewardState; // ポイント・引換券・福引状態
  kounichan?: import('./kounichan').KounichanSettings; // こうにちゃん・乗り物設定
  lastSaved: number;
  githubRepo: string;
  autoSyncGithub: boolean;
}

export * from './rewards';
export * from './kounichan';
