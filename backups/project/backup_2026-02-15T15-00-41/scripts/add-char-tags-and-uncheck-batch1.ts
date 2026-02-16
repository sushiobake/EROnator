#!/usr/bin/env tsx
/**
 * 1. 第1批10件: humanChecked=false, tagSource='ai' で人間チェックを外す
 * 2. 全20件: characterName があれば STRUCTURAL タグを追加
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const BATCH1 = ['d_623317','d_150811','d_161054','d_172858','d_177026','d_200670','d_219198','d_219615','d_242308','d_251200'];

const prisma = new PrismaClient();

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `char_${hash}`;
}

interface Item {
  workId: string;
  characterName?: string | null;
}

async function main() {
  const batch1Path = path.join(process.cwd(), 'data', 'chatgpt-export', 'cursor-analysis-legacy-ai-10.json');
  const batch2Path = path.join(process.cwd(), 'data', 'chatgpt-export', 'cursor-analysis-legacy-ai-10-batch2.json');
  const batch1: Item[] = JSON.parse(fs.readFileSync(batch1Path, 'utf-8'));
  const batch2: Item[] = JSON.parse(fs.readFileSync(batch2Path, 'utf-8'));
  const all: Item[] = [...batch1, ...batch2];

  // 1. 第1批: 人間チェックを外す
  await prisma.work.updateMany({
    where: { workId: { in: BATCH1 } },
    data: { humanChecked: false, tagSource: 'ai' },
  });
  console.log('Unchecked batch1 (humanChecked=false, tagSource=ai)');

  // 2. キャラタグ追加
  let charCount = 0;
  for (const item of all) {
    const name = item.characterName?.trim();
    if (!name || name.length < 2) continue;

    let charTag = await prisma.tag.findFirst({
      where: { displayName: name, tagType: 'STRUCTURAL' },
    });
    if (!charTag) {
      const tagKey = generateTagKey(name);
      charTag = await prisma.tag.create({
        data: {
          tagKey,
          displayName: name,
          tagType: 'STRUCTURAL',
          category: 'キャラクター',
        },
      });
      charCount++;
    }

    await prisma.workTag.upsert({
      where: { workId_tagKey: { workId: item.workId, tagKey: charTag.tagKey } },
      create: { workId: item.workId, tagKey: charTag.tagKey },
      update: {},
    });
    console.log(`  ${item.workId}: ${name}`);
  }

  console.log(JSON.stringify({ success: true, unchecked: BATCH1.length, characterTagsAdded: all.filter((x) => x.characterName?.trim()).length, newTags: charCount }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
