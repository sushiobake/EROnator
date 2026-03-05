/**
 * /api/admin/tags/load-from-db: 既存DBから作品を読み込むAPI
 * 既存の作品とタグを取得して、編集可能な形式で返す
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

function getTagRanks(): Record<string, 'A' | 'B' | 'C' | ''> {
  try {
    const ranksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
    if (fs.existsSync(ranksPath)) {
      const content = fs.readFileSync(ranksPath, 'utf-8');
      const data = JSON.parse(content);
      return data.ranks || {};
    }
  } catch (e) {
    console.warn('[load-from-db] Failed to load tag ranks:', e);
  }
  return {};
}

type WorkWithTags = Awaited<
  ReturnType<
    typeof prisma.work.findMany<{
      include: { workTags: { include: { tag: true } } };
    }>
  >
>;

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
      rank?: string;
      tagKey?: string;
      source?: string;
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
    // Phase0/1/AIチェック用（詳細モーダル表示）
    lastTaggingReasoning?: Record<string, unknown> | null;
    lastCheckReasoning?: Record<string, unknown> | null;
    lastCheckTagChanges?: { added?: string[]; removed?: string[]; newProposal?: string } | null;
    /** 現在のフォルダ（タグ済・要注意・チェック待ち等） */
    manualTaggingFolder?: string | null;
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
    const rawPageSize = typeof body.pageSize === 'number' ? body.pageSize : 100;
    const pageSize = Math.min(10000, Math.max(1, rawPageSize));
    const skip = (page - 1) * pageSize;
    const needsReviewFilter = body.needsReviewFilter as 'exclude' | 'only' | undefined;
    await ensurePrismaConnected();

    // 使用作品DB: タグチェックのゲーム使用フォルダ（タグ済・人間確認・チェック待ち・旧AIタグ）
    const GAME_FOLDERS = ['tagged', 'needs_human_check', 'pending', 'legacy_ai'] as const;
    let workWhere: Record<string, unknown>;
    if (needsReviewFilter === 'only') {
      // 要確認のみ: ゲーム使用フォルダ内で needsReview=true の作品（シミュ失敗追加分）
      // 要注意（needs_review フォルダ）は除外＝作品DBはゲーム使用作品のみ
      workWhere = {
        manualTaggingFolder: { in: [...GAME_FOLDERS] },
        needsReview: true,
      };
    } else {
      workWhere = {
        manualTaggingFolder: { in: [...GAME_FOLDERS] },
        OR: [{ needsReview: false }, { needsReview: null }],
      };
    }

    let workCount: number;
    let effectiveWhere: Record<string, unknown> = workWhere;
    try {
      workCount = await prisma.work.count({ where: workWhere as any });
    } catch (err) {
      console.warn('[load-from-db] count failed (manualTaggingFolder/needsReview may not exist), fallback to all:', err);
      effectiveWhere = {};
      workCount = await prisma.work.count();
    }

    // better-sqlite3 フォールバックを削除（Prisma 二重アクセス解消）:
    // Prisma が 0 件を返す場合はそのまま返す。復元が必要なら backups/project/ から route.ts を戻す。

    // 総作品数は workCount を使用
    const totalWorks = workCount;
    const totalPages = Math.ceil(totalWorks / pageSize);

    // 作品を取得（タグ情報も含める、ページネーション・フィルタ適用）
    let works: WorkWithTags;
    try {
      works = await prisma.work.findMany({
        where: Object.keys(effectiveWhere).length ? (effectiveWhere as any) : undefined,
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
        gameRegistered: null,
        tagSource: null,
        aiAnalyzed: null,
        humanChecked: null,
        manualTaggingFolder: null,
      })) as WorkWithTags;
    }

    // タグランクを取得（derivedTags の A/B/C 表示用）
    const tagRanks = getTagRanks();

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
      const derivedTags: Array<{ displayName: string; confidence: number; category: string | null; rank?: string; tagKey?: string; source?: string }> = [];
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
            rank: tagRanks[tag.displayName] || '',
            tagKey: tag.tagKey,
            source: workTag.derivedSource || undefined,
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
              lastTaggingReasoning: (() => {
                const v = (work as { lastTaggingReasoning?: string | null }).lastTaggingReasoning;
                if (!v) return null;
                try { return JSON.parse(v) as Record<string, unknown>; } catch { return null; }
              })(),
              lastCheckReasoning: (() => {
                const v = (work as { lastCheckReasoning?: string | null }).lastCheckReasoning;
                if (!v) return null;
                try { return JSON.parse(v) as Record<string, unknown>; } catch { return null; }
              })(),
              lastCheckTagChanges: (() => {
                const v = (work as { lastCheckTagChanges?: string | null }).lastCheckTagChanges;
                if (!v) return null;
                try { return JSON.parse(v) as { added?: string[]; removed?: string[]; newProposal?: string }; } catch { return null; }
              })(),
              manualTaggingFolder: (work as { manualTaggingFolder?: string | null }).manualTaggingFolder ?? null,
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
