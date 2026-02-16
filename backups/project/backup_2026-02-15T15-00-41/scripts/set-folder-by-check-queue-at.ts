#!/usr/bin/env tsx
/**
 * checkQueueAt あり → チェック待ち (pending)
 * checkQueueAt なし（かつ DERIVED あり・人間チェック済でない・要注意でない）→ 旧AIタグ (legacy_ai)
 * Usage: npx tsx scripts/set-folder-by-check-queue-at.ts
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

async function main() {
  const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');

  // 1) checkQueueAt が入っている作品 → チェック待ち（タグ済・要注意は上書きしない＝タグ済はそのままの方がよいので、checkQueueAt ありはすべて pending に）
  const toPending = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      checkQueueAt: { not: null },
    },
    select: { workId: true },
  });
  console.log('checkQueueAt あり → pending に移動する件数:', toPending.length);
  for (const w of toPending) {
    if (isPostgres) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Work" SET "manualTaggingFolder" = $1 WHERE "workId" = $2',
        'pending',
        w.workId
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE Work SET manualTaggingFolder = ? WHERE workId = ?',
        'pending',
        w.workId
      );
    }
  }

  // 2) checkQueueAt が入っていない & DERIVED あり & 人間チェック済でない & 要注意でない → 旧AIタグ
  const toLegacy = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      checkQueueAt: null,
      needsReview: false,
      humanChecked: false,
      NOT: { tagSource: 'human' },
      workTags: { some: { tag: { tagType: 'DERIVED' } } },
    },
    select: { workId: true },
  });
  console.log('checkQueueAt なし & DERIVEDあり & 人間未チェック → legacy_ai に移動する件数:', toLegacy.length);
  for (const w of toLegacy) {
    if (isPostgres) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Work" SET "manualTaggingFolder" = $1 WHERE "workId" = $2',
        'legacy_ai',
        w.workId
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE Work SET manualTaggingFolder = ? WHERE workId = ?',
        'legacy_ai',
        w.workId
      );
    }
  }

  console.log('完了。pending:', toPending.length, '件 / legacy_ai:', toLegacy.length, '件');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
