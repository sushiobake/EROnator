#!/usr/bin/env tsx
/**
 * popularityBaseとisAiの状態を確認
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const works = await prisma.work.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      workId: true,
      title: true,
      reviewCount: true,
      reviewAverage: true,
      popularityBase: true,
      isAi: true,
    },
  });

  console.log('最新5件の作品:');
  works.forEach(w => {
    console.log(`  ${w.workId}: ${w.title.substring(0, 40)}...`);
    console.log(`    reviewCount=${w.reviewCount}, reviewAverage=${w.reviewAverage}, popularityBase=${w.popularityBase}, isAi=${w.isAi}`);
  });

  await prisma.$disconnect();
}

main();
