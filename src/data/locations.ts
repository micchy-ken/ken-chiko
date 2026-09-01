import { LocationId, LocationInfo, TransportMethod } from '../types';

export const LOCATIONS: Record<LocationId, LocationInfo> = {
  living: {
    id: 'living',
    name: 'りびんぐ',
    reading: 'リビング',
    description: 'ふかふかのソファとこたつがある落ち着く空間。おやつを食べたりテレビを見たり。',
    transitTimeMin: [5, 8],
    possibleNyanIds: [1, 4, 5, 6, 16, 19, 37, 53, 54, 56, 59, 61, 70, 85, 87],
    bgIcon: 'Sofa',
    themeColor: 'amber',
  },
  bedroom: {
    id: 'bedroom',
    name: 'しんしつ',
    reading: '寝室',
    description: '静かで暗い安らぎの部屋。リカバリーウェアを着てぐっすり1時間昼寝。',
    transitTimeMin: [5, 6],
    possibleNyanIds: [5, 6, 9, 27, 39, 53, 77, 80],
    bgIcon: 'Bed',
    themeColor: 'indigo',
  },
  office: {
    id: 'office',
    name: 'かいしゃ',
    reading: '会社',
    description: 'パソコンと書類の並ぶオフィス。カタカタ仕事をしたり、休憩に新幹線出張の妄想をしたり。',
    transitTimeMin: [6, 10],
    possibleNyanIds: [22, 25, 29, 47, 52, 70, 71, 85, 86],
    bgIcon: 'Building2',
    themeColor: 'blue',
  },
  beginner_forest: {
    id: 'beginner_forest',
    name: 'しょしんしゃのもり',
    reading: '初心者の森',
    description: '緑豊かなやさしい森。羊が放牧されていたり、珍しい武器やナウシカ風の猫が隠れている。',
    transitTimeMin: [7, 10],
    possibleNyanIds: [1, 8, 10, 18, 30, 31, 35, 50, 64, 87],
    bgIcon: 'Trees',
    themeColor: 'emerald',
  },
  lalaport: {
    id: 'lalaport',
    name: 'ららぽーと',
    reading: 'ららぽーと',
    description: '巨大なショッピングパーク。お買い物袋を抱えたにゃんやフードコートが賑わう。',
    transitTimeMin: [6, 10],
    possibleNyanIds: [17, 34, 38, 42, 43, 46, 48, 49, 51, 81],
    bgIcon: 'ShoppingBag',
    themeColor: 'rose',
  },
  aeon: {
    id: 'aeon',
    name: 'いおん',
    reading: 'イオン',
    description: '休日にふらっと立ち寄る大型モール。シャトレーゼや和菓子屋、メガネ屋が揃っている。',
    transitTimeMin: [5, 9],
    possibleNyanIds: [7, 15, 19, 37, 47, 48, 52, 58, 68, 72],
    bgIcon: 'Store',
    themeColor: 'purple',
  },
  study: {
    id: 'study',
    name: 'しょさい',
    reading: '書斎',
    description: '本棚とガジェットに囲まれた秘密基地。ピタゴラ装置の発明やAI相談に耽る。',
    transitTimeMin: [5, 7],
    possibleNyanIds: [3, 14, 21, 29, 52, 63, 70, 86],
    bgIcon: 'BookOpen',
    themeColor: 'teal',
  },
  camp: {
    id: 'camp',
    name: 'きゃんぷじょう',
    reading: '木曽駒キャンプ場',
    description: '焚き火とうなぎの香りが漂う大自然。テントを張って星空の下でのんびり。',
    transitTimeMin: [8, 10],
    possibleNyanIds: [1, 10, 11, 13, 26, 32, 36, 41, 75, 82],
    bgIcon: 'Tent',
    themeColor: 'lime',
  },
  hotspring: {
    id: 'hotspring',
    name: 'ならこのおんせん',
    reading: 'ならここの里 温泉',
    description: '湯煙が立ちのぼる秘湯。湯上がりのコーヒー牛乳と鮎の塩焼きがたまらない。',
    transitTimeMin: [7, 10],
    possibleNyanIds: [9, 12, 45, 60, 67, 73, 79],
    bgIcon: 'Flame',
    themeColor: 'orange',
  },
};

export const TRANSPORT_METHODS: {
  id: TransportMethod;
  name: string;
  reading: string;
  speedMultiplier: number;
  description: string;
  icon: string;
}[] = [
  {
    id: 'walk',
    name: 'とほ',
    reading: '徒歩',
    speedMultiplier: 1.0,
    description: 'テクテク自分の足でお散歩。道端の草花や隠れたにゃんを発見しやすい。',
    icon: 'Footprints',
  },
  {
    id: 'bicycle',
    name: 'じてんしゃ',
    reading: '自転車',
    speedMultiplier: 1.5,
    description: '風を切ってスイスイ。近所のイオンやりびんぐへの移動はお手の物。',
    icon: 'Bike',
  },
  {
    id: 'car',
    name: 'くるま',
    reading: '車（アクア）',
    speedMultiplier: 2.0,
    description: '愛車で少し遠くのららぽーとやキャンプ場へ快適ドライブ。',
    icon: 'Car',
  },
  {
    id: 'jinbei_nyan',
    name: 'じんべえにゃん',
    reading: '甚平猫ライド',
    speedMultiplier: 2.5,
    description: '涼しげな甚平を着たじんべいにゃんがふわりと空を飛んで運んでくれる伝説の移動術。',
    icon: 'CloudSun',
  },
  {
    id: 'train',
    name: 'しんかんせん',
    reading: '新幹線（しんかんせんにゃん）',
    speedMultiplier: 3.0,
    description: 'ビール片手に超高速移動！あっという間に目的地へ到着。',
    icon: 'Train',
  },
];
