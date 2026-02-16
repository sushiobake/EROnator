#!/usr/bin/env tsx
/**
 * 未タグ作品JSONを読み、ルールに従って additionalSTags / aTags / bTags / cTags / characterTags を付与し、
 * data/ai-tagging-batch-10.json に書き出す。
 * 実行: npx tsx scripts/tag-untagged-batch.ts [入力JSON]
 * 例: npx tsx scripts/tag-untagged-batch.ts data/untagged-373.json
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_UNTAGGED_PATH = path.join(process.cwd(), 'data', 'untagged-100.json');
const UNTAGGED_PATH = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_UNTAGGED_PATH;
const OFFICIAL_CACHE_PATH = path.join(process.cwd(), 'config', 'officialTagsCache.json');
const TAG_RANKS_PATH = path.join(process.cwd(), 'config', 'tagRanks.json');
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'ai-tagging-batch-10.json');

interface UntaggedItem {
  workId: string;
  title: string;
  authorName: string;
  commentText: string;
  officialTags: string[];
}

interface OutputItem {
  workId: string;
  title: string;
  additionalSTags: string[];
  aTags: string[];
  bTags: string[];
  cTags: string[];
  characterTags: string[];
}

// コメント・タイトルに含まれる語 → 追加Sで使う公式タグ表示名（officialTagsCache に存在するもののみ）
const KEYWORD_TO_OFFICIAL: Array<{ pattern: RegExp | string; tag: string }> = [
  { pattern: /総集編|ベスト.*総集|収録作品/, tag: 'ベスト・総集編' },
  { pattern: /シリーズ|続編|\(2\)|\(3\)|第\d+話|編」|〜.*〜|セット\s*[【\[]?\d|続・|話\d|After|アフター/, tag: 'シリーズもの' },
  { pattern: /義母|義母さん/, tag: '義母' },
  { pattern: /義父|叔父/, tag: '叔父・義父' },
  { pattern: /幼なじみ|幼馴染/, tag: '幼なじみ' },
  { pattern: /人妻|主婦/, tag: '人妻・主婦' },
  { pattern: /母親|ママ|お母さん/, tag: '母親' },
  { pattern: /童貞/, tag: '童貞' },
  { pattern: /処女/, tag: '処女' },
  { pattern: /妊娠|孕ませ|孕む/, tag: '妊娠・孕ませ' },
  { pattern: /教師|先生/, tag: '教師' },
  { pattern: /後輩/, tag: '後輩' },
  { pattern: /先輩/, tag: '先輩' },
  { pattern: /メイド/, tag: 'メイド' },
  { pattern: /風俗|ソープ|デリヘル/, tag: '風俗・ソープ' },
  { pattern: /温泉|銭湯|お風呂/, tag: '温泉・銭湯・お風呂' },
  { pattern: /学園|学園もの/, tag: '学園もの' },
  { pattern: /中出し/, tag: '中出し' },
  { pattern: /寝取られ|NTR|寝取り/, tag: '寝取られ・NTR' },
  { pattern: /BSS/, tag: 'BSS' },
  { pattern: /巨乳|おっぱい/, tag: '巨乳' },
  { pattern: /巨根/, tag: '巨根' },
  { pattern: /天使|悪魔/, tag: '天使・悪魔' },
  { pattern: /姉妹/, tag: '姉妹' },
  { pattern: /同級生|同僚/, tag: '同級生/同僚' },
  { pattern: /お嬢様|令嬢/, tag: 'お嬢様・令嬢' },
  { pattern: /洗脳/, tag: '洗脳' },
  { pattern: /上司/, tag: '上司' },
  { pattern: /陰キャ|地味/, tag: '陰キャ・地味' },
  { pattern: /同棲/, tag: '同棲' },
  { pattern: /風紀委員/, tag: '風紀委員' },
  { pattern: /魔法/, tag: '魔法' },
  { pattern: /VTuber/, tag: 'VTuber' },
  { pattern: /制服/, tag: '制服' },
  { pattern: /寝落ち/, tag: '寝落ち' },
  { pattern: /催眠/, tag: '常識改変' },
  { pattern: /バイト|アルバイト/, tag: 'バイト' },
];

// タイトル・コメントから A タグ候補（tagRanks の A またはよく使う語）。S と被らないものだけ使う
const A_TAG_KEYWORDS: Array<{ pattern: RegExp | string; tag: string }> = [
  { pattern: /筆[お下]ろし|筆下ろし/, tag: '筆下ろし' },
  { pattern: /ご褒美|ごほうび/, tag: 'ご褒美' },
  { pattern: /罰ゲーム/, tag: '罰ゲーム' },
  { pattern: /逆レイプ|逆レ●プ/, tag: '逆レイプ' },
  { pattern: /ジャンケン|じゃんけん/, tag: 'ジャンケン' },
  { pattern: /保健室/, tag: '保健室' },
  { pattern: /海水浴/, tag: '海水浴' },
  { pattern: /マッチョ/, tag: 'マッチョ' },
  { pattern: /JK|女子高生|女子大生/, tag: 'JK' },
  { pattern: /脅迫/, tag: '脅迫' },
  { pattern: /デリヘル/, tag: 'デリヘル' },
  { pattern: /新婚/, tag: '新婚' },
  { pattern: /酔っ払い|酔い/, tag: '酔っ払い' },
  { pattern: /娘の友達|娘の友人/, tag: '娘の友達' },
  { pattern: /セックスレス/, tag: 'セックスレス' },
  { pattern: /人間操作|常識改変/, tag: '人間操作' },
  { pattern: /リモコン/, tag: 'リモコン' },
  { pattern: /図書館/, tag: '図書館' },
  { pattern: /退魔師/, tag: '退魔師' },
  { pattern: /ポイント/, tag: 'ポイント' },
  { pattern: /出張/, tag: '出張' },
  { pattern: /通勤/, tag: '通勤' },
  { pattern: /地雷系/, tag: '地雷系' },
  { pattern: /新入社員|新卒/, tag: '新入社員' },
  { pattern: /店員/, tag: '店員' },
  { pattern: /押しかけ/, tag: '押しかけ' },
  { pattern: /パパ活/, tag: 'パパ活' },
  { pattern: /種付け/, tag: '種付け' },
  { pattern: /学園祭/, tag: '学園祭' },
  { pattern: /マッチングアプリ/, tag: 'マッチングアプリ' },
  { pattern: /卒業式/, tag: '卒業式' },
  { pattern: /友達のママ/, tag: '友達のママ' },
  { pattern: /托卵/, tag: '托卵' },
  { pattern: /盗撮/, tag: '盗撮' },
  { pattern: /祖父|おじいちゃん/, tag: '祖父' },
  { pattern: /子作り/, tag: '子作り' },
  { pattern: /家事代行/, tag: '家事代行' },
  { pattern: /メイド教育/, tag: 'メイド教育' },
  { pattern: /ヒロイン/, tag: 'ヒロイン' },
  { pattern: /水泳/, tag: '水泳' },
  { pattern: /スワッピング/, tag: 'スワッピング' },
  { pattern: /借金/, tag: '借金' },
  { pattern: /告白/, tag: '告白' },
  { pattern: /ハプニング/, tag: 'ハプニング' },
  { pattern: /絶倫/, tag: '絶倫' },
  { pattern: /搾精/, tag: '搾精' },
  { pattern: /病気/, tag: '病気' },
  { pattern: /貴族/, tag: '貴族' },
  { pattern: /寝取られない/, tag: '寝取られない' },
];

const B_TAG_KEYWORDS: Array<{ pattern: RegExp | string; tag: string }> = [
  { pattern: /マンション/, tag: 'マンション' },
];

function hasKeyword(text: string, item: { pattern: RegExp | string; tag: string }): boolean {
  if (typeof item.pattern === 'string') return text.includes(item.pattern);
  return item.pattern.test(text);
}

function main() {
  const officialTagsList: string[] = JSON.parse(
    fs.readFileSync(OFFICIAL_CACHE_PATH, 'utf-8')
  ).tags;
  const officialSet = new Set(officialTagsList.map((s: string) => s.toLowerCase()));

  let tagRanks: Record<string, string> = {};
  try {
    tagRanks = JSON.parse(fs.readFileSync(TAG_RANKS_PATH, 'utf-8')).ranks || {};
  } catch {
    // ignore
  }

  const raw = fs.readFileSync(UNTAGGED_PATH, 'utf-8');
  const items: UntaggedItem[] = JSON.parse(raw);
  if (!Array.isArray(items) || items.length === 0) {
    console.error('untagged list empty');
    process.exit(1);
  }

  const alreadyHasOfficial = (work: UntaggedItem, displayName: string) =>
    work.officialTags.some((t) => t.toLowerCase() === displayName.toLowerCase());

  const output: OutputItem[] = [];

  for (const work of items) {
    const text = `${work.title} ${work.commentText}`;
    const addS: string[] = [];
    const aList: string[] = [];
    const bList: string[] = [];
    const usedA = new Set<string>();

    // 1) additionalSTags: KEYWORD_TO_OFFICIAL でマッチし、かつ公式に存在し、かつ作品にまだ付いていないもの
    for (const { pattern, tag } of KEYWORD_TO_OFFICIAL) {
      if (!officialSet.has(tag.toLowerCase())) continue;
      if (alreadyHasOfficial(work, tag)) continue;
      if (addS.some((s) => s.toLowerCase() === tag.toLowerCase())) continue;
      if (hasKeyword(text, { pattern, tag })) addS.push(tag);
    }

    // 2) aTags: タイトル・コメントのキーワード。S・additionalS と被らないように
    const sAndAddS = new Set([
      ...work.officialTags.map((t) => t.toLowerCase()),
      ...addS.map((t) => t.toLowerCase()),
    ]);
    for (const { pattern, tag } of A_TAG_KEYWORDS) {
      if (sAndAddS.has(tag.toLowerCase())) continue;
      if (usedA.has(tag)) continue;
      if (hasKeyword(text, { pattern, tag })) {
        aList.push(tag);
        usedA.add(tag);
      }
    }
    // tagRanks の A で、テキストに含まれる語を追加。S・additionalS と同概念（含む）は入れない
    const sOrAddSContains = (tagName: string) =>
      [...work.officialTags, ...addS].some(
        (t) => t.includes(tagName) || tagName.includes(t) || t.toLowerCase() === tagName.toLowerCase()
      );
    for (const [name, rank] of Object.entries(tagRanks)) {
      if (rank !== 'A') continue;
      if (sAndAddS.has(name.toLowerCase()) || usedA.has(name)) continue;
      if (sOrAddSContains(name)) continue;
      if (text.includes(name)) {
        aList.push(name);
        usedA.add(name);
      }
    }

    // 3) bTags
    for (const { pattern, tag } of B_TAG_KEYWORDS) {
      if (text.includes(tag) && !aList.includes(tag)) bList.push(tag);
    }

    // キャラは簡易スキップ（必要なら後で手動で追加）
    const characterTags: string[] = [];

    output.push({
      workId: work.workId,
      title: work.title,
      additionalSTags: addS,
      aTags: aList,
      bTags: bList,
      cTags: [],
      characterTags,
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.error(`wrote ${output.length} items to ${OUTPUT_PATH}`);
}

main();
