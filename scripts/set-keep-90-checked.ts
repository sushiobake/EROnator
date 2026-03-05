#!/usr/bin/env tsx
/** sim-keep-85-list.txt の90件を needsReview=false（チェック完了）にする */
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const listPath = path.join(__dirname, '..', '..', 'sim-keep-85-list.txt');

function main() {
  const raw = fs.readFileSync(listPath, 'utf8');
  const workIds = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.startsWith('d_'))
    .map((line) => line.split('\t')[0])
    .filter((id) => /^d_\d+$/.test(id));

  if (workIds.length === 0) {
    console.error('workId が1件もありません: ' + listPath);
    process.exit(1);
  }

  console.log('対象 workId 件数:', workIds.length);
  console.log('先頭3件:', workIds.slice(0, 3));

  return prisma.work
    .updateMany({
      where: { workId: { in: workIds } },
      data: { needsReview: false },
    })
    .then((r) => {
      console.log('更新完了: count =', r.count);
    })
    .finally(() => prisma.$disconnect());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
