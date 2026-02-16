#!/usr/bin/env tsx
/**
 * displayName が重複しているタグ（OFFICIAL と DERIVED の混在含む）を統合する
 * - 同一 displayName で複数 tagKey がある場合、正規タグを 1 本に決め、他は「統合」（WorkTag を付け替えてから削除）
 * - 正規の優先: OFFICIAL > DERIVED。OFFICIAL が複数なら off_* 優先、それ以外は WorkTag 数が最多のもの
 * - 既に同じ workId に正規 tagKey が付いている場合は重複 WorkTag のみ削除
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-tags-by-display-name.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function norm(s: string): string {
  return (s || '').trim().normalize('NFC');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const tags = await prisma.tag.findMany({
    where: { tagType: { in: ['OFFICIAL', 'DERIVED'] } },
    select: { tagKey: true, displayName: true, tagType: true, category: true },
  });

  const byName = new Map<
    string,
    Array<{ tagKey: string; tagType: string; category: string | null }>
  >();
  for (const t of tags) {
    const k = norm(t.displayName);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push({ tagKey: t.tagKey, tagType: t.tagType, category: t.category });
  }

  const dups = Array.from(byName.entries()).filter(([, arr]) => arr.length > 1);
  if (dups.length === 0) {
    console.log('displayName の重複はありません（OFFICIAL/DERIVED 内）。');
    return;
  }

  console.log(`重複 displayName 数: ${dups.length}`);
  if (dryRun) console.log('--dry-run: 変更は行いません\n');

  let workTagsMoved = 0;
  let workTagsRemoved = 0;
  let tagsDeleted = 0;

  for (const [displayName, tagList] of dups) {
    const withCount = await Promise.all(
      tagList.map(async (t) => ({
        ...t,
        workTagCount: await prisma.workTag.count({ where: { tagKey: t.tagKey } }),
      }))
    );

    // 正規: OFFICIAL を優先。複数あれば off_ を優先、なければ WorkTag 数が最多
    const officials = withCount.filter((t) => t.tagType === 'OFFICIAL');
    const derivedOnly = withCount.filter((t) => t.tagType === 'DERIVED');

    const canonical =
      (officials.length > 0
        ? officials.find((t) => t.tagKey.startsWith('off_')) ||
          officials.reduce((a, b) => (a.workTagCount >= b.workTagCount ? a : b))
        : null) ??
      (derivedOnly.length > 0
        ? derivedOnly.reduce((a, b) => (a.workTagCount >= b.workTagCount ? a : b))
        : withCount[0]);

    const others = withCount.filter((t) => t.tagKey !== canonical.tagKey);
    if (others.length === 0) continue;

    if (dryRun) {
      console.log(`[${displayName}] 正規: ${canonical.tagKey} (${canonical.tagType})`);
      for (const o of others) {
        console.log(`  → 統合対象: ${o.tagKey} (${o.tagType}) WorkTags: ${o.workTagCount}`);
      }
      continue;
    }

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
          await prisma.workTag.delete({
            where: {
              workId_tagKey: { workId: wt.workId, tagKey: other.tagKey },
            },
          });
          workTagsRemoved++;
        } else {
          await prisma.workTag.delete({
            where: {
              workId_tagKey: { workId: wt.workId, tagKey: other.tagKey },
            },
          });
          await prisma.workTag.create({
            data: { workId: wt.workId, tagKey: canonical.tagKey },
          });
          workTagsMoved++;
        }
      }

      await prisma.workTag.deleteMany({ where: { tagKey: other.tagKey } });
      await prisma.tag.delete({ where: { tagKey: other.tagKey } });
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
