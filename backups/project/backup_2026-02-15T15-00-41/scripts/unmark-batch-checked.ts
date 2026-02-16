#!/usr/bin/env tsx
/**
 * さっき一括でチェック済みにした作品を、チェック待ちに戻す。
 * 条件: export-pending と同じ（commentText あり, needsReview なし, aiAnalyzed=1, tagSource≠human）
 *       かつ humanChecked = true のものを humanChecked = false に戻す。
 * Usage: npx tsx scripts/unmark-batch-checked.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // チェック済みのうち「チェック待ち条件」に合うもの = さっきマークした392件相当
  const toUnmark = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      aiAnalyzed: true,
      humanChecked: true,
      AND: [
        { OR: [{ needsReview: false }, { needsReview: null }] },
        { OR: [{ tagSource: null }, { tagSource: { not: 'human' } }] },
      ],
    },
    select: { workId: true },
  });

  const workIds = toUnmark.map((w) => w.workId);
  if (workIds.length === 0) {
    console.log(JSON.stringify({ success: true, count: 0, message: 'チェック済みの対象は0件です。' }));
    return;
  }

  const result = await prisma.work.updateMany({
    where: { workId: { in: workIds } },
    data: { humanChecked: false },
  });

  console.log(
    JSON.stringify({
      success: true,
      count: result.count,
      message: `${result.count} 件をチェック待ち（humanChecked: false）に戻しました。`,
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
