export type KounichanVehicleId =
  | 'tricycle_turbo' // 三輪車（ターボ付き三輪車）
  | 'koyumi_2' // 三輪車（老朽化・改造版 / こゆみ号2）
  | 'four_wheeler' // 四輪車（よんりんしゃ / ぶるんるん）
  | 'dendrobium' // 新マシン（デンドロビウム風後継車）
  | 'space_trike' // 新型三輪車（宇宙対応仕様）
  | 'aqua_yakkun'; // 自動車（愛車アクア「やっくん」）

export interface KounichanVehicleConfig {
  id: KounichanVehicleId;
  name: string;
  era: string; // 登場時期
  description: string;
  onomatopoeia: string; // 代表的な擬音
  turboOnomatopoeia: string; // 加速・ダッシュ時の擬音
  subOnomatopoeia?: string; // 予備・初期音 (例: がっ…がこっ…がこっ)
  baseSpeedSec: number; // 横切る基本秒数 (例: 10)
  dashSpeedSec: number; // タップ時ダッシュ秒数 (例: 2.5)
  customImageUrl?: string; // 透過PNGデータURLまたは画像URL
  customKouniImageUrl?: string; // 乗客こうにちゃん個別画像
  customOnomatopoeiaImageUrl?: string; // 描き文字切り出し画像
  soundVolume?: number; // 0 - 1
  enabled: boolean;
}

export interface KounichanSettings {
  enabled: boolean;
  frequency: 'rare' | 'normal' | 'often' | 'test'; // 出現頻度
  customSheetUrl?: string; // 6台一括元画像（生画像データURL）
  vehicles: Record<KounichanVehicleId, KounichanVehicleConfig>;
  stats: {
    totalSpotted: number;
    totalTapped: number;
    pointsGifted: number;
    catsGifted: number;
    lastSpottedAt?: number;
  };
}

export const DEFAULT_KOUNICHAN_VEHICLES: Record<KounichanVehicleId, KounichanVehicleConfig> = {
  tricycle_turbo: {
    id: 'tricycle_turbo',
    name: '三輪車（ターボ付き三輪車）',
    era: '2019年〜2023年頃',
    description: 'こうにちゃんの初代かつ基本の乗り物。赤いボディにターボ加速付き。',
    onomatopoeia: 'キコキコ',
    turboOnomatopoeia: 'ばびゅーん！',
    subOnomatopoeia: 'きこきこ',
    baseSpeedSec: 11,
    dashSpeedSec: 2.2,
    enabled: true,
  },
  koyumi_2: {
    id: 'koyumi_2',
    name: '三輪車（老朽化・改造版 / こゆみ号2）',
    era: '2021年夏',
    description: '味わい深く使い込まれ、補助輪や改造が施された歴戦のマシン。',
    onomatopoeia: 'がこがこ',
    turboOnomatopoeia: 'がっ…がこっ…がこっ！',
    subOnomatopoeia: 'がっ…がこっ…がこっ',
    baseSpeedSec: 13,
    dashSpeedSec: 2.8,
    enabled: true,
  },
  four_wheeler: {
    id: 'four_wheeler',
    name: '四輪車（よんりんしゃ / ぶるんるん）',
    era: '2025年5月〜9月',
    description: '三輪車の代わりに導入された爽やかな青い四輪車両。ごきげんな笑顔で走行。',
    onomatopoeia: 'ぶるんるんるん',
    turboOnomatopoeia: 'ぶるるるるーーん！',
    subOnomatopoeia: 'ぶるんるん',
    baseSpeedSec: 9.5,
    dashSpeedSec: 2.0,
    enabled: true,
  },
  dendrobium: {
    id: 'dendrobium',
    name: '新マシン（デンドロビウム風後継車）',
    era: '2025年9月〜2026年3月',
    description: '健介さんが製作した轟音マシン。ミサイルポッドや多連装火器風パーツを備えた重装甲仕様。',
    onomatopoeia: 'どががががーっ',
    turboOnomatopoeia: 'どががががーーっ！！！',
    subOnomatopoeia: 'どががっ',
    baseSpeedSec: 8.5,
    dashSpeedSec: 1.8,
    enabled: true,
  },
  space_trike: {
    id: 'space_trike',
    name: '新型三輪車（宇宙対応仕様）',
    era: '2026年3月末〜現在（2026年9月）',
    description: '宇宙まで飛べる超高速マシン。丸いキャノピーと宇宙服、青いジェット噴射が特徴。',
    onomatopoeia: 'しゅごごごごーーっ',
    turboOnomatopoeia: 'しゅごぉぉぉーーっ！',
    subOnomatopoeia: 'しゅごごっ',
    baseSpeedSec: 7.5,
    dashSpeedSec: 1.5,
    enabled: true,
  },
  aqua_yakkun: {
    id: 'aqua_yakkun',
    name: '愛車アクア「やっくん」',
    era: '常時（通勤・ドライブ）',
    description: 'けんちこさん（健介さん）の運転で車通勤やドライブをする際の愛車トヨタ・アクア。窓から手を振るこうにちゃん。',
    onomatopoeia: 'ぶいーーんっ',
    turboOnomatopoeia: 'ぶいぃーーんっ！！',
    subOnomatopoeia: 'ぶいーん',
    baseSpeedSec: 9.0,
    dashSpeedSec: 1.9,
    enabled: true,
  },
};

export const DEFAULT_KOUNICHAN_SETTINGS: KounichanSettings = {
  enabled: true,
  frequency: 'normal',
  vehicles: DEFAULT_KOUNICHAN_VEHICLES,
  stats: {
    totalSpotted: 0,
    totalTapped: 0,
    pointsGifted: 0,
    catsGifted: 0,
  },
};
