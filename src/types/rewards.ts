export type TicketType = 'karuchieratan' | 'nyanko_book' | 'combini_snack';

export type GaraponBallColor = 'gold' | 'silver' | 'red' | 'blue' | 'white';

export interface RewardTicket {
  id: string; // Unique ticket UUID
  type: TicketType;
  title: string;
  description: string;
  rarity: 'gold' | 'silver' | 'red';
  obtainedAt: number; // timestamp
  isUsed: boolean;
  usedAt?: number; // timestamp
}

export interface GaraponHistoryEntry {
  id: string;
  timestamp: number;
  type: 'ticket' | 'new_nyan' | 'miss';
  ballColor: GaraponBallColor;
  prizeTitle: string;
  prizeDescription: string;
  nyanInfo?: {
    no: number;
    name: string;
  };
}

export interface UserRewardState {
  points: number; // Current spendable points
  lifetimePoints: number; // Cumulative points earned
  hasClaimedInitialDiscoveryBonus: boolean;
  initialBonusAmount?: number;
  lastPettedDate?: string; // e.g. '2026-09-08'
  readStoryIds: number[]; // Nyan numbers whose final story has been read
  tickets: RewardTicket[];
  history: GaraponHistoryEntry[];
}

export const GARAPON_COST = 200;
export const POINTS_NEW_DISCOVERY = 50;
export const POINTS_STORY_COMPLETE = 20;
export const POINTS_DAILY_PET = 10;

export interface TicketDefinition {
  type: TicketType;
  title: string;
  description: string;
  shortLabel: string;
  rarity: 'gold' | 'silver' | 'red';
  ballColor: GaraponBallColor;
  ratePercent: number; // 15, 10, 30
  iconEmoji: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
}

export const TICKET_DEFINITIONS: Record<TicketType, TicketDefinition> = {
  karuchieratan: {
    type: 'karuchieratan',
    title: 'かるちぇらたん引換券',
    description: 'カルチェラタンのお菓子が買ってもらえるよ！🍰',
    shortLabel: 'かるちぇらたん',
    rarity: 'gold',
    ballColor: 'gold',
    ratePercent: 15,
    iconEmoji: '🍰',
    bgColor: '#FFFBEB',
    borderColor: '#D97706',
    accentColor: '#B45309',
  },
  nyanko_book: {
    type: 'nyanko_book',
    title: 'にゃんこ関連本引換券',
    description: 'にゃんこが主役の本を買ってもらえるよ！📚',
    shortLabel: 'にゃんこ本',
    rarity: 'silver',
    ballColor: 'silver',
    ratePercent: 10,
    iconEmoji: '📚',
    bgColor: '#F1F5F9',
    borderColor: '#64748B',
    accentColor: '#334155',
  },
  combini_snack: {
    type: 'combini_snack',
    title: 'こんびにおかし引換券',
    description: 'コンビニお菓子を買ってもらえるよ！🍫',
    shortLabel: 'コンビニお菓子',
    rarity: 'red',
    ballColor: 'red',
    ratePercent: 30,
    iconEmoji: '🍫',
    bgColor: '#FEF2F2',
    borderColor: '#EF4444',
    accentColor: '#B91C1C',
  },
};
