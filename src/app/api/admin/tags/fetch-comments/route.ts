/**
 * /api/admin/tags/fetch-comments: 選択した作品のコメントを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { updatePhaseProgress } from '@/server/bulk/progressStore';
import { scrapeWorkComment } from '@/server/scraping/fanzaScraper';

/** 同時実行数（並列4で高速化。FANZAブロック時は2に下げる） */
const SCRAPE_CONCURRENCY = 4;

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
    const { workIds: rawWorkIds, overwrite = false, limit: rawLimit, allocations: rawAllocations, bulkJobId, progressContext } = body;

    const MAX_LIMIT = 500;
    const MAX_TOTAL_PRIORITY = 10000;
    const limit = rawLimit != null ? Math.min(MAX_LIMIT, Math.max(1, parseInt(String(rawLimit), 10) || 50)) : null;

    let workIds: string[];
    if (Array.isArray(rawAllocations) && rawAllocations.length > 0) {
      // 優先度指定: 年ごと・有名順で workIds を構築（コメント未取得のみ）
      const collected: string[] = [];
      const baseWhere = overwrite ? {} : { commentText: null };
      for (const entry of rawAllocations) {
        const lim = Math.max(0, Math.min(10000, parseInt(String(entry.limit), 10) || 0));
        if (lim <= 0) continue;
        const year = entry.year != null ? parseInt(String(entry.year), 10) : null;
        const yearEnd = entry.yearEnd != null ? parseInt(String(entry.yearEnd), 10) : null;
        const releaseDateFilter =
          year != null && !isNaN(year)
            ? { gte: `${year}-01-01`, lte: `${year}-12-31` }
            : yearEnd != null && !isNaN(yearEnd)
              ? { lte: `${yearEnd}-12-31` }
              : null;
        const where = releaseDateFilter
          ? { ...baseWhere, releaseDate: releaseDateFilter }
          : baseWhere;
        const rows = await prisma.work.findMany({
          where,
          select: { workId: true },
          orderBy: [{ reviewCount: 'desc' }, { createdAt: 'desc' }],
          take: lim,
        });
        for (const r of rows) {
          if (collected.length >= MAX_TOTAL_PRIORITY) break;
          collected.push(r.workId);
        }
        if (collected.length >= MAX_TOTAL_PRIORITY) break;
      }
      workIds = collected;
      if (workIds.length === 0) {
        return NextResponse.json({
          success: true,
          stats: { success: 0, failed: 0, skipped: 0 },
          fetched: 0,
        });
      }
    } else if (Array.isArray(rawWorkIds) && rawWorkIds.length > 0) {
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
        { success: false, error: 'workIds / limit / allocations のいずれかを指定してください' },
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
        title: true,
        productUrl: true,
        commentText: true, // 既に取得済みかチェック
        manualTaggingFolder: true, // 未タグ振り分け判定用
      },
    });
    const orderIndex = new Map(workIds.map((id, i) => [id, i]));
    works.sort((a, b) => (orderIndex.get(a.workId) ?? 0) - (orderIndex.get(b.workId) ?? 0));

    const toProcess = works.filter((w) => overwrite || !w.commentText);
    const skippedCount = works.length - toProcess.length;

    const ctx = bulkJobId && progressContext && typeof progressContext.doneOffset === 'number'
      ? progressContext as { doneOffset: number; total: number; round: number; roundTotal: number }
      : null;

    const concurrencyLimit = pLimit(SCRAPE_CONCURRENCY);
    const completedRef = { count: 0 };

    const results = await Promise.all(
      toProcess.map((work) =>
        concurrencyLimit(async (): Promise<{ success: boolean; skippedReason?: string; errorMessage?: string }> => {
          if (ctx) {
            updatePhaseProgress(bulkJobId, 'comment', {
              done: ctx.doneOffset + completedRef.count,
              total: ctx.total,
              round: ctx.round,
              roundTotal: ctx.roundTotal,
              currentWorkId: work.workId,
              detail: `取得中: ${work.workId}`,
            });
          }

          try {
            const data = await scrapeWorkComment(work.productUrl, {
              headless: true,
              timeout: 30000,
            });

            if (data) {
              const updateData: {
                commentText?: string | null;
                reviewCount?: number | null;
                reviewAverage?: number | null;
                isAi?: 'AI' | 'HAND' | 'UNKNOWN';
                popularityBase?: number;
                manualTaggingFolder?: string;
              } = {};

              if (data.commentText) {
                updateData.commentText = data.commentText;
                const currentFolder = work.manualTaggingFolder;
                if (currentFolder == null || currentFolder === '') {
                  (updateData as Record<string, unknown>).manualTaggingFolder = 'untagged';
                }
              } else if (data.commentSkippedReason === 'too_short') {
                updateData.commentText = '（コメント短すぎ・要確認）';
                updateData.manualTaggingFolder = 'needs_human_check';
                console.warn(`[fetch-comments] コメント短すぎスキップ（人間確認へ）: ${work.workId}`);
              } else if (data.commentSkippedReason === 'not_found') {
                updateData.commentText = '（作品コメント未検出・要確認）';
                updateData.manualTaggingFolder = 'needs_human_check';
                console.warn(`[fetch-comments] 作品コメント未検出（人間確認へ）: ${work.workId}`);
              }

              if (data.reviewCount !== null || data.reviewAverage !== null) {
                updateData.reviewCount = data.reviewCount;
                updateData.reviewAverage = data.reviewAverage;
                updateData.popularityBase = computePopularityBase(data.reviewCount, data.reviewAverage);
              }

              if (data.isAi && data.isAi !== 'UNKNOWN') {
                updateData.isAi = data.isAi;
              }

              await prisma.work.update({
                where: { workId: work.workId },
                data: updateData,
              });
            }

            completedRef.count++;
            const detail =
              data?.commentText ? 'OK' :
              data?.commentSkippedReason === 'too_short' ? '短すぎ→要確認' :
              data?.commentSkippedReason === 'not_found' ? '未検出' : '失敗';
            if (ctx) {
              updatePhaseProgress(bulkJobId, 'comment', {
                done: ctx.doneOffset + completedRef.count,
                total: ctx.total,
                round: ctx.round,
                roundTotal: ctx.roundTotal,
                currentWorkId: work.workId,
                detail,
              });
            }

            await new Promise((resolve) => setTimeout(resolve, 1500));
            const success = !!(data?.commentText);
            return {
              success,
              skippedReason: data?.commentSkippedReason,
            };
          } catch (error) {
            console.error(`Error fetching comment for ${work.workId}:`, error);
            completedRef.count++;
            if (ctx) {
              updatePhaseProgress(bulkJobId, 'comment', {
                done: ctx.doneOffset + completedRef.count,
                total: ctx.total,
                round: ctx.round,
                roundTotal: ctx.roundTotal,
                currentWorkId: work.workId,
                detail: 'エラー',
              });
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, errorMessage };
          }
        })
      )
    );

    const successCount = results.filter((r) => r.success).length;
    const skippedTooShort = results.filter((r) => r.skippedReason === 'too_short').length;
    const skippedNotFound = results.filter((r) => r.skippedReason === 'not_found').length;
    const failedCount = results.length - successCount;
    const failedDetails: Array<{ workId: string; title: string; reason: string }> = toProcess
      .map((w, i) => ({ work: w, r: results[i] }))
      .filter(({ r }) => !r.success)
      .map(({ work, r }) => ({
        workId: work.workId,
        title: work.title ?? '',
        reason:
          r.skippedReason === 'too_short'
            ? 'コメント短すぎ（要確認）'
            : r.skippedReason === 'not_found'
              ? 'コメント未検出（要確認）'
              : r.errorMessage ?? 'エラー',
      }));

    return NextResponse.json({
      success: true,
      stats: {
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        skippedTooShort,
        skippedNotFound,
      },
      fetched: successCount,
      failed: failedCount,
      skippedTooShort,
      skippedNotFound,
      failedDetails,
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
