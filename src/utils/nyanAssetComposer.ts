import { NyanCharacter } from '../types';

export type NyanCoatType = 'white' | 'calico' | 'tabby' | 'black' | 'gray' | 'tuxedo';
export type NyanPoseType = 'sitting' | 'typing' | 'loaf' | 'standing' | 'sleeping';
export type NyanHeadProp =
  | 'antenna'
  | 'hanpen'
  | 'mikan'
  | 'glasses'
  | 'chef_hat'
  | 'scarf'
  | 'ribbon'
  | 'headband'
  | 'straw_hat'
  | 'party_hat'
  | 'fever_patch'
  | 'flower'
  | 'none';

export type NyanHandProp =
  | 'taiyaki'
  | 'pino_box'
  | 'sushi_plate'
  | 'laptop'
  | 'coffee'
  | 'beer'
  | 'ramen'
  | 'book'
  | 'guitar'
  | 'onigiri'
  | 'shopping_bag'
  | 'cardboard_shield'
  | 'bread'
  | 'none';

export interface ComposedNyanConfig {
  coat: NyanCoatType;
  pose: NyanPoseType;
  headProp: NyanHeadProp;
  handProp: NyanHandProp;
  soundEffect?: string;
  accentColor?: string;
}

/**
 * Derives dynamic hand-drawn visual parts configuration for any ◯◯-nyan
 * based on its No, name, and motif keywords.
 */
export function getNyanComposition(nyan: NyanCharacter): ComposedNyanConfig {
  const name = nyan.name || '';
  const motif = (nyan.motif || '').toLowerCase();
  const no = nyan.no;

  // 0. Kihon-nyan (#1 / きほんのにゃんこ) - Pure authentic base drawing
  if (no === 1 || name === 'きほんのにゃんこ' || name.includes('きほん')) {
    return {
      coat: 'white',
      pose: 'standing',
      headProp: 'none',
      handProp: 'none',
      soundEffect: '',
      accentColor: '#3E3833',
    };
  }

  // 1. Taiyaki-nyan (たいやきにゃん)
  if (name.includes('たいやき') || name.includes('たい焼き') || motif.includes('たいやき') || motif.includes('たい焼き')) {
    return {
      coat: 'white',
      pose: 'sitting',
      headProp: 'none',
      handProp: 'taiyaki',
      soundEffect: 'ほかほか',
      accentColor: '#C47335',
    };
  }

  // 2. AI-Nyan (#86 / えーあいにゃん)
  if (no === 86 || name.includes('えーあい') || name.includes('AI') || name.includes('プログラマ') || name.includes('エンジニア')) {
    return {
      coat: 'white',
      pose: 'typing',
      headProp: 'antenna',
      handProp: 'laptop',
      soundEffect: 'カタカタ',
      accentColor: '#488A58',
    };
  }

  // 3. Oden-nyan (#4 / おでんにゃん)
  if (no === 4 || name.includes('おでん') || motif.includes('おでん') || motif.includes('はんぺん')) {
    return {
      coat: 'white',
      pose: 'sitting',
      headProp: 'hanpen',
      handProp: 'none',
      soundEffect: 'あつあつ',
      accentColor: '#D99B4E',
    };
  }

  // 4. Pino-nyan (#5 / ピノにゃん)
  if (no === 5 || name.includes('ピノ') || motif.includes('アイス') || motif.includes('ピノ')) {
    return {
      coat: 'white',
      pose: 'sitting',
      headProp: 'none',
      handProp: 'pino_box',
      soundEffect: 'ひんやり',
      accentColor: '#D9433B',
    };
  }

  // 5. Mikan / Kotatsu-nyan (みかんにゃん)
  if (name.includes('みかん') || motif.includes('みかん') || name.includes('こたつ') || motif.includes('こたつ')) {
    return {
      coat: 'white',
      pose: 'sitting',
      headProp: 'mikan',
      handProp: 'none',
      soundEffect: 'まったり',
      accentColor: '#E68A2E',
    };
  }

  // 6. Yataizushi-nyan (#7 / やたいずしにゃん)
  if (no === 7 || name.includes('ずし') || name.includes('寿司') || motif.includes('寿司') || motif.includes('まぐろ')) {
    return {
      coat: 'tuxedo',
      pose: 'standing',
      headProp: 'headband',
      handProp: 'sushi_plate',
      soundEffect: 'へいお待ち！',
      accentColor: '#D9433B',
    };
  }

  // 7. Kanpa-nyan (#9 / 寒波にゃん)
  if (no === 9 || name.includes('寒波') || name.includes('雪') || motif.includes('寒波') || motif.includes('マフラー')) {
    return {
      coat: 'gray',
      pose: 'sitting',
      headProp: 'scarf',
      handProp: 'none',
      soundEffect: 'ぶるぶる',
      accentColor: '#78B9DC',
    };
  }

  // 8. JINS-nyan (#47 / JINSにゃん)
  if (no === 47 || name.includes('メガネ') || name.includes('眼鏡') || name.includes('JINS') || motif.includes('眼鏡')) {
    return {
      coat: 'calico',
      pose: 'sitting',
      headProp: 'glasses',
      handProp: 'book',
      soundEffect: 'きらーん',
      accentColor: '#3C5C7A',
    };
  }

  // 9. Sick / Influenza / Fever-nyan
  if (name.includes('インフル') || name.includes('かぜ') || name.includes('熱') || motif.includes('体調')) {
    return {
      coat: 'white',
      pose: 'sitting',
      headProp: 'fever_patch',
      handProp: 'none',
      soundEffect: 'ふーふー',
      accentColor: '#4A90E2',
    };
  }

  // 10. Coffee / Cafe-nyan
  if (name.includes('カフェ') || name.includes('コーヒー') || motif.includes('コーヒー') || motif.includes('喫茶')) {
    return {
      coat: 'tabby',
      pose: 'sitting',
      headProp: 'none',
      handProp: 'coffee',
      soundEffect: 'ほっと一息',
      accentColor: '#8C5A3E',
    };
  }

  // 11. Beer / Izakaya-nyan
  if (name.includes('ビール') || name.includes('居酒屋') || name.includes('酒') || motif.includes('ビール')) {
    return {
      coat: 'calico',
      pose: 'standing',
      headProp: 'none',
      handProp: 'beer',
      soundEffect: 'ぷはぁー！',
      accentColor: '#DDA032',
    };
  }

  // 12. Ramen / Noodles-nyan
  if (name.includes('ラーメン') || name.includes('麺') || motif.includes('ラーメン')) {
    return {
      coat: 'tabby',
      pose: 'sitting',
      headProp: 'headband',
      handProp: 'ramen',
      soundEffect: 'ずずずっ',
      accentColor: '#C44E38',
    };
  }

  // 13. Shopping-nyan
  if (name.includes('ショッピング') || name.includes('ららぽーと') || name.includes('イオン') || motif.includes('買い物')) {
    return {
      coat: 'calico',
      pose: 'standing',
      headProp: 'ribbon',
      handProp: 'shopping_bag',
      soundEffect: 'るんるん♪',
      accentColor: '#D9758B',
    };
  }

  // 14. Hero / Captain-nyan
  if (name.includes('キャプテン') || name.includes('勇者') || name.includes('ヒーロー') || motif.includes('盾')) {
    return {
      coat: 'white',
      pose: 'standing',
      headProp: 'headband',
      handProp: 'cardboard_shield',
      soundEffect: 'シャキーン',
      accentColor: '#3B82F6',
    };
  }

  // 15. Bread / Bakery-nyan
  if (name.includes('パン') || name.includes('ベーカリー') || motif.includes('パン')) {
    return {
      coat: 'tabby',
      pose: 'sitting',
      headProp: 'chef_hat',
      handProp: 'bread',
      soundEffect: 'ふっくら',
      accentColor: '#D99B4E',
    };
  }

  // 16. Mountain / Outdoor-nyan
  if (name.includes('山') || name.includes('登山') || motif.includes('登山') || motif.includes('キャンプ')) {
    return {
      coat: 'white',
      pose: 'standing',
      headProp: 'straw_hat',
      handProp: 'onigiri',
      soundEffect: 'てくてく',
      accentColor: '#5C8299',
    };
  }

  // Deterministic fallbacks for any of the 200+ characters:
  const headPropPool: NyanHeadProp[] = ['none', 'none', 'ribbon', 'glasses', 'none', 'party_hat', 'flower', 'straw_hat'];
  const headProp = headPropPool[(no * 7) % headPropPool.length];

  const handPropPool: NyanHandProp[] = ['none', 'taiyaki', 'onigiri', 'coffee', 'none', 'book', 'none'];
  const handProp = handPropPool[(no * 5) % handPropPool.length];

  return {
    coat: 'white',
    pose: 'standing',
    headProp,
    handProp,
    soundEffect: 'じーっ',
  };
}
