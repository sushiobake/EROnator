/**
 * インポート統計API
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET() {
  try {
    // 総作品数
    const totalWorks = await prisma.work.count();

    // コメント取得済み
    const withComment = await prisma.work.count({
      where: { commentText: { not: null } }
    });

    // DERIVEDタグ付き作品数
    const withDerivedTags = await prisma.work.count({
      where: {
        workTags: {
          some: {
            tag: { tagType: 'DERIVED' }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalWorks,
        withComment,
        withoutComment: totalWorks - withComment,
        withDerivedTags,
        withoutDerivedTags: withComment - withDerivedTags, // コメントありでタグなし
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
