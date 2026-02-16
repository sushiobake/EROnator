#!/usr/bin/env tsx
/** チェック待ち作品を取得（AIタグ再分析用）＝ aiAnalyzed=true, humanChecked=false */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const pendingWhere = {
  commentText: { not: null },
  needsReview: false,
  aiAnalyzed: true,
  humanChecked: false,
  NOT: { tagSource: 'human' },
};

async function main() {
  const works = await prisma.work.findMany({
    where: pendingWhere,
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

  console.log(JSON.stringify(list, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
