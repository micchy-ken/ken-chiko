import { NyanCharacter } from '../types';

export type NyanCoatType = 'white' | 'calico' | 'tabby' | 'black' | 'gray' | 'tuxedo';
export type NyanPoseType = 'sitting' | 'typing' | 'loaf' | 'standing' | 'sleeping';
export type NyanHeadProp = 'antenna' | 'hanpen' | 'glasses' | 'chef_hat' | 'scarf' | 'ribbon' | 'headband' | 'straw_hat' | 'party_hat' | 'none';
export type NyanHandProp = 'laptop' | 'coffee' | 'pino_box' | 'sushi_plate' | 'beer' | 'ramen' | 'book' | 'guitar' | 'onigiri' | 'shopping_bag' | 'none';

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

  // 1. AI-Nyan (#86 / えーあいにゃん) - EXACT Reference Image match
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

  // 2. Oden-nyan (#4 / おでんにゃん)
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

  // 3. Pino-nyan (#5 / ピノにゃん)
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

  // 4. Yataizushi-nyan (#7 / やたいずしにゃん)
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

  // 5. Kanpa-nyan (#9 / 寒波にゃん)
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

  // 6. JINS-nyan (#47 / JINSにゃん)
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

  // 7. Coffee / Cafe-nyan
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

  // 8. Beer / Izakaya-nyan
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

  // 9. Ramen / Noodles-nyan
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

  // 10. Sleeping / Chill nyan
  if (name.includes('ねむ') || name.includes('まくら') || name.includes('すや') || motif.includes('睡眠')) {
    return {
      coat: 'white',
      pose: 'sleeping',
      headProp: 'none',
      handProp: 'none',
      soundEffect: 'すやぁ...',
      accentColor: '#88A3B8',
    };
  }

  // 11. Music / Guitar-nyan
  if (name.includes('音楽') || name.includes('ギター') || name.includes('ロック') || motif.includes('楽器')) {
    return {
      coat: 'black',
      pose: 'standing',
      headProp: 'none',
      handProp: 'guitar',
      soundEffect: 'ジャーン♪',
      accentColor: '#C43A3A',
    };
  }

  // 12. Shopping / Department-nyan
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

  // Generic algorithm for any dynamically created or CSV imported nyan:
  // Deterministically map by ID/Name hash to guarantee rich variety
  const coatPool: NyanCoatType[] = ['white', 'calico', 'tabby', 'black', 'gray', 'tuxedo'];
  const coat = coatPool[no % coatPool.length];

  const posePool: NyanPoseType[] = ['sitting', 'standing', 'loaf', 'sitting'];
  const pose = posePool[(no * 3) % posePool.length];

  const headPropPool: NyanHeadProp[] = ['none', 'ribbon', 'straw_hat', 'glasses', 'none', 'party_hat'];
  const headProp = headPropPool[(no * 7) % headPropPool.length];

  const handPropPool: NyanHandProp[] = ['none', 'coffee', 'onigiri', 'book', 'none'];
  const handProp = handPropPool[(no * 5) % handPropPool.length];

  return {
    coat,
    pose,
    headProp,
    handProp,
    soundEffect: 'じーっ',
  };
}
