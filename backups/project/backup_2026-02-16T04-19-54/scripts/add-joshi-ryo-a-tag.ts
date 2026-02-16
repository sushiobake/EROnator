#!/usr/bin/env tsx
/** 作品 d_448999「女子寮管理人の僕はギャル寮生に振り回されてます4」に Aタグ「女子寮」を付与 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveTagKeyForDisplayName } from '../src/server/admin/resolveTagByDisplayName';

const prisma = new PrismaClient();
const workId = 'd_448999';
const displayName = '女子寮';
const rank = 'A';

function generateTagKey(name: string, type: 'DERIVED' | 'STRUCTURAL'): string {
  const h = crypto.createHash('sha1').update(name, 'utf8').digest('hex').substring(0, 10);
  return type === 'STRUCTURAL' ? `char_${h}` : `tag_${h}`;
}

function addTagToRanks(name: string, r: string): void {
  const fullPath = path.join(process.cwd(), 'config/tagRanks.json');
  let data: { ranks?: Record<string, string>; updatedAt?: string } = {};
  try {
    data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  } catch {
    data = { ranks: {} };
  }
  data.ranks = data.ranks || {};
  data.ranks[name] = r; // 既存でも A で上書き
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
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
        questionTemplate: `${displayName.trim()}が特徴的だったりするのかしら？`,
      },
    });
  }
  addTagToRanks(displayName, rank);
  await prisma.workTag.upsert({
    where: { workId_tagKey: { workId, tagKey } },
    create: { workId, tagKey, derivedConfidence: 0.9, derivedSource: 'manual' },
    update: { derivedConfidence: 0.9, derivedSource: 'manual' },
  });
  console.log('ok: added 女子寮 (A) to work', workId);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
