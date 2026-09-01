import { NyanCharacter } from '../types';

export const RAW_DEFAULT_CSV = `No.,キャラクター名,よみ,モチーフ・元ネタ,初登場時期,設定・主なエピソード,画像生成プロンプト（日本語：B-1 ゆるかわ脱力ペン画風）,画像生成プロンプト（英語：ImageFX / Midjourney等）
1,へびにゃん,へびにゃん,2025年 巳年・蛇のBBQ,2025/01/06,巳年だからとBBQを始めるが、具材がネズミ・カエル・トカゲで健介さんに共食いだと怒られる。後に手足が生えて進化する。,シンプルな黒インクペン画の蛇柄のゆるい猫「へびにゃん」。小さなトングを持って真顔でBBQ網の前に立っている。脱力系イラスト。,"minimalist cute cat mascot named Hebi-nyan with subtle snake scale patterns, holding tiny BBQ tongs with a deadpan stoic face, simple black ink pen lines, charming Japanese indie character style --ar 1:1"
2,きょうとたちばなにゃん,きょうとたちばなにゃん,京都橘高校吹奏楽部（オレンジの悪魔）,2025/01/14,オレンジ色の衣装を着て激しいステップで楽器を演奏しながら行進する猫。はぐれて迷子になる「はぐれ橘にゃん」も登場。,シンプルなペン画の猫「きょうとたちばなにゃん」。鮮やかなオレンジ色のユニフォームを着て、小さな金管楽器を持って真顔で行進している脱力系マスコット。,"minimalist marching band cat mascot named Kyoto-Tachibana-nyan, wearing a tiny bright orange uniform, holding a miniature brass instrument with a serious deadpan face, clean pen lines, Japanese character design --ar 1:1"
3,じーくあくすにゃん,じーくあくすにゃん,ガンダム（ジークジオン・モビルスーツ）,2025/01/20,木と真鍮と釘で手作りされた木製モビルスーツを着て宇宙進出を目論む猫。酸素ボンベ代わりに空気入れを背負っている。,シンプルなペン画の猫「じーくあくすにゃん」。手作りの木製ロボットスーツを着て、手動の空気入れを背負い真顔で敬礼している。シュールで可愛いマスコット。,"minimalist quirky cat mascot named Zeek-nyan wearing a handmade wooden robot armor with a tiny bicycle air pump on its back, deadpan stoic salute, clean black line art, charming parody character --ar 1:1"
4,おでんにゃん,おでんにゃん,冬の熱々おでん・猫舌,2025/01/27,アヴァンギャルドなおでんを開発するが猫舌のため熱くて食べられない。中華風や八丁味噌煮込みなど迷走を重ねる。,シンプルなペン画のぽっちゃり猫「おでんにゃん」。頭に三角はんぺんを乗せ、おでん鍋の横でフーフーしながら真顔で立っている。脱力系イラスト。,"minimalist chubby cat mascot named Oden-nyan with a triangular fish cake on its head, standing near an oden pot with a deadpan funny expression, simple black ink drawing, Japanese character style --ar 1:1"
5,すのうにゃん / ぴのにゃん,すのうにゃん,雪景色・ピノアイス,2025/02/03,雪の日に現れる白い猫。本物のスノーボールではなくピノアイスを買い集めていることがバレて「ピノにゃん」に改名されそうになる。,シンプルなペン画の純白の丸っこい猫「すのうにゃん」。小さなピノアイスの箱を両手で抱えて無表情の点目で見つめている脱力マスコット。,"minimalist cute white cat mascot named Snow-nyan, holding a tiny ice cream box with its small paws, deadpan round dot eyes, simple clean black outlines, charming Japanese indie character --ar 1:1"
6,いんふるにゃん,いんふるにゃん,インフルエンザ・体調管理,2025/02/10,屋根の上から体調不良を監視し、熱冷ましのお手紙を運んでくる冬の用心猫。,シンプルなペン画の猫「いんふるにゃん」。おでこに冷却シートを貼り、体温計をくわえて真顔でたたずんでいる脱力系イラスト。,"minimalist funny cat mascot named Influ-nyan with a fever cooling patch on its forehead, holding a tiny thermometer in mouth with stoic deadpan eyes, simple black line art, Japanese character --ar 1:1"
7,やたいずしにゃん,やたいずしにゃん,居酒屋「や台ずし」・大間マグロ,2025/02/12,大間のまぐろ（まげろ）を握ってくれる寿司職人猫。ネタの仕入れに命をかける。,シンプルなペン画の猫寿司職人「やたいずしにゃん」。頭にねじり鉢巻きをし、大きなマグロの握り寿司を両手で差し出す真顔のマスコット。,"minimalist cute cat sushi chef mascot wearing a twisted headband, proudly holding a giant tuna sushi with tiny paws, funny deadpan face, clean black ink lines, Japanese indie character --ar 1:1"
8,きゃぷてんあめりかにゃん,きゃぷてんあめりかにゃん,映画キャプテン・アメリカ,2025/02/17,光学迷彩と称した段ボールハウスを作り、落とし穴の罠を仕掛けてサバイバル生活を送るヒーロー猫。,シンプルなペン画の猫「きゃぷてんあめりかにゃん」。段ボールで作った丸い盾を持ち、段ボール箱をかぶって真顔で潜入ポーズをとっている脱力系イラスト。,"minimalist funny superhero cat mascot carrying a round cardboard shield, crouching inside a cardboard box with a deadpan serious expression, simple black ink contour, Japanese parody comic style --ar 1:1"
9,かんぱにゃん,かんぱにゃん,冬の大寒波・雪,2025/02/26,感情と天気が連動しており、落ち込むと周囲が氷点下の極寒になる冬の精霊猫。もつ鍋で温めると機嫌が直る。,シンプルなペン画の青白い丸っこい猫「かんぱにゃん」。首にぐるぐる巻きの長いマフラーをして、ガタガタ震えながら真顔で見つめている脱力マスコット。,"minimalist cute cold cat mascot named Kanpa-nyan, wrapped in a comically oversized scarf, shivering slightly with a funny stoic deadpan face, simple pen lines, light icy blue accents --ar 1:1"
10,やくしまにゃん / とれっきんぐにゃん,やくしまにゃん,屋久島旅行・トレッキング,2025/03/04,屋久島の巨木や自然を案内してくれるガイド猫。漫才のツッコミが鋭く、コロンビアのレインウェアを着ている。,シンプルなペン画の登山猫「やくしまにゃん」。小さな登山リュックを背負い、トレッキングポールを持って真顔で立っている脱力系イラスト。,"minimalist cute hiking cat mascot named Yakushima-nyan, wearing a tiny backpack and holding hiking trekking poles with a deadpan focused face, simple black line art, Japanese outdoor style --ar 1:1"
11,ちゃうすやまにゃん,ちゃうすやまにゃん,茶臼山高原・アウトドア,2025/03/05,全国の茶臼山を統括するローカル猫。芝桜や高原キャンプの魅力を広めている。,シンプルなペン画の猫「ちゃうすやまにゃん」。頭に小さな山型の帽子を被り、芝桜の花を一輪持った真顔のマスコット。,"minimalist cute mountain cat mascot named Chausuyama-nyan, wearing a tiny mountain peak hat, holding a pink moss phlox flower with stoic deadpan eyes, simple clean ink art --ar 1:1"
12,さくらじまにゃん / たまてばこにゃん,さくらじまにゃん,鹿児島旅行・桜島・観光列車,2025/03/07,頭から火山灰の煙をもくもく出しながら、指宿のたまてばこ列車を案内する鹿児島猫。,シンプルなペン画の猫「さくらじまにゃん」。頭の上から小さな煙をもくもく出し、黒豚のぬいぐるみを抱えた真顔の脱力系イラスト。,"minimalist funny volcano cat mascot named Sakurajima-nyan with a puff of smoke above head, holding a tiny black pig plush with deadpan eyes, simple black line drawing, Japanese indie character --ar 1:1"
13,ぜいんあーつにゃん,ぜいんあーつにゃん,アウトドアブランド ZANE ARTS,2025/03/10,長久手進出を目論み、ステッカーやカッパを量産してコングロマリット企業を築こうとする野心家テント猫。,シンプルなペン画の猫「ぜいんあーつにゃん」。幾何学的なテント型のケープをまとい、ステッカーを両手に持って真顔でアピールしているマスコット。,"minimalist stylish outdoor cat mascot named ZaneArts-nyan wearing a geometric camping tent cape, holding outdoor stickers with an expressionless funny stare, clean black lines --ar 1:1"
14,こむてっくにゃん,こむてっくにゃん,ドライブレコーダー COMTEC,2025/03/17,ライブハウス祭りを開催し、屋台で焼きうどんを売りまくろうとするドラレコ搭載猫。,シンプルなペン画の猫「こむてっくにゃん」。おでこに小さな四角いカメラレンズが付いており、フライ返しを持って真顔で屋台に立つ脱力イラスト。,"minimalist quirky cat mascot with a tiny dashcam lens on forehead, holding a cooking spatula with deadpan stoic eyes, simple black ink contour, humorous Japanese character --ar 1:1"
15,せんじゅにゃん,せんじゅにゃん,穴子寿司の名店「千寿」,2025/03/18,絶品の穴子寿司を握って差し入れてくれる、手先が器用なお寿司猫。,シンプルなペン画の猫「せんじゅにゃん」。笹の葉に乗った穴子寿司を両手で大事そうに運んでいる真顔の脱力マスコット。,"minimalist Japanese cat mascot named Senju-nyan, carefully carrying a pair of eel sushi on a bamboo leaf with tiny paws, deadpan polite expression, simple clean pen lines --ar 1:1"
16,にくじゃがにゃん,にくじゃがにゃん,おふくろの味・肉じゃが,2025/03/19,塩分1kgの超濃厚肉じゃがまぜそばを開発しようとする家庭料理の妖精。,シンプルなペン画の丸い猫「にくじゃがにゃん」。ジャガイモのような茶色の丸っこい体型で、お玉を持って真顔で鍋を覗き込んでいる脱力系イラスト。,"minimalist round potato-shaped cat mascot named Nikujaga-nyan, holding a tiny cooking ladle, peering into a stew pot with funny deadpan dot eyes, simple black line art --ar 1:1"
17,けんちきにゃん,けんちきにゃん,ケンタッキーフライドチキン・手羽先,2025/03/24,足が8本ある伝説のチキンをペットとして飼い、フライドチキン会社を起業して下克上を狙う猫。,シンプルなペン画の猫「けんちきにゃん」。フライドチキンのバケツハットを被り、両手にチキンを持って真顔でキメポーズをとっているマスコット。,"minimalist funny cat mascot named Kenchiki-nyan wearing a fried chicken bucket hat, holding crispy chicken pieces with a serious deadpan face, clean simple pen lines --ar 1:1"
18,くじゃくにゃん,くじゃくにゃん,孔雀・ジャングルダンスショー,2025/03/31,ジャングルで豪華な羽を広げてダンスショーを開くが、観客（人間）が来すぎて恥ずかしくなり逃げ出した内気な猫。,シンプルなペン画の猫「くじゃくにゃん」。背中に扇状に広がるカラフルな孔雀の羽を背負い、もじもじしながら真顔で見つめている脱力系イラスト。,"minimalist shy cat mascot named Kujaku-nyan with a miniature peacock feather fan on its back, fidgeting with an expressionless funny bashful face, clean ink lines --ar 1:1"
19,きんせいどうにゃん,きんせいどうにゃん,和菓子屋「金精軒/金生堂」・五代目,2025/04/08,「五代目がすごい」と熱弁し、棚の和菓子を全部売りつけようとする押し売り和菓子猫。,シンプルなペン画の猫「きんせいどうにゃん」。「五代目」と書かれた前掛けをして大きな大福を掲げ、真顔のジト目でアピールしている脱力マスコット。,"minimalist funny Japanese merchant cat mascot wearing an apron labeled '五代目', holding up a giant mochi sweet, deadpan intense stare, simple clean pen lines --ar 1:1"
20,たかとおにゃん / ひくちかにゃん,たかとおにゃん,高遠城址公園・桜・お花見,2025/04/14,高遠の桜が混雑するため、低くて近い第二の公園「ひくちか城址公園」を開園してマスコットになった猫。,シンプルなペン画の猫「たかとおにゃん」。頭に桜の花びらを1枚乗せ、三色団子を持って真顔でお花見をしている脱力系イラスト。,"minimalist cute cat mascot named Takato-nyan with a pink cherry blossom petal on its ear, holding a small tricolor dango skewer, expressionless charming face, simple black ink contour --ar 1:1"
21,ぴたごらにゃん,ぴたごらにゃん,ピタゴラスイッチ・スマートボール,2025/04/21,パチンコ玉やからくり仕掛けで壮大なお祭り屋台装置を作る発明家猫。,シンプルなペン画の猫「ぴたごらにゃん」。大きなビー玉を両手で持ち、真顔で転がそうとしている脱力系イラスト。,"minimalist clever cat mascot named Pythagora-nyan holding a shiny glass marble with tiny paws, watching a contraption with a deadpan focused face, simple line art --ar 1:1"
22,しんかんせんにゃん,しんかんせんにゃん,東海道新幹線・出張,2025/05/02,新幹線のかぶりものを被り、アルコールを燃料にして名古屋〜品川間を疾走する出張猫。,シンプルなペン画の猫「しんかんせんにゃん」。頭に新幹線N700系の先頭車両のかぶりものを被り、ビール缶を持って真顔で走っているマスコット。,"minimalist funny bullet train cat mascot wearing a Shinkansen train hat, holding a tiny beer can, running with a stoic deadpan expression, simple clean black ink art --ar 1:1"
23,ごーるでんうぃーくにゃん,ごーるでんうぃーくにゃん,ゴールデンウィーク（前半・後半）,2025/05/07,前半にゃんと後半にゃんの2匹組。連休が終わるのを阻止しようとカレンダーにしがみつく。,シンプルなペン画の2匹の丸い猫「ごーるでんうぃーくにゃん」。カレンダーの端っこを2匹で必死に引っ張りながら真顔で見つめている脱力イラスト。,"minimalist pair of chubby cat mascots named Golden-Week-nyans, holding onto a calendar page together with deadpan funny faces, simple clean pen lines, Japanese character design --ar 1:1"
24,えんていにゃん,えんていにゃん,焼肉店「炎亭」,2025/05/12,上質な牛タンとカルビを網の上で完璧な焼き加減に仕上げてくれる焼肉職人猫。,シンプルなペン画の猫「えんていにゃん」。頭に「炎」の鉢巻きをし、トングで分厚い牛タンを焼いている真顔のマスコット。,"minimalist cute cat yakiniku chef wearing a headband with fire kanji, grilling a slice of beef tongue with tiny metal tongs, deadpan serious face, simple black line art --ar 1:1"
25,でぃれくたーにゃん,でぃれくたーにゃん,テレビ番組ディレクター・撮影,2025/05/13,肩にカーディガンを羽織り、メガホンを持って「はいカット！」と指示を出す業界人猫。,シンプルなペン画の猫「でぃれくたーにゃん」。プロデューサー巻きのカーディガンを着て、小さなメガホンを持った真顔の業界猫マスコット。,"minimalist funny TV director cat mascot wearing a miniature sweater tied over shoulders, holding a tiny director megaphone with a stoic deadpan expression, clean black lines --ar 1:1"
26,ふぃーるどすたいるにゃん,ふぃーるどすたいるにゃん,アウトドア展示会 FIELDSTYLE,2025/05/20,最新のキャンプギアに身を包み、VIPコンシェルジュとしてブースを案内するおしゃれ猫。,シンプルなペン画のアウトドア猫「ふぃーるどすたいるにゃん」。サファリハットを被り、ミニLEDランタンを持って真顔でポーズをとっているイラスト。,"minimalist stylish outdoor camper cat mascot wearing a tiny bucket hat, holding a small LED camping lantern with deadpan cool eyes, clean line art, Japanese festival style --ar 1:1"
27,りぜろにゃん,りぜろにゃん,アニメ「Re:ゼロから始める異世界生活」,2025/05/26,何があっても「死に戻り」で月曜日の朝に巻き戻そうとする異世界召喚猫。,シンプルなペン画の猫「りぜろにゃん」。黒と紫のジャージを着て、カレンダーの前で頭を抱えながら真顔で耐えている脱力系マスコット。,"minimalist deadpan anime parody cat mascot wearing a purple tracksuit, standing stoically with tiny paws on head, simple black ink contour, humorous Japanese character style --ar 1:1"
28,しょくちゅうどくにゃん,しょくちゅうどくにゃん,夏の食中毒予防・巨大冷蔵庫,2025/06/16,食品を全部冷凍庫に詰め込んで氷のお城を作り、凍ったビール（びーしゃー）を飲む衛生管理猫。,シンプルなペン画の猫「しょくちゅうどくにゃん」。白衣を着て手に氷キューブを持ち、真顔で安全点検している脱力系イラスト。,"minimalist funny hygiene cat mascot wearing a tiny lab coat, holding a frozen ice cube with a serious deadpan face, clean simple pen lines, humorous character --ar 1:1"
29,えぬてぃーてぃーにゃん,えぬてぃーてぃーにゃん,NTT・紙コップ糸電話通信,2025/06/23,紙コップ糸電話の通信網を全国に張り巡らせ、歴史上の偉人（聖徳太子やエジソン）と通話する猫。,シンプルなペン画の猫「えぬてぃーてぃーにゃん」。耳に紙コップ糸電話をあてて、真顔で誰かと真剣に話している脱力マスコット。,"minimalist cute cat mascot named NTT-nyan holding a tiny paper cup telephone to its ear, listening intently with a deadpan stoic face, simple black ink lines, charming character --ar 1:1"
30,しゃんてぃにゃん,しゃんてぃにゃん,虫・自然・風の谷のナウシカ,2025/06/30,大量の虫を引き連れて登場するナウシカ風の猫。虫が気になる健介さんにお嫁入りしようとする。,シンプルなペン画の猫「しゃんてぃにゃん」。頭に可愛いテントウムシとチョウチョをとまらせ、真顔で両手を広げてたたずんでいる自然派マスコット。,"minimalist deadpan cat mascot named Shanti-nyan with a tiny cute ladybug and butterfly on its ears, standing peacefully with tiny open paws, simple black ink lines, subtle green accent --ar 1:1"
31,くろーぜっとにゃん,くろーぜっとにゃん,ネット通販・羊の放牧,2025/07/07,ネットショップで高級ニットを販売するため、初心者の森で大量の羊を飼育するアパレル猫。,シンプルなペン画の猫「くろーぜっとにゃん」。毛糸玉と編み棒を持ち、真顔で羊のぬいぐるみの横に座っている脱力系イラスト。,"minimalist cute cat fashion designer mascot sitting next to a tiny fluffy sheep, holding knitting needles and a yarn ball with deadpan stoic eyes, simple line drawing --ar 1:1"
32,きそこまにゃん,きそこまにゃん,木曽駒高原オートキャンプ場,2025/07/14,木曽駒の山奥から名古屋観光の特訓にやってきたキャンプ場の主猫。ゲリラ豪雨対策に巨大傘を持つ。,シンプルなペン画の猫「きそこまにゃん」。大きな葉っぱの傘を差し、首にバンダナを巻いて真顔で立っているアウトドアマスコット。,"minimalist rustic camper cat mascot named Kisokoma-nyan holding a large leaf umbrella, wearing a neck bandana with a deadpan expression, clean black line art --ar 1:1"
33,とよおかにゃん,とよおかにゃん,長野県豊丘村・桃狩り,2025/07/22,豊丘村の甘い完熟桃を守る番猫。もぎたての桃を抱えてお出迎えしてくれる。,シンプルなペン画の猫「とよおかにゃん」。ピンクの大きな桃を両手で抱え、真顔でドヤ顔をしている脱力マスコット。,"minimalist cute round cat mascot holding a giant pink ripe peach with its tiny paws, funny proud deadpan expression, clean black ink outlines, subtle peach accent --ar 1:1"
34,さんどいっちにゃん,さんどいっちにゃん,手作りサンドイッチ・港まつり,2025/07/23,茂子茄子（重子菜の酢）サンドなど創作サンドイッチを開発し、港まつりに出店する屋台猫。,シンプルなペン画の猫「さんどいっちにゃん」。大きな三角サンドイッチを背負って、真顔で立っている脱力系イラスト。,"minimalist funny sandwich vendor cat mascot carrying a giant triangular sandwich like a backpack, deadpan stoic expression, simple clean pen lines --ar 1:1"
35,ふぁんたすてぃっくふぉーにゃん,ふぁんたすてぃっくふぉーにゃん,映画ファンタスティック・フォー,2025/07/28,巨大怪物に対抗するため、真鍮と釘で金色に輝く巨大ランタンロボを組み立てる発明猫。,シンプルなペン画の猫「ふぁんたすてぃっくふぉーにゃん」。胸に「4」のマークが付いたスーツを着て、真顔で巨大ロボを操縦しているマスコット。,"minimalist superhero cat mascot with a number 4 emblem on chest, operating a tiny mechanical robot lever with a deadpan serious face, clean black lines --ar 1:1"
36,しんえつにゃん,しんえつにゃん,信越地方・信濃路キャンプ,2025/08/04,信越の山々からやってきて、お盆キャンプのうなぎパーティーに参加するグルメ猫。,シンプルなペン画の猫「しんえつにゃん」。串に刺さった香ばしいうなぎ蒲焼きを持ち、真顔で見つめている脱力系イラスト。,"minimalist cute Japanese cat mascot holding an unagi grilled eel skewer with tiny paws, deadpan stoic expression, simple black ink contour, Japanese culinary art --ar 1:1"
37,しゃとれーぜにゃん,しゃとれーぜにゃん,スイーツ店「シャトレーゼ」・アイス,2025/08/18,真夏の暑さで溶けてドロドロになり、アイスを食べて復活・合体巨大化する不思議なスイーツ猫。,シンプルなペン画の猫「しゃとれーぜにゃん」。チョコバッキーアイスを頭に乗せ、半分溶けたようなぷにぷに体型で真顔の脱力マスコット。,"minimalist melting dessert cat mascot named Chateraise-nyan balancing an ice cream bar on its head, soft squishy body, deadpan funny stare, simple line art --ar 1:1"
38,ぴえとろにゃん,ぴえとろにゃん,ピエトロドレッシング・ねぎとろ,2025/08/25,サラダにかけると絶品のねぎとろドレッシング「ねぎとろん」を開発するイタリアン調味料猫。,シンプルなペン画の猫「ぴえとろにゃん」。コック帽を被り、オレンジ色のドレッシングボトルを抱えて真顔で立っているイラスト。,"minimalist cat chef mascot named Pietro-nyan wearing a tiny tall chef hat, hugging an Italian salad dressing bottle with deadpan stoic eyes, clean black lines --ar 1:1"
39,りかばりーうぇあにゃん,りかばりーうぇあにゃん,リカバリーウェア・へそくり,2025/09/01,着るだけであらゆる疲労とへそくりをリカバリーする特殊ウェアを開発した健康猫。,シンプルなペン画の猫「りかばりーうぇあにゃん」。ゆったりした黒いパジャマを着て、脱力した真顔で布団の上に座っているマスコット。,"minimalist relaxed cat mascot wearing loose black recovery sleepwear pajamas, sitting on a futon with an expressionless funny deadpan face, simple pen art --ar 1:1"
40,えとやにゃん,えとやにゃん,太宰府えとや「梅の実ひじき」,2025/09/08,カリカリ梅とひじきのふりかけで大豪邸を建てようと企む福岡出身のグルメ猫。,シンプルなペン画の猫「えとやにゃん」。ご飯茶碗の上に「梅の実ひじき」を山盛りに乗せて、真顔のジト目で見せつけてくる脱力イラスト。,"minimalist funny gourmet cat mascot holding a rice bowl topped with plum seaweed sprinkles, deadpan proud stare, simple black ink contour, Japanese character --ar 1:1"
41,ぐらんぴーくすにゃん,ぐらんぴーくすにゃん,グランピング・東白川村キャンプ,2025/09/16,東白川村の山奥で豪華グランピングテントを設営し、モスキート音で虫を撃退するハイテク猫。,シンプルなペン画の猫「ぐらんぴーくすにゃん」。豪華なベルテントの前で、小さな双眼鏡を持って真顔で見張りをしているマスコット。,"minimalist luxury camper cat mascot holding miniature binoculars in front of a bell tent with a deadpan serious expression, clean black line drawing --ar 1:1"
42,じゃずどりーむにゃん,じゃずどりーむにゃん,三井アウトレットジャズドリーム長島,2025/09/22,80%オフセールに命をかけ、ブランド品の毛皮やキノコを爆買いする買い物上手猫。,シンプルなペン画の猫「じゃずどりーむにゃん」。両手にたくさんの紙袋を下げて、真顔でショッピングモールを歩いている脱力マスコット。,"minimalist shopping cat mascot carrying multiple tiny shopping bags with both paws, walking briskly with a deadpan stoic face, simple clean line art --ar 1:1"
43,だあちぇにゃん,だあちぇにゃん,ピザの名店「ダ・アチェ / チェザリ」,2025/09/29,ピザ窯の前で巨大団扇を仰ぎ、常連風を吹かせるセルフファンを配る熱風ピザ猫。,シンプルなペン画の猫ピザ職人「だあちぇにゃん」。大きなうちわとピザピールを持ち、真顔で薪窯の前に立っているイラスト。,"minimalist pizza chef cat mascot holding a large traditional paper fan and a pizza paddle, standing stoically before a wood-fired oven, clean black lines --ar 1:1"
44,みゃくみゃくにゃん,みゃくみゃくにゃん,大阪・関西万博公式キャラクター,2025/10/06,細胞のような赤い丸と青い体のふしぎな姿で、万博チケットを配り歩く謎のキャラクター猫。,シンプルなペン画の猫「みゃくみゃくにゃん」。青い丸っこい体に赤い目玉リングの輪っかを頭に乗せた、シュールで可愛い真顔のマスコット。,"minimalist quirky surreal cat mascot with red ring-shaped eye patterns on head, blue body, standing with funny deadpan wide eyes, simple clean ink art --ar 1:1"
45,やなにゃん / みやちかにゃん,やなにゃん,岐阜の鮎やな・宮内庁御用達「宮地香」,2025/10/14,清流長良川のやなで獲れた香ばしい鮎の塩焼きを振る舞う岐阜の伝統猫。,シンプルなペン画の猫「やなにゃん」。串に刺さった鮎の塩焼きを大切そうに抱えて、真顔で川辺に立っている脱力系イラスト。,"minimalist Japanese river cat mascot holding a salt-grilled sweetfish ayu skewer, standing by a river with a stoic deadpan expression, simple line art --ar 1:1"
46,じろうにゃん,じろうにゃん,ラーメン二郎・大盛りラーメン,2025/10/20,野菜マシマシニンニクアブラカラメを注文し、山盛りラーメンと格闘するガッツリ系猫。,シンプルなペン画のぽっちゃり猫「じろうにゃん」。自分より高く盛られたモヤシタワーラーメンの前に座り、割り箸を持って真顔で見つめているマスコット。,"minimalist chubby cat mascot sitting in front of a giant ramen bowl with a huge mountain of bean sprouts, holding chopsticks with deadpan serious eyes, clean line art --ar 1:1"
47,じんずにゃん,じんずにゃん,JINSメガネ・老眼鏡・スカウター,2025/10/27,相手の戦闘力や寿命が見えるハイテク老眼鏡を開発し、布教活動を行うメガネ猫。,シンプルなペン画の猫「じんずにゃん」。大きな黒縁メガネを鼻先にかけ、人差し指でメガネをクイッと上げながら真顔で決めているイラスト。,"minimalist smart cat mascot named Jins-nyan wearing large black-rimmed glasses, pushing glasses up nose with tiny paw, expressionless funny intellectual face, simple lines --ar 1:1"
48,おかざきあうとれっとにゃん / おかれっとにゃん,おかざきあうとれっとにゃん,岡崎アウトレット・オカザエモン,2025/11/04,民家の敷地を通行料ビジネスにして名物オムレツを開発する岡崎の商売猫。,シンプルなペン画の猫「おかざきあうとれっとにゃん」。オムレツの帽子を被り、看板を持って真顔で立っている脱力系マスコット。,"minimalist funny merchant cat mascot wearing a yellow omelet hat, holding a tiny wooden sign with a deadpan stoic face, simple black ink contour --ar 1:1"
49,きみはんにゃん,きみはんにゃん,ハンバーグ店「君のハンバーグを食べたい」,2025/11/11,デミグラスソースたっぷりの手ごねハンバーグを握り、バイト面接を勝ち抜こうとする猫。,シンプルなペン画の猫「きみはんにゃん」。湯気の立つふっくらハンバーグをお皿に乗せて両手で差し出す真顔の脱力マスコット。,"minimalist cute cat chef mascot holding a sizzling hamburger steak on a plate with both paws, funny deadpan expression, simple clean pen lines, Japanese food art --ar 1:1"
50,すかーれっとにゃん,すかーれっとにゃん,映画女優スカーレット・ヨハンソン,2025/11/25,初心者の森で巨大な謎の武器を拾い、自衛隊と戦った後にハローワークへ行く波乱万丈な猫。,シンプルなペン画のスパイ猫「すかーれっとにゃん」。黒いタイツスーツを着て、身の丈以上の巨大なモップ銃を担いで真顔で歩いているイラスト。,"minimalist action hero cat mascot in a sleek black spy suit, carrying an oversized mop weapon on shoulder with a stoic deadpan stare, simple black lines --ar 1:1"
51,しゃんでりあにゃん,しゃんでりあにゃん,高級シャンデリア・シャインマスカット,2025/12/08,天井からシャインマスカットの粒がぶら下がった特製シャンデリアを営業しに来るゴージャス猫。,シンプルなペン画の猫「しゃんでりあにゃん」。頭の上にキラキラ輝くミニシャンデリアを乗せて、真顔で澄ましている脱力マスコット。,"minimalist elegant cat mascot named Chandelier-nyan balancing a sparkling miniature crystal chandelier on its head, deadpan funny posh expression, clean line art --ar 1:1"
52,かんたんすまほにゃん,かんたんすまほにゃん,シニア向けスマートフォン,2025/12/22,文字が巨大に表示される簡単スマホを使いこなし、宇宙ステーションからの脱出メッセージを打つ猫。,シンプルなペン画の猫「かんたんすまほにゃん」。特大画面のスマホを両手で持ち、真顔で人差し指でポチポチ操作しているイラスト。,"minimalist funny senior cat mascot holding an oversized easy-smartphone, tapping the screen with one tiny paw with a deadpan focused face, simple black lines --ar 1:1"
53,みちこにゃん,みちこにゃん,お母様（ミチコさん）・忘れ物タグ,2025/12/15,マイペースで自由。老眼鏡やスマホ、しっぽにAirTag等の忘れ物防止タグをたくさん付けて音を鳴らしながら脱走する。,シンプルなペン画のクリーム色猫「みちこにゃん」。丸い老眼鏡を鼻先にかけ、首輪としっぽにカラフルな忘れ物タグをぶら下げてすたすた歩く真顔のマスコット。,"minimalist cute cream cat mascot named Michiko-nyan wearing tiny round reading glasses on nose, carrying multiple colorful keytags on collar and tail, walking happily with deadpan eyes --ar 1:1"
54,かびとりにゃん,かびとりにゃん,年末年始の大掃除・カビ取り剤,2026/01/05,人間関係や面倒な仕事まで何でも綺麗さっぱり消し去る伝説の掃除猫。消した関係を復活させるため盆踊りを踊る。,シンプルなペン画のぽっちゃり白猫「かびとりにゃん」。スプレーボトルのリュックを背負い、小さなハタキを持って真顔で立っているマスコット。,"minimalist chubby white cat mascot named Kabitori-nyan carrying a small cleaning spray bottle backpack, holding a tiny feather duster, funny confident deadpan expression, clean black lines --ar 1:1"
55,ろとにゃん,ろとにゃん,イタリア料理店「Lotto」,2026/01/13,無愛想に見えて超お人好しな店主。満席で大忙しのためバイト募集オーディションを開催。べるにゃんに翻弄される。,シンプルなペン画の丸っこい猫店主「ろとにゃん」。小さなエプロンを着て腕組みをし、真顔のジト目で見つめている脱力系イラスト。,"minimalist fluffy round cat restaurant owner named Lotto-nyan wearing a small bistro apron, crossing tiny arms with a deadpan funny stare, simple black lines --ar 1:1"
56,べるにゃん,べるにゃん,イタリア料理店「Ristorante Bell」,2026/01/15,距離感が近すぎる天然系シェフ。新作パスタの試作や仕入れ、ろとにゃんとのコラボやアルバイト交換など頻出。,シンプルなペン画のゆるい猫シェフ「べるにゃん」。小さなコック帽を被り、小さなフライパンを両手でぎゅっと抱きしめて真顔の点目で見つめているマスコット。,"minimalist cute chubby cat chef mascot named Bell-nyan, wearing a tiny chef hat, tightly hugging a small frying pan with tiny paws, funny deadpan dot eyes, clean black lines --ar 1:1"
57,あばたーにゃん,あばたーにゃん,映画「アバター」,2026/02/02,青い肌と長いしっぽを持ち、ぶら下がり健康器にぶら下がって惑星パンドラごっこをする猫。,シンプルなペン画の猫「あばたーにゃん」。淡い青色の毛並みで、鉄棒に両手でぶら下がりながら真顔で下を見つめている脱力イラスト。,"minimalist funny blue alien cat mascot hanging by its tiny paws from a pull-up bar, looking down with a deadpan stoic face, simple black ink contour, light blue accent --ar 1:1"
58,らるけすとにゃん,らるけすとにゃん,人気洋菓子店「ラルケスト」,2026/02/09,アムール・デュ・ショコラの限定当選スイーツを頭に乗せて運ぶ幻の高級洋菓子猫。,シンプルなペン画の猫「らるけすとにゃん」。リボン付きの高級チョコレート箱を頭に乗せ、真顔のジト目で立っているマスコット。,"minimalist deadpan cat mascot named L'archeste-nyan balancing a luxury chocolate gift box on its head, stoic funny expression, clean black ink lines --ar 1:1"
59,みーとぐらたんにゃん,みーとぐらたんにゃん,家庭料理・ミートグラタン,2026/02/16,ペンネ、ペンヌ、ペンニを畑で栽培・お世話するグラタンの妖精。,シンプルなペン画の猫「みーとぐらたんにゃん」。頭にペンネパスタを1本乗せ、じょうろを持って真顔で畑に水をやっている脱力系イラスト。,"minimalist round cat mascot named Meat-gratin-nyan with a single penne pasta standing on head, holding a tiny watering can with a funny stoic face, clean line art --ar 1:1"
60,おひがしひおこしにゃん,おひがしひおこしにゃん,東別院マルシェ・火起こし,2026/02/24,お東さんの縁日やイベントで火を起こす係。水筒にアルコールを入れて暖を取る。,シンプルなペン画の猫「おひがしひおこしにゃん」。法被を着て水筒を肩から下げ、火起こし用の棒を持って真顔で立っているお祭りマスコット。,"minimalist Japanese cat mascot wearing a traditional festival happi coat, holding a small fire-making stick with a serious deadpan face, clean simple pen lines --ar 1:1"
61,むしぱにゃん,むしぱにゃん,おやつ・蒸しパン,2026/03/02,ほかほかふっくら蒸しあがった蒸しパンの美味しさを全身で表現するおやつ猫。,シンプルなペン画のぽてっとした丸い猫「むしぱにゃん」。せいろ蒸し器の中から真顔で顔を出している脱力マスコット。,"minimalist round chubby cat mascot popping out from a bamboo steaming basket with a funny deadpan face, clean black lines, warm bread accent --ar 1:1"
62,がーでんぱーくにゃん,がーでんぱーくにゃん,浜名湖ガーデンパーク・花畑,2026/03/09,浜名湖の広大な花畑を管理し、チューリップの花冠をかぶって散歩するガーデニング猫。,シンプルなペン画の猫「がーでんぱーくにゃん」。チューリップの花冠を頭に乗せ、小さなスコップを持って真顔でたたずんでいるイラスト。,"minimalist cute gardening cat mascot wearing a colorful tulip flower crown, holding a small garden shovel with stoic deadpan eyes, simple black lines --ar 1:1"
63,ぐーぐるにゃん,ぐーぐるにゃん,Googleマップ・検索ナビ,2026/03/10,あらゆるルートやスポットを最短で案内してくれるが、たまに細い路地に誘導するナビ猫。,シンプルなペン画の猫「ぐーぐるにゃん」。頭の上にGoogleピン（マップの赤ピン）が刺さっており、虫眼鏡を持って真顔で立っているマスコット。,"minimalist tech cat mascot named Google-nyan with a red map location pin icon on head, holding a magnifying glass with a deadpan serious face, clean pen art --ar 1:1"
64,さぼてんにゃん,さぼてんにゃん,春日井サボテン・多肉植物,2026/03/16,トゲトゲのサボテンの着ぐるみを着て、怒ると真っ赤になる春日井名物の猫。,シンプルなペン画の猫「さぼてんにゃん」。丸いサボテンのスーツを着て両手を上げ、真顔のジト目でポーズをとっている脱力イラスト。,"minimalist quirky cat mascot in a green round cactus suit with tiny soft prickles, posing with deadpan funny eyes, simple black ink contour --ar 1:1"
65,ぐれーすにゃん / ろっきーにゃん,ぐれーすにゃん,映画ボクシング・ゲームセンター景品,2026/03/23,ボクシンググローブをはめてゲームセンターのUFOキャッチャー景品になったストイック猫。,シンプルなペン画の猫「ぐれーすにゃん」。赤いボクシンググローブを両手にはめ、ファイティングポーズを真顔でとっているマスコット。,"minimalist boxer cat mascot named Grace-nyan wearing tiny red boxing gloves, taking a fighting stance with an expressionless funny deadpan face, clean line art --ar 1:1"
66,いちのみやたわーにゃん,いちのみやたわーにゃん,一宮138タワー・展望台,2026/03/30,138メートルの高さから一宮市を見守り、ダンシングヒーローに合わせて揺れるタワー猫。,シンプルなペン画の猫「いちのみやたわーにゃん」。頭の上に138タワーのツインタワー型帽子を乗せて、真顔で立っている脱力系イラスト。,"minimalist tall tower cat mascot wearing an architectural arch tower hat, standing stoically with deadpan eyes, clean black lines, Japanese local mascot --ar 1:1"
67,じんべいにゃん,じんべいにゃん,和服・甚平 / 甚兵衛,2026/03/31,藍色の涼しげな甚平を着て、うちわを持って空の彼方からやってくる夏の風物詩猫。,シンプルなペン画の猫「じんべいにゃん」。藍色のかすり模様の甚平を着て、うちわをパタパタしながら真顔で歩いているマスコット。,"minimalist relaxed Japanese cat mascot wearing a traditional navy jinbei summer loungewear, holding a round uchiwa fan with a stoic deadpan expression, simple lines --ar 1:1"
68,いいねまるしぇにゃん,いいねまるしぇにゃん,地元の人気マルシェ・朝市,2026/04/13,新鮮な採れたて野菜や手作りパンをカゴに入れて売りに来るマルシェの看板猫。,シンプルなペン画の猫「いいねまるしぇにゃん」。フランスパンとトマトが入った買い物カゴを腕にかけ、真顔で立っている脱力イラスト。,"minimalist cute market cat mascot carrying a woven shopping basket with a baguette and tomato, deadpan charming expression, clean simple pen lines --ar 1:1"
69,いまーしぶじゃーににゃん / ばすてとにゃん,いまーしぶじゃーににゃん,体験型アトラクション・エジプト神話,2026/04/20,古代エジプトのバステト神のような装飾を身につけ、ピラミッドの謎を解き明かす冒険猫。,シンプルなペン画のエジプト猫「ばすてとにゃん」。金色の首飾りと額の宝石をつけ、真顔でツタンカーメンポーズをとっているマスコット。,"minimalist Egyptian cat goddess mascot named Bastet-nyan wearing a tiny golden necklace, standing with a deadpan stoic regal face, simple black line drawing --ar 1:1"
70,しきしまにゃん / しきほにゃん,しきしまにゃん,敷島製パン（Pasco）/ 四季報,2026/04/27,焼きたての食パンを頭に乗せながら、分厚い四季報をめくって株価をチェックする知性派猫。,シンプルなペン画の猫「しきしまにゃん」。一斤の角食パンを抱え、分厚い本を開いて真顔で見つめている脱力系イラスト。,"minimalist smart cat mascot holding a loaf of white sandwich bread and an open thick book, funny intellectual deadpan face, clean black lines --ar 1:1"
71,さくらいにゃん,さくらいにゃん,ニュース番組・櫻井キャスター,2026/04/30,スーツを着てニュース原稿を持ち、迫真の表情で夜のニュースを伝えるキャスター猫。,シンプルなペン画の猫「さくらいにゃん」。小さなネクタイとスーツを着て、原稿用紙を持って真顔でニュースを読むマスコット。,"minimalist news anchor cat mascot wearing a tiny suit and tie, holding a stack of news papers with a serious deadpan expression, clean simple line art --ar 1:1"
72,さんぜんにゃん,さんぜんにゃん,ドラマ「三千円の使いかた」・節約術,2026/05/11,三千円の予算で最高のランチとスイーツを楽しむ、やりくり上手の倹約猫。,シンプルなペン画の猫「さんぜんにゃん」。千円札3枚を扇状に広げて両手で持ち、真顔のドヤ顔で見せびらかしているイラスト。,"minimalist frugal cat mascot holding three Japanese yen bills like a fan with tiny paws, funny proud deadpan face, clean black line art --ar 1:1"
73,ならここにゃん,ならここにゃん,ならここの里キャンプ場（静岡県掛川）,2026/05/14,清流沿いの温泉付きキャンプ場を守る森の番猫。温泉上がりにコーヒー牛乳を飲む。,シンプルなペン画の温泉猫「ならここにゃん」。頭の上に小さな温泉タオルを乗せ、瓶入り牛乳を持って真顔でたたずんでいるマスコット。,"minimalist cute hot spring camping cat mascot with a folded bath towel on head, holding a glass milk bottle with deadpan stoic eyes, simple line drawing --ar 1:1"
74,そーしゃるたわーにゃん,そーしゃるたわーにゃん,SOCIAL TOWER MARKET・名古屋テレビ塔,2026/05/26,テレビ塔の足元でおしゃれなクラフトビールと古着を物色するシティ派猫。,シンプルなペン画の猫「そーしゃるたわーにゃん」。クラフトビールのグラスを持ち、サングラスをかけて真顔でポーズをとっているイラスト。,"minimalist stylish city cat mascot wearing tiny black sunglasses, holding a craft beer glass with a deadpan cool expression, clean black lines --ar 1:1"
75,もりみちにゃん,もりみちにゃん,野外フェス「森、道、市場」,2026/05/27,海岸沿いの芝生フェスで音楽とカレーを楽しみ、夜はテントでくつろぐフェス猫。,シンプルなペン画のフェス猫「もりみちにゃん」。フェス用のアームバンドを付け、紙コップを持って真顔でリズムに乗っているマスコット。,"minimalist music festival cat mascot wearing colorful festival wristbands, holding a paper cup, nodding to music with a deadpan funny face, clean line art --ar 1:1"
76,そるとうぉーたーにゃん,そるとうぉーたーにゃん,ソルトウォーター・海釣り・防波堤,2026/06/02,防波堤でルアーを投げてシーバスを狙うが、いつもサビキでアジばかり釣れる釣り猫。,シンプルなペン画の釣り猫「そるとうぉーたーにゃん」。小さな釣竿を持ち、釣れた小魚を真顔で見つめている脱力系イラスト。,"minimalist cute fisherman cat mascot holding a miniature fishing rod with a tiny hooked fish dangling, deadpan stoic expression, simple black ink contour --ar 1:1"
77,ぐろーぐーにゃん / まんだろりにゃん,ぐろーぐーにゃん,スター・ウォーズ「マンダロリアン」,2026/06/08,フォースを使ってご飯のお椀を浮かそうとするが、お腹が空いてすぐ眠くなるベイビーヨーダ猫。,シンプルなペン画の猫「ぐろーぐーにゃん」。大きな茶色いローブを着て横長の大きな耳を持ち、手をかざして真顔で念力を送っているマスコット。,"minimalist parody cat mascot wearing an oversized beige monk robe with long pointy ears, reaching out tiny paw with a deadpan intense stare, simple clean line art --ar 1:1"
78,まりおにゃん,まりおにゃん,スーパーマリオブラザーズ,2026/06/15,赤い帽子を被り、緑の土管から飛び出そうとしてお腹がつっかえている配管工猫。,シンプルなペン画の猫「まりおにゃん」。赤いキャップ帽を被り、緑の土管から顔を出して真顔で見つめている脱力系イラスト。,"minimalist cute plumber cat mascot wearing a red cap, popping out of a green pipe with an expressionless funny deadpan face, clean simple line art --ar 1:1"
79,さかぐらにゃん,さかぐらにゃん,日本酒・全国酒蔵巡り,2026/06/22,杉玉を頭に飾り、お猪口で全国の銘酒を利き酒して回る日本酒通の猫。,シンプルなペン画の猫「さかぐらにゃん」。法被を着て小さな徳利とお猪口を持ち、真顔で日本酒を味わっているマスコット。,"minimalist traditional Japanese sake-taster cat mascot holding a tiny ceramic sake cup and bottle, deadpan stoic expression, clean black ink drawing --ar 1:1"
80,くびひえにゃん / れおんにゃん,くびひえにゃん,ネッククーラー・クールリング・猛暑対策,2026/07/06,首を冷やすことに一生を捧げる猫。凍らせたタオルや叩いたネギを首に巻いて涼しい顔をする。,シンプルなペン画の猫「くびひえにゃん」。水色のネッククーラーリングとネギを首に巻き、真顔で涼んでいる脱力マスコット。,"minimalist quirky cat mascot wearing an icy-blue cooling neck ring and a green onion around its neck, standing calmly with a deadpan chilled expression, clean line art --ar 1:1"
81,あうとれっとおかざきにゃん / べっにゃん,あうとれっとおかざきにゃん,岡崎アウトレット・ショッピング,2026/07/13,岡崎のアウトレットを庭のように歩き回り、お得なセール品をいち早く見つけ出す目利き猫。,シンプルなペン画の猫「あうとれっとおかざきにゃん」。ブランド品のショッパーを口にくわえて真顔で歩いているイラスト。,"minimalist cute shopping cat mascot holding a luxury shopping bag handle in its mouth, walking briskly with a deadpan stoic face, simple black ink contour --ar 1:1"
82,ふじろっくにゃん,ふじろっくにゃん,フジロックフェスティバル（苗場）,2026/07/27,苗場の山奥でポンチョを着て長靴を履き、土砂降りの雨の中でも真顔で音楽に聴き入るロック猫。,シンプルなペン画の猫「ふじろっくにゃん」。カラフルなレインポンチョを着て小さな長靴を履き、真顔で立っている野外フェスマスコット。,"minimalist rock festival cat mascot wearing a colorful rain poncho and tiny rubber boots, standing in the rain with deadpan cool eyes, clean line art --ar 1:1"
83,すぱいだーにゃん / すっぱいだーにゃん / しっぱいだーにゃん,すぱいだーにゃん,映画スパイダーマン・出前配達,2026/08/03,ビルの間を糸で飛び交うが、ラーメン出前のスープをこぼして失敗する親愛なる配達猫。すっぱいレモン汁100%を配る変種も。,シンプルなペン画の猫「すぱいだーにゃん」。赤いマスクを頭に少しめくり上げ、出前おかもちを持って糸からぶら下がる真顔の脱力マスコット。,"minimalist funny cat superhero mascot in red spider mask pushed up, carrying a tiny noodle delivery box, hanging from a thread with deadpan eyes, simple black lines --ar 1:1"
84,はえらにゃん / にせはえらにゃん,はえらにゃん,栄中日ビル「はえら」・電飾魚類,2026/08/17,電飾を体に巻きつけてギラギラ光る目立ちたがり屋。実は「歯とエラが丈夫な魚類」という文系・偽物設定が発覚。,シンプルなペン画の猫「はえらにゃん」。体にクリスマス電飾コードがぐるぐる巻きでピカピカ光り、足先が魚のヒレのようになっている真顔のイラスト。,"minimalist quirky cat mascot wrapped in glowing colorful Christmas lights, tiny fish fin feet, posing proudly with a funny deadpan face, clean black lines --ar 1:1"
85,しゃけんにゃん,しゃけんにゃん,車の車検（愛車アクア等の整備）,2026/08/24,「見守ってほしい」と頼んでくるメンヘラ気質の猫。朝昼晩10回ずつのメール契約を要求し、AIにゃんに弟子入りする。,シンプルなペン画のぽてっとしたグレー猫「しゃけんにゃん」。首から「しゃけん」と書かれた看板を下げ、両手をもじもじさせて無表情の点目で見つめてくるマスコット。,"minimalist cute chubby grey cat mascot hanging a white sign labeled 'しゃけん' around its neck, fidgeting tiny paws, deadpan dot eyes with subtle worry, clean pen art --ar 1:1"
86,えーあいにゃん,えーあいにゃん,人工知能（AI / Gemini / ChatGPT）,2026/08/25,何でもこなす万能猫。しゃけんにゃんの相談相手になるが、メールが多すぎて月額5万円でも割に合わないと疲弊する。,シンプルなペン画の猫「えーあいにゃん」。頭に小さなアンテナがちょこんと生え、ミニノートPCを開いて真顔でカタカタ操作している脱力イラスト。,"minimalist funny smart cat mascot with a tiny antenna on head, sitting before a miniature laptop with a deadpan serious robotic expression, clean black lines --ar 1:1"
87,かみなりにゃん,かみなりにゃん,雷・悪天候,2026/08/28,角が生えていて可愛い迷子の猫。一緒にいると強い電圧で周囲の電気製品がバチバチ壊れてしまう。,シンプルなペン画の黒猫「かみなりにゃん」。頭に黄色い小さなツノが1本、しっぽの先がカミナリ型。体から小さな静電気がパチパチ出ているのに本人はきょとんとした真顔。,"minimalist cute black kitten mascot with a tiny yellow horn on head and lightning-bolt tail, faint electric sparks around it, innocent expressionless wide eyes, clean lines --ar 1:1"
88,ほむらにゃん / まどかにゃん,ほむらにゃん,アニメ「魔法少女まどか☆マギカ」,2026/08/31,限定パフェを食べる約束を守るためまどかにゃんを探す。裏切られて真っ黒な「あくまほむらにゃん」に変貌。,シンプルなペン画の黒猫「ほむらにゃん」。巨大なイチゴパフェの前に座り、小さなスプーンを両手で持って無表情で見つめている脱力系イラスト。,"minimalist deadpan black cat mascot with tiny demon wings, sitting before a giant strawberry parfait holding a tiny spoon, expressionless stoic cute eyes, clean lines --ar 1:1"`;

export function parseCsvToNyans(csvText: string): NyanCharacter[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
    } else if (char === '\r') {
      // skip
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  const result: NyanCharacter[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const tokens: string[] = [];
    let curToken = '';
    let inside = false;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        inside = !inside;
      } else if (c === ',' && !inside) {
        tokens.push(curToken.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        curToken = '';
      } else {
        curToken += c;
      }
    }
    tokens.push(curToken.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

    if (tokens.length >= 6) {
      const no = parseInt(tokens[0], 10) || i;
      const name = tokens[1] || `にゃん #${no}`;
      const reading = tokens[2] || name;
      const motif = tokens[3] || '不明';
      const firstAppeared = tokens[4] || '';
      const episode = tokens[5] || '';
      const promptJa = tokens[6] || '';
      const promptEn = tokens[7] || '';

      // Initially unlock character 1, 4, 5, 53 as discovered or start fresh with 1 discovered
      const isInitialDiscovered = no === 1 || no === 5 || no === 53;

      result.push({
        no,
        name,
        reading,
        motif,
        firstAppeared,
        episode,
        promptJa,
        promptEn,
        discovered: isInitialDiscovered,
        discoveryDate: isInitialDiscovered ? '2026/08/31 12:00' : undefined,
        playCount: isInitialDiscovered ? 1 : 0,
        friendshipLevel: isInitialDiscovered ? 1 : 0,
      });
    }
  }

  return result;
}

export const INITIAL_NYANS: NyanCharacter[] = parseCsvToNyans(RAW_DEFAULT_CSV);
