import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function rollback() {
  // WorkIds to rollback
  const workIds = [
    'cid:d_177976',
    'cid:d_168242',
    'd_711382',
    'd_177445',
    'd_203685'
  ];

  console.log(`\n🔄 ロールバック開始: ${workIds.length}件\n`);

  for (const workId of workIds) {
    try {
      // Find the work
      const work = await prisma.work.findUnique({
        where: { id: workId },
        include: { workTags: true }
      });

      if (!work) {
        console.log(`⚠ ${workId}: 作品が見つかりません`);
        continue;
      }

      // Get tag IDs to delete (DERIVED only)
      const derivedTagIds = work.workTags
        .filter((wt: any) => wt.tag?.tagType === 'DERIVED')
        .map((wt: any) => wt.tagId);

      // Disconnect tags
      if (derivedTagIds.length > 0) {
        await prisma.work.update({
          where: { id: workId },
          data: {
            workTags: {
              disconnect: derivedTagIds.map(tagId => ({ workId_tagId: { workId, tagId } }))
            }
          }
        });
      }

      // Reset aiAnalyzed and checkQueueAt
      await prisma.work.update({
        where: { id: workId },
        data: {
          aiAnalyzed: false,
          checkQueueAt: null,
          updatedAt: new Date()
        }
      });

      console.log(`✅ ${workId}: ロールバック完了（DERIVED タグ数: ${derivedTagIds.length}）`);
    } catch (e: any) {
      console.log(`❌ ${workId}: エラー - ${e.message}`);
    }
  }

  await prisma.$disconnect();
  console.log(`\n✨ ロールバック完了\n`);
}

rollback();
