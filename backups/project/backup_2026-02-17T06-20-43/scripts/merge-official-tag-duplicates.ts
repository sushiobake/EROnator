#!/usr/bin/env tsx
/**
 * OFFICIALタグの重複を統合する
 * - 同一 displayName で複数 tagKey がある場合、正規は off_*（DMMインポート標準）とする
 * - 他系統（fanza_01_ 等）の WorkTag を off_ 側に付け替え、空になった Tag を削除
 * - 既に同じ workId に正規 tagKey が付いている場合は重複 WorkTag のみ削除
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function norm(s: string): string {
  return (s || '').trim().normalize('NFC');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const tags = await prisma.tag.findMany({
    where: { tagType: 'OFFICIAL' },
    select: { tagKey: true, displayName: true, category: true },
  });

  const byName = new Map<string, Array<{ tagKey: string; category: string | null }>>();
  for (const t of tags) {
    const k = norm(t.displayName);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push({ tagKey: t.tagKey, category: t.category });
  }

  const dups = Array.from(byName.entries()).filter(([, arr]) => arr.length > 1);
  if (dups.length === 0) {
    console.log('重複なし');
    return;
  }

  console.log(`OFFICIAL重複 displayName 数: ${dups.length}`);
  if (dryRun) console.log('--dry-run: 変更は行いません\n');

  let workTagsMoved = 0;
  let workTagsRemoved = 0;
  let tagsDeleted = 0;

  for (const [displayName, tagList] of dups) {
    // 正規: off_ があればそれ、なければ WorkTag 数が最多のものを残す
    const withCount = await Promise.all(
      tagList.map(async (t) => ({
        ...t,
        workTagCount: await prisma.workTag.count({ where: { tagKey: t.tagKey } }),
      }))
    );

    const offTag = withCount.find((t) => t.tagKey.startsWith('off_'));
    const canonical =
      offTag ||
      withCount.reduce((a, b) => (a.workTagCount >= b.workTagCount ? a : b));
    const others = withCount.filter((t) => t.tagKey !== canonical.tagKey);

    for (const other of others) {
      const wts = await prisma.workTag.findMany({
        where: { tagKey: other.tagKey },
        select: { workId: true },
      });

      for (const wt of wts) {
        const existing = await prisma.workTag.findUnique({
          where: {
            workId_tagKey: { workId: wt.workId, tagKey: canonical.tagKey },
          },
        });
        if (existing) {
          if (!dryRun) {
            await prisma.workTag.delete({
              where: {
                workId_tagKey: { workId: wt.workId, tagKey: other.tagKey },
              },
            });
          }
          workTagsRemoved++;
        } else {
          if (!dryRun) {
            await prisma.workTag.delete({
              where: {
                workId_tagKey: { workId: wt.workId, tagKey: other.tagKey },
              },
            });
            await prisma.workTag.create({
              data: { workId: wt.workId, tagKey: canonical.tagKey },
            });
          }
          workTagsMoved++;
        }
      }

      if (!dryRun) {
        await prisma.workTag.deleteMany({ where: { tagKey: other.tagKey } });
        await prisma.tag.delete({ where: { tagKey: other.tagKey } });
      }
      tagsDeleted++;
    }
  }

  console.log(`WorkTag 付け替え: ${workTagsMoved}`);
  console.log(`WorkTag 重複削除: ${workTagsRemoved}`);
  console.log(`削除した Tag: ${tagsDeleted}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
