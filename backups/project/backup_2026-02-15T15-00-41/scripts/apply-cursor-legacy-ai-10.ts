#!/usr/bin/env tsx
/**
 * cursor-analysis-legacy-ai-10.json の分析結果をDBに反映
 * 既存DERIVED削除 → matched/suggested/character追加 → aiAnalyzed=true でチェック待ち先頭へ
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { resolveTagKeyForDisplayName } from '../src/server/admin/resolveTagByDisplayName';

const prisma = new PrismaClient();

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `tag_${hash}`;
}

interface ImportItem {
  workId: string;
  title?: string;
  matchedTags?: Array<{ displayName: string; category?: string }>;
  suggestedTags?: Array<{ displayName: string; category?: string }>;
  characterName?: string | null;
}

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'chatgpt-export', 'cursor-analysis-legacy-ai-10.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Not found:', jsonPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const importData: ImportItem[] = JSON.parse(raw);

  if (!Array.isArray(importData) || importData.length === 0) {
    console.error('importData is empty');
    process.exit(1);
  }

  const workIds = importData.map((item) => item.workId);
  const works = await prisma.work.findMany({
    where: { workId: { in: workIds } },
  });

  if (works.length !== workIds.length) {
    const foundIds = new Set(works.map((w) => w.workId));
    const missing = workIds.filter((id) => !foundIds.has(id));
    console.error('Missing workId:', missing);
    process.exit(1);
  }

  const start = Date.now();
  let newTagCount = 0;

  for (const item of importData) {
    const existingTags = await prisma.workTag.findMany({
      where: { workId: item.workId },
      include: { tag: true },
    });
    const derivedTagKeys = existingTags.filter((wt) => wt.tag.tagType === 'DERIVED').map((wt) => wt.tagKey);
    if (derivedTagKeys.length > 0) {
      await prisma.workTag.deleteMany({
        where: { workId: item.workId, tagKey: { in: derivedTagKeys } },
      });
    }

    const allTags: Array<{ displayName: string; category?: string; isSuggested: boolean }> = [];
    if (item.matchedTags) {
      allTags.push(...item.matchedTags.map((t) => ({ ...t, isSuggested: false })));
    }
    if (item.suggestedTags) {
      allTags.push(...item.suggestedTags.map((t) => ({ ...t, isSuggested: true })));
    }

    for (const tagItem of allTags) {
      const trimmedName = tagItem.displayName.trim();
      if (!trimmedName || trimmedName.length < 2) continue;

      let tagKey = await resolveTagKeyForDisplayName(prisma, trimmedName);
      let tag = tagKey ? await prisma.tag.findUnique({ where: { tagKey } }) : null;
      if (!tag) {
        tagKey = generateTagKey(trimmedName);
        tag = await prisma.tag.create({
          data: {
            tagKey,
            displayName: trimmedName,
            tagType: 'DERIVED',
            category: tagItem.category || 'その他',
          },
        });
        newTagCount++;
      } else {
        tagKey = tag.tagKey;
      }

      await prisma.workTag.upsert({
        where: {
          workId_tagKey: { workId: item.workId, tagKey },
        },
        create: {
          workId: item.workId,
          tagKey,
          derivedSource: tagItem.isSuggested ? 'manual-suggested' : 'manual-matched',
          derivedConfidence: 1.0,
        },
        update: {
          derivedSource: tagItem.isSuggested ? 'manual-suggested' : 'manual-matched',
          derivedConfidence: 1.0,
        },
      });
    }

    if (item.characterName && item.characterName.trim()) {
      const charName = item.characterName.trim();
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
        newTagCount++;
      }
      await prisma.workTag.upsert({
        where: {
          workId_tagKey: { workId: item.workId, tagKey: charTag.tagKey },
        },
        create: { workId: item.workId, tagKey: charTag.tagKey },
        update: {},
      });
    }

    const now = new Date();
    await prisma.work.update({
      where: { workId: item.workId },
      data: { aiAnalyzed: true, updatedAt: now, checkQueueAt: now },
    });
  }

  const elapsed = Date.now() - start;
  console.log(JSON.stringify({ success: true, works: importData.length, newTags: newTagCount, elapsedMs: elapsed }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
