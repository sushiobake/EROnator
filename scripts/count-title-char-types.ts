#!/usr/bin/env tsx
/**
 * タイトル先頭文字の文字種別で作品数を集計
 * Usage: npx tsx scripts/count-title-char-types.ts
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
import { getTitleCharType } from '../src/server/utils/titleCharType';

const prisma = new PrismaClient();

async function main() {
  const works = await prisma.work.findMany({
    select: { workId: true, title: true, titleReadingInitial: true },
  });

  const counts: Record<string, number> = {
    KANJI: 0,
    KATAKANA: 0,
    HIRAGANA: 0,
    OTHER: 0,
  };

  for (const work of works) {
    const type = getTitleCharType(work.title ?? '');
    counts[type]++;
  }

  const total = works.length;
  console.log('📊 タイトル先頭文字の文字種別（括弧・記号除去後）\n');
  console.log(`漢字で始まる:   ${counts.KANJI.toLocaleString()} 件 (${((100 * counts.KANJI) / total).toFixed(1)}%)`);
  console.log(`カタカナで始まる: ${counts.KATAKANA.toLocaleString()} 件 (${((100 * counts.KATAKANA) / total).toFixed(1)}%)`);
  console.log(`ひらがなで始まる: ${counts.HIRAGANA.toLocaleString()} 件 (${((100 * counts.HIRAGANA) / total).toFixed(1)}%)`);
  console.log(`その他（英字・数字等）: ${counts.OTHER.toLocaleString()} 件 (${((100 * counts.OTHER) / total).toFixed(1)}%)`);
  console.log(`\n合計: ${total.toLocaleString()} 件`);

  const hasInitial = works.filter((w) => w.titleReadingInitial != null).length;
  console.log(`\ntitleReadingInitial 取得済み: ${hasInitial.toLocaleString()} 件 (${((100 * hasInitial) / total).toFixed(1)}%)`);

  const withComment = await prisma.work.count({ where: { commentText: { not: null } } });
  const needBackfill = await prisma.work.count({
    where: { titleReadingInitial: null, commentText: { not: null } },
  });
  console.log(`\nコメント取得済み: ${withComment.toLocaleString()} 件`);
  console.log(`バックフィル対象（コメント済みかつ頭文字未設定）: ${needBackfill.toLocaleString()} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
