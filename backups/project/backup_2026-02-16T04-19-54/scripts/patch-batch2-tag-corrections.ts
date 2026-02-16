#!/usr/bin/env tsx
/**
 * 第2批のタグ修正を反映
 * - レべチなスワッピング2: セックスレス削除 → 妊活追加
 * - クールな先輩: 彼女あり削除
 * - 女学寮に誘われて: 逆レイプ削除 → バイ,百合を追加S
 * - ハーレムシェアハウス: Ｗフェラ,オールハッピーを追加S
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

  // レべチなスワッピング2: セックスレス削除 → 妊活追加
  console.log('レべチなスワッピング2: セックスレス削除、妊活追加');
  if (await removeTagFromWork('d_419480', 'セックスレス')) patchCount++;
  await addMatchedTag('d_419480', '妊活');
  patchCount++;

  // クールな先輩: 彼女あり削除
  console.log('クールな先輩: 彼女あり削除');
  if (await removeTagFromWork('d_419023', '彼女あり')) patchCount++;

  // 女学寮に誘われて: 逆レイプ削除 → バイ,百合を追加S
  console.log('女学寮に誘われて: 逆レイプ削除、バイ・百合追加S');
  if (await removeTagFromWork('d_362817', '逆レイプ')) patchCount++;
  if (await addAdditionalS('d_362817', 'バイ')) patchCount++;
  if (await addAdditionalS('d_362817', '百合')) patchCount++;

  // ハーレムシェアハウス: Ｗフェラ,オールハッピーを追加S
  console.log('ハーレムシェアハウス: Ｗフェラ・オールハッピー追加S');
  if (await addAdditionalS('d_284892', 'Ｗフェラ')) patchCount++;
  if (await addAdditionalS('d_284892', 'オールハッピー')) patchCount++;

  console.log(JSON.stringify({ success: true, patches: patchCount }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
