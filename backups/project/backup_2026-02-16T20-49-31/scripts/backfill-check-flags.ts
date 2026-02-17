#!/usr/bin/env tsx
/**
 * 元のチェック状態をDBに正確に戻すバックフィル
 * - tagSource='human' の作品 → humanChecked = true
 * - 派生タグ(DERIVED)が1つでもある作品 → aiAnalyzed = true
 * これにより「チェック済み」「チェック待ち」タブが正しく件数表示される。
 * Usage: npx tsx scripts/backfill-check-flags.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const baseWhere = { commentText: { not: null } };

  // 1) tagSource = 'human' の作品をすべて humanChecked = true に
  const humanResult = await prisma.work.updateMany({
    where: { ...baseWhere, tagSource: 'human' },
    data: { humanChecked: true },
  });
  console.log(`humanChecked=true (tagSource=human): ${humanResult.count} 件`);

  // 2) 派生タグが1つでもある作品を aiAnalyzed = true に（未設定または false のものだけ）
  const withDerived = await prisma.work.findMany({
    where: {
      ...baseWhere,
      workTags: { some: { tag: { tagType: 'DERIVED' } } },
      OR: [{ aiAnalyzed: null }, { aiAnalyzed: false }],
    },
    select: { workId: true },
  });
  const workIdsWithDerived = withDerived.map((w) => w.workId);
  if (workIdsWithDerived.length > 0) {
    const aiResult = await prisma.work.updateMany({
      where: { workId: { in: workIdsWithDerived } },
      data: { aiAnalyzed: true },
    });
    console.log(`aiAnalyzed=true (DERIVED あり): ${aiResult.count} 件`);
  } else {
    console.log('aiAnalyzed=true (DERIVED あり): 0 件（更新対象なし）');
  }

  console.log('backfill 完了。タブ件数を再読み込みしてください。');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
