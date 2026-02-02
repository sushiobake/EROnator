/**
 * /api/admin/tags/load-from-db: 既存DBから作品を読み込むAPI
 * 既存の作品とタグを取得して、編集可能な形式で返す
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

export interface LoadFromDbResponse {
  success: boolean;
  works?: Array<{
    workId: string;
    cid: string | null;
    title: string;
    circleName: string;
    productUrl: string;
    thumbnailUrl: string | null;
    reviewAverage: number | null;
    reviewCount: number | null;
    popularityBase: number;
    popularityPlayBonus: number;
    isAi: 'AI' | 'HAND' | 'UNKNOWN';
    scrapedAt: string;
    officialTags: string[];
    derivedTags: Array<{
      displayName: string;
      confidence: number;
      category: string | null;
    }>;
    characterTags: string[];
    metaText: string;
    commentText: string | null; // null=未取得
    // 新フィールド
    contentId: string | null;
    releaseDate: string | null;
    pageCount: string | null;
    affiliateUrl: string | null;
    seriesInfo: string | null; // JSON string
  }>;
  stats?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  // アクセス制御
  if (!isAdminAllowed(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    // ページネーションパラメータを取得
    const body = await request.json().catch(() => ({}));
    const page = typeof body.page === 'number' ? body.page : 1;
    const pageSize = typeof body.pageSize === 'number' ? body.pageSize : 100;
    const skip = (page - 1) * pageSize;
    // DATABASE_URLを確認（デバッグ用）- ensurePrismaConnectedの前に
    const dbUrl = process.env.DATABASE_URL;
    console.log(`[load-from-db] DATABASE_URL: ${dbUrl}`);
    console.log(`[load-from-db] process.cwd(): ${process.cwd()}`);

    await ensurePrismaConnected();

    // まず作品数を確認
    const workCount = await prisma.work.count();
    console.log(`[load-from-db] Total works in DB: ${workCount}`);

    if (workCount === 0) {
      // 直接SQLiteで確認してみる
      console.log(`[load-from-db] Prisma returned 0 works, but DB file exists. Checking directly...`);
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite3 = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        console.log(`[load-from-db] Direct DB path: ${dbPath}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const db = sqlite3(dbPath, { readonly: true });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const directCount = db.prepare('SELECT COUNT(*) as count FROM Work').get() as { count: number };
        console.log(`[load-from-db] Direct SQLite query count: ${directCount.count}`);
        
        // Prismaが0件を返すが、直接SQLiteではデータがある場合、直接SQLiteから取得する
        if (directCount.count > 0) {
          console.log(`[load-from-db] Using direct SQLite query as fallback (Prisma returned 0 works)`);
          // 総作品数を取得
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const directTotalCount = db.prepare('SELECT COUNT(*) as count FROM Work').get() as { count: number };
          const directTotalPages = Math.ceil(directTotalCount.count / pageSize);

          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const directWorks = db.prepare(`
            SELECT 
              w.workId,
              w.title,
              w.authorName,
              w.isAi,
              w.productUrl,
              w.thumbnailUrl,
              w.reviewAverage,
              w.reviewCount,
              w.popularityBase,
              w.popularityPlayBonus,
              w.sourcePayload,
              w.createdAt,
              w.contentId,
              w.releaseDate,
              w.pageCount,
              w.affiliateUrl,
              w.seriesInfo,
              w.commentText
            FROM Work w
            ORDER BY w.createdAt DESC
            LIMIT ? OFFSET ?
          `).all(pageSize, skip) as Array<{
            workId: string;
            title: string;
            authorName: string;
            isAi: string;
            productUrl: string;
            thumbnailUrl: string | null;
            reviewAverage: number | null;
            reviewCount: number | null;
            popularityBase: number;
            popularityPlayBonus: number;
            sourcePayload: string | null;
            createdAt: string;
            contentId: string | null;
            releaseDate: string | null;
            pageCount: string | null;
            affiliateUrl: string | null;
            seriesInfo: string | null;
            commentText: string | null;
          }>;
          
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const directWorkTags = db.prepare(`
            SELECT 
              wt.workId,
              wt.tagKey,
              wt.derivedConfidence,
              t.displayName,
              t.tagType,
              t.category
            FROM WorkTag wt
            INNER JOIN Tag t ON wt.tagKey = t.tagKey
          `).all() as Array<{
            workId: string;
            tagKey: string;
            derivedConfidence: number | null;
            displayName: string;
            tagType: string;
            category: string | null;
          }>;
          
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          db.close();
          
          // タグをworkIdごとにグループ化
          const tagsByWorkId = new Map<string, typeof directWorkTags>();
          for (const wt of directWorkTags) {
            if (!tagsByWorkId.has(wt.workId)) {
              tagsByWorkId.set(wt.workId, []);
            }
            tagsByWorkId.get(wt.workId)!.push(wt);
          }
          
          // 作品データを変換
          const worksData: LoadFromDbResponse['works'] = [];
          
          for (const work of directWorks) {
            // sourcePayloadから情報を取得
            let sourcePayload: any = {};
            try {
              if (work.sourcePayload) {
                sourcePayload = JSON.parse(work.sourcePayload);
              }
            } catch (e) {
              // パースエラーは無視
            }
            
            // タグを分類
            const workTags = tagsByWorkId.get(work.workId) || [];
            const officialTags: string[] = [];
            const derivedTags: Array<{ displayName: string; confidence: number; category: string | null }> = [];
            const characterTags: string[] = [];
            
            for (const wt of workTags) {
              if (wt.tagType === 'OFFICIAL') {
                officialTags.push(wt.displayName);
              } else if (wt.tagType === 'DERIVED') {
                derivedTags.push({
                  displayName: wt.displayName,
                  confidence: wt.derivedConfidence ?? 0.5,
                  category: wt.category,
                });
              } else if (wt.tagType === 'STRUCTURAL' && wt.category === 'CHARACTER') {
                characterTags.push(wt.displayName);
              }
            }
            
            // confidence順でソート
            derivedTags.sort((a, b) => b.confidence - a.confidence);
            
            // cidを取得（workIdから抽出、またはsourcePayloadから）
            let cid: string | null = null;
            if (work.workId.startsWith('cid:')) {
              cid = work.workId.replace('cid:', '');
            } else if (sourcePayload.cid) {
              cid = sourcePayload.cid;
            }
            
            worksData.push({
              workId: work.workId,
              cid,
              title: work.title,
              circleName: work.authorName,
              productUrl: work.productUrl,
              thumbnailUrl: work.thumbnailUrl,
              reviewAverage: work.reviewAverage,
              reviewCount: work.reviewCount,
              popularityBase: work.popularityBase,
              popularityPlayBonus: work.popularityPlayBonus,
              isAi: work.isAi as 'AI' | 'HAND' | 'UNKNOWN',
              scrapedAt: new Date(work.createdAt).toISOString(),
              officialTags,
              derivedTags,
              characterTags,
              metaText: sourcePayload.metaText || '',
              commentText: work.commentText ?? null, // DBから直接取得（null=未取得）
              // 新フィールド
              contentId: work.contentId ?? null,
              releaseDate: work.releaseDate ?? null,
              pageCount: work.pageCount ?? null,
              affiliateUrl: work.affiliateUrl ?? null,
              seriesInfo: work.seriesInfo ?? null,
            });
          }
          
          return NextResponse.json({
            success: true,
            works: worksData,
            stats: {
              total: directTotalCount.count,
              page,
              pageSize,
              totalPages: directTotalPages,
            },
          });
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        db.close();
      } catch (e) {
        console.error(`[load-from-db] Error checking direct DB:`, e);
      }
    }

    // 総作品数を取得
    const totalWorks = await prisma.work.count();
    const totalPages = Math.ceil(totalWorks / pageSize);

    // 作品を取得（タグ情報も含める、ページネーション適用）
    const works = await prisma.work.findMany({
      include: {
        workTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    console.log(`[load-from-db] Fetched ${works.length} works from Prisma`);

    // 作品データを変換
    const worksData: LoadFromDbResponse['works'] = [];

    for (const work of works) {
      // sourcePayloadから情報を取得
      let sourcePayload: any = {};
      try {
        if (work.sourcePayload) {
          sourcePayload = JSON.parse(work.sourcePayload);
        }
      } catch (e) {
        // パースエラーは無視
      }

      // タグを分類
      const officialTags: string[] = [];
      const derivedTags: Array<{ displayName: string; confidence: number; category: string | null }> = [];
      const characterTags: string[] = [];

      for (const workTag of work.workTags) {
        const tag = workTag.tag;
        if (tag.tagType === 'OFFICIAL') {
          officialTags.push(tag.displayName);
        } else if (tag.tagType === 'DERIVED') {
          derivedTags.push({
            displayName: tag.displayName,
            confidence: workTag.derivedConfidence ?? 0.5,
            category: tag.category,
          });
        } else if (tag.tagType === 'STRUCTURAL' && tag.category === 'CHARACTER') {
          characterTags.push(tag.displayName);
        }
      }

      // confidence順でソート
      derivedTags.sort((a, b) => b.confidence - a.confidence);

      // cidを取得（workIdから抽出、またはsourcePayloadから）
      let cid: string | null = null;
      if (work.workId.startsWith('cid:')) {
        cid = work.workId.replace('cid:', '');
      } else if (sourcePayload.cid) {
        cid = sourcePayload.cid;
      }

            // シリーズ情報をパース
            let seriesInfo: string | null = null;
            try {
              if (work.seriesInfo) {
                seriesInfo = work.seriesInfo;
              } else if (sourcePayload.iteminfo?.series?.[0]) {
                seriesInfo = JSON.stringify({
                  id: sourcePayload.iteminfo.series[0].id,
                  name: sourcePayload.iteminfo.series[0].name,
                });
              }
            } catch (e) {
              // パースエラーは無視
            }

            worksData.push({
              workId: work.workId,
              cid,
              title: work.title,
              circleName: work.authorName,
              productUrl: work.productUrl,
              thumbnailUrl: work.thumbnailUrl,
              reviewAverage: work.reviewAverage,
              reviewCount: work.reviewCount,
              popularityBase: work.popularityBase,
              popularityPlayBonus: work.popularityPlayBonus,
              isAi: work.isAi as 'AI' | 'HAND' | 'UNKNOWN',
              scrapedAt: work.createdAt.toISOString(),
              officialTags,
              derivedTags,
              characterTags,
              metaText: sourcePayload.metaText || '',
              commentText: work.commentText ?? null, // DBから直接取得（null=未取得）
              // 新フィールド
              contentId: work.contentId ?? null,
              releaseDate: work.releaseDate ?? null,
              pageCount: work.pageCount ?? null,
              affiliateUrl: work.affiliateUrl ?? null,
              seriesInfo,
            });
    }

    return NextResponse.json({
      success: true,
      works: worksData,
      stats: {
        total: totalWorks,
        page,
        pageSize,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error loading works from database:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
