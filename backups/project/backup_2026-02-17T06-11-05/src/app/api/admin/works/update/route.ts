/**
 * 作品更新API
 * - 要注意フラグの更新
 * - ゲーム登録フラグの更新
 * - 手動タグ追加
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { resolveTagKeyForDisplayName } from '@/server/admin/resolveTagByDisplayName';
import crypto from 'crypto';

/** DBに gameRegistered 列が無い場合に追加する（既に存在する場合は何もしない） */
async function ensureGameRegisteredColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Work" ADD COLUMN "gameRegistered" INTEGER NOT NULL DEFAULT 0'
    );
    console.warn('[works/update] Added missing column gameRegistered to Work table');
  } catch (alterErr: unknown) {
    const msg = String((alterErr as Error)?.message ?? '');
    if (!msg.includes('duplicate column name')) throw alterErr;
  }
}

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `tag_${hash}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, workId, workIds } = body;

    // 人間要チェックフラグの更新（AIチェックで問題あり→人間要チェックタブに表示）
    if (action === 'setNeedsHumanCheck') {
      const { needsHumanCheck } = body;
      const value = Boolean(needsHumanCheck);
      if (workIds && Array.isArray(workIds)) {
        await prisma.work.updateMany({
          where: { workId: { in: workIds } },
          data: { needsHumanCheck: value },
        });
        return NextResponse.json({ success: true, updated: workIds.length });
      }
      if (workId) {
        await prisma.work.update({
          where: { workId },
          data: { needsHumanCheck: value },
        });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'workId or workIds required' }, { status: 400 });
    }

    // 要注意フラグの更新
    if (action === 'setNeedsReview') {
      const { needsReview } = body;
      
      if (workIds && Array.isArray(workIds)) {
        await prisma.work.updateMany({
          where: { workId: { in: workIds } },
          data: { needsReview: Boolean(needsReview) }
        });
        return NextResponse.json({ success: true, updated: workIds.length });
      } else if (workId) {
        await prisma.work.update({
          where: { workId },
          data: { needsReview: Boolean(needsReview) }
        });
        return NextResponse.json({ success: true });
      }
    }

    // ゲーム登録（エロネーター登録）フラグの更新
    if (action === 'setGameRegistered') {
      const { gameRegistered } = body;
      const value = Boolean(gameRegistered);

      const tryUpdate = async () => {
        if (workIds && Array.isArray(workIds)) {
          await prisma.work.updateMany({
            where: { workId: { in: workIds } },
            data: { gameRegistered: value }
          });
          return NextResponse.json({ success: true, updated: workIds.length });
        }
        if (workId) {
          await prisma.work.update({
            where: { workId },
            data: { gameRegistered: value }
          });
          return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'workId or workIds required' }, { status: 400 });
      };

      try {
        return await tryUpdate();
      } catch (err: unknown) {
        const prismaErr = err as { code?: string; meta?: { column?: string } };
        if (prismaErr?.code === 'P2022' && prismaErr?.meta?.column === 'gameRegistered') {
          await ensureGameRegisteredColumn();
          return await tryUpdate();
        }
        throw err;
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

      // 同名の OFFICIAL/DERIVED が既にあればその tagKey を使う（重複防止）
      let tagKey = await resolveTagKeyForDisplayName(prisma, trimmedName);
      let tag: { tagKey: string; displayName: string } | null = tagKey
        ? await prisma.tag.findUnique({ where: { tagKey }, select: { tagKey: true, displayName: true } })
        : null;

      if (!tag) {
        tagKey = generateTagKey(trimmedName);
        tag = await prisma.tag.create({
          data: {
            tagKey,
            displayName: trimmedName,
            tagType: 'DERIVED',
            category: 'その他',
            questionText: `${trimmedName}が関係している？`,
          }
        });
        console.log(`[ManualTag] Created new tag: ${trimmedName} (${tag.tagKey})`);
      } else {
        tagKey = tag.tagKey;
      }

      // 既に紐付いているか確認
      const existing = await prisma.workTag.findUnique({
        where: { workId_tagKey: { workId, tagKey } }
      });

      if (existing) {
        return NextResponse.json({ error: 'このタグは既に追加されています' }, { status: 400 });
      }

      // WorkTagを作成
      await prisma.workTag.create({
        data: {
          workId,
          tagKey,
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
