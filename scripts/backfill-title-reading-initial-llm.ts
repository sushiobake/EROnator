#!/usr/bin/env tsx
/**
 * titleReadingInitial が未設定の作品を LLM API で一括取得して DB に反映
 * ひらがな/カタカナ始まりは機械設定、漢字・英字は LLM に問い合わせ
 * Usage: npx tsx scripts/backfill-title-reading-initial-llm.ts [--dry-run] [--limit=N]
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
require('dotenv').config({ path: path.join(root, '.env.local') });

import { PrismaClient } from '@prisma/client';
import { getTitleReadingInitialFromTitle } from '../src/server/utils/titleCharType';
import { callCheckApi } from '../src/server/checkAiClient';

const prisma = new PrismaClient();

const BATCH_SIZE = 8;
const DELAY_MS = 500;

const INSTRUCTION = `以下の作品リストについて、各タイトルの「読みの先頭1文字」をカタカナで返してください。

【ルール】
・括弧・鍵括弧（【】、()、[]、「」など）は無視し、除去した後の最初の有効な文字の読みを使う
・漢字 → その読みの先頭1文字をカタカナで（例：隣→ト、双→フ、異→イ）
・英字・アルファベット → 日本語読みの先頭1文字をカタカナで（例：L→エ、A→エ、R→ア）
・数字 → 日本語読みの先頭1文字をカタカナで（例：1→イ、2→ニ、3→サ）
・ひらがな・カタカナ始まり → その1文字をカタカナに（例：あ→ア、か→カ）
・不明・判断できない場合は「?」を返す

【出力形式】
workId（タブ）読みの1文字
1行1作品。元の順序を維持。ヘッダー不要。workId は入力のままそのまま返す。

例：
d_abc123	ト
cid:d_xyz	フ
`;

const KATAKANA_ONE = /^[ァ-ヶー]$/;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? '0', 10) : 0;

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY が設定されていません');
    process.exit(1);
  }

  const works = await prisma.work.findMany({
    where: {
      titleReadingInitial: null,
      commentText: { not: null },
    },
    select: { workId: true, title: true },
    orderBy: { workId: 'asc' },
  });

  const toProcess = limit > 0 ? works.slice(0, limit) : works;

  const mechanical: Array<{ workId: string; initial: string }> = [];
  const needLlm: Array<{ workId: string; title: string }> = [];

  for (const w of toProcess) {
    const initial = getTitleReadingInitialFromTitle(w.title ?? '');
    if (initial) {
      mechanical.push({ workId: w.workId, initial });
    } else {
      needLlm.push({ workId: w.workId, title: (w.title ?? '').replace(/\r?\n/g, ' ') });
    }
  }

  console.log(`対象: ${toProcess.length} 件`);
  console.log(`  機械設定（ひらがな/カタカナ）: ${mechanical.length} 件`);
  console.log(`  LLM 問い合わせ: ${needLlm.length} 件`);

  let updated = 0;

  if (mechanical.length > 0 && !dryRun) {
    for (const { workId, initial } of mechanical) {
      const r = await prisma.work.updateMany({
        where: { workId },
        data: { titleReadingInitial: initial },
      });
      updated += r.count;
    }
    console.log(`機械設定 更新: ${updated} 件`);
  } else if (mechanical.length > 0 && dryRun) {
    console.log(`[dry-run] 機械設定 ${mechanical.length} 件はスキップ`);
  }

  if (needLlm.length === 0) {
    console.log('LLM 問い合わせ対象なし。完了。');
    return;
  }

  const llmResults: Array<{ workId: string; initial: string }> = [];

  for (let i = 0; i < needLlm.length; i += BATCH_SIZE) {
    const chunk = needLlm.slice(i, i + BATCH_SIZE);
    const listLines = chunk.map((w) => `${w.workId}\t${w.title}`).join('\n');
    const userContent = `${INSTRUCTION}

## 作品リスト（workId<TAB>title）

${listLines}
`;

    if (dryRun) {
      console.log(`[dry-run] バッチ ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} 件（API 呼び出しスキップ）`);
      continue;
    }

    try {
      const content = await callCheckApi(userContent, 'backfill-title-reading-initial');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const tabIdx = trimmed.indexOf('\t');
        if (tabIdx < 0) continue;
        const workId = trimmed.slice(0, tabIdx).trim();
        const initial = trimmed.slice(tabIdx + 1).trim();
        if (!workId || initial === '?' || !KATAKANA_ONE.test(initial)) continue;
        llmResults.push({ workId, initial });
      }
    } catch (e) {
      console.error(`❌ バッチ ${Math.floor(i / BATCH_SIZE) + 1} 失敗:`, e instanceof Error ? e.message : e);
      break;
    }

    const done = Math.min(i + BATCH_SIZE, needLlm.length);
    process.stdout.write(`\rLLM 処理: ${done} / ${needLlm.length}`);
    await sleep(DELAY_MS);
  }

  console.log('');

  if (llmResults.length > 0 && !dryRun) {
    for (const { workId, initial } of llmResults) {
      const r = await prisma.work.updateMany({
        where: { workId },
        data: { titleReadingInitial: initial },
      });
      updated += r.count;
    }
    console.log(`LLM 結果 更新: ${llmResults.length} 件`);
  }

  console.log(`\n合計 更新: ${updated} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
