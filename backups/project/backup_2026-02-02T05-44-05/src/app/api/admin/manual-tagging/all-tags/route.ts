/**
 * 人力タグ付け: 全タグ一覧（S/A/B/C マスター・参考用）
 * GET → { s: string[], a: string[], b: string[], c: string[] }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import fs from 'fs/promises';
import path from 'path';

const TAG_RANKS_PATH = 'config/tagRanks.json';

export async function GET() {
  try {
    const [officialTags, derivedTags] = await Promise.all([
      prisma.tag.findMany({
        where: { tagType: 'OFFICIAL' },
        select: { displayName: true },
        orderBy: { displayName: 'asc' },
      }),
      prisma.tag.findMany({
        where: { tagType: 'DERIVED' },
        select: { displayName: true },
        orderBy: { displayName: 'asc' },
      }),
    ]);
    let tagRanks: Record<string, string> = {};
    try {
      const content = await fs.readFile(path.join(process.cwd(), TAG_RANKS_PATH), 'utf-8');
      const parsed = JSON.parse(content);
      tagRanks = parsed.ranks || {};
    } catch {
      // ignore
    }
    const s = officialTags.map((t) => t.displayName);
    const a = derivedTags.filter((t) => tagRanks[t.displayName] === 'A').map((t) => t.displayName);
    const b = derivedTags.filter((t) => tagRanks[t.displayName] === 'B').map((t) => t.displayName);
    const c = derivedTags.filter((t) => tagRanks[t.displayName] === 'C').map((t) => t.displayName);
    return NextResponse.json({ success: true, s, a, b, c });
  } catch (error) {
    console.error('[manual-tagging/all-tags]', error);
    return NextResponse.json({ error: 'Failed to fetch all tags' }, { status: 500 });
  }
}
