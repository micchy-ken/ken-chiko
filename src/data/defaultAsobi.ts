import { KenchikoAsobi } from '../types';

export const INITIAL_ASOBI_LIST: KenchikoAsobi[] = [
  // --- 歌・口ずさみ系 ---
  {
    id: 'asobi_1',
    title: 'けんちこはうたをうたった',
    content: '素敵なけんちこさん♪ 今日も街をゆく〜',
    condition: 'loc_living',
    frequency: 'normal',
    createdAt: 1700000000000,
  },
  {
    id: 'asobi_song_strolling',
    title: 'けんちこは鼻歌をうたった',
    content: 'るんるん〜♪ 寄り道しながら鼻歌まじりのお散歩タイム。',
    condition: 'trans_walk',
    frequency: 'normal',
    createdAt: 1700000000001,
  },

  // --- おやつ・食事系 (snacking) ---
  {
    id: 'asobi_snack_1',
    title: 'ひたすらおやつをもぐもぐ食べている（30分コース）',
    content: 'もぐもぐ…やっぱり甘いものは正義。30分ずっと食べ続けてるけど、まだ入るな…。',
    condition: 'all_locations',
    frequency: 'normal',
    createdAt: 1700000000002,
  },
  {
    id: 'asobi_snack_2',
    title: '特等席でお茶会タイム',
    content: 'これ、誰にもあげたくないくらい美味い。お茶も淹れてきてよかった〜。カロリーは明日考えよう。',
    condition: 'loc_living',
    frequency: 'high',
    createdAt: 1700000000003,
  },

  // --- 睡眠・昼寝系 (nap) ---
  {
    id: 'asobi_nap_1',
    title: 'ぐっすり1時間熟睡している…Zzz',
    content: 'ふかふかのお布団最高…1時間あっという間だな。夢の中で巨大なはんぺんに乗ってた…Zzz',
    condition: 'loc_bedroom',
    frequency: 'high',
    createdAt: 1700000000004,
  },
  {
    id: 'asobi_nap_2',
    title: 'すやすや15分のお昼寝中…',
    content: 'むにゃむにゃ…すぅ…すぅ…あと5分だけ…Zzz 寝起きに飲む水ってなんでこんなに美味いんだろ。',
    condition: 'all_locations',
    frequency: 'normal',
    createdAt: 1700000000005,
  },
  {
    id: 'asobi_nap_rec',
    title: 'けんちこは熟睡の体勢に入った',
    content: 'リカバリーウェアの包容力たるや…おやすみ世界…Zzz',
    condition: 'loc_bedroom',
    frequency: 'high',
    createdAt: 1700000000006,
  },

  // --- お仕事・作業系 (working) ---
  {
    id: 'asobi_work_1',
    title: 'けんちこはキーボードを叩いた',
    content: 'カタカタ…ッターン！仕事してる風だけど実は週末の予定を検索中。',
    condition: 'loc_office',
    frequency: 'normal',
    createdAt: 1700000000007,
  },
  {
    id: 'asobi_work_2',
    title: 'けんちこは真剣にパソコンに向かった',
    content: 'カタカタ…カタカタ…メール多すぎてAIに丸投げしたい…。次の休みはどこ行こうかな。',
    condition: 'loc_office',
    frequency: 'normal',
    createdAt: 1700000000008,
  },
  {
    id: 'asobi_study_1',
    title: 'けんちこは難解な本を開いた',
    content: 'ふむふむ…3行読んだところで強烈な睡魔が襲ってきた。',
    condition: 'loc_study',
    frequency: 'high',
    createdAt: 1700000000009,
  },

  // --- お買い物・ショッピング系 (shopping) ---
  {
    id: 'asobi_shop_1',
    title: 'けんちこはウインドウショッピングを楽しんだ',
    content: 'これも欲しいし、あれも気になる…80%オフって見ると買わなきゃ損な気がしてくる。両手に荷物がいっぱい！',
    condition: 'loc_lalaport',
    frequency: 'high',
    createdAt: 1700000000010,
  },
  {
    id: 'asobi_shop_2',
    title: 'けんちこはスーパーを徘徊した',
    content: '試食コーナーのいい匂いにつられて吸い寄せられそう…ついついカートがおやつでいっぱいに。',
    condition: 'loc_aeon',
    frequency: 'high',
    createdAt: 1700000000011,
  },

  // --- 温泉・リフレッシュ系 (hotspring / camp) ---
  {
    id: 'asobi_onsen_1',
    title: 'けんちこは湯船でとろけた',
    content: 'はぁぁぁ〜〜極楽極楽…温泉の効能が全身の細胞に染み渡る…湯上がりの牛乳が待ちきれない。',
    condition: 'loc_hotspring',
    frequency: 'high',
    createdAt: 1700000000012,
  },
  {
    id: 'asobi_camp_1',
    title: 'けんちこは焚き火を見つめた',
    content: 'パチパチ…火の粉が舞い上がるのを眺めているだけで心が洗われるねぇ。マシュマロ焼こうかな。',
    condition: 'loc_camp',
    frequency: 'high',
    createdAt: 1700000000013,
  },
  {
    id: 'asobi_forest_1',
    title: 'けんちこは森林浴で深呼吸した',
    content: 'すぅ〜〜はぁ〜〜！マイナスイオンがすごい。木陰に丸いにゃんこが隠れていそうだ。',
    condition: 'loc_beginner_forest',
    frequency: 'high',
    createdAt: 1700000000014,
  },

  // --- 移動系 (transit) ---
  {
    id: 'asobi_trans_walk',
    title: 'けんちこはのんびり歩いた',
    content: 'あ、あそこに何か丸いものが落ちてる…？急ぐ旅でもなし、のんびり行こう。',
    condition: 'trans_walk',
    frequency: 'high',
    createdAt: 1700000000015,
  },
  {
    id: 'asobi_trans_bike',
    title: 'けんちこは風を感じた',
    content: 'すいすい〜！自転車で走ると悩み事も吹き飛ぶなぁ。立ち漕ぎすると爽快感MAX！',
    condition: 'trans_bicycle',
    frequency: 'high',
    createdAt: 1700000000016,
  },
  {
    id: 'asobi_trans_car',
    title: 'けんちこはドライブを満喫した',
    content: 'お気に入りの音楽を流しながら快適ドライブ。信号待ちでついついリズムに乗っちゃう。',
    condition: 'trans_car',
    frequency: 'normal',
    createdAt: 1700000000017,
  },
  {
    id: 'asobi_trans_jinbei',
    title: 'けんちこはじんべえにゃんに乗った',
    content: 'ふわふわ〜！空を泳ぐような乗り心地で雲の上の世界へ。どこまでも飛んでいけそう。',
    condition: 'trans_jinbei_nyan',
    frequency: 'rare',
    createdAt: 1700000000018,
  },
  {
    id: 'asobi_trans_train',
    title: 'けんちこは電車の旅情にひたった',
    content: 'ガタゴト揺られながら飲むお茶は格別だねぇ。車窓を流れる景色をぼんやり見つめる至福のひととき。',
    condition: 'trans_train',
    frequency: 'normal',
    createdAt: 1700000000019,
  },
  {
    id: 'asobi_trans_all',
    title: 'けんちこは移動を楽しんだ',
    content: '移動中って、無駄にいろんなこと考えちゃうよね。風が気持ちいいなぁ〜。',
    condition: 'all_transports',
    frequency: 'normal',
    createdAt: 1700000000020,
  },

  // --- 日常・ぼーっとする系 (spacing out / strolling / all) ---
  {
    id: 'asobi_space_1',
    title: 'けんちこはぼーーーーーっとした',
    content: '（無の境地に入っている）…夕飯何にしようかな…それとも何も考えないでおこうか…宇宙の神秘について考えているようで何も考えていない。',
    condition: 'all_locations',
    frequency: 'normal',
    createdAt: 1700000000021,
  },
  {
    id: 'asobi_space_2',
    title: 'けんちこは空を見上げた',
    content: '雲の形がどことなく猫に見えるような気がする…今日の天気は最高だね。',
    condition: 'all_locations',
    frequency: 'normal',
    createdAt: 1700000000022,
  },
  {
    id: 'asobi_opt_glasses',
    title: 'けんちこはメガネを磨いた',
    content: 'キュッキュッ…これで視界良好、にゃんこもクッキリ！',
    condition: 'all',
    frequency: 'normal',
    createdAt: 1700000000023,
  },
  {
    id: 'asobi_opt_stretch',
    title: 'けんちこは背筋をぐーんと伸ばした',
    content: 'う〜〜ん！ポキポキッ！身体を伸ばすとリフレッシュできるねぇ。よし、気合十分！',
    condition: 'all',
    frequency: 'normal',
    createdAt: 1700000000024,
  },
];
