#!/usr/bin/env tsx
/**
 * Usage: npx tsx scripts/apply-cursor-legacy-ai-batch.ts [jsonFileName]
 * Default: cursor-analysis-legacy-ai-10.json
 * 既存DERIVED削除 → matched/suggested/character追加 → aiAnalyzed=true, checkQueueAt でチェック待ち先頭へ
 *
 * workId: JSON の workId が "cid:d_xxx" でも "d_xxx" でも、DB の登録に合わせて解釈する（再発防止）。
 */

import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(process.cwd());
function loadDatabaseUrl(): string | null {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^DATABASE_URL=(.+)$/);
      if (match) {
        const val = match[1].trim().replace(/^["']|["']$/g, '');
        if (val) return val;
        break;
      }
    }
  }
  return null;
}
const urlFromFile = loadDatabaseUrl();
if (urlFromFile) {
  const fileMatch = urlFromFile.match(/^file:(\.\/)?(.*?)(\?.*)?$/);
  if (fileMatch) {
    const absolutePath = path.resolve(root, fileMatch[2]);
    const suffix = fileMatch[3] || '';
    process.env.DATABASE_URL = 'file:' + absolutePath.replace(/\\/g, '/') + suffix;
  } else {
    process.env.DATABASE_URL = urlFromFile;
  }
} else {
  require('dotenv').config({ path: path.join(root, '.env') });
}

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { resolveTagKeyForDisplayName, resolveOfficialTagKeyByDisplayName } from '../src/server/admin/resolveTagByDisplayName';

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
  additionalSTags?: string[];
  characterName?: string | null;
}

async function main() {
  const jsonName = process.argv[2] || 'cursor-analysis-legacy-ai-10.json';
  const jsonPath = path.join(process.cwd(), 'data', 'chatgpt-export', jsonName);
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

  const requestedWorkIds = [...new Set(importData.map((item) => item.workId))];
  let works = await prisma.work.findMany({
    where: { workId: { in: requestedWorkIds } },
  });

  const foundIds = new Set(works.map((w) => w.workId));
  const missing = requestedWorkIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const alternateIds = missing.flatMap((id) =>
      id.startsWith('cid:') ? [id.replace(/^cid:/, '')] : ['cid:' + id]
    );
    const extra = await prisma.work.findMany({
      where: { workId: { in: alternateIds } },
    });
    works = [...works, ...extra];
  }

  const jsonToDbWorkId = new Map<string, string>();
  for (const w of works) {
    jsonToDbWorkId.set(w.workId, w.workId);
    if (w.workId.startsWith('cid:')) {
      jsonToDbWorkId.set(w.workId.replace(/^cid:/, ''), w.workId);
    } else {
      jsonToDbWorkId.set('cid:' + w.workId, w.workId);
    }
  }

  const stillMissing = requestedWorkIds.filter((id) => !jsonToDbWorkId.has(id));
  if (stillMissing.length > 0) {
    console.error('Missing workId (not found in DB):', stillMissing);
    process.exit(1);
  }

  const start = Date.now();
  let newTagCount = 0;

  for (const item of importData) {
    const actualWorkId = jsonToDbWorkId.get(item.workId) ?? item.workId;
    const existingTags = await prisma.workTag.findMany({
      where: { workId: actualWorkId },
      include: { tag: true },
    });
    const derivedTagKeys = existingTags.filter((wt) => wt.tag.tagType === 'DERIVED').map((wt) => wt.tagKey);
    if (derivedTagKeys.length > 0) {
      await prisma.workTag.deleteMany({
        where: { workId: actualWorkId, tagKey: { in: derivedTagKeys } },
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
          workId_tagKey: { workId: actualWorkId, tagKey },
        },
        create: {
          workId: actualWorkId,
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
          workId_tagKey: { workId: actualWorkId, tagKey: charTag.tagKey },
        },
        create: { workId: actualWorkId, tagKey: charTag.tagKey },
        update: {},
      });
    }

    if (item.additionalSTags && item.additionalSTags.length > 0) {
      for (const displayName of item.additionalSTags) {
        const name = displayName.trim();
        if (!name) continue;
        const tagKey = await resolveOfficialTagKeyByDisplayName(prisma, name);
        if (!tagKey) {
          console.warn(`  [skip] OFFICIAL tag not found for additionalS: ${name} (workId=${actualWorkId})`);
          continue;
        }
        await prisma.workTag.upsert({
          where: { workId_tagKey: { workId: actualWorkId, tagKey } },
          create: { workId: actualWorkId, tagKey, derivedSource: 'additionalS', derivedConfidence: 0.9 },
          update: { derivedSource: 'additionalS', derivedConfidence: 0.9 },
        });
      }
    }

    const now = new Date();
    await prisma.$executeRawUnsafe(
      'UPDATE Work SET aiAnalyzed = 1, updatedAt = ?, checkQueueAt = ?, manualTaggingFolder = ? WHERE workId = ?',
      now,
      now,
      'pending',
      actualWorkId
    );
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
