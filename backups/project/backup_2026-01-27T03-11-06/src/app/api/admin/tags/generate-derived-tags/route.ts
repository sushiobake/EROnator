/**
 * /api/admin/tags/generate-derived-tags: 選択した作品の準有名タグを生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { analyzeWithHuggingFace } from '@/server/ai/cloudflareAi';

const SYSTEM_PROMPT = `あなたは成人向け同人誌のタグ生成AIです。
作品コメントを読み、その作品に適した「準有名タグ」を生成してください。

準有名タグとは:
- 公式タグ（OFFICIAL）には含まれていないが、作品の特徴を表すタグ
- シチュエーション、属性、関係性などを表現する
- 例: 「温泉」「学園」「年上」「年下」「先輩後輩」など

出力形式（JSON）:
{
  "derivedTags": [
    {
      "displayName": "タグ名",
      "confidence": 0.0-1.0の数値,
      "category": "カテゴリ名（例: シチュエーション、属性、関係性）"
    }
  ],
  "characterTags": ["キャラクター名1", "キャラクター名2"]
}

注意:
- derivedTagsは最大5件まで
- characterTagsは最大1件まで
- 既存の公式タグと重複しないようにする
- 作品コメントから読み取れる情報のみを使用する`;

/**
 * タグキーを生成
 */
function getHash10(text: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').substring(0, 10);
}

function generateTagKey(displayName: string, tagType: 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL'): string {
  const hash10 = getHash10(displayName);
  if (tagType === 'DERIVED') {
    return `tag_${hash10}`;
  } else if (tagType === 'STRUCTURAL') {
    return `char_${hash10}`;
  } else {
    return `off_${hash10}`;
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const { workIds, overwrite = false } = body;

    if (!Array.isArray(workIds) || workIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'workIds is required' },
        { status: 400 }
      );
    }

    // 作品を取得（コメントがあるもののみ）
    const works = await prisma.work.findMany({
      where: {
        workId: { in: workIds },
        commentText: { not: null }, // コメントが取得済みのもののみ
      },
      include: {
        workTags: {
          where: {
            tag: {
              tagType: 'DERIVED',
            },
          },
          include: {
            tag: true,
          },
        },
      },
    });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // 各作品の準有名タグを生成
    for (const work of works) {
      if (!work.commentText) {
        failedCount++;
        continue;
      }

      // 既存のDERIVEDタグがある場合の処理
      if (work.workTags.length > 0 && !overwrite) {
        skippedCount++;
        continue;
      }

      // 上書きモードの場合、既存のDERIVEDタグを削除
      if (overwrite && work.workTags.length > 0) {
        await prisma.workTag.deleteMany({
          where: {
            workId: work.workId,
            tag: {
              tagType: 'DERIVED',
            },
          },
        });
      }

      try {
        // AIで準有名タグを生成
        const aiResult = await analyzeWithHuggingFace(work.commentText, SYSTEM_PROMPT);

        if (aiResult.derivedTags.length === 0) {
          failedCount++;
          continue;
        }

        // タグをDBに保存
        for (const tag of aiResult.derivedTags) {
          const tagKey = generateTagKey(tag.displayName, 'DERIVED');

          // Tagをupsert
          await prisma.tag.upsert({
            where: { tagKey },
            update: {
              displayName: tag.displayName,
              tagType: 'DERIVED',
              category: tag.category || null,
            },
            create: {
              tagKey,
              displayName: tag.displayName,
              tagType: 'DERIVED',
              category: tag.category || null,
            },
          });

          // WorkTagをupsert
          await prisma.workTag.upsert({
            where: {
              workId_tagKey: {
                workId: work.workId,
                tagKey,
              },
            },
            update: {
              derivedConfidence: tag.confidence,
            },
            create: {
              workId: work.workId,
              tagKey,
              derivedConfidence: tag.confidence,
            },
          });
        }

        successCount++;

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Error generating derived tags for ${work.workId}:`, error);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        success: successCount,
        failed: failedCount,
        skipped: skippedCount + (workIds.length - works.length), // スキップ + コメント未取得
      },
    });
  } catch (error) {
    console.error('Error generating derived tags:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
