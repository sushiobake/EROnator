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
    gameRegistered?: boolean; // ゲーム・シミュレーションで使用（エロネーター登録）
    tagSource?: 'human' | 'ai' | null; // タグの由来（human=人力タグ付け、ai=AI分析、null=未タグ）
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
    // ページネーションパラメータ・フィルタを取得
    const body = await request.json().catch(() => ({}));
    const page = typeof body.page === 'number' ? body.page : 1;
    const pageSize = typeof body.pageSize === 'number' ? body.pageSize : 100;
    const filter = body.filter === 'registered' || body.filter === 'unregistered' ? body.filter : 'all';
    const skip = (page - 1) * pageSize;
    // DATABASE_URLを確認（デバッグ用）
    const dbUrl = process.env.DATABASE_URL;
    console.log(`[load-from-db] DATABASE_URL: ${dbUrl}`);
    console.log(`[load-from-db] process.cwd(): ${process.cwd()}`);

    await ensurePrismaConnected();

    // 作品数（フィルタ適用）。gameRegistered 列が未存在のDBではフィルタを無視
    let workWhere: Record<string, unknown> = {};
    if (filter === 'registered') workWhere = { gameRegistered: true, needsReview: false };
    else if (filter === 'unregistered') workWhere = { gameRegistered: false };

    let workCount: number;
    try {
      workCount = await prisma.work.count({
        where: Object.keys(workWhere).length ? workWhere : undefined,
      });
    } catch (err) {
      console.warn('[load-from-db] count with gameRegistered failed (column may not exist), using all works:', err);
      workWhere = {};
      workCount = await prisma.work.count();
    }
    console.log(`[load-from-db] Total works in DB (filter=${filter}): ${workCount}`);

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
            // 表示順を固定（フィルタ・取得経路に依存しない）
            officialTags.sort((a, b) => a.localeCompare(b, 'ja'));
            characterTags.sort((a, b) => a.localeCompare(b, 'ja'));
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

    // 総作品数は workCount を使用
    const totalWorks = workCount;
    const totalPages = Math.ceil(totalWorks / pageSize);

    // 作品を取得（タグ情報も含める、ページネーション・フィルタ適用）
    let works: Awaited<ReturnType<typeof prisma.work.findMany>>;
    try {
      works = await prisma.work.findMany({
        where: Object.keys(workWhere).length ? workWhere : undefined,
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
    } catch (err) {
      // Prisma はスキーマの全カラムを SELECT するため、gameRegistered 列が無いDBでは
      // findMany を再度呼んでも失敗する。生SQLで gameRegistered を除いて取得する。
      console.warn('[load-from-db] findMany failed (gameRegistered column may not exist), using raw SQL fallback:', err);
      workWhere = {};
      const rawRows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          workId: string;
          title: string;
          authorName: string;
          isAi: string;
          popularityBase: number;
          popularityPlayBonus: number;
          reviewCount: number | null;
          reviewAverage: number | null;
          productUrl: string;
          affiliateUrl: string | null;
          thumbnailUrl: string | null;
          sourcePayload: string | null;
          contentId: string | null;
          releaseDate: string | null;
          pageCount: string | null;
          seriesInfo: string | null;
          commentText: string | null;
          needsReview: number;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(
        `SELECT id, workId, title, authorName, isAi, popularityBase, popularityPlayBonus, reviewCount, reviewAverage,
         productUrl, affiliateUrl, thumbnailUrl, sourcePayload, contentId, releaseDate, pageCount, seriesInfo,
         commentText, needsReview, createdAt, updatedAt
         FROM Work ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        pageSize,
        skip
      );
      const workIds = rawRows.map(r => r.workId);
      const workTagsList = workIds.length > 0
        ? await prisma.workTag.findMany({
            where: { workId: { in: workIds } },
            include: { tag: true },
          })
        : [];
      const workTagsByWorkId = new Map<string, typeof workTagsList>();
      for (const wt of workTagsList) {
        const list = workTagsByWorkId.get(wt.workId) ?? [];
        list.push(wt);
        workTagsByWorkId.set(wt.workId, list);
      }
      works = rawRows.map(row => ({
        ...row,
        needsReview: Boolean(row.needsReview),
        workTags: workTagsByWorkId.get(row.workId) ?? [],
      })) as Awaited<ReturnType<typeof prisma.work.findMany>>;
      // gameRegistered 列が無いDBでは「登録済み」フィルタは 0 件とする（未登録のみ表示可能）
      if (filter === 'registered') works = [];
    }

    console.log(`[load-from-db] Fetched ${works.length} works`);

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
      // 表示順を固定（フィルタ・取得経路に依存しない）
      officialTags.sort((a, b) => a.localeCompare(b, 'ja'));
      characterTags.sort((a, b) => a.localeCompare(b, 'ja'));
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
              scrapedAt: work.createdAt instanceof Date ? work.createdAt.toISOString() : String(work.createdAt),
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
              gameRegistered: (work as { gameRegistered?: boolean }).gameRegistered ?? false,
              tagSource: (work as { tagSource?: string | null }).tagSource as 'human' | 'ai' | null ?? null,
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
