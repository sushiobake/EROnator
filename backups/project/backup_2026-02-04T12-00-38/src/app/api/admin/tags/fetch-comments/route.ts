/**
 * /api/admin/tags/fetch-comments: 選択した作品のコメントを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { scrapeWorkComment } from '@/server/scraping/fanzaScraper';

/**
 * popularityBaseを計算（仕様書§9.1に基づく）
 */
function computePopularityBase(reviewCount: number | null, reviewAverage: number | null): number {
  const rc = reviewCount ?? 0;
  let base = 0;

  if (rc >= 100) base = 50;
  else if (rc >= 10) base = 30;
  else if (rc >= 1) base = 10;
  else base = 0;

  if (reviewAverage != null && !isNaN(reviewAverage)) {
    base += Math.round(reviewAverage);
  }

  // 0..55にクランプ
  if (base < 0) base = 0;
  if (base > 55) base = 55;
  return base;
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const { workIds: rawWorkIds, overwrite = false, limit: rawLimit } = body;

    const MAX_LIMIT = 500;
    const limit = rawLimit != null ? Math.min(MAX_LIMIT, Math.max(1, parseInt(String(rawLimit), 10) || 50)) : null;

    let workIds: string[];
    if (Array.isArray(rawWorkIds) && rawWorkIds.length > 0) {
      workIds = rawWorkIds;
    } else if (limit != null) {
      const rows = await prisma.work.findMany({
        where: overwrite ? {} : { commentText: null },
        select: { workId: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      workIds = rows.map((r) => r.workId);
      if (workIds.length === 0) {
        return NextResponse.json({
          success: true,
          stats: { success: 0, failed: 0, skipped: 0 },
          fetched: 0,
        });
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'workIds または limit を指定してください' },
        { status: 400 }
      );
    }

    // 作品を取得
    const works = await prisma.work.findMany({
      where: {
        workId: { in: workIds },
      },
      select: {
        workId: true,
        productUrl: true,
        commentText: true, // 既に取得済みかチェック
      },
    });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // 各作品のコメントを取得
    for (const work of works) {
      // 既に取得済みの場合の処理
      if (work.commentText) {
        if (overwrite) {
          // 上書きモード: 既存データがあっても取得し直す
        } else {
          // スキップモード: 既存データがある場合はスキップ
          skippedCount++;
          continue;
        }
      }

      try {
        const data = await scrapeWorkComment(work.productUrl, {
          headless: true,
          timeout: 30000,
        });

        if (data) {
          // 更新データを準備
          const updateData: {
            commentText?: string | null;
            reviewCount?: number | null;
            reviewAverage?: number | null;
            isAi?: 'AI' | 'HAND' | 'UNKNOWN';
            popularityBase?: number;
          } = {};

          // コメントがあれば更新
          if (data.commentText) {
            updateData.commentText = data.commentText;
          }

          // レビュー情報があれば更新
          if (data.reviewCount !== null || data.reviewAverage !== null) {
            updateData.reviewCount = data.reviewCount;
            updateData.reviewAverage = data.reviewAverage;
            // popularityBaseを計算
            const computedPopularityBase = computePopularityBase(data.reviewCount, data.reviewAverage);
            updateData.popularityBase = computedPopularityBase;
            console.log(`  [popularityBase計算] reviewCount=${data.reviewCount}, reviewAverage=${data.reviewAverage}, popularityBase=${computedPopularityBase}`);
          }

          // isAiがあれば更新（UNKNOWNの場合は既存値を保持）
          if (data.isAi && data.isAi !== 'UNKNOWN') {
            updateData.isAi = data.isAi;
          }

          // DBを更新
          await prisma.work.update({
            where: { workId: work.workId },
            data: updateData,
          });
          successCount++;
        } else {
          failedCount++;
        }

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error fetching comment for ${work.workId}:`, error);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
      },
      fetched: successCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
