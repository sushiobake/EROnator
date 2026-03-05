#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const listPath = path.join(__dirname, '..', '..', 'sim-keep-85-list.txt');

async function main() {
  const raw = fs.readFileSync(listPath, 'utf8');
  const workIds = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.startsWith('d_'))
    .map((l) => l.split('\t')[0])
    .filter((id) => /^d_\d+$/.test(id));

  const found = await prisma.work.findMany({
    where: { workId: { in: workIds } },
    select: { workId: true, needsReview: true },
  });
  const needsReviewTrue = await prisma.work.count({
    where: { workId: { in: workIds }, needsReview: true },
  });
  const totalWorks = await prisma.work.count();

  console.log('リスト workId 数:', workIds.length);
  console.log('DB に存在した数:', found.length);
  console.log('そのうち needsReview=true の数:', needsReviewTrue);
  console.log('DB Work 総数:', totalWorks);
  if (found.length > 0) console.log('サンプル:', found.slice(0, 3));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
