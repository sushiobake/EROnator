/**
 * タグ削除API
 * POST: タグを削除（関連するWorkTagも削除、tagRanks.jsonからも削除）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import fs from 'fs';
import path from 'path';

// tagRanks.jsonからタグを削除
function removeFromTagRanks(displayNames: string[]) {
  try {
    const ranksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
    if (!fs.existsSync(ranksPath)) return;
    
    const content = fs.readFileSync(ranksPath, 'utf-8');
    const data = JSON.parse(content);
    const ranks = data.ranks || {};
    
    let removed = 0;
    for (const name of displayNames) {
      if (ranks[name]) {
        delete ranks[name];
        removed++;
      }
    }
    
    if (removed > 0) {
      data.ranks = ranks;
      data.updatedAt = new Date().toISOString();
      fs.writeFileSync(ranksPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[TagDelete] Removed ${removed} tags from tagRanks.json`);
    }
  } catch (e) {
    console.warn('[TagDelete] Failed to update tagRanks.json:', e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tagKey, tagKeys } = body;

    // 単一タグの削除
    if (tagKey) {
      // タグの情報を取得（displayName用）
      const tag = await prisma.tag.findUnique({ where: { tagKey } });
      
      // まず関連するWorkTagを削除
      await prisma.workTag.deleteMany({
        where: { tagKey }
      });
      // タグを削除
      await prisma.tag.delete({
        where: { tagKey }
      });
      
      // tagRanks.jsonからも削除
      if (tag) {
        removeFromTagRanks([tag.displayName]);
      }
      
      return NextResponse.json({ success: true });
    }

    // 一括削除
    if (tagKeys && Array.isArray(tagKeys)) {
      // タグの情報を取得（displayName用）
      const tags = await prisma.tag.findMany({
        where: { tagKey: { in: tagKeys } },
        select: { displayName: true }
      });
      
      // まず関連するWorkTagを削除
      await prisma.workTag.deleteMany({
        where: { tagKey: { in: tagKeys } }
      });
      // タグを削除
      const result = await prisma.tag.deleteMany({
        where: { tagKey: { in: tagKeys } }
      });
      
      // tagRanks.jsonからも削除
      removeFromTagRanks(tags.map(t => t.displayName));
      
      return NextResponse.json({ success: true, deleted: result.count });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}
