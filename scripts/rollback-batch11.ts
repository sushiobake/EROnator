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
        where: { workId },
        include: { workTags: { include: { tag: true } } }
      });

      if (!work) {
        console.log(`⚠ ${workId}: 作品が見つかりません`);
        continue;
      }

      // Get tagKeys to delete (DERIVED only)
      const derivedTagKeys = work.workTags
        .filter((wt) => wt.tag?.tagType === 'DERIVED')
        .map((wt) => wt.tagKey);

      // Disconnect tags
      if (derivedTagKeys.length > 0) {
        await prisma.work.update({
          where: { workId },
          data: {
            workTags: {
              disconnect: derivedTagKeys.map((tagKey) => ({ workId_tagKey: { workId, tagKey } }))
            }
          }
        });
      }

      // Reset aiAnalyzed and checkQueueAt
      await prisma.work.update({
        where: { workId },
        data: {
          aiAnalyzed: false,
          checkQueueAt: null,
          updatedAt: new Date()
        }
      });

      console.log(`✅ ${workId}: ロールバック完了（DERIVED タグ数: ${derivedTagKeys.length}）`);
    } catch (e: any) {
      console.log(`❌ ${workId}: エラー - ${e.message}`);
    }
  }

  await prisma.$disconnect();
  console.log(`\n✨ ロールバック完了\n`);
}

rollback();
