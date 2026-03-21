#!/usr/bin/env tsx
/**
 * 未タグ → 未タグ（優先順位①）への一括移動（1回限り実行用）
 * manualTaggingFolder = 'untagged' の作品をすべて 'priority_untagged_1' に更新する。
 * ②（priority_untagged_2）には何も移さない（空のまま）。
 *
 * Usage: npx tsx scripts/migrate-untagged-to-priority-1.ts
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
  const before = await prisma.work.count({
    where: { commentText: { not: null }, manualTaggingFolder: 'untagged' },
  });
  console.log(`未タグ（untagged）の作品数: ${before}件`);

  if (before === 0) {
    console.log('移動する作品がありません。完了.');
    return;
  }

  const result = await prisma.work.updateMany({
    where: { commentText: { not: null }, manualTaggingFolder: 'untagged' },
    data: { manualTaggingFolder: 'priority_untagged_1' },
  });

  console.log(`未タグ（優先順位①）へ移動: ${result.count}件を更新`);

  const afterUntagged = await prisma.work.count({
    where: { commentText: { not: null }, manualTaggingFolder: 'untagged' },
  });
  const afterP1 = await prisma.work.count({
    where: { commentText: { not: null }, manualTaggingFolder: 'priority_untagged_1' },
  });
  console.log(`\n更新後: untagged=${afterUntagged}件, priority_untagged_1=${afterP1}件`);
  console.log('完了');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
