/**
 * /api/admin/tags/update: タグの質問テンプレートを更新するAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

export interface UpdateRequest {
  tagKey: string;
  questionTemplate: string | null;
}

export interface UpdateResponse {
  success: boolean;
  tag?: {
    tagKey: string;
    displayName: string;
    questionTemplate: string | null;
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
    const { tagKey, questionTemplate } = body;

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
        
        // questionTemplateカラムが存在するか確認
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const tableInfo = db.prepare("PRAGMA table_info(Tag)").all() as Array<{ name: string }>;
        const hasQuestionTemplate = tableInfo.some(col => col.name === 'questionTemplate');
        
        if (!hasQuestionTemplate) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          db.prepare('ALTER TABLE Tag ADD COLUMN questionTemplate TEXT').run();
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
        
        // 質問テンプレートを更新
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        db.prepare('UPDATE Tag SET questionTemplate = ? WHERE tagKey = ?').run(
          questionTemplate || null,
          tagKey
        );
        
        // 更新後のタグを取得
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const updatedDirectTag = db.prepare('SELECT tagKey, displayName, questionTemplate FROM Tag WHERE tagKey = ?').get(tagKey) as {
          tagKey: string;
          displayName: string;
          questionTemplate: string | null;
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

    // 質問テンプレートを更新
    const updatedTag = await prisma.tag.update({
      where: { tagKey },
      data: {
        questionTemplate: questionTemplate || null,
      },
      select: {
        tagKey: true,
        displayName: true,
        questionTemplate: true,
      },
    });

    return NextResponse.json({
      success: true,
      tag: updatedTag,
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
