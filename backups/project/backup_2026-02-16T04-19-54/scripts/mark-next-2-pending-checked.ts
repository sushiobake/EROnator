#!/usr/bin/env tsx
/**
 * チェック待ちの先頭2件をチェック済みにする（「最初の50件」を50件にするため）
 * Usage: npx tsx scripts/mark-next-2-pending-checked.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<Array<{ workId: string }>>`
    SELECT workId FROM Work
    WHERE commentText IS NOT NULL AND (needsReview = 0 OR needsReview IS NULL)
      AND aiAnalyzed = 1 AND (humanChecked = 0 OR humanChecked IS NULL)
      AND (tagSource IS NULL OR tagSource != 'human')
    ORDER BY checkQueueAt DESC NULLS LAST, updatedAt DESC
    LIMIT 2
  `;
  const workIds = rows.map((r) => r.workId);
  if (workIds.length === 0) {
    console.log(JSON.stringify({ success: true, count: 0, message: 'チェック待ちは0件です。' }));
    return;
  }

  const result = await prisma.work.updateMany({
    where: { workId: { in: workIds } },
    data: { humanChecked: true },
  });

  console.log(
    JSON.stringify({
      success: true,
      count: result.count,
      workIds,
      message: `${result.count} 件をチェック済みにしました（最初の50件＝48+2）。`,
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
