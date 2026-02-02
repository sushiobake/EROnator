/**
 * タグタイプ変更API
 * POST: タグのタイプを変更
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tagKey, newType, tagKeys } = body;

    // 単一タグの変更
    if (tagKey && newType) {
      const tag = await prisma.tag.update({
        where: { tagKey },
        data: { tagType: newType }
      });
      return NextResponse.json({
        success: true,
        tag: {
          tagKey: tag.tagKey,
          displayName: tag.displayName,
          tagType: tag.tagType
        }
      });
    }

    // 一括変更
    if (tagKeys && Array.isArray(tagKeys) && newType) {
      const result = await prisma.tag.updateMany({
        where: { tagKey: { in: tagKeys } },
        data: { tagType: newType }
      });
      return NextResponse.json({
        success: true,
        updated: result.count
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error changing tag type:', error);
    return NextResponse.json({ error: 'Failed to change tag type' }, { status: 500 });
  }
}
