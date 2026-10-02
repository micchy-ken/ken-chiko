import {
  KenchikoState,
  LocationId,
  TransportMethod,
  ActivityType,
  NyanCharacter,
  DiaryEntry,
  GiftItem,
  KenchikoAsobi,
} from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';

const MONOLOGUES: Record<ActivityType, string[]> = {
  transit: [
    '風が気持ちいいなぁ〜。',
    '寄り道しないでまっすぐ向かおう。',
    'あ、あそこに何か丸いものが落ちてる…？',
    '鼻歌でも歌いながら行きますかね。',
    '急ぐ旅でもなし、のんびり行こう。',
    '移動中って、無駄にいろんなこと考えちゃうよね。',
  ],
  arrived: [
    'ふぅ、到着したにゃ！辺りを見回しているにゃ…',
    '無事に着いたにゃ！だれかいるかにゃ…？',
    '到着したにゃ〜！ちょっと一息つくにゃ。',
  ],
  snacking: [
    'もぐもぐ…やっぱり甘いものは正義。',
    '30分ずっと食べ続けてるけど、まだ入るな…。',
    'おいしいものを食べてるときが一番しあわせ。',
    'これ、誰にもあげたくないくらい美味い。',
    'お茶も淹れてくればよかったかな。',
    'カロリーは明日考えよう。',
  ],
  nap: [
    'むにゃむにゃ…あと5分だけ…Zzz',
    'すぅ…すぅ…（熟睡中）',
    'ふかふかのお布団最高…1時間あっという間だな。',
    '夢の中で巨大なはんぺんに乗ってた…Zzz',
    '寝起きに飲む水ってなんでこんなに美味いんだろ。',
  ],
  play_with_nyan: [
    '君、なかなかいいツッコミするねぇ！',
    '一緒にいると肩の力が抜けるよ。',
    '真顔で見つめ合ってたら10分経ってた。',
    'よしよし、いい子だねぇ（なでなで）',
    '今度またおやつ持ってきてあげるからね。',
  ],
  strolling: [
    'セカイをうろつくのも、なかなか悪くない。',
    '今日はいい天気だなぁ。',
    '何か面白いこと転がってないかな。',
    'ふらふら歩いてるだけで楽しい。',
  ],
  spacing_out: [
    'ぼーーーーーっ……',
    '（無の境地に入っている）',
    '夕飯何にしようかな…それとも何も考えないでおこうか…',
    '宇宙の神秘について考えているようで何も考えていない。',
  ],
  working: [
    'カタカタ…カタカタ…（仕事してる風）',
    'メール多すぎてAIに丸投げしたい…。',
    '次の休みはどこ行こうかな。',
  ],
  shopping: [
    'これも欲しいし、あれも気になる…',
    '80%オフって見ると買わなきゃ損な気がしてくる。',
    '両手に荷物がいっぱいになっちゃった。',
  ],
  custom_action: [
    '素敵なけんちこさん♪',
    '今日も一日ごきげんよう。',
    'ふふふ、いい感じ。',
  ],
  cheering: [
    'よしよし、大丈夫だよ。',
    'いつもよくがんばってるね。',
    'いつでもそばにいるからね。',
  ],
};

/**
 * Filter custom asobi list matching current location, transport, or activity
 */
export function getMatchingAsobiList(
  asobiList: KenchikoAsobi[] | undefined,
  currentLocation: LocationId,
  transportMethod: TransportMethod | null,
  activity?: ActivityType
): KenchikoAsobi[] {
  if (!asobiList || asobiList.length === 0) return [];

  const isTransit = activity === 'transit' || transportMethod !== null;

  // First pass: specific matches for transit or location conditions
  const specificMatches = asobiList.filter((item) => {
    const cond = item.condition;
    // 1. Specific transport (when in transit)
    if (cond.startsWith('trans_') && isTransit) {
      const targetTrans = cond.replace('trans_', '');
      return !transportMethod || targetTrans === transportMethod;
    }
    // 2. All transports (when in transit)
    if (cond === 'all_transports' && isTransit) {
      return true;
    }
    // 3. Specific location (when not in transit)
    if (cond.startsWith('loc_') && !isTransit) {
      const targetLoc = cond.replace('loc_', '');
      return targetLoc === currentLocation;
    }
    // 4. All locations (when not in transit)
    if (cond === 'all_locations' && !isTransit) {
      return true;
    }
    return false;
  });

  if (specificMatches.length > 0) {
    return specificMatches;
  }

  // Second pass: 'all' (どこでも / 常時) matches everywhere (including transit)
  return asobiList.filter((item) => item.condition === 'all');
}

export interface MonologueAndTitleResult {
  monologue: string;
  title: string;
  matchedAsobiId?: string;
}

/**
 * Picks both monologue and title together from matched custom asobi or built-in pool
 */
export function getRandomMonologueAndTitle(
  activity: ActivityType,
  currentLocation: LocationId = 'living',
  transportMethod: TransportMethod | null = null,
  asobiList: KenchikoAsobi[] = [],
  companionName?: string,
  targetLocation?: LocationId | null
): MonologueAndTitleResult {
  const isTransit = activity === 'transit' || transportMethod !== null;
  const locInfo = LOCATIONS[currentLocation] || LOCATIONS.living;
  const targetLocInfo = targetLocation ? (LOCATIONS[targetLocation] || null) : null;
  const transport = transportMethod
    ? (TRANSPORT_METHODS.find((t) => t.id === transportMethod) || TRANSPORT_METHODS[0])
    : null;

  // Check if matching custom asobi exists
  const matchedAsobi = getMatchingAsobiList(asobiList, currentLocation, transportMethod, activity);

  // If matched custom asobi found, ALWAYS prioritize custom asobi entries
  if (matchedAsobi.length > 0) {
    const weightedPool: KenchikoAsobi[] = [];
    matchedAsobi.forEach((a) => {
      const weight = a.frequency === 'high' ? 4 : a.frequency === 'normal' ? 2 : 1;
      for (let i = 0; i < weight; i++) {
        weightedPool.push(a);
      }
    });

    const chosen = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    if (chosen && (chosen.content || chosen.title)) {
      let quote = chosen.content || '';
      if (companionName && Math.random() > 0.6) {
        quote = `${companionName}といっしょ。「${quote}」`;
      }
      const title = chosen.title || (isTransit ? `${transport?.name || 'とほ'}で移動中` : 'あそび中');
      return {
        monologue: quote,
        title,
        matchedAsobiId: chosen.id,
      };
    }
  }

  // Fallback to standard monologues only if no custom asobi matched
  const pool = MONOLOGUES[activity] || (isTransit ? MONOLOGUES.transit : MONOLOGUES.spacing_out);
  let quote = pool[Math.floor(Math.random() * pool.length)];
  if (companionName && Math.random() > 0.5) {
    quote = `${companionName}とまったり中。「${quote}」`;
  }

  // Standard activity titles when no custom asobi matched
  let defaultTitle = 'のんびり過ごしている';
  if (isTransit) {
    if (targetLocInfo && transport) {
      defaultTitle = `${transport.name}で「${targetLocInfo.name}」へ向かって移動中…`;
    } else if (transport) {
      defaultTitle = `${transport.name}で移動中`;
    } else {
      defaultTitle = '移動中…';
    }
  } else if (activity === 'snacking') {
    defaultTitle = companionName ? `${companionName}とおやつ休憩` : 'おやつタイム';
  } else if (activity === 'nap') {
    defaultTitle = companionName ? `${companionName}とお昼寝` : 'すやすやお昼寝中…';
  } else if (activity === 'play_with_nyan') {
    defaultTitle = companionName ? `${companionName}とおしゃべりして遊んでいる` : 'にゃんことあそんでいる';
  } else if (activity === 'cheering') {
    defaultTitle = 'けんちこが応援中';
  } else if (activity === 'arrived') {
    defaultTitle = `${locInfo.name}に到着！見回し中`;
  } else {
    defaultTitle = `${locInfo.name}でのんびりボーッとしている`;
  }

  return {
    monologue: quote,
    title: defaultTitle,
  };
}

/**
 * Picks a monologue from either matched custom asobi or built-in pool
 */
export function getRandomMonologue(
  activity: ActivityType,
  currentLocation: LocationId = 'living',
  transportMethod: TransportMethod | null = null,
  asobiList: KenchikoAsobi[] = [],
  companionName?: string
): string {
  return getRandomMonologueAndTitle(
    activity,
    currentLocation,
    transportMethod,
    asobiList,
    companionName
  ).monologue;
}

export function pickRandomLocation(current: LocationId): LocationId {
  const allLocs = Object.keys(LOCATIONS) as LocationId[];
  const candidates = allLocs.filter((l) => l !== current);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function pickRandomTransport(): TransportMethod {
  const roll = Math.random();
  if (roll < 0.35) return 'walk';
  if (roll < 0.65) return 'bicycle';
  if (roll < 0.85) return 'car';
  if (roll < 0.95) return 'jinbei_nyan';
  return 'train';
}

export interface BaseActivitySetup {
  type: ActivityType;
  title: string;
  durationSec: number;
  customMonologue?: string;
  diaryText?: string;
}

/**
 * Initiates a standard 5-minute (or activity-specific) activity at the location
 * without immediately determining nyan encounter (which occurs 5 seconds into the activity).
 */
export function startNewActivity(
  currentLoc: LocationId,
  asobiList: KenchikoAsobi[] = []
): BaseActivitySetup {
  const roll = Math.random();
  const locInfo = LOCATIONS[currentLoc] || LOCATIONS.living;

  // 1. Custom asobi match
  const matchedAsobi = getMatchingAsobiList(asobiList, currentLoc, null);
  if (matchedAsobi.length > 0) {
    const weightedPool: KenchikoAsobi[] = [];
    matchedAsobi.forEach((a) => {
      const weight = a.frequency === 'high' ? 4 : a.frequency === 'normal' ? 2 : 1;
      for (let i = 0; i < weight; i++) {
        weightedPool.push(a);
      }
    });
    const chosenAsobi = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    return {
      type: 'custom_action',
      title: chosenAsobi.title,
      durationSec: 300, // 5 min
      customMonologue: chosenAsobi.content,
      diaryText: `${locInfo.name}で「${chosenAsobi.title}」。${chosenAsobi.content}`,
    };
  }

  // 2. Snacking (30% chance)
  if (roll < 0.3) {
    const isLongSnack = Math.random() < 0.5;
    const durationSec = isLongSnack ? 1800 : 300; // 30min or 5min
    return {
      type: 'snacking',
      title: `${locInfo.name}でおやつタイム`,
      durationSec,
      diaryText: `${locInfo.name}でおやつタイム。のんびり過ごした。`,
    };
  }

  // 3. Nap (25% chance)
  if (roll < 0.55) {
    const isLongNap = Math.random() < 0.6;
    const durationSec = isLongNap ? 3600 : 900; // 60min or 15min
    return {
      type: 'nap',
      title: `${locInfo.name}ですやすやお昼寝中…`,
      durationSec,
      diaryText: `${locInfo.name}で心地よい風に吹かれてぐっすり眠った。`,
    };
  }

  // 4. Strolling (20% chance)
  if (roll < 0.75) {
    return {
      type: 'strolling',
      title: `${locInfo.name}をのんびり探索中`,
      durationSec: 300, // 5 min
      diaryText: `${locInfo.name}をふらふらお散歩した。`,
    };
  }

  // 5. Default spacing out
  return {
    type: 'spacing_out',
    title: `${locInfo.name}でのんびりボーッとしている`,
    durationSec: 300, // 5 min
    diaryText: `${locInfo.name}でのんびり風の音を聞きながら過ごした。`,
  };
}

export interface RollEncounterOptions {
  isFirstCheck?: boolean; // true: 到着後15秒初回判定(60%, 未発見優先なし) / false: 15-30秒ごと再抽選(30%, 未発見1.5倍)
  isGuaranteedHintEncounter?: boolean; // true: 予告先での確定遭遇(100%, 未発見確定, 「本当にいた！」演出)
}

/**
 * Rolls encounter lottery with the updated rules:
 * - Guaranteed hint arrival: 100% encounter with an undiscovered cat ("本当にいた！" presentation)
 * - First check (15s after arrival): 60% chance, flat distribution (no undiscovered boost)
 * - Subsequent checks (every 15-30s): 30% chance, undiscovered cats get 1.5x weight
 */
export function rollEncounterForActivity(
  currentLoc: LocationId,
  allNyans: NyanCharacter[],
  baseActivity: { type: ActivityType; title: string },
  _asobiList: KenchikoAsobi[] = [],
  options?: RollEncounterOptions
): {
  companionNyan: NyanCharacter | null;
  newDiscoveredNyan: NyanCharacter | null;
  updatedTitle?: string;
  diaryText?: string;
  customMonologue?: string;
} {
  const locInfo = LOCATIONS[currentLoc] || LOCATIONS.living;

  if (allNyans.length === 0) {
    return {
      companionNyan: null,
      newDiscoveredNyan: null,
    };
  }

  // Case 1: Guaranteed Encounter from Hint Arrival ("本当にいた！")
  if (options?.isGuaranteedHintEncounter) {
    const undiscovered = allNyans.filter((c) => !c.discovered);
    if (undiscovered.length > 0) {
      const randomNyan = undiscovered[Math.floor(Math.random() * undiscovered.length)];
      const updatedTitle = `${randomNyan.name}とおしゃべり中 (本当にいた！)`;
      const diaryText = `${locInfo.name}に行ってみたら…本当にいた！新にゃんこ「${randomNyan.name}」と出会えた！${randomNyan.episode || 'のんびり一緒に過ごした。'}`;
      const customMonologue = `本当にいた！${randomNyan.name}、見つけたよ！`;

      return {
        companionNyan: randomNyan,
        newDiscoveredNyan: randomNyan,
        updatedTitle,
        diaryText,
        customMonologue,
      };
    }
  }

  // Case 2: Normal Probability Check
  // First check (15s after arrival): 60%
  // Re-rolls (every 15-30s): 30%
  const winRate = options?.isFirstCheck ? 0.60 : 0.30;
  if (Math.random() >= winRate) {
    return {
      companionNyan: null,
      newDiscoveredNyan: null,
    };
  }

  // Cat Selection
  let pickedNyan: NyanCharacter;
  if (options?.isFirstCheck) {
    // First check: equal probability for all Nyans (no undiscovered bonus)
    pickedNyan = allNyans[Math.floor(Math.random() * allNyans.length)];
  } else {
    // Subsequent checks: undiscovered Nyans get 1.5x weight
    let totalWeight = 0;
    const weights = allNyans.map((n) => {
      const w = !n.discovered ? 1.5 : 1.0;
      totalWeight += w;
      return w;
    });
    let roll = Math.random() * totalWeight;
    pickedNyan = allNyans[0];
    for (let i = 0; i < allNyans.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pickedNyan = allNyans[i];
        break;
      }
    }
  }

  const isNewDiscovery = !pickedNyan.discovered ? pickedNyan : null;

  let updatedTitle = `${pickedNyan.name}とおしゃべり中`;
  let diaryText = `${locInfo.name}で「${pickedNyan.name}」と遭遇！${pickedNyan.episode || 'のんびり一緒に過ごした。'}`;

  if (baseActivity.type === 'snacking') {
    updatedTitle = `${pickedNyan.name}とおやつ休憩`;
    diaryText = `${locInfo.name}で${pickedNyan.name}とおやつを分け合って休憩した。平和な時間。`;
  } else if (baseActivity.type === 'nap') {
    updatedTitle = `${pickedNyan.name}とお昼寝`;
    diaryText = `${locInfo.name}で${pickedNyan.name}が隣で丸くなってきたので、いっしょにお昼寝した。`;
  } else if (baseActivity.type === 'custom_action') {
    updatedTitle = `${baseActivity.title} (${pickedNyan.name}と一緒)`;
  }

  return {
    companionNyan: pickedNyan,
    newDiscoveredNyan: isNewDiscovery,
    updatedTitle,
    diaryText,
  };
}

export function generateNextActivity(
  currentLoc: LocationId,
  allNyans: NyanCharacter[],
  asobiList: KenchikoAsobi[] = []
): {
  type: ActivityType;
  title: string;
  durationSec: number;
  companionNyanId: number | null;
  newDiscoveredNyan: NyanCharacter | null;
  diaryText?: string;
  customMonologue?: string;
} {
  const roll = Math.random();
  const locInfo = LOCATIONS[currentLoc] || LOCATIONS.living;

  // Decide if a Nyan visits
  let companionNyan: NyanCharacter | null = null;
  let isNewDiscovery: NyanCharacter | null = null;

  if (locInfo.possibleNyanIds && locInfo.possibleNyanIds.length > 0 && Math.random() < 0.75) {
    const randomNyanId = locInfo.possibleNyanIds[Math.floor(Math.random() * locInfo.possibleNyanIds.length)];
    const found = allNyans.find((n) => n.no === randomNyanId);
    if (found) {
      companionNyan = found;
      if (!found.discovered) {
        isNewDiscovery = found;
      }
    }
  } else if (Math.random() < 0.4) {
    // Random nyan from entire catalog
    const randomNyan = allNyans[Math.floor(Math.random() * allNyans.length)];
    if (randomNyan) {
      companionNyan = randomNyan;
      if (!randomNyan.discovered) {
        isNewDiscovery = randomNyan;
      }
    }
  }

  // Check if custom asobi should trigger as an activity (prioritize user custom activities)
  const matchedAsobi = getMatchingAsobiList(asobiList, currentLoc, null);
  if (matchedAsobi.length > 0) {
    const weightedPool: KenchikoAsobi[] = [];
    matchedAsobi.forEach((a) => {
      const weight = a.frequency === 'high' ? 4 : a.frequency === 'normal' ? 2 : 1;
      for (let i = 0; i < weight; i++) {
        weightedPool.push(a);
      }
    });
    const chosenAsobi = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    return {
      type: 'custom_action',
      title: chosenAsobi.title,
      durationSec: 300, // 5 min
      companionNyanId: companionNyan ? companionNyan.no : null,
      newDiscoveredNyan: isNewDiscovery,
      customMonologue: chosenAsobi.content,
      diaryText: `${locInfo.name}で「${chosenAsobi.title}」。${chosenAsobi.content}`,
    };
  }

  // 1. Snacking (30min or 5min)
  if (roll < 0.3) {
    const isLongSnack = Math.random() < 0.5;
    const durationSec = isLongSnack ? 1800 : 300; // 30min or 5min
    const title = companionNyan
      ? `${companionNyan.name}とおやつ休憩`
      : 'おやつタイム';

    return {
      type: 'snacking',
      title,
      durationSec,
      companionNyanId: companionNyan ? companionNyan.no : null,
      newDiscoveredNyan: isNewDiscovery,
      diaryText: companionNyan
        ? `${locInfo.name}で${companionNyan.name}とおやつを分け合って休憩した。平和な時間。`
        : `${locInfo.name}でおやつタイム。のんびり過ごした。`,
    };
  }

  // 2. Nap (1 hour or 15 min)
  if (roll < 0.55) {
    const isLongNap = Math.random() < 0.6;
    const durationSec = isLongNap ? 3600 : 900; // 60min or 15min
    const title = companionNyan
      ? `${companionNyan.name}とお昼寝`
      : 'すやすやお昼寝中…';

    return {
      type: 'nap',
      title,
      durationSec,
      companionNyanId: companionNyan ? companionNyan.no : null,
      newDiscoveredNyan: isNewDiscovery,
      diaryText: companionNyan
        ? `${locInfo.name}で${companionNyan.name}が隣で丸くなってきたので、いっしょにお昼寝した。`
        : `${locInfo.name}で心地よい風に吹かれてぐっすり眠った。`,
    };
  }

  // 3. Play with Nyan or Strolling
  if (companionNyan) {
    return {
      type: 'play_with_nyan',
      title: `${companionNyan.name}とおしゃべりして遊んでいる`,
      durationSec: 300 + Math.floor(Math.random() * 4) * 300, // 5 to 20 min
      companionNyanId: companionNyan.no,
      newDiscoveredNyan: isNewDiscovery,
      diaryText: `${locInfo.name}で「${companionNyan.name}」と遭遇！${companionNyan.episode}。脱力した表情がなんとも味わい深くて、すっかり仲良くなった。`,
    };
  }

  // 4. Default spacing out / strolling
  return {
    type: 'spacing_out',
    title: `${locInfo.name}でのんびりボーッとしている`,
    durationSec: 300, // 5 min
    companionNyanId: null,
    newDiscoveredNyan: null,
    diaryText: `${locInfo.name}でのんびり風の音を聞きながら過ごした。`,
  };
}

export function startTransit(
  currentLoc: LocationId,
  targetLoc: LocationId,
  transportMethod: TransportMethod,
  asobiList: KenchikoAsobi[] = [],
  companionName?: string
): {
  title: string;
  monologue: string;
  durationSec: number;
} {
  const durationSec = 20;

  // Pick transit monologue and transit title (custom asobi prioritized)
  const res = getRandomMonologueAndTitle(
    'transit',
    currentLoc,
    transportMethod,
    asobiList,
    companionName,
    targetLoc
  );

  return {
    title: res.title,
    monologue: res.monologue,
    durationSec,
  };
}
