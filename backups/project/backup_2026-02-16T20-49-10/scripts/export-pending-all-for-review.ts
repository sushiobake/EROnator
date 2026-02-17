#!/usr/bin/env tsx
/**
 * チェック待ちの残り全件を、レビュー用に workId / title / タグ・キャラ 付きで export する
 * Usage: npx tsx scripts/export-pending-all-for-review.ts
 * Output: data/chatgpt-export/pending-all-for-review.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<Array<{ workId: string }>>`
    SELECT workId FROM Work
    WHERE commentText IS NOT NULL AND (needsReview = 0 OR needsReview IS NULL)
      AND aiAnalyzed = 1 AND (humanChecked = 0 OR humanChecked IS NULL)
      AND (tagSource IS NULL OR tagSource != 'human')
    ORDER BY checkQueueAt DESC NULLS LAST, updatedAt DESC
  `;
  const workIds = rows.map((r) => r.workId);
  if (workIds.length === 0) {
    console.log('チェック待ちは0件です。');
    process.exit(0);
  }

  const works = await prisma.work.findMany({
    where: { workId: { in: workIds } },
    select: {
      workId: true,
      title: true,
      workTags: {
        select: {
          tag: {
            select: {
              displayName: true,
              tagType: true,
              category: true,
            },
          },
        },
      },
    },
  });

  const idToOrder = new Map(workIds.map((id, i) => [id, i]));
  works.sort((a, b) => (idToOrder.get(a.workId) ?? 999) - (idToOrder.get(b.workId) ?? 999));

  const out = works.map((w) => {
    const derived = w.workTags
      .filter((wt) => wt.tag.tagType === 'DERIVED')
      .map((wt) => wt.tag.displayName);
    const official = w.workTags
      .filter((wt) => wt.tag.tagType === 'OFFICIAL')
      .map((wt) => wt.tag.displayName);
    const character = w.workTags
      .filter((wt) => wt.tag.tagType === 'STRUCTURAL' && wt.tag.category === 'キャラクター')
      .map((wt) => wt.tag.displayName);
    return {
      workId: w.workId,
      title: w.title,
      derivedTags: derived,
      officialTags: official,
      characterName: character[0] ?? null,
    };
  });

  const outPath = path.join(process.cwd(), 'data', 'chatgpt-export', 'pending-all-for-review.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
  console.log(JSON.stringify({ success: true, count: out.length, path: outPath }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
