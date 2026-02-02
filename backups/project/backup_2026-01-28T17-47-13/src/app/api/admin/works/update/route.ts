/**
 * 作品更新API
 * - 要注意フラグの更新
 * - 手動タグ追加
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import crypto from 'crypto';

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `tag_${hash}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, workId, workIds } = body;

    // 要注意フラグの更新
    if (action === 'setNeedsReview') {
      const { needsReview } = body;
      
      if (workIds && Array.isArray(workIds)) {
        // 複数更新
        await prisma.work.updateMany({
          where: { workId: { in: workIds } },
          data: { needsReview: Boolean(needsReview) }
        });
        return NextResponse.json({ success: true, updated: workIds.length });
      } else if (workId) {
        // 単一更新
        await prisma.work.update({
          where: { workId },
          data: { needsReview: Boolean(needsReview) }
        });
        return NextResponse.json({ success: true });
      }
    }

    // 手動タグ追加
    if (action === 'addTag') {
      const { tagName } = body;
      
      if (!workId || !tagName) {
        return NextResponse.json({ error: 'workId and tagName are required' }, { status: 400 });
      }

      // タグ名のバリデーション
      const trimmedName = tagName.trim();
      if (trimmedName.length < 2 || trimmedName.length > 30) {
        return NextResponse.json({ error: 'タグ名は2〜30文字で入力してください' }, { status: 400 });
      }

      // 既存のDERIVEDタグを検索
      let tag = await prisma.tag.findFirst({
        where: { displayName: trimmedName, tagType: 'DERIVED' }
      });

      // なければ新規作成
      if (!tag) {
        const tagKey = generateTagKey(trimmedName);
        tag = await prisma.tag.create({
          data: {
            tagKey,
            displayName: trimmedName,
            tagType: 'DERIVED',
            category: 'その他'
          }
        });
        console.log(`[ManualTag] Created new tag: ${trimmedName} (${tag.tagKey})`);
      }

      // 既に紐付いているか確認
      const existing = await prisma.workTag.findUnique({
        where: { workId_tagKey: { workId, tagKey: tag.tagKey } }
      });

      if (existing) {
        return NextResponse.json({ error: 'このタグは既に追加されています' }, { status: 400 });
      }

      // WorkTagを作成
      await prisma.workTag.create({
        data: {
          workId,
          tagKey: tag.tagKey,
          derivedSource: 'manual',
          derivedConfidence: 1.0
        }
      });

      console.log(`[ManualTag] Added tag "${trimmedName}" to work ${workId}`);

      return NextResponse.json({ 
        success: true, 
        tag: { displayName: tag.displayName, tagKey: tag.tagKey }
      });
    }

    // タグ削除
    if (action === 'removeTag') {
      const { tagKey } = body;
      
      if (!workId || !tagKey) {
        return NextResponse.json({ error: 'workId and tagKey are required' }, { status: 400 });
      }

      await prisma.workTag.delete({
        where: { workId_tagKey: { workId, tagKey } }
      });

      console.log(`[ManualTag] Removed tag ${tagKey} from work ${workId}`);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating work:', error);
    return NextResponse.json({ error: 'Failed to update work' }, { status: 500 });
  }
}

// タグ候補を取得（オートコンプリート用）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    if (query.length < 1) {
      return NextResponse.json({ tags: [] });
    }

    // DERIVEDタグを検索
    const tags = await prisma.tag.findMany({
      where: {
        tagType: 'DERIVED',
        displayName: { contains: query }
      },
      select: { displayName: true, tagKey: true },
      take: 20,
      orderBy: { displayName: 'asc' }
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error searching tags:', error);
    return NextResponse.json({ error: 'Failed to search tags' }, { status: 500 });
  }
}
