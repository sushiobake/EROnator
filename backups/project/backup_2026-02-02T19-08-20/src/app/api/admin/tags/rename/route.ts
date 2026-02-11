/**
 * タグ名変更API
 * POST: タグのdisplayNameを変更
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import fs from 'fs/promises';
import path from 'path';

const RANKS_FILE = path.join(process.cwd(), 'config', 'tagRanks.json');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tagKey, newDisplayName } = body;

    if (!tagKey || !newDisplayName) {
      return NextResponse.json({ error: 'tagKey and newDisplayName are required' }, { status: 400 });
    }

    // 現在のタグを取得
    const currentTag = await prisma.tag.findUnique({
      where: { tagKey }
    });

    if (!currentTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const oldDisplayName = currentTag.displayName;

    // 同じ名前のタグが既に存在しないかチェック
    const existingTag = await prisma.tag.findFirst({
      where: { 
        displayName: newDisplayName,
        tagKey: { not: tagKey }
      }
    });

    if (existingTag) {
      return NextResponse.json({ error: `タグ「${newDisplayName}」は既に存在します` }, { status: 400 });
    }

    // タグ名を更新
    await prisma.tag.update({
      where: { tagKey },
      data: { displayName: newDisplayName }
    });

    // tagRanks.jsonのキーも更新
    try {
      const ranksContent = await fs.readFile(RANKS_FILE, 'utf-8');
      const ranksConfig = JSON.parse(ranksContent);
      
      if (ranksConfig.ranks[oldDisplayName]) {
        ranksConfig.ranks[newDisplayName] = ranksConfig.ranks[oldDisplayName];
        delete ranksConfig.ranks[oldDisplayName];
        ranksConfig.updatedAt = new Date().toISOString();
        await fs.writeFile(RANKS_FILE, JSON.stringify(ranksConfig, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('Failed to update tagRanks.json:', e);
    }

    return NextResponse.json({ 
      success: true, 
      oldName: oldDisplayName,
      newName: newDisplayName 
    });
  } catch (error) {
    console.error('Error renaming tag:', error);
    return NextResponse.json({ error: 'Failed to rename tag' }, { status: 500 });
  }
}
