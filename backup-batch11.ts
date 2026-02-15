import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backup() {
  const workIds = [
    'cid:d_177976',
    'cid:d_168242',
    'd_711382',
    'd_177445',
    'd_203685'
  ];

  console.log(`\n💾 バックアップ開始: ${workIds.length}件\n`);

  const backup: Record<string, any> = {};

  for (const workId of workIds) {
    const work = await prisma.work.findUnique({
      where: { workId },
      include: {
        workTags: {
          include: { tag: true },
          orderBy: { tagKey: 'asc' }
        }
      }
    });

    if (!work) {
      console.log(`⚠ ${workId}: 見つかりません`);
      continue;
    }

    backup[workId] = {
      workId: work.workId,
      title: work.title,
      aiAnalyzed: work.aiAnalyzed,
      checkQueueAt: work.checkQueueAt,
      workTags: work.workTags.map(wt => ({
        tagKey: wt.tagKey,
        displayName: wt.tag.displayName,
        tagType: wt.tag.tagType,
        derivedSource: wt.derivedSource,
        derivedConfidence: wt.derivedConfidence
      }))
    };

    console.log(`✓ ${workId}: ${work.workTags.length}個のタグをバックアップ`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `batch11-backup-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'data', 'chatgpt-export', filename);

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

  console.log(`\n✨ バックアップ完了: ${filename}`);
  console.log(`   パス: data/chatgpt-export/${filename}`);
}

backup()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
