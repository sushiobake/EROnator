#!/usr/bin/env tsx
/**
 * apply-cursor-legacy-ai-batch の取り消し
 * Usage: npx tsx scripts/undo-apply-legacy-ai-batch.ts [jsonFileName]
 *
 * やること:
 * - JSON に含まれる各 workId について、aiAnalyzed=false, checkQueueAt=null に戻す
 * - この apply で追加したタグだけ削除する（matchedTags / characterName / additionalSTags の分）
 *
 * 注意: apply 時に「既存DERIVEDを全削除」しているため、もともとあったタグは復元できない。
 * 完全に戻すには apply 前の DB バックアップが必要。
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ImportItem {
  workId: string;
  title?: string;
  matchedTags?: Array<{ displayName: string; category?: string }>;
  suggestedTags?: Array<{ displayName: string; category?: string }>;
  additionalSTags?: string[];
  characterName?: string | null;
}

async function main() {
  const jsonName = process.argv[2];
  if (!jsonName) {
    console.error('Usage: npx tsx scripts/undo-apply-legacy-ai-batch.ts <jsonFileName>');
    process.exit(1);
  }
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

  let removedTagCount = 0;

  for (const item of importData) {
    const actualWorkId = jsonToDbWorkId.get(item.workId) ?? item.workId;
    // 1. この apply で追加したタグの tagKey を集める
    const tagKeysToRemove: string[] = [];

    if (item.matchedTags?.length) {
      for (const t of item.matchedTags) {
        const name = t.displayName?.trim();
        if (!name) continue;
        const tag = await prisma.tag.findFirst({
          where: { displayName: name, tagType: 'DERIVED' },
        });
        if (tag) tagKeysToRemove.push(tag.tagKey);
      }
    }
    if (item.suggestedTags?.length) {
      for (const t of item.suggestedTags) {
        const name = t.displayName?.trim();
        if (!name) continue;
        const tag = await prisma.tag.findFirst({
          where: { displayName: name, tagType: 'DERIVED' },
        });
        if (tag) tagKeysToRemove.push(tag.tagKey);
      }
    }
    if (item.characterName?.trim()) {
      const charTag = await prisma.tag.findFirst({
        where: { displayName: item.characterName!.trim(), tagType: 'STRUCTURAL' },
      });
      if (charTag) tagKeysToRemove.push(charTag.tagKey);
    }
    if (item.additionalSTags?.length) {
      for (const name of item.additionalSTags) {
        const n = name.trim();
        if (!n) continue;
        const tag = await prisma.tag.findFirst({
          where: { displayName: n },
        });
        if (tag) tagKeysToRemove.push(tag.tagKey);
      }
    }

    if (tagKeysToRemove.length > 0) {
      const deleted = await prisma.workTag.deleteMany({
        where: {
          workId: actualWorkId,
          tagKey: { in: tagKeysToRemove },
        },
      });
      removedTagCount += deleted.count;
    }

    await prisma.work.update({
      where: { workId: actualWorkId },
      data: { aiAnalyzed: false, checkQueueAt: null },
    });
  }

  console.log(
    JSON.stringify({
      success: true,
      works: importData.length,
      workIds: requestedWorkIds,
      removedTagCount,
      message: 'aiAnalyzed=false, checkQueueAt=null に戻し、このapplyで追加したタグを削除しました。apply前にあったDERIVEDは復元されません。',
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
