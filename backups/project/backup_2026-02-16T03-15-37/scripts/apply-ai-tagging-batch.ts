#!/usr/bin/env tsx
/**
 * data/ai-tagging-batch-10.json のタグをDBに反映（aiAnalyzed=true, humanChecked=false）
 * PUT /api/admin/manual-tagging/works/[workId] と同じロジック
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveTagKeyForDisplayName } from '../src/server/admin/resolveTagByDisplayName';

const prisma = new PrismaClient();
const TAG_RANKS_PATH = 'config/tagRanks.json';

function generateTagKey(displayName: string, tagType: 'DERIVED' | 'STRUCTURAL'): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return tagType === 'STRUCTURAL' ? `char_${hash}` : `tag_${hash}`;
}

async function addTagToRanks(displayName: string, rank: 'A' | 'B' | 'C'): Promise<void> {
  const fullPath = path.join(process.cwd(), TAG_RANKS_PATH);
  let data: { ranks?: Record<string, string>; [key: string]: unknown } = {};
  try {
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    data = JSON.parse(content);
  } catch {
    data = { ranks: {} };
  }
  const ranks = data.ranks || {};
  if (!(displayName in ranks)) {
    ranks[displayName] = rank;
    data.ranks = ranks;
    data.updatedAt = new Date().toISOString();
    await fs.promises.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

interface BatchItem {
  workId: string;
  title?: string;
  additionalSTags?: string[];
  aTags?: string[];
  bTags?: string[];
  cTags?: string[];
  characterTags?: string[];
}

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'ai-tagging-batch-10.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const items: BatchItem[] = JSON.parse(raw);
  if (!Array.isArray(items) || items.length === 0) {
    console.error('items empty');
    process.exit(1);
  }

  const officialNameToKey = new Map(
    (
      await prisma.tag.findMany({
        where: { tagType: 'OFFICIAL' },
        select: { displayName: true, tagKey: true },
      })
    ).map((t) => [t.displayName.toLowerCase(), t.tagKey])
  );

  const defaultQuestionTemplate = (name: string) => `「${name.trim()}」が登場しますか？`;

  for (const item of items) {
    const workId = item.workId;
    const addS = (item.additionalSTags || []).filter((s) => typeof s === 'string' && s.trim());
    const aList = (item.aTags || []).filter((s) => typeof s === 'string' && s.trim());
    const bList = (item.bTags || []).filter((s) => typeof s === 'string' && s.trim());
    const cList = (item.cTags || []).filter((s) => typeof s === 'string' && s.trim());
    const charList = (item.characterTags || []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 1);

    const work = await prisma.work.findUnique({ where: { workId }, include: { workTags: { include: { tag: true } } } });
    if (!work) {
      console.warn(`skip: work not found ${workId}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const existingWorkTags = await tx.workTag.findMany({
        where: { workId },
        include: { tag: true },
      });
      const toDelete: string[] = [];
      for (const wt of existingWorkTags) {
        if (wt.tag.tagType === 'DERIVED') toDelete.push(wt.tagKey);
        else if (wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS') toDelete.push(wt.tagKey);
        else if (wt.tag.tagType === 'STRUCTURAL') toDelete.push(wt.tagKey);
      }
      if (toDelete.length > 0) {
        await tx.workTag.deleteMany({ where: { workId, tagKey: { in: toDelete } } });
      }

      for (const displayName of addS) {
        const tagKey = officialNameToKey.get(displayName.trim().toLowerCase());
        if (!tagKey) continue;
        await tx.workTag.upsert({
          where: { workId_tagKey: { workId, tagKey } },
          create: {
            workId,
            tagKey,
            derivedSource: 'additionalS',
            derivedConfidence: 0.9,
          },
          update: { derivedSource: 'additionalS', derivedConfidence: 0.9 },
        });
      }

      const upsertDerived = async (displayName: string, rank: 'A' | 'B' | 'C') => {
        const trimmed = displayName.trim();
        let tagKey = await resolveTagKeyForDisplayName(tx as any, displayName);
        if (!tagKey) {
          tagKey = generateTagKey(displayName, 'DERIVED');
          await tx.tag.create({
            data: {
              tagKey,
              displayName: trimmed,
              tagType: 'DERIVED',
              category: 'その他',
              questionTemplate: defaultQuestionTemplate(displayName),
            },
          });
          await addTagToRanks(trimmed, rank);
        } else {
          await tx.tag.updateMany({
            where: { tagKey, questionTemplate: null },
            data: { questionTemplate: defaultQuestionTemplate(displayName) },
          });
        }
        await tx.workTag.upsert({
          where: { workId_tagKey: { workId, tagKey } },
          create: {
            workId,
            tagKey,
            derivedConfidence: 0.9,
            derivedSource: 'manual',
          },
          update: { derivedConfidence: 0.9, derivedSource: 'manual' },
        });
      };
      for (const name of aList) await upsertDerived(name, 'A');
      for (const name of bList) await upsertDerived(name, 'B');
      for (const name of cList) await upsertDerived(name, 'C');

      if (charList.length > 0) {
        const charName = charList[0];
        let charTag = await tx.tag.findFirst({
          where: { displayName: charName, tagType: 'STRUCTURAL' },
          select: { tagKey: true },
        });
        if (!charTag) {
          const charTagKey = generateTagKey(charName, 'STRUCTURAL');
          await tx.tag.create({
            data: {
              tagKey: charTagKey,
              displayName: charName,
              tagType: 'STRUCTURAL',
              category: 'キャラクター',
              questionTemplate: `「${charName}」が登場しますか？`,
            },
          });
          await tx.workTag.create({
            data: {
              workId,
              tagKey: charTagKey,
              derivedSource: 'manual',
              derivedConfidence: 0.9,
            },
          });
        } else {
          await tx.tag.updateMany({
            where: { tagKey: charTag.tagKey, questionTemplate: null },
            data: { questionTemplate: `「${charName}」が登場しますか？` },
          });
          await tx.workTag.upsert({
            where: { workId_tagKey: { workId, tagKey: charTag.tagKey } },
            create: {
              workId,
              tagKey: charTag.tagKey,
              derivedSource: 'manual',
              derivedConfidence: 0.9,
            },
            update: { derivedSource: 'manual', derivedConfidence: 0.9 },
          });
        }
      }

      await tx.work.update({
        where: { workId },
        data: {
          tagSource: 'ai',
          humanChecked: false,
          aiAnalyzed: true,
        },
      });
    });

    console.log(`ok: ${workId} ${(item.title || '').slice(0, 40)}`);
  }

  console.log('done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
