#!/usr/bin/env tsx
/**
 * 指定タイトルに部分一致する作品の workId / title / commentText を取得
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TITLE_PARTS = [
  'ハーレム水泳部',  // 巨乳（デカパイ）ハーレム水泳部のマネージャーになりました！
  '舐めた犬',
  'セクシードッキリ',
  '都合のいい女',
];

async function main() {
  const allWorks: { workId: string; title: string; commentText: string | null }[] = [];
  for (const part of TITLE_PARTS) {
    const works = await prisma.work.findMany({
      where: { title: { contains: part } },
      select: { workId: true, title: true, commentText: true },
      orderBy: { createdAt: 'asc' },
    });
    if (works.length > 0) allWorks.push(works[0]);
  }

  const works = allWorks;
  if (works.length === 0) {
    console.log('該当作品が0件です。');
    return;
  }

  console.log(JSON.stringify(works, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
