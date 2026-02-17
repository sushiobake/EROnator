/**
 * /api/admin/tags/generate-derived-tags-oldest
 * 「準有名タグがない作品」のうち、古い順に N 件を AI が分析して準有名タグを付与し DB に保存する。
 * 目的: 準有名タグがついた作品を増やす（メモ＝取得手順に沿って、AI が分析してタグを入れる）。
 *
 * POST body: { limit?: number } 省略時は 100
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { resolveTagKeyForDisplayName } from '@/server/admin/resolveTagByDisplayName';
import { analyzeWithConfiguredProvider } from '@/server/ai/cloudflareAi';

const SYSTEM_PROMPT = `あなたは成人向け同人誌のタグ生成AIです。
作品コメントを読み、その作品に適した「準有名タグ」を生成してください。

準有名タグとは:
- 公式タグ（OFFICIAL）には含まれていないが、作品の特徴を表すタグ
- シチュエーション、属性、関係性などを表現する
- 例: 「温泉」「学園」「年上」「年下」「先輩後輩」など

【重要】JSONのみを出力してください。<think>タグや推論プロセスは不要です。

出力形式:
{"derivedTags":[{"displayName":"タグ名","confidence":0.8,"category":"カテゴリ"}],"characterTags":[]}

ルール:
- derivedTagsは最大5件、characterTagsは最大1件
- 作品コメントから読み取れる情報のみ使用
- 余計なテキストは一切出力しない`;

function getHash10(text: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').substring(0, 10);
}

function generateTagKey(displayName: string, tagType: 'DERIVED' | 'STRUCTURAL'): string {
  const hash10 = getHash10(displayName);
  return tagType === 'DERIVED' ? `tag_${hash10}` : `char_${hash10}`;
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const startMs = Date.now();

  try {
    await ensurePrismaConnected();

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 500);

    // 準有名タグがない作品のうち、古い順に limit 件（コメントありのみ）
    const works = await prisma.work.findMany({
      where: {
        commentText: { not: null },
        workTags: { none: { tag: { tagType: 'DERIVED' } } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        workTags: {
          where: { tag: { tagType: 'DERIVED' } },
          include: { tag: true },
        },
      },
    });

    if (works.length === 0) {
      return NextResponse.json({
        success: true,
        message: '対象作品が0件です（準有名タグなし・コメントあり）',
        stats: { total: 0, success: 0, failed: 0, elapsedMs: Date.now() - startMs },
      });
    }

    const officialTagNames = await prisma.tag.findMany({
      where: { tagType: 'OFFICIAL' },
      select: { displayName: true },
    });
    const officialNameSet = new Set(officialTagNames.map((t) => t.displayName.toLowerCase()));

    let successCount = 0;
    let failedCount = 0;
    const MAX_COMMENT_LENGTH = 8000;

    for (const work of works) {
      if (!work.commentText) {
        failedCount++;
        continue;
      }

      try {
        let commentTextToUse = work.commentText;
        if (commentTextToUse.length > MAX_COMMENT_LENGTH) {
          commentTextToUse = work.commentText.substring(0, MAX_COMMENT_LENGTH);
        }

        const aiResult = await analyzeWithConfiguredProvider(commentTextToUse, SYSTEM_PROMPT);
        const filteredTags = aiResult.derivedTags.filter((tag) => !officialNameSet.has(tag.displayName.toLowerCase()));

        if (filteredTags.length === 0) {
          failedCount++;
          continue;
        }

        for (const tag of filteredTags) {
          let finalTagKey = await resolveTagKeyForDisplayName(prisma, tag.displayName);
          const hadExisting = finalTagKey != null;
          if (!finalTagKey) {
            finalTagKey = generateTagKey(tag.displayName, 'DERIVED');
            await prisma.tag.create({
              data: {
                tagKey: finalTagKey,
                displayName: tag.displayName,
                tagType: 'DERIVED',
                category: tag.category || null,
                questionText: `${tag.displayName}が関係している？`,
              },
            });
          }
          await prisma.workTag.upsert({
            where: { workId_tagKey: { workId: work.workId, tagKey: finalTagKey } },
            update: {
              derivedConfidence: tag.confidence,
              derivedSource: hadExisting ? 'matched' : (tag.source || 'suggested'),
            },
            create: {
              workId: work.workId,
              tagKey: finalTagKey,
              derivedConfidence: tag.confidence,
              derivedSource: hadExisting ? 'matched' : (tag.source || 'suggested'),
            },
          });
        }

        successCount++;
      } catch (err) {
        console.error(`[準有名タグ生成-oldest] エラー: ${work.workId}`, err);
        failedCount++;
      }

      await new Promise((r) => setTimeout(r, 3000));
    }

    const elapsedMs = Date.now() - startMs;

    return NextResponse.json({
      success: true,
      stats: {
        total: works.length,
        success: successCount,
        failed: failedCount,
        elapsedMs,
      },
    });
  } catch (error) {
    console.error('[準有名タグ生成-oldest] 全体エラー:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
