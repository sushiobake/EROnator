/**
 * 指定 workId の作品から DERIVED タグのみ削除する（WorkTag と孤立した Tag）
 * 使用例: npx tsx scripts/remove-derived-tags-for-works.ts cid:d_717499 d_721017 d_511775 d_722307 d_713210
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workIds = process.argv.slice(2).filter(Boolean);
  if (workIds.length === 0) {
    console.log('Usage: npx tsx scripts/remove-derived-tags-for-works.ts <workId> [workId ...]');
    process.exit(1);
  }

  console.log('🗑️ 指定作品の DERIVED タグを削除します:', workIds);

  let totalRemoved = 0;
  for (const workId of workIds) {
    const work = await prisma.work.findUnique({ where: { workId } });
    if (!work) {
      console.log(`  ⚠️ 作品が見つかりません: ${workId}`);
      continue;
    }

    const workTags = await prisma.workTag.findMany({
      where: { workId },
      include: { tag: true },
    });

    const derived = workTags.filter((wt) => wt.tag.tagType === 'DERIVED');
    const derivedTagKeys = derived.map((wt) => wt.tagKey);

    if (derivedTagKeys.length > 0) {
      await prisma.workTag.deleteMany({
        where: { workId, tagKey: { in: derivedTagKeys } },
      });
      totalRemoved += derivedTagKeys.length;
      console.log(`  ✓ ${workId}: ${derivedTagKeys.length} 個の DERIVED タグを削除`);
    } else {
      console.log(`  - ${workId}: DERIVED タグなし（スキップ）`);
    }
  }

  console.log('✅ 削除完了（WorkTag のみ。孤立 Tag の削除は未実装）');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
