#!/usr/bin/env tsx
/**
 * batch16 品質確認後の修正
 * - d_303553: matchedTags の「彼氏あり」（曖昧タグ）を削除
 *
 * Usage: npx tsx scripts/patch-batch16-corrections.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeTagFromWork(workId: string, displayName: string): Promise<boolean> {
  const tag = await prisma.tag.findFirst({
    where: { displayName: displayName.trim(), tagType: { in: ['DERIVED', 'OFFICIAL'] } },
  });
  if (!tag) {
    console.warn(`  [skip] tag not found: ${displayName}`);
    return false;
  }
  const deleted = await prisma.workTag.deleteMany({
    where: { workId, tagKey: tag.tagKey },
  });
  return deleted.count > 0;
}

async function main() {
  console.log('batch16 修正: d_303553 から「彼氏あり」を削除（曖昧タグ）');
  if (await removeTagFromWork('d_303553', '彼氏あり')) {
    console.log('  削除完了');
  } else {
    console.log('  該当なし or 既に削除済み');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
