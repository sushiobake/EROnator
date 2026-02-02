/**
 * /api/admin/tags/list: タグ一覧と作品数を取得するAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

export interface TagListResponse {
  success: boolean;
  tags?: Array<{
    tagKey: string;
    displayName: string;
    tagType: string;
    category: string | null;
    workCount: number;
  }>;
  stats?: {
    total: number;
    byType: {
      OFFICIAL: number;
      DERIVED: number;
      STRUCTURAL: number;
    };
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  // アクセス制御
  if (!isAdminAllowed(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    await ensurePrismaConnected();

    // 全タグを取得
    const tags = await prisma.tag.findMany({
      orderBy: [
        { tagType: 'asc' },
        { displayName: 'asc' },
      ],
      select: {
        tagKey: true,
        displayName: true,
        tagType: true,
        category: true,
        _count: {
          select: {
            workTags: true,
          },
        },
      },
    });

    console.log(`[tags/list] Found ${tags.length} tags from Prisma`);

    // Prismaで0件の場合、直接SQLiteで取得（load-from-dbと同じフォールバック）
    if (tags.length === 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite3 = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        console.log(`[tags/list] Prisma returned 0 tags, but DB file exists. Using direct SQLite query as fallback...`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const db = sqlite3(dbPath, { readonly: true });
        
        // 直接SQLiteでタグを取得
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const directTags = db.prepare(`
          SELECT 
            t.tagKey,
            t.displayName,
            t.tagType,
            t.category,
            COUNT(wt.tagKey) as workCount
          FROM Tag t
          LEFT JOIN WorkTag wt ON t.tagKey = wt.tagKey
          GROUP BY t.tagKey, t.displayName, t.tagType, t.category
          ORDER BY t.tagType ASC, t.displayName ASC
        `).all() as Array<{
          tagKey: string;
          displayName: string;
          tagType: string;
          category: string | null;
          workCount: number;
        }>;
        
        console.log(`[tags/list] Direct SQLite query found ${directTags.length} tags`);
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        db.close();
        
        // 直接SQLiteで取得したデータを使用
        const byType = {
          OFFICIAL: 0,
          DERIVED: 0,
          STRUCTURAL: 0,
        };

        const tagsData = directTags.map(tag => {
          const tagType = tag.tagType as 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL';
          byType[tagType]++;

          return {
            tagKey: tag.tagKey,
            displayName: tag.displayName,
            tagType: tag.tagType,
            category: tag.category,
            workCount: tag.workCount,
          };
        });

        console.log(`[tags/list] Returning ${tagsData.length} tags from direct SQLite, stats:`, byType);

        return NextResponse.json({
          success: true,
          tags: tagsData,
          stats: {
            total: tagsData.length,
            byType,
          },
        });
      } catch (e) {
        console.error('[tags/list] Error using direct SQLite fallback:', e);
        // フォールバック失敗時はPrismaの結果（0件）を返す
      }
    }

    // タグタイプ別の集計
    const byType = {
      OFFICIAL: 0,
      DERIVED: 0,
      STRUCTURAL: 0,
    };

    const tagsData = tags.map(tag => {
      const tagType = tag.tagType as 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL';
      byType[tagType]++;

          return {
            tagKey: tag.tagKey,
            displayName: tag.displayName,
            tagType: tag.tagType,
            category: tag.category,
            workCount: tag._count.workTags,
          };
    });

    console.log(`[tags/list] Returning ${tagsData.length} tags, stats:`, byType);

    return NextResponse.json({
      success: true,
      tags: tagsData,
      stats: {
        total: tagsData.length,
        byType,
      },
    });
  } catch (error) {
    console.error('Error loading tags:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
