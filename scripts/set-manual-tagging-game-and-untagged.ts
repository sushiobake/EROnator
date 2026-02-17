#!/usr/bin/env tsx
/**
 * ① 人力タグ付けの4フォルダ（tagged, needs_human_check, pending, legacy_ai）内の作品を
 *    gameRegistered=true, needsReview=false（ゲーム有効）に一括更新
 * ② commentText があり manualTaggingFolder が null の作品を manualTaggingFolder='untagged' に更新
 *
 * Usage: npx tsx scripts/set-manual-tagging-game-and-untagged.ts
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

const GAME_ENABLED_FOLDERS = ['tagged', 'needs_human_check', 'pending', 'legacy_ai'] as const;

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const isPostgres = dbUrl.startsWith('postgres');

  // ① 4フォルダ内の作品をゲーム有効に
  const gameCount = await prisma.work.updateMany({
    where: {
      commentText: { not: null },
      manualTaggingFolder: { in: [...GAME_ENABLED_FOLDERS] },
    },
    data: { gameRegistered: true, needsReview: false },
  });
  console.log(`① ゲーム有効: ${gameCount.count}件を gameRegistered=true, needsReview=false に更新`);

  // ② commentText があり manualTaggingFolder が null の作品を untagged に
  const untaggedCount = await prisma.work.updateMany({
    where: {
      commentText: { not: null },
      manualTaggingFolder: null,
    },
    data: { manualTaggingFolder: 'untagged' },
  });
  console.log(`② 未タグ振り分け: ${untaggedCount.count}件を manualTaggingFolder='untagged' に更新`);

  console.log('\n完了');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
