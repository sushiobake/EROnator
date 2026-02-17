#!/usr/bin/env tsx
/**
 * 1作品にキャラクタータグ（STRUCTURAL・キャラクター）を1つ追加する
 * Usage: npx tsx scripts/add-character-tag-single.ts <workId> <characterDisplayName>
 * Example: npx tsx scripts/add-character-tag-single.ts d_514928 詩鶴
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `tag_${hash}`;
}

async function main() {
  const workId = process.argv[2];
  const charName = process.argv[3]?.trim();
  if (!workId || !charName) {
    console.error('Usage: npx tsx scripts/add-character-tag-single.ts <workId> <characterDisplayName>');
    process.exit(1);
  }

  let work = await prisma.work.findUnique({ where: { workId } });
  if (!work && workId.startsWith('cid:')) {
    work = await prisma.work.findUnique({ where: { workId: workId.replace(/^cid:/, '') } });
  } else if (!work) {
    work = await prisma.work.findUnique({ where: { workId: 'cid:' + workId } });
  }
  if (!work) {
    console.error('Work not found:', workId);
    process.exit(1);
  }
  const actualWorkId = work.workId;

  let charTag = await prisma.tag.findFirst({
    where: { displayName: charName, tagType: 'STRUCTURAL' },
  });
  if (!charTag) {
    const charTagKey = generateTagKey(charName);
    charTag = await prisma.tag.create({
      data: {
        tagKey: charTagKey,
        displayName: charName,
        tagType: 'STRUCTURAL',
        category: 'キャラクター',
      },
    });
  }

  await prisma.workTag.upsert({
    where: {
      workId_tagKey: { workId: actualWorkId, tagKey: charTag.tagKey },
    },
    create: { workId: actualWorkId, tagKey: charTag.tagKey },
    update: {},
  });

  console.log(JSON.stringify({ success: true, workId: actualWorkId, characterName: charName, tagKey: charTag.tagKey }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
