#!/usr/bin/env tsx
/** 1作品に Aタグ「シリーズもの」を追加 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveTagKeyForDisplayName } from '../src/server/admin/resolveTagByDisplayName';

const prisma = new PrismaClient();
const workId = 'd_614856';
const displayName = 'シリーズもの';
const rank = 'A';

function generateTagKey(name: string, type: 'DERIVED' | 'STRUCTURAL'): string {
  const h = crypto.createHash('sha1').update(name, 'utf8').digest('hex').substring(0, 10);
  return type === 'STRUCTURAL' ? `char_${h}` : `tag_${h}`;
}

async function addTagToRanks(name: string, r: string): Promise<void> {
  const fullPath = path.join(process.cwd(), 'config/tagRanks.json');
  let data: { ranks?: Record<string, string> } = {};
  try {
    data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  } catch {
    data = { ranks: {} };
  }
  data.ranks = data.ranks || {};
  if (!(name in data.ranks)) {
    data.ranks[name] = r;
    (data as { updatedAt?: string }).updatedAt = new Date().toISOString();
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

async function main() {
  let tagKey = await resolveTagKeyForDisplayName(prisma, displayName);
  if (!tagKey) {
    tagKey = generateTagKey(displayName, 'DERIVED');
    await prisma.tag.create({
      data: {
        tagKey,
        displayName: displayName.trim(),
        tagType: 'DERIVED',
        category: 'その他',
        questionTemplate: `「${displayName}」が登場しますか？`,
      },
    });
    await addTagToRanks(displayName, rank);
  }
  await prisma.workTag.upsert({
    where: { workId_tagKey: { workId, tagKey } },
    create: { workId, tagKey, derivedConfidence: 0.9, derivedSource: 'manual' },
    update: { derivedConfidence: 0.9, derivedSource: 'manual' },
  });
  console.log('ok: added シリーズもの to', workId);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
