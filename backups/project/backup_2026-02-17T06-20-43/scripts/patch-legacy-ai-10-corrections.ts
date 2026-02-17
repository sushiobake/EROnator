#!/usr/bin/env tsx
/**
 * 旧AI10件へのユーザー添削を反映
 * - #3 まろん: 母乳を追加S
 * - #4 月曜彼女: 盗撮・露出・カップル削除 → オリジナル＋キーワード（セーラー服,めがね,ビッチ,タイツ,アナル）を追加S
 * - #5 孕ませ屋: 人妻削除
 * - #6 おしかけ: 借金削除
 * - #9 文学女子: 初恋削除
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { resolveTagKeyForDisplayName, resolveOfficialTagKeyByDisplayName } from '../src/server/admin/resolveTagByDisplayName';

const prisma = new PrismaClient();

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `tag_${hash}`;
}

async function addAdditionalS(workId: string, displayName: string): Promise<boolean> {
  const tagKey = await resolveOfficialTagKeyByDisplayName(prisma, displayName);
  if (!tagKey) {
    console.warn(`  [skip] OFFICIAL tag not found: ${displayName}`);
    return false;
  }
  await prisma.workTag.upsert({
    where: { workId_tagKey: { workId, tagKey } },
    create: { workId, tagKey, derivedSource: 'additionalS', derivedConfidence: 0.9 },
    update: { derivedSource: 'additionalS', derivedConfidence: 0.9 },
  });
  return true;
}

async function removeTagFromWork(workId: string, displayName: string): Promise<boolean> {
  const tag = await prisma.tag.findFirst({
    where: { displayName: displayName.trim(), tagType: { in: ['DERIVED', 'OFFICIAL'] } },
  });
  if (!tag) return false;
  const deleted = await prisma.workTag.deleteMany({
    where: { workId, tagKey: tag.tagKey },
  });
  return deleted.count > 0;
}

async function addMatchedTag(workId: string, displayName: string): Promise<void> {
  let tagKey = await resolveTagKeyForDisplayName(prisma, displayName);
  let tag = tagKey ? await prisma.tag.findUnique({ where: { tagKey } }) : null;
  if (!tag) {
    tagKey = generateTagKey(displayName);
    tag = await prisma.tag.create({
      data: { tagKey, displayName, tagType: 'DERIVED', category: 'その他' },
    });
  } else {
    tagKey = tag.tagKey;
  }
  await prisma.workTag.upsert({
    where: { workId_tagKey: { workId, tagKey } },
    create: { workId, tagKey, derivedSource: 'manual-matched', derivedConfidence: 1.0 },
    update: { derivedSource: 'manual-matched', derivedConfidence: 1.0 },
  });
}

async function main() {
  let patchCount = 0;

  // #3 まろん: 母乳を追加S
  console.log('#3 まろん: 母乳を追加S');
  if (await addAdditionalS('d_219615', '母乳')) patchCount++;

  // #4 月曜彼女: 盗撮・露出・カップル削除 → オリジナル＋キーワード追加S
  console.log('#4 月曜彼女: やり直し');
  for (const name of ['盗撮', '露出', 'カップル']) {
    if (await removeTagFromWork('d_219198', name)) patchCount++;
  }
  await addMatchedTag('d_219198', 'オリジナル');
  patchCount++;
  for (const name of ['セーラー服', 'めがね', 'ビッチ', 'タイツ', 'アナル']) {
    if (await addAdditionalS('d_219198', name)) patchCount++;
  }

  // #5 孕ませ屋: 人妻削除
  console.log('#5 孕ませ屋: 人妻削除');
  if (await removeTagFromWork('d_200670', '人妻')) patchCount++;

  // #6 おしかけ: 借金削除
  console.log('#6 おしかけ: 借金削除');
  if (await removeTagFromWork('d_177026', '借金')) patchCount++;

  // #9 文学女子: 初恋削除
  console.log('#9 文学女子: 初恋削除');
  if (await removeTagFromWork('d_150811', '初恋')) patchCount++;

  // #4: checkQueueAt 更新（ユーザーが人間チェックするので先頭に残す）
  const now = new Date();
  await prisma.$executeRawUnsafe(
    'UPDATE Work SET checkQueueAt = ? WHERE workId = ?',
    now.toISOString(),
    'd_219198'
  );

  console.log(JSON.stringify({ success: true, patches: patchCount }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
