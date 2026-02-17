#!/usr/bin/env tsx
/**
 * フォルダ化「前」の「チェック待ち」条件で「もともとチェック待ちだった作品」を特定し、
 * 現在「チェック待ち」フォルダに入っている作品のうち、それ以外をすべて「旧AIタグ」に移動する。
 *
 * フォルダ化前のチェック待ち条件（旧API）:
 *   commentText あり, needsReview false, aiAnalyzed true, humanChecked false, tagSource != 'human'
 * Usage: npx tsx scripts/move-pending-to-legacy-ai-by-flag.ts
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
  // フォルダ化前に「チェック待ち」に入っていた作品 = 旧APIの pending 条件を満たす workId
  const originallyPending = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      needsReview: false,
      aiAnalyzed: true,
      humanChecked: false,
      NOT: { tagSource: 'human' },
    },
    select: { workId: true },
  });
  const originallyPendingIds = new Set(originallyPending.map((w) => w.workId));
  console.log('フォルダ化前にチェック待ちだった作品数:', originallyPendingIds.size);

  // 現在「チェック待ち」フォルダに入っている作品のうち、上記に含まれないもの → 旧AIタグに移動
  const currentlyPending = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      manualTaggingFolder: 'pending',
    },
    select: { workId: true },
  });
  const toMove = currentlyPending.filter((w) => !originallyPendingIds.has(w.workId));
  console.log('現在 pending のうち「もともとチェック待ちでない」= 移動対象:', toMove.length);

  const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
  let updated = 0;
  for (const w of toMove) {
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
    updated++;
  }

  console.log('manualTaggingFolder = legacy_ai に更新した件数:', updated);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
