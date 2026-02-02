/**
 * 作品リスト取得API（インポートワークフロー用）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import fs from 'fs';
import path from 'path';

// タグランクを取得
function getTagRanks(): Record<string, 'A' | 'B' | 'C' | ''> {
  try {
    const ranksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
    if (fs.existsSync(ranksPath)) {
      const content = fs.readFileSync(ranksPath, 'utf-8');
      const data = JSON.parse(content);
      return data.ranks || {};
    }
  } catch (e) {
    console.warn('Failed to load tag ranks:', e);
  }
  return {};
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let where: any = {};
    
    if (filter === 'noComment') {
      where = { commentText: null };
    } else if (filter === 'noTags') {
      where = {
        commentText: { not: null },
        NOT: {
          workTags: {
            some: {
              tag: { tagType: 'DERIVED' }
            }
          }
        }
      };
    } else if (filter === 'needsReview') {
      where = { needsReview: true };
    }

    // 総件数を取得
    const total = await prisma.work.count({ where });

    const works = await prisma.work.findMany({
      where,
      select: {
        workId: true,
        title: true,
        authorName: true,
        commentText: true,
        needsReview: true,
        workTags: {
          select: {
            tagKey: true,
            derivedSource: true,
            derivedConfidence: true,
            tag: {
              select: {
                displayName: true,
                category: true,
                tagType: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    // タグランクを取得
    const tagRanks = getTagRanks();
    
    const workList = works.map(w => {
      // OFFICIALタグとDERIVEDタグとSTRUCTURALタグを分離
      const officialTags = w.workTags
        .filter(wt => wt.tag.tagType === 'OFFICIAL')
        .map(wt => ({
          displayName: wt.tag.displayName,
          category: wt.tag.category,
        }));
      
      const derivedTags = w.workTags
        .filter(wt => wt.tag.tagType === 'DERIVED')
        .map(wt => ({
          tagKey: wt.tagKey,
          displayName: wt.tag.displayName,
          category: wt.tag.category,
          source: wt.derivedSource || 'suggested',
          confidence: wt.derivedConfidence,
          rank: tagRanks[wt.tag.displayName] || '', // A, B, C, or ''（未分類）
        }));
      
      const structuralTags = w.workTags
        .filter(wt => wt.tag.tagType === 'STRUCTURAL')
        .map(wt => ({
          displayName: wt.tag.displayName,
          category: wt.tag.category,
        }));
      
      return {
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        commentText: w.commentText,
        needsReview: w.needsReview,
        officialTags,
        derivedTags,
        structuralTags,
      };
    });

    return NextResponse.json({
      success: true,
      works: workList,
      total,
    });
  } catch (error) {
    console.error('Error fetching works:', error);
    return NextResponse.json({ error: 'Failed to fetch works' }, { status: 500 });
  }
}
