#!/usr/bin/env tsx
/** 未タグ作品を取得（AIタグ付け用） */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const baseWhere = {
  commentText: { not: null },
  needsReview: false,
  humanChecked: false,
  NOT: { workTags: { some: { tag: { tagType: 'DERIVED' } } } },
};

async function main() {
  const works = await prisma.work.findMany({
    where: baseWhere,
    take: 373,
    orderBy: { updatedAt: 'desc' },
    include: {
      workTags: {
        include: { tag: true },
      },
    },
  });

  const list = works.map((w) => {
    const official = w.workTags
      .filter((wt) => wt.tag.tagType === 'OFFICIAL')
      .map((wt) => wt.tag.displayName);
    return {
      workId: w.workId,
      title: w.title,
      authorName: w.authorName,
      commentText: (w.commentText || '').slice(0, 1200),
      officialTags: official,
    };
  });

  const json = JSON.stringify(list, null, 2);
  const outFile = process.env.OUTPUT_FILE || process.argv[2];
  if (outFile) {
    fs.writeFileSync(path.resolve(outFile), json, 'utf-8');
    console.error(`wrote ${list.length} works to ${outFile}`);
  } else {
    console.log(json);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
