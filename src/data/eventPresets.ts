import { KenchikoAsobi, AsobiConditionScope } from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';

export interface EventPresetTemplate {
  name: string;
  description: string;
  condition: AsobiConditionScope;
  title: string;
  content: string;
}

export const EVENT_PRESET_TEMPLATES: EventPresetTemplate[] = [
  {
    name: '歌・鼻歌イベント',
    description: 'けんちこがご機嫌に歌や鼻歌を口ずさむイベント',
    condition: 'all',
    title: 'けんちこはうたをうたった',
    content: '素敵なけんちこさん♪ 今日も元気に街をゆく〜',
  },
  {
    name: 'おやつタイムイベント',
    description: 'お気に入りのお菓子やお茶を食べてほっと一息つくイベント',
    condition: 'all_locations',
    title: 'ひたすらおやつをもぐもぐ食べた',
    content: 'もぐもぐ…やっぱり甘いものは正義。カロリーは明日考えよう。',
  },
  {
    name: '熟睡・お昼寝イベント',
    description: 'ふかふかのお布団やベッドで熟睡するイベント',
    condition: 'loc_bedroom',
    title: 'ぐっすり1時間熟睡している…Zzz',
    content: 'リカバリーウェアの包容力たるや…おやすみ世界…Zzz',
  },
  {
    name: '仕事・作業イベント',
    description: 'オフィスでカタカタパソコンに向かうイベント',
    condition: 'loc_office',
    title: 'けんちこはキーボードを叩いた',
    content: 'カタカタ…ッターン！仕事してる風だけど実は週末の計画中。',
  },
  {
    name: '読書・勉強イベント',
    description: '書斎で本を開いて思索に耽るイベント',
    condition: 'loc_study',
    title: 'けんちこは難解な本を開いた',
    content: 'ふむふむ…3行読んだところで心地よい睡魔が襲ってきた。',
  },
  {
    name: 'ショッピングイベント',
    description: 'ららぽーとやモールで買い物を満喫するイベント',
    condition: 'loc_lalaport',
    title: 'けんちこは買い物を楽しんだ',
    content: 'これも欲しいしあれも気になる…両手に荷物がいっぱい！',
  },
  {
    name: 'スーパー散策イベント',
    description: 'イオンで食材や和菓子を見て回るイベント',
    condition: 'loc_aeon',
    title: 'けんちこはスーパーを徘徊した',
    content: '試食コーナーのいい匂いにつられてついついカートがいっぱいに。',
  },
  {
    name: '温泉・湯治イベント',
    description: '温泉に浸かって身体を癒やすイベント',
    condition: 'loc_hotspring',
    title: 'けんちこは湯船でとろけた',
    content: 'はぁぁぁ〜〜極楽極楽…湯上がりのコーヒー牛乳が待ちきれない。',
  },
  {
    name: 'キャンプ・星空イベント',
    description: '大自然の中で焚き火や星空を眺めるイベント',
    condition: 'loc_camp',
    title: 'けんちこは焚き火を見つめた',
    content: 'パチパチ…火の粉が舞い上がるのを眺めているだけで心が洗われるねぇ。',
  },
  {
    name: '森林浴・散歩イベント',
    description: '緑豊かな森でマイナスイオンを浴びるイベント',
    condition: 'loc_beginner_forest',
    title: 'けんちこは森林浴で深呼吸した',
    content: 'すぅ〜〜はぁ〜〜！マイナスイオンがすごい。木陰ににゃんこがいるかも。',
  },
  {
    name: '徒歩散歩イベント',
    description: '歩きながら風や街並みを楽しむイベント',
    condition: 'trans_walk',
    title: 'けんちこはのんびり歩いた',
    content: 'あ、あそこに何か丸いものが落ちてる…？急ぐ旅でもなし、のんびり行こう。',
  },
  {
    name: '自転車サイクリングイベント',
    description: '自転車ですいすい風を切って走るイベント',
    condition: 'trans_bicycle',
    title: 'けんちこは風を感じた',
    content: 'すいすい〜！自転車で走ると悩み事も吹き飛ぶなぁ。立ち漕ぎ爽快！',
  },
  {
    name: 'ドライブイベント',
    description: '車で音楽を聴きながらドライブするイベント',
    condition: 'trans_car',
    title: 'けんちこはドライブを満喫した',
    content: 'お気に入りの音楽を流しながら快適ドライブ。信号待ちでリズムに乗る。',
  },
  {
    name: 'じんべえにゃん空中飛行イベント',
    description: 'じんべえにゃんの背中に乗って雲の上を飛ぶレアなイベント',
    condition: 'trans_jinbei_nyan',
    title: 'けんちこはじんべえにゃんに乗った',
    content: 'ふわふわ〜！空を泳ぐような乗り心地で雲の上の世界へ。',
  },
  {
    name: '電車・新幹線旅情イベント',
    description: '電車や新幹線に揺られて旅を楽しむイベント',
    condition: 'trans_train',
    title: 'けんちこは電車の旅情にひたった',
    content: 'ガタゴト揺られながら飲むお茶は格別だねぇ。車窓の景色をぼんやり見つめる。',
  },
];
