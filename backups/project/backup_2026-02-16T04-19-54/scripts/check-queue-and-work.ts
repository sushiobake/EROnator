#!/usr/bin/env tsx
/** 確認用: checkQueueAt 件数と d_650621 のフォルダ */
import * as path from 'path';
import * as fs from 'fs';
const root = path.resolve(process.cwd());
function loadUrl(): string | null {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const c = fs.readFileSync(p, 'utf-8');
    for (const line of c.split('\n')) {
      const m = line.match(/^DATABASE_URL=(.+)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}
const u = loadUrl();
if (u) {
  const fileMatch = u.match(/^file:(\.\/)?(.*?)(\?.*)?$/);
  if (fileMatch) {
    process.env.DATABASE_URL =
      'file:' + path.resolve(root, fileMatch[2]).replace(/\\/g, '/') + (fileMatch[3] || '');
  } else process.env.DATABASE_URL = u;
} else require('dotenv').config({ path: path.join(root, '.env') });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // checkQueueAt あり かつ 今「旧AIタグ」に入っている作品
  const inLegacy = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      checkQueueAt: { not: null },
      manualTaggingFolder: 'legacy_ai',
    },
    select: { workId: true, title: true },
    take: 20,
  });
  const count = await prisma.work.count({
    where: {
      commentText: { not: null },
      checkQueueAt: { not: null },
      manualTaggingFolder: 'legacy_ai',
    },
  });
  console.log('checkQueueAt が入っている かつ 今「旧AIタグ」に入っている作品数:', count);
  if (count > 0) {
    console.log('例（最大20件）:');
    inLegacy.forEach((w) => console.log('  ', w.workId, (w.title || '').slice(0, 40) + '...'));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
