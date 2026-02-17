#!/usr/bin/env tsx
/**
 * 同一タイトル＋作者の作品を1本にまとめる（重複解消）
 *
 * - タイトル・authorName が同じ Work をグループ化
 * - 各グループで「代表」1件を決め、他は代表に WorkTag を移してから削除
 *
 * 使い方:
 *   npx tsx scripts/deduplicate-works-by-title.ts        # ドライラン（削除しない）
 *   npx tsx scripts/deduplicate-works-by-title.ts --run # 実行（削除する）
 *
 * 環境変数: DATABASE_URL（.env から読み込み）
 */

import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes('--run');

function pickCanonical(works: { workId: string; gameRegistered: boolean | null }[]): string {
  const withGame = works.find(w => w.gameRegistered === true);
  if (withGame) return withGame.workId;
  return works.map(w => w.workId).sort()[0];
}

async function main() {
  console.log(DRY_RUN ? '🔍 ドライラン（--run を付けると実際に削除します）\n' : '▶ 実行モード\n');

  const all = await prisma.work.findMany({
    select: { workId: true, title: true, authorName: true, gameRegistered: true },
  });

  const key = (w: { title: string; authorName: string }) => `${(w.title ?? '').trim()}\t${(w.authorName ?? '').trim()}`;
  const groups = new Map<string, typeof all>();
  for (const w of all) {
    const k = key(w);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  }

  const duplicateGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
  if (duplicateGroups.length === 0) {
    console.log('重複グループはありません。');
    return;
  }

  console.log(`重複グループ: ${duplicateGroups.length} 件\n`);

  let mergedCount = 0;
  let deletedCount = 0;

  for (const [titleAuthor, works] of duplicateGroups) {
    const [title, authorName] = titleAuthor.split('\t');
    const canonicalWorkId = pickCanonical(works);
    const duplicates = works.filter(w => w.workId !== canonicalWorkId);

    console.log(`「${title.slice(0, 40)}${title.length > 40 ? '…' : ''}」 (${authorName})`);
    console.log(`  代表: ${canonicalWorkId}`);
    for (const d of duplicates) {
      console.log(`  重複: ${d.workId}`);
    }

    if (DRY_RUN) {
      mergedCount += duplicates.length;
      continue;
    }

    for (const dup of duplicates) {
      const tags = await prisma.workTag.findMany({
        where: { workId: dup.workId },
        select: { tagKey: true, derivedConfidence: true, derivedSource: true },
      });
      for (const wt of tags) {
        await prisma.workTag.upsert({
          where: { workId_tagKey: { workId: canonicalWorkId, tagKey: wt.tagKey } },
          update: {},
          create: {
            workId: canonicalWorkId,
            tagKey: wt.tagKey,
            derivedConfidence: wt.derivedConfidence ?? undefined,
            derivedSource: wt.derivedSource ?? undefined,
          },
        });
      }
      await prisma.work.delete({ where: { workId: dup.workId } });
      deletedCount++;
      mergedCount++;
    }
  }

  console.log(DRY_RUN ? `\nドライラン: ${duplicateGroups.length} グループ・${mergedCount} 件を代表にまとめると削除されます。実行するには --run を付けてください。` : `\n完了: ${deletedCount} 件の重複 Work を削除し、代表にタグを統合しました。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
