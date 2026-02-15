import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function rollback() {
  const importData = JSON.parse(
    fs.readFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch11.json', 'utf-8')
  );

  const workIds = importData.map((item: any) => item.workId);
  
  console.log(`\n🔄 ロールバック開始: ${workIds.length}件`);
  console.log(`WorkIds: ${workIds.join(', ')}\n`);

  // Find works using workId field
  const works = await prisma.work.findMany({
    where: { workId: { in: workIds } },
    include: { workTags: { include: { tag: true } } }
  });

  console.log(`データベースで見つかった作品: ${works.length}件\n`);

  for (const work of works) {
    console.log(`処理中: ${work.workId}`);

    // Get DERIVED tags
    const derivedTags = work.workTags.filter(wt => wt.tag.tagType === 'DERIVED');
    const structuralTags = work.workTags.filter(wt => wt.tag.tagType === 'STRUCTURAL');
    const additionalSTags = work.workTags.filter(wt => wt.derivedSource === 'additionalS');

    console.log(`  - DERIVED: ${derivedTags.length}個`);
    console.log(`  - STRUCTURAL: ${structuralTags.length}個`);
    console.log(`  - additionalS: ${additionalSTags.length}個`);

    // Delete DERIVED tags
    if (derivedTags.length > 0) {
      const tagKeysToDelete = derivedTags.map(wt => wt.tagKey);
      await prisma.workTag.deleteMany({
        where: {
          workId: work.workId,
          tagKey: { in: tagKeysToDelete }
        }
      });
      console.log(`  ✓ DERIVED ${tagKeysToDelete.length}個を削除`);
    }

    // Delete STRUCTURAL tags  
    if (structuralTags.length > 0) {
      const tagKeysToDelete = structuralTags.map(wt => wt.tagKey);
      await prisma.workTag.deleteMany({
        where: {
          workId: work.workId,
          tagKey: { in: tagKeysToDelete }
        }
      });
      console.log(`  ✓ STRUCTURAL ${tagKeysToDelete.length}個を削除`);
    }

    // Delete additionalS tags
    if (additionalSTags.length > 0) {
      const tagKeysToDelete = additionalSTags.map(wt => wt.tagKey);
      await prisma.workTag.deleteMany({
        where: {
          workId: work.workId,
          tagKey: { in: tagKeysToDelete }
        }
      });
      console.log(`  ✓ additionalS ${tagKeysToDelete.length}個を削除`);
    }

    // Reset aiAnalyzed and checkQueueAt
    await prisma.work.update({
      where: { workId: work.workId },
      data: {
        aiAnalyzed: false,
        checkQueueAt: null,
        updatedAt: new Date()
      }
    });
    console.log(`  ✓ aiAnalyzed=false, checkQueueAt=null に更新`);
    console.log();
  }

  await prisma.$disconnect();
  console.log(`✨ ロールバック完了\n`);
}

rollback().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
