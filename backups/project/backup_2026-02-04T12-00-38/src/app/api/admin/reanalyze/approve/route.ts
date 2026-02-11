/**
 * AI分析プレビュー結果を承認してDBに保存するAPI
 * POST body: { results: [ { workId, derivedTags, characterTags?, needsReview? } ] }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { resolveTagKeyForDisplayName } from '@/server/admin/resolveTagByDisplayName';
import crypto from 'crypto';

function generateTagKey(displayName: string, tagType: 'DERIVED' | 'STRUCTURAL' = 'DERIVED'): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return tagType === 'STRUCTURAL' ? `char_${hash}` : `tag_${hash}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { results } = body;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'results is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    const officialNameToKey = new Map(
      (await prisma.tag.findMany({ where: { tagType: 'OFFICIAL' }, select: { displayName: true, tagKey: true } })).map(
        t => [t.displayName.toLowerCase(), t.tagKey]
      )
    );

    let savedCount = 0;
    for (const r of results) {
      const workId = r.workId;
      const derivedTags = Array.isArray(r.derivedTags) ? r.derivedTags : [];
      const characterTags = Array.isArray(r.characterTags) ? r.characterTags : [];
      const needsReview = r.needsReview === true;

      const work = await prisma.work.findUnique({ where: { workId } });
      if (!work) {
        console.warn(`[Reanalyze Approve] Work not found: ${workId}`);
        continue;
      }

      const existingWorkTags = await prisma.workTag.findMany({
        where: { workId },
        include: { tag: true },
      });
      const toDelete: string[] = [];
      for (const wt of existingWorkTags) {
        if (wt.tag.tagType === 'DERIVED') toDelete.push(wt.tagKey);
        else if (wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS') toDelete.push(wt.tagKey);
      }
      if (toDelete.length > 0) {
        await prisma.workTag.deleteMany({
          where: { workId, tagKey: { in: toDelete } },
        });
      }

      const additionalSTags = derivedTags.filter((t: { source?: string }) => t.source === 'additionalS');
      const abcTags = derivedTags.filter((t: { source?: string }) => t.source !== 'additionalS');

      for (const tag of additionalSTags) {
        const displayName = tag.displayName && String(tag.displayName).trim();
        if (!displayName) continue;
        const tagKey = officialNameToKey.get(displayName.toLowerCase());
        if (!tagKey) continue;
        await prisma.workTag.upsert({
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

      for (const tag of abcTags) {
        const displayName = tag.displayName && String(tag.displayName).trim();
        if (!displayName) continue;
        const confidence = typeof tag.confidence === 'number' ? tag.confidence : 0.9;
        const category = tag.category ?? 'その他';
        const source = tag.source === 'matched' ? 'matched' : 'suggested';

        let finalTagKey = await resolveTagKeyForDisplayName(prisma, displayName);
        const hadExisting = finalTagKey != null;
        if (!finalTagKey) {
          finalTagKey = generateTagKey(displayName);
          await prisma.tag.create({
            data: {
              tagKey: finalTagKey,
              displayName,
              tagType: 'DERIVED',
              category,
              questionTemplate: `${displayName}が特徴的だったりするのかしら？`,
            },
          });
        }
        await prisma.workTag.upsert({
          where: {
            workId_tagKey: { workId, tagKey: finalTagKey },
          },
          create: {
            workId,
            tagKey: finalTagKey,
            derivedConfidence: confidence,
            derivedSource: hadExisting ? 'matched' : source,
          },
          update: {
            derivedConfidence: confidence,
            derivedSource: hadExisting ? 'matched' : source,
          },
        });
      }

      // キャラクタータグ（1つのみ）
      if (characterTags.length > 0) {
        const charName = String(characterTags[0]).trim();
        if (charName) {
          const existingCharTags = await prisma.workTag.findMany({
            where: { workId },
            include: { tag: true },
          });
          const charTagKeys = existingCharTags
            .filter(wt => wt.tag.tagType === 'STRUCTURAL')
            .map(wt => wt.tagKey);
          if (charTagKeys.length > 0) {
            await prisma.workTag.deleteMany({
              where: { workId, tagKey: { in: charTagKeys } },
            });
          }
          const charTagKey = generateTagKey(charName, 'STRUCTURAL');
          const existingCharTag = await prisma.tag.findFirst({
            where: { displayName: charName, tagType: 'STRUCTURAL' },
          });
          if (!existingCharTag) {
            await prisma.tag.create({
              data: {
                tagKey: charTagKey,
                displayName: charName,
                tagType: 'STRUCTURAL',
                category: 'キャラクター',
                questionTemplate: `${charName}というキャラクターが登場する？`,
              },
            });
          }
          await prisma.workTag.create({
            data: {
              workId,
              tagKey: existingCharTag?.tagKey ?? charTagKey,
            },
          });
        }
      }

      if (needsReview) {
        await prisma.work.update({
          where: { workId },
          data: { needsReview: true },
        });
      }

      savedCount++;
    }

    return NextResponse.json({
      success: true,
      stats: { saved: savedCount },
    });
  } catch (error) {
    console.error('[Reanalyze Approve] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
