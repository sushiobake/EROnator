#!/usr/bin/env tsx
/**
 * 出題プール件数の確認（読み取り専用）
 * 実行: npx tsx src/quiz-prototype/check-pool.ts
 */

import { prisma } from '../lib/prisma';
import { getQuizPool } from './pool/selectWorks';

async function main() {
  const result = await getQuizPool(prisma, { refresh: true });
  console.log('\n[quiz-prototype] 出題プール統計\n');
  console.log(`  候補総数: ${result.summary.totalCandidates}`);
  console.log(`  選定総数: ${result.summary.totalSelected}`);
  console.log(`  有名: ${result.summary.famousCount}`);
  console.log(`  中堅: ${result.summary.midCount}`);
  console.log(`  マイナー: ${result.summary.minorCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
