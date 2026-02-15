import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workIds = [
    'd_607719', 'd_645601', 'd_705785', 'd_709480', 'd_709714',
    'd_717438', 'd_719384', 'd_721017', 'd_721263', 'd_722925', 'd_725363'
  ];
  
  console.log('🗑️ テスト作品のDERIVEDタグを削除中...');
  
  // 各作品のDERIVEDタグを削除
  for (const workId of workIds) {
    const work = await prisma.work.findUnique({ where: { workId } });
    if (!work) {
      console.log(`  ⚠️ 作品が見つかりません: ${workId}`);
      continue;
    }
    
    const workTags = await prisma.workTag.findMany({
      where: { workId },
      include: { tag: true }
    });
    
    const derivedTagKeys = workTags
      .filter(wt => wt.tag.tagType === 'DERIVED')
      .map(wt => wt.tagKey);
    
    if (derivedTagKeys.length > 0) {
      await prisma.workTag.deleteMany({
        where: {
          workId,
          tagKey: { in: derivedTagKeys }
        }
      });
      console.log(`  ✓ ${workId}: ${derivedTagKeys.length}個のタグを削除`);
    }
  }
  
  console.log('✅ 削除完了');
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
