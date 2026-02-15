import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function rollback() {
  const importData = JSON.parse(
    fs.readFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch12.json', 'utf-8')
  );

  const workIds = importData.map((item: any) => item.workId);
  
  console.log(`\n🔄 ロールバック: ${workIds.length}件\n`);

  const works = await prisma.work.findMany({
    where: { workId: { in: workIds } },
    include: {
      workTags: {
        include: { tag: true }
      }
    }
  });

  for (const work of works) {
    // Get tags added by batch12
    const derivedTags = work.workTags.filter(wt => wt.tag.tagType === 'DERIVED' && wt.derivedSource !== 'manual');
    const structuralTags = work.workTags.filter(wt => wt.tag.tagType === 'STRUCTURAL');

    if (derivedTags.length > 0) {
      await prisma.workTag.deleteMany({
        where: {
          workId: work.workId,
          tagKey: { in: derivedTags.map(wt => wt.tagKey) }
        }
      });
    }

    if (structuralTags.length > 0) {
      await prisma.workTag.deleteMany({
        where: {
          workId: work.workId,
          tagKey: { in: structuralTags.map(wt => wt.tagKey) }
        }
      });
    }

    await prisma.work.update({
      where: { workId: work.workId },
      data: {
        aiAnalyzed: false,
        checkQueueAt: null,
        updatedAt: new Date()
      }
    });

    console.log(`✓ ${work.workId}: ロールバック完了`);
  }

  await prisma.$disconnect();
  console.log(`\n✨ ロールバック完了\n`);
}

rollback().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
