#!/usr/bin/env tsx
/**
 * TITLE_SYLLABLE_2 と AUTHOR_CHAR_TYPE の最適な質問設計のための分析
 * Usage: npx tsx scripts/analyze-syllable-and-author.ts
 */
import * as path from 'path';
import * as fs from 'fs';

const root = path.resolve(process.cwd());
function loadDatabaseUrl(): string | null {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^DATABASE_URL=(.+)$/);
      if (match) {
        const val = match[1].trim().replace(/^["']|["']$/g, '');
        if (val) return val;
        break;
      }
    }
  }
  return null;
}
const urlFromFile = loadDatabaseUrl();
if (urlFromFile) {
  const fileMatch = urlFromFile.match(/^file:(\.\/)?(.*?)(\?.*)?$/);
  if (fileMatch) {
    const absolutePath = path.resolve(root, fileMatch[2]);
    const suffix = fileMatch[3] || '';
    process.env.DATABASE_URL = 'file:' + absolutePath.replace(/\\/g, '/') + suffix;
  } else {
    process.env.DATABASE_URL = urlFromFile;
  }
} else {
  require('dotenv').config({ path: path.join(root, '.env') });
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 現行の3範囲（1次質問）
const RANGES = {
  sa_to_wa: {
    id: 'sa_to_wa',
    label: 'さ～わ行',
    chars: ['サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'],
  },
  a_to_sa: {
    id: 'a_to_sa',
    label: 'あ～さ行',
    chars: ['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ'],
  },
  ka_to_ha: {
    id: 'ka_to_ha',
    label: 'か～は行',
    chars: ['カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ'],
  },
} as const;

function infoGain(pYes: number): number {
  const p = Math.max(0.001, Math.min(0.999, pYes));
  return Math.min(p, 1 - p);
}

function getAuthorCharType(authorName: string | null): 'KANJI' | 'KATAKANA' | 'HIRAGANA' | 'ALPHA' | 'OTHER' {
  if (!authorName || !authorName.trim()) return 'OTHER';
  const c = authorName.trim()[0] ?? '';
  if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(c)) return 'KANJI';
  if (/[ァ-ヶー]/.test(c)) return 'KATAKANA';
  if (/[ぁ-んー]/.test(c)) return 'HIRAGANA';
  if (/[a-zA-Z0-9]/.test(c)) return 'ALPHA';
  return 'OTHER';
}

async function main() {
  const works = await prisma.work.findMany({
    where: { gameRegistered: true },
    select: { workId: true, title: true, titleReadingInitial: true, authorName: true },
  });

  const total = works.length;
  console.log(`\n=== 分析対象: ゲーム登録作品 ${total.toLocaleString()} 件 ===\n`);

  // --- 1. titleReadingInitial の分布 ---
  const byInitial = new Map<string, number>();
  let hasInitial = 0;
  for (const w of works) {
    const init = w.titleReadingInitial;
    if (init) {
      hasInitial++;
      byInitial.set(init, (byInitial.get(init) ?? 0) + 1);
    }
  }
  console.log(`titleReadingInitial 設定済み: ${hasInitial} 件 (${total > 0 ? ((100 * hasInitial) / total).toFixed(1) : 0}%)\n`);

  const charSet = (chars: string[]) => new Set(chars);

  // --- 2. TITLE_SYLLABLE_2: 各1次範囲の YES/NO 後の最適2分割 ---
  console.log('=== TITLE_SYLLABLE_2: 各1次範囲の YES/NO 後の最適2分割 ===\n');

  for (const [rangeId, range] of Object.entries(RANGES)) {
    const set = charSet(range.chars);
    const inRange = works.filter((w) => w.titleReadingInitial && set.has(w.titleReadingInitial));
    const outRange = works.filter((w) => w.titleReadingInitial && !set.has(w.titleReadingInitial));

    console.log(`--- ${range.label} (${rangeId}) ---`);
    console.log(`  YES時（${range.label}内）: ${inRange.length} 件`);
    console.log(`  NO時（${range.label}外）: ${outRange.length} 件`);

    // YES時の2分割候補を試す
    const yesSplits: Array<{ label: string; chars: string[]; cnt: number; pYes: number; ig: number }> = [];
    if (rangeId === 'sa_to_wa') {
      const candidates = [
        { label: 'さ～た行', chars: ['サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト'] },
        { label: 'さ～な行', chars: ['サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ'] },
        { label: 'さ～は行', chars: ['サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ'] },
        { label: 'な～わ行', chars: ['ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'] },
        { label: 'は～わ行', chars: ['ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'] },
        { label: 'ま～わ行', chars: ['マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'] },
      ];
      for (const { label, chars } of candidates) {
        const s = new Set(chars);
        const cnt = inRange.filter((w) => s.has(w.titleReadingInitial!)).length;
        const pYes = inRange.length > 0 ? cnt / inRange.length : 0.5;
        yesSplits.push({ label, chars, cnt, pYes, ig: infoGain(pYes) });
      }
    }
    if (rangeId === 'a_to_sa') {
      const candidates = [
        { label: 'あ行', chars: ['ア','イ','ウ','エ','オ'] },
        { label: 'か～さ行', chars: ['カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ'] },
        { label: 'あ～か行', chars: ['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ'] },
        { label: 'さ行', chars: ['サ','シ','ス','セ','ソ'] },
      ];
      for (const { label, chars } of candidates) {
        const s = new Set(chars);
        const cnt = inRange.filter((w) => s.has(w.titleReadingInitial!)).length;
        const pYes = inRange.length > 0 ? cnt / inRange.length : 0.5;
        yesSplits.push({ label, chars, cnt, pYes, ig: infoGain(pYes) });
      }
    }
    if (rangeId === 'ka_to_ha') {
      const candidates = [
        { label: 'か～さ行', chars: ['カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ'] },
        { label: 'た～は行', chars: ['タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ'] },
        { label: 'か～た行', chars: ['カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト'] },
        { label: 'な～は行', chars: ['ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ'] },
      ];
      for (const { label, chars } of candidates) {
        const s = new Set(chars);
        const cnt = inRange.filter((w) => s.has(w.titleReadingInitial!)).length;
        const pYes = inRange.length > 0 ? cnt / inRange.length : 0.5;
        yesSplits.push({ label, chars, cnt, pYes, ig: infoGain(pYes) });
      }
    }

    if (yesSplits.length > 0) {
      const best = yesSplits.reduce((a, b) => (a.ig > b.ig ? a : b));
      console.log(`  【YES時】最適2分割: 「${best.label}」で始まる？ (件数: ${best.cnt}, pYes=${(best.pYes * 100).toFixed(1)}%, 情報量=${best.ig.toFixed(3)})`);
    }

    // NO時の2分割（補集合の中での分割）
    // あ～さ行 NO → 残りは た行～わ行（か行・さ行は含まない！）
    // か～は行 NO → 残りは あ行＋ま～わ行
    // さ～わ行 NO → 残りは あ～か行
    const noSplits: Array<{ label: string; chars: string[]; cnt: number; pYes: number; ig: number }> = [];
    if (rangeId === 'sa_to_wa') {
      // NO = あ～か行（あ行＋か行）
      const noChars = ['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ'];
      const noSet = new Set(noChars);
      const inNo = works.filter((w) => w.titleReadingInitial && noSet.has(w.titleReadingInitial));
      const candidates = [
        { label: 'あ行', chars: ['ア','イ','ウ','エ','オ'] },
        { label: 'か行', chars: ['カ','キ','ク','ケ','コ'] },
      ];
      for (const { label, chars } of candidates) {
        const s = new Set(chars);
        const cnt = inNo.filter((w) => s.has(w.titleReadingInitial!)).length;
        const pYes = inNo.length > 0 ? cnt / inNo.length : 0.5;
        noSplits.push({ label, chars, cnt, pYes, ig: infoGain(pYes) });
      }
      console.log(`  【NO時】残り: あ～か行 ${inNo.length}件`);
    }
    if (rangeId === 'a_to_sa') {
      // NO = た行～わ行（か・さは含まない！）
      const noChars = ['タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'];
      const noSet = new Set(noChars);
      const inNo = works.filter((w) => w.titleReadingInitial && noSet.has(w.titleReadingInitial));
      const candidates = [
        { label: 'た～は行', chars: ['タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ'] },
        { label: 'ま～わ行', chars: ['マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'] },
        { label: 'た行', chars: ['タ','チ','ツ','テ','ト'] },
        { label: 'な～わ行', chars: ['ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'] },
      ];
      for (const { label, chars } of candidates) {
        const s = new Set(chars);
        const cnt = inNo.filter((w) => s.has(w.titleReadingInitial!)).length;
        const pYes = inNo.length > 0 ? cnt / inNo.length : 0.5;
        noSplits.push({ label, chars, cnt, pYes, ig: infoGain(pYes) });
      }
      console.log(`  【NO時】残り: た～わ行 ${inNo.length}件（か・さ行は含まない）`);
    }
    if (rangeId === 'ka_to_ha') {
      // NO = あ行＋ま～わ行
      const noChars = ['ア','イ','ウ','エ','オ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'];
      const noSet = new Set(noChars);
      const inNo = works.filter((w) => w.titleReadingInitial && noSet.has(w.titleReadingInitial));
      const candidates = [
        { label: 'あ行', chars: ['ア','イ','ウ','エ','オ'] },
        { label: 'ま～わ行', chars: ['マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン'] },
      ];
      for (const { label, chars } of candidates) {
        const s = new Set(chars);
        const cnt = inNo.filter((w) => s.has(w.titleReadingInitial!)).length;
        const pYes = inNo.length > 0 ? cnt / inNo.length : 0.5;
        noSplits.push({ label, chars, cnt, pYes, ig: infoGain(pYes) });
      }
      console.log(`  【NO時】残り: あ行＋ま～わ行 ${inNo.length}件`);
    }

    if (noSplits.length > 0) {
      const best = noSplits.reduce((a, b) => (a.ig > b.ig ? a : b));
      console.log(`  【NO時】最適2分割: 「${best.label}」で始まる？ (件数: ${best.cnt}, pYes=${(best.pYes * 100).toFixed(1)}%, 情報量=${best.ig.toFixed(3)})\n`);
    }
  }

  // --- 3. AUTHOR_CHAR_TYPE の分布 ---
  console.log('\n=== AUTHOR_CHAR_TYPE: 作者名の文字種分布 ===\n');

  const authorCounts: Record<string, number> = { KANJI: 0, KATAKANA: 0, HIRAGANA: 0, ALPHA: 0, OTHER: 0 };
  for (const w of works) {
    const t = getAuthorCharType(w.authorName);
    authorCounts[t]++;
  }
  const authTotal = works.length;
  console.log('作者名の先頭文字種別:');
  for (const [k, n] of Object.entries(authorCounts)) {
    console.log(`  ${k}: ${n} 件 (${authTotal > 0 ? ((100 * n) / authTotal).toFixed(1) : 0}%)`);
  }

  // 2択の最適分割（情報量最大化）
  const kanji = authorCounts.KANJI;
  const kataHira = authorCounts.KATAKANA + authorCounts.HIRAGANA;
  const alpha = authorCounts.ALPHA;
  const other = authorCounts.OTHER;

  const splits = [
    { label: 'カタカナ/ひらがな', pYes: kataHira / authTotal, ig: infoGain(kataHira / authTotal) },
    { label: '漢字', pYes: kanji / authTotal, ig: infoGain(kanji / authTotal) },
    { label: 'アルファベット', pYes: alpha / authTotal, ig: infoGain(alpha / authTotal) },
    { label: 'カタカナ/ひらがな vs その他', pYes: kataHira / authTotal, ig: infoGain(kataHira / authTotal) },
    { label: '漢字 vs その他', pYes: kanji / authTotal, ig: infoGain(kanji / authTotal) },
    { label: 'アルファベット vs その他', pYes: alpha / authTotal, ig: infoGain(alpha / authTotal) },
  ];
  const bestAuth = splits.reduce((a, b) => (a.ig > b.ig ? a : b));
  console.log(`\n推奨: 情報量最大の1択は「${bestAuth.label}」 (pYes=${(bestAuth.pYes * 100).toFixed(1)}%, 情報量=${bestAuth.ig.toFixed(3)})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
