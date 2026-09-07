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
};

/**
 * Filter custom asobi list matching current location, transport, or activity
 */
export function getMatchingAsobiList(
  asobiList: KenchikoAsobi[] | undefined,
  currentLocation: LocationId,
  transportMethod: TransportMethod | null
): KenchikoAsobi[] {
  if (!asobiList || asobiList.length === 0) return [];

  const isTransit = transportMethod !== null;

  return asobiList.filter((item) => {
    const cond = item.condition;
    // 1. All (any state)
    if (cond === 'all') return true;

    // 2. All locations (when not in transit)
    if (cond === 'all_locations' && !isTransit) return true;

    // 3. All transports (when in transit)
    if (cond === 'all_transports' && isTransit) return true;

    // 4. Specific location
    if (cond.startsWith('loc_')) {
      const targetLoc = cond.replace('loc_', '');
      return !isTransit && targetLoc === currentLocation;
    }

    // 5. Specific transport
    if (cond.startsWith('trans_')) {
      const targetTrans = cond.replace('trans_', '');
      return isTransit && targetTrans === transportMethod;
    }

    return false;
  });
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
  // Check if matching custom asobi exists
  const matchedAsobi = getMatchingAsobiList(asobiList, currentLocation, transportMethod);

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
    if (chosen && chosen.content) {
      if (companionName && Math.random() > 0.6) {
        return `${companionName}といっしょ。「${chosen.content}」`;
      }
      return chosen.content;
    }
  }

  // Fallback to standard monologues only if no custom asobi matched
  const pool = MONOLOGUES[activity] || MONOLOGUES.spacing_out;
  let quote = pool[Math.floor(Math.random() * pool.length)];
  if (companionName && Math.random() > 0.5) {
    quote = `${companionName}とまったり中。「${quote}」`;
  }
  return quote;
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
  transportMethod: TransportMethod
): {
  title: string;
  durationSec: number;
} {
  const locInfo = LOCATIONS[targetLoc] || LOCATIONS.living;
  const transport = TRANSPORT_METHODS.find((t) => t.id === transportMethod) || TRANSPORT_METHODS[0];

  // Standardized transit duration: 30 seconds
  const durationSec = 30;

  return {
    title: `${transport.name}で「${locInfo.name}」へ向かって移動中…`,
    durationSec,
  };
}
