import {
  UserRewardState,
  RewardTicket,
  GaraponHistoryEntry,
  GARAPON_COST,
  POINTS_NEW_DISCOVERY,
  POINTS_STORY_COMPLETE,
  POINTS_DAILY_PET,
  TICKET_DEFINITIONS,
  GaraponBallColor,
} from '../types/rewards';
import { NyanCharacter } from '../types';

/**
 * Generates default reward state.
 */
export function createInitialRewardState(): UserRewardState {
  return {
    points: 0,
    lifetimePoints: 0,
    hasClaimedInitialDiscoveryBonus: false,
    initialBonusAmount: 0,
    readStoryIds: [],
    tickets: [],
    history: [],
  };
}

/**
 * Checks and grants the initial discovery bonus (discoveredCount * 50pt).
 */
export function grantInitialDiscoveryBonus(
  current: UserRewardState | undefined,
  discoveredCount: number
): { updatedState: UserRewardState; bonusAmount: number; granted: boolean } {
  const state: UserRewardState = current
    ? { ...current }
    : createInitialRewardState();

  if (state.hasClaimedInitialDiscoveryBonus) {
    return { updatedState: state, bonusAmount: 0, granted: false };
  }

  const bonusAmount = Math.max(0, discoveredCount * POINTS_NEW_DISCOVERY);
  const updatedState: UserRewardState = {
    ...state,
    points: state.points + bonusAmount,
    lifetimePoints: state.lifetimePoints + bonusAmount,
    hasClaimedInitialDiscoveryBonus: true,
    initialBonusAmount: bonusAmount,
  };

  return { updatedState, bonusAmount, granted: true };
}

/**
 * Adds points for a new character discovery (+50pt).
 */
export function addDiscoveryPoints(current: UserRewardState | undefined): UserRewardState {
  const state: UserRewardState = current
    ? { ...current }
    : createInitialRewardState();

  return {
    ...state,
    points: state.points + POINTS_NEW_DISCOVERY,
    lifetimePoints: state.lifetimePoints + POINTS_NEW_DISCOVERY,
  };
}

/**
 * Awards daily petting points (+10pt, max 1/day).
 */
export function claimDailyPetPoints(
  current: UserRewardState | undefined,
  todayStr: string = new Date().toLocaleDateString('ja-JP')
): { updatedState: UserRewardState; pointsAdded: number; wasAwarded: boolean } {
  const state: UserRewardState = current
    ? { ...current }
    : createInitialRewardState();

  if (state.lastPettedDate === todayStr) {
    return { updatedState: state, pointsAdded: 0, wasAwarded: false };
  }

  const updatedState: UserRewardState = {
    ...state,
    points: state.points + POINTS_DAILY_PET,
    lifetimePoints: state.lifetimePoints + POINTS_DAILY_PET,
    lastPettedDate: todayStr,
  };

  return { updatedState, pointsAdded: POINTS_DAILY_PET, wasAwarded: true };
}

/**
 * Awards story completion points (+20pt, once per character).
 */
export function claimStoryCompletionPoints(
  current: UserRewardState | undefined,
  nyanNo: number
): { updatedState: UserRewardState; pointsAdded: number; wasAwarded: boolean } {
  const state: UserRewardState = current
    ? { ...current }
    : createInitialRewardState();

  const readIds = state.readStoryIds || [];
  if (readIds.includes(nyanNo)) {
    return { updatedState: state, pointsAdded: 0, wasAwarded: false };
  }

  const updatedState: UserRewardState = {
    ...state,
    points: state.points + POINTS_STORY_COMPLETE,
    lifetimePoints: state.lifetimePoints + POINTS_STORY_COMPLETE,
    readStoryIds: [...readIds, nyanNo],
  };

  return { updatedState, pointsAdded: POINTS_STORY_COMPLETE, wasAwarded: true };
}

export type GaraponOutcomeType = 'ticket' | 'new_nyan' | 'miss';

export interface GaraponResult {
  outcomeType: GaraponOutcomeType;
  ballColor: GaraponBallColor;
  title: string;
  description: string;
  ticket?: RewardTicket;
  discoveredNyan?: NyanCharacter;
  pointsRefunded?: number;
}

/**
 * Performs a Garapon spin:
 * Costs 200pt.
 * Probability:
 * - 15% かるちぇらたん引換券 (gold)
 * - 10% にゃんこ関連本引換券 (silver)
 * - 30% こんびにおかし引換券 (red)
 * - 20% 未発見にゃんこ発見 (blue) (+50pt discovery bonus included!)
 * - 25% ハズレ (white)
 */
export function spinGarapon(
  current: UserRewardState,
  allCharacters: NyanCharacter[]
): {
  success: boolean;
  error?: string;
  updatedState: UserRewardState;
  result?: GaraponResult;
  updatedCharacters?: NyanCharacter[];
} {
  if (current.points < GARAPON_COST) {
    return {
      success: false,
      error: `ポイントが足りません（所持: ${current.points}pt / 必要: ${GARAPON_COST}pt）`,
      updatedState: current,
    };
  }

  // Deduct 200 points
  let nextPoints = current.points - GARAPON_COST;
  let nextLifetime = current.lifetimePoints;
  const tickets = [...(current.tickets || [])];
  const history = [...(current.history || [])];
  let updatedCharacters: NyanCharacter[] | undefined = undefined;

  // Roll random 0 - 100
  const roll = Math.random() * 100;
  let result: GaraponResult;

  if (roll < 15) {
    // 15% かるちぇらたん引換券 (Gold)
    const def = TICKET_DEFINITIONS.karuchieratan;
    const newTicket: RewardTicket = {
      id: `tkt_krc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'karuchieratan',
      title: def.title,
      description: def.description,
      rarity: 'gold',
      obtainedAt: Date.now(),
      isUsed: false,
    };
    tickets.unshift(newTicket);
    result = {
      outcomeType: 'ticket',
      ballColor: 'gold',
      title: def.title,
      description: def.description,
      ticket: newTicket,
    };
  } else if (roll < 25) {
    // 10% にゃんこ関連本引換券 (Silver)
    const def = TICKET_DEFINITIONS.nyanko_book;
    const newTicket: RewardTicket = {
      id: `tkt_bok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'nyanko_book',
      title: def.title,
      description: def.description,
      rarity: 'silver',
      obtainedAt: Date.now(),
      isUsed: false,
    };
    tickets.unshift(newTicket);
    result = {
      outcomeType: 'ticket',
      ballColor: 'silver',
      title: def.title,
      description: def.description,
      ticket: newTicket,
    };
  } else if (roll < 55) {
    // 30% こんびにおかし引換券 (Red)
    const def = TICKET_DEFINITIONS.combini_snack;
    const newTicket: RewardTicket = {
      id: `tkt_snk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'combini_snack',
      title: def.title,
      description: def.description,
      rarity: 'red',
      obtainedAt: Date.now(),
      isUsed: false,
    };
    tickets.unshift(newTicket);
    result = {
      outcomeType: 'ticket',
      ballColor: 'red',
      title: def.title,
      description: def.description,
      ticket: newTicket,
    };
  } else if (roll < 75) {
    // 20% 未発見にゃんこ発見！ (Blue)
    // Find all undiscovered nyans
    const undiscovered = allCharacters.filter((c) => !c.discovered);

    if (undiscovered.length > 0) {
      // Pick a random undiscovered nyan
      const picked = undiscovered[Math.floor(Math.random() * undiscovered.length)];
      const newlyDiscoveredNyan: NyanCharacter = {
        ...picked,
        discovered: true,
        discoveryDate: new Date().toLocaleString('ja-JP'),
        lastMetAt: Date.now(),
        playCount: (picked.playCount || 0) + 1,
        friendshipLevel: Math.max(1, picked.friendshipLevel || 1),
      };

      updatedCharacters = allCharacters.map((c) =>
        c.no === picked.no ? newlyDiscoveredNyan : c
      );

      // Award +50pt for finding a new nyan!
      nextPoints += POINTS_NEW_DISCOVERY;
      nextLifetime += POINTS_NEW_DISCOVERY;

      result = {
        outcomeType: 'new_nyan',
        ballColor: 'blue',
        title: `新にゃんこ発見！ No.${picked.no} ${picked.name}`,
        description: `まだ出会っていなかった「${picked.name}」が図鑑に登録されました！新発見ボーナスで +50pt 獲得！✨`,
        discoveredNyan: newlyDiscoveredNyan,
        pointsRefunded: POINTS_NEW_DISCOVERY,
      };
    } else {
      // All nyans already discovered! Give an encouraging super bonus (100pt refund)
      nextPoints += 100;
      nextLifetime += 100;
      result = {
        outcomeType: 'new_nyan',
        ballColor: 'blue',
        title: '図鑑コンプリートマスター賞！',
        description: 'すべてのにゃんこを発見済みのため、特別ボーナスとして100ptをプレゼント！🎉',
        pointsRefunded: 100,
      };
    }
  } else {
    // 25% ハズレ (White)
    const missMessages = [
      'ざんねん賞…でもけんちこはいつでもあなたの味方だよ〜',
      'ティッシュ…ではなくけんちこからの温かいエールをプレゼント！',
      '今回はハズレだったけど、次はきっと良いことあるよ♪',
      'ガラガラ…コロン！ざんねん賞。けんちことのんびりお茶でも飲もう〜',
    ];
    const pickedMsg = missMessages[Math.floor(Math.random() * missMessages.length)];
    result = {
      outcomeType: 'miss',
      ballColor: 'white',
      title: 'ざんねん賞（ハズレ）',
      description: pickedMsg,
    };
  }

  // Add history record
  const historyEntry: GaraponHistoryEntry = {
    id: `his_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    type: result.outcomeType,
    ballColor: result.ballColor,
    prizeTitle: result.title,
    prizeDescription: result.description,
    nyanInfo: result.discoveredNyan
      ? { no: result.discoveredNyan.no, name: result.discoveredNyan.name }
      : undefined,
  };
  history.unshift(historyEntry);
  if (history.length > 50) {
    history.pop();
  }

  const updatedState: UserRewardState = {
    ...current,
    points: nextPoints,
    lifetimePoints: nextLifetime,
    tickets,
    history,
  };

  return {
    success: true,
    updatedState,
    result,
    updatedCharacters,
  };
}

/**
 * Marks a ticket as used.
 */
export function markTicketAsUsed(
  current: UserRewardState,
  ticketId: string
): { success: boolean; updatedState: UserRewardState; ticket?: RewardTicket } {
  const tickets = (current.tickets || []).map((t) => {
    if (t.id === ticketId) {
      return {
        ...t,
        isUsed: true,
        usedAt: Date.now(),
      };
    }
    return t;
  });

  const target = tickets.find((t) => t.id === ticketId);

  return {
    success: !!target,
    updatedState: {
      ...current,
      tickets,
    },
    ticket: target,
  };
}
