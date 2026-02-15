#!/usr/bin/env tsx
/** legacy_ai 作品を10件取得（commentText 付き） */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const works = await prisma.work.findMany({
    where: {
      needsReview: false,
      commentText: { not: null },
      workTags: { some: { tag: { tagType: 'DERIVED' } } },
      aiAnalyzed: false,
      humanChecked: false,
    },
    select: {
      workId: true,
      title: true,
      authorName: true,
      commentText: true,
      workTags: {
        where: { tag: { tagType: 'DERIVED' } },
        select: { tag: { select: { displayName: true } } },
      },
    },
    orderBy: { updatedAt: 'asc' },
    take: 10,
  });

  const outDir = path.join(process.cwd(), 'data', 'chatgpt-export');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'legacy-ai-10-for-cursor.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      works.map((w) => ({
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        commentText: w.commentText,
        currentDerived: w.workTags.map((wt) => wt.tag.displayName),
      })),
      null,
      2
    ),
    'utf-8'
  );
  console.log(`Wrote ${works.length} works to ${outPath}`);
  works.forEach((w, i) => console.log(`${i + 1}. ${w.title}`));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
