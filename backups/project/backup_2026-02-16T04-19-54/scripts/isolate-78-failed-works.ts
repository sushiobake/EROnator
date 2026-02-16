#!/usr/bin/env tsx
/**
 * 5回とも失敗した78作品を needsReview=true で隔離
 * タイトルで照合（workId が確実なら workId 指定も可）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TITLES = [
  '墜羽の蝶',
  'ご主人様，ほんとにおっぱい好きですね。',
  '俺の天使が堕ちるまで〜清楚な水泳部の後輩、寝取られてビッチギャルに堕ちる〜',
  'いいなりの人妻さん',
  '催〇オナホ 登校中の処女アイドルとギャルモデルを犯します',
  '虚狩り悪堕ち改造計画',
  'Fate/GrandOrderの総集編 真夏のカルデアサマーヴァケーション',
  '4作品超お買い得パックセール【第32弾】',
  '結〇明〇奈【イけばイくほど、成長する触手パンツ＆プラグとの一週間】',
  'リスナーさんのザーメンください',
  'エロRPGの女主人公にTS転生したら…2章 娼館編',
  'くのいちちゃんが堕ちるまで',
  '父が再婚した新しいママは、中出しOKのドスケベ爆乳ママでした',
  'えっちなお店の娘総集編vol.3＋',
  'おじ専ギャル巫女早苗さん',
  'あんたなんて大嫌い！ツンデレ次女が催●で…（前編）',
  'セックス依存症の人妻ナースは今日も性欲を我慢できない 総集編',
  '王子様系デカチチボーイッシュ女子に愛される合同誌',
  '秦谷美鈴のP育成日誌',
  '定時後は私とセックスです総集編',
  '母さんだって女なんだよ！総集編',
  'ヤリ☆チン四郎！',
  '変身能力のオレと改変能力の友人',
  '【Part.2】キスで催●シリーズ贅沢イッキ読み！総集編',
  '敏感体質なツンデレ金髪ギャルとセックスしたお話',
  'その着せ替え人形はHをする総集編II＋9',
  'ゾンビより女に喰われるほうがいい-Devoured World-',
  'ちょいコワ元ヤン兄嫁in実家濃厚托卵アクメNTR',
  '砂糖あい総集編',
  '底辺ニートの俺が悪の組織の幹部になったので…（姪っ子改造）',
  'ちょろいメス○キが足相撲を挑んできた',
  'ピンサロ嬢の遠〇リンに中出ししてみた件',
  '憧れの元AV女優の人妻 旦那に隠れて俺と',
  'ちんぽ生えて人生終わった美少女たち総集編＋α',
  '【期間限定配信】diletta作品集 vol.6',
  'オトコ見せてよ、旦那様。',
  '巨乳母娘を堕とす！〜快楽調教でビッチに変わる母娘〜',
  '僕が守りたかった未亡人が義兄に寝取られていく',
  '大当たり嬢降臨〜総集編〜',
  'とらぶるキャラを指名できるデリヘルアプリ2',
  '憧れの生徒会長は性処理肉便器…',
  'あんたなんて大嫌い！…（後編）',
  'あると10 総集編',
  '催●アイドル学園 総集編',
  'ワタシが最初に好きだったから〜巨乳幼馴染とセックス練習〜',
  'ホリアヤ',
  'オナホになりたいお嬢様 -SEX Saves the World- 全話セット総集編',
  '童貞をバカにする女社長のSSボディ相手に…',
  '孕ませ屋4',
  '優性種族との交配政策',
  '人妻達の憂鬱 真面目な人妻エリさんの場合',
  'ご主人様，ほんとにおっぱい好きですね。2 〜ミルク乳首でイキまくり〜',
  '元いじめられっ子配達員の俺が勝ち組タワマン人妻の弱みを握って…',
  'NK（なまこうび）ハニトラ計画',
  '発情ルーム 総集編…',
  '日常的ハレンチ学園2',
  '宝くじが当たったので貧困母娘買ってみた',
  '感覚遮断穴に入れられて完全肉体改造される勇者パーティー',
  '魔法少女VS淫魔生物 総集編',
  '【総集編】透明感のある美少女4人を…',
  '憧れたヒーローを孕ませた',
  '中野五姉妹を拉致って孕ませた話 総集編',
  'モルガン陛下と愛に溺れる総集編',
  '私たち名門女学園生は姉妹でパパ活してます総集編',
  'おしかけ！爆乳ギャルハーレム性活',
  '新卒ちゃん試せるコンドーム屋に迷い込む',
  '異変出口',
  '性徒指導の秘録〜少女たちが隠していた欲求と快楽',
  '乳影ストリップ',
  '学校占拠したテロリストに、俺は片思い女子と、無理やりセックスさせられる',
  'ユニバーサルセックスジャパン 100％パコれる！！ハロウィンイベント…',
  '怒ってばかりの綺麗め家政婦さんが実は俺のパンツでオナニーする…',
  'ふたなりのいる日常 総集編',
  '俺の事が好きだった幼馴染が違う男とセックスしていた',
  '中野にあるピンサロ店〜総集編〜',
  '10年ぶりに会ったチビが甘えん坊のまま引きこもりムッチリデカ女に…',
  'Lカップ人妻オナホ奴●家政婦かなえ（39）〜他人棒でヨガり狂わされた1週間〜',
  '双子の兄妹強●近親相姦つがいじめ',
];

/** 〇●等の表記ゆれ: DB側の可能性のある文字に正規化 */
function normalizeForMatch(s: string): string {
  return s
    .replace(/〇/g, '[〇○◯]')
    .replace(/●/g, '[●◉]')
    .replace(/○/g, '[〇○◯]');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[DRY RUN] 変更は反映されません\n');

  const foundWorkIds: string[] = [];
  const notFound: string[] = [];

  for (const title of TITLES) {
    // 完全一致を試す
    let works = await prisma.work.findMany({
      where: { title },
      select: { workId: true, title: true },
    });

    // 見つからなければ部分一致（contains）
    if (works.length === 0 && title.length >= 4) {
      const keys = [
        title.slice(0, Math.min(20, title.length)),
        title.slice(0, Math.min(12, title.length)),
      ];
      for (const key of keys) {
        if (key.length < 4) break;
        const candidates = await prisma.work.findMany({
          where: { title: { contains: key } },
          select: { workId: true, title: true },
        });
        if (candidates.length === 1) {
          works = candidates;
          break;
        }
        if (candidates.length > 1) {
          const best = candidates
            .filter((w) => w.title.length >= key.length && (w.title.startsWith(key) || w.title.includes(key)))
            .sort((a, b) => Math.abs(a.title.length - title.length) - Math.abs(b.title.length - title.length))[0];
          if (best) {
            works = [best];
            break;
          }
        }
      }
    }

    if (works.length > 0) {
      foundWorkIds.push(works[0].workId);
    } else {
      notFound.push(title);
    }
  }

  console.log(`照合結果: ${foundWorkIds.length}件ヒット, ${notFound.length}件未ヒット`);
  if (notFound.length > 0) {
    console.log('\n未ヒットのタイトル:');
    notFound.forEach((t) => console.log(`  - ${t}`));
  }

  if (foundWorkIds.length === 0) {
    console.log('\nヒットが0件のため終了します。');
    process.exit(1);
  }

  if (!dryRun) {
    const result = await prisma.work.updateMany({
      where: { workId: { in: foundWorkIds } },
      data: { needsReview: true },
    });
    console.log(`\n${result.count}件を needsReview=true に設定しました。`);
  } else {
    console.log(`\n[DRY RUN] ${foundWorkIds.length}件を needsReview=true に設定する予定でした。`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
