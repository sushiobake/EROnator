/**
 * /api/admin/tags/update: タグの質問テンプレートを更新するAPI
 * Phase 3: 統合・包括グループ内の全タグに同期する
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { getGroupDisplayNames } from '@/server/config/tagIncludeUnify';

export interface UpdateRequest {
  tagKey: string;
  questionText?: string | null;
  /** 大別カテゴリ: ストーリー | プレイ | キャラクター | 未分類 */
  category?: string | null;
}

export interface UpdateResponse {
  success: boolean;
  tag?: {
    tagKey: string;
    displayName: string;
    questionText: string | null;
    category?: string | null;
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
    await ensurePrismaConnected();

    const body: UpdateRequest = await request.json();
    const { tagKey, questionText, category } = body;

    if (!tagKey) {
      return NextResponse.json(
        { error: 'tagKey is required' },
        { status: 400 }
      );
    }

    // タグが存在するか確認
    const existingTag = await prisma.tag.findUnique({
      where: { tagKey },
      select: {
        tagKey: true,
        displayName: true,
      },
    });

    // Prismaで見つからない場合、直接SQLiteで更新（フォールバック）
    if (!existingTag) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite3 = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const db = sqlite3(dbPath);
        
        // questionTextカラムが存在するか確認（無ければ追加）
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const tableInfo = db.prepare("PRAGMA table_info(Tag)").all() as Array<{ name: string }>;
        const hasQuestionText = tableInfo.some(col => col.name === 'questionText');
        
        if (!hasQuestionText) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          db.prepare('ALTER TABLE Tag ADD COLUMN questionText TEXT').run();
        }
        
        // タグが存在するか確認
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const directTag = db.prepare('SELECT tagKey, displayName FROM Tag WHERE tagKey = ?').get(tagKey) as {
          tagKey: string;
          displayName: string;
        } | undefined;
        
        if (!directTag) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          db.close();
          return NextResponse.json(
            { error: 'Tag not found' },
            { status: 404 }
          );
        }
        
        // 質問テンプレート・カテゴリを更新（送られたフィールドのみ）
        const hasCategoryCol = tableInfo.some(col => col.name === 'category');
        if (questionText !== undefined && hasCategoryCol && category !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          db.prepare('UPDATE Tag SET questionText = ?, category = ? WHERE tagKey = ?').run(questionText ?? null, category ?? null, tagKey);
        } else if (category !== undefined && hasCategoryCol) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          db.prepare('UPDATE Tag SET category = ? WHERE tagKey = ?').run(category, tagKey);
        } else if (questionText !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          db.prepare('UPDATE Tag SET questionText = ? WHERE tagKey = ?').run(questionText ?? null, tagKey);
        }
        
        // 更新後のタグを取得
        const selectCols = hasCategoryCol ? 'tagKey, displayName, questionText, category' : 'tagKey, displayName, questionText';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const updatedDirectTag = db.prepare(`SELECT ${selectCols} FROM Tag WHERE tagKey = ?`).get(tagKey) as {
          tagKey: string;
          displayName: string;
          questionText: string | null;
        };
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        db.close();
        
        return NextResponse.json({
          success: true,
          tag: updatedDirectTag,
        });
      } catch (directError) {
        console.error('Error updating tag via direct SQLite:', directError);
        return NextResponse.json(
          {
            success: false,
            error: directError instanceof Error ? directError.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // Phase 3: 統合・包括グループ内の全タグに同期
    const displayName = existingTag.displayName;
    const groupDisplayNames = getGroupDisplayNames(displayName);
    const tagKeysInGroup = groupDisplayNames.length > 0
      ? (await prisma.tag.findMany({
          where: { displayName: { in: groupDisplayNames } },
          select: { tagKey: true },
        })).map(t => t.tagKey)
      : [tagKey];

    const updateData: { questionText?: string | null; category?: string | null } = {};
    if (questionText !== undefined) updateData.questionText = questionText ?? null;
    if (category !== undefined) updateData.category = category;
    if (Object.keys(updateData).length === 0) {
      const updatedTag = await prisma.tag.findUnique({ where: { tagKey }, select: { tagKey: true, displayName: true, questionText: true, category: true } });
      return NextResponse.json({ success: true, tag: updatedTag ?? { tagKey, displayName: displayName ?? '', questionText: null, category: null }, syncedCount: tagKeysInGroup.length });
    }
    await prisma.tag.updateMany({
      where: { tagKey: { in: tagKeysInGroup } },
      data: updateData,
    });

    const updatedTag = await prisma.tag.findUnique({
      where: { tagKey },
      select: {
        tagKey: true,
        displayName: true,
        questionText: true,
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      tag: updatedTag ?? { tagKey, displayName: displayName ?? '', questionText: questionText ?? null, category: category ?? null },
      syncedCount: tagKeysInGroup.length,
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
