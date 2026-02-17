#!/usr/bin/env tsx
/**
 * チェック待ちのうち「キャラクタータグ（STRUCTURAL・キャラクター）が付いている作品」を
 * チェック済みに戻す。＝ GPT がちゃんとやった最初の50件相当をチェック済みのままにする。
 * Usage: npx tsx scripts/mark-char-tag-works-checked.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 現在チェック待ち（unmark で戻した438件）のうち、キャラタグが1つでも付いている作品
  const withCharTag = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      aiAnalyzed: true,
      humanChecked: false,
      AND: [
        { OR: [{ needsReview: false }, { needsReview: null }] },
        { OR: [{ tagSource: null }, { tagSource: { not: 'human' } }] },
      ],
      workTags: {
        some: {
          tag: {
            tagType: 'STRUCTURAL',
            category: 'キャラクター',
          },
        },
      },
    },
    select: { workId: true, title: true },
  });

  const workIds = withCharTag.map((w) => w.workId);
  if (workIds.length === 0) {
    console.log(
      JSON.stringify({
        success: true,
        count: 0,
        message: 'チェック待ちのうちキャラタグ付き作品は0件でした。',
      })
    );
    return;
  }

  const result = await prisma.work.updateMany({
    where: { workId: { in: workIds } },
    data: { humanChecked: true },
  });

  console.log(
    JSON.stringify({
      success: true,
      count: result.count,
      message: `キャラタグ付き ${result.count} 件をチェック済み（humanChecked: true）にしました。`,
    })
  );
  if (withCharTag.length <= 20) {
    console.log('workIds: ' + workIds.join(', '));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
