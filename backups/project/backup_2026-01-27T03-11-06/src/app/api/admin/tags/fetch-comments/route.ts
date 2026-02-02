/**
 * /api/admin/tags/fetch-comments: 選択した作品のコメントを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { scrapeWorkComment } from '@/server/scraping/fanzaScraper';

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

        if (data && data.commentText) {
          // DBを更新
          await prisma.work.update({
            where: { workId: work.workId },
            data: { commentText: data.commentText },
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
        skipped: skippedCount, // スキップされた件数
      },
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
