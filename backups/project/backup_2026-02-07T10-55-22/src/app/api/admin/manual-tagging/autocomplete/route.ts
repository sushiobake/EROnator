/**
 * 人力タグ付け: オートコンプリート候補
 * GET ?type=official|derived|structural|all&q=コス
 * - official: OFFICIALタグ（追加S用）
 * - derived: 全DERIVED（A/B/C欄、rank付きで返す）
 * - structural: STRUCTURAL（キャラ用）
 * - all: S+A+B+C をまとめて、rank付きで返す（共通入力用）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import fs from 'fs/promises';
import path from 'path';

const TAG_RANKS_PATH = 'config/tagRanks.json';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'derived';
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);

    if (type === 'all') {
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
      const sList = officialTags.map((t) => ({ displayName: t.displayName, rank: 'S' as const }));
      const abcList = derivedTags
        .map((t) => {
          const r = tagRanks[t.displayName];
          if (r === 'A' || r === 'B' || r === 'C') return { displayName: t.displayName, rank: r as 'A' | 'B' | 'C' };
          return null;
        })
        .filter((x): x is { displayName: string; rank: 'A' | 'B' | 'C' } => x != null);
      let combined = [...sList, ...abcList];
      if (q) {
        combined = combined.filter((n) => n.displayName.toLowerCase().includes(q));
      }
      combined.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));
      return NextResponse.json({ success: true, items: combined.slice(0, limit) });
    }

    if (type === 'official') {
      const tags = await prisma.tag.findMany({
        where: { tagType: 'OFFICIAL' },
        select: { displayName: true },
        orderBy: { displayName: 'asc' },
      });
      let list = tags.map((t) => t.displayName);
      if (q) {
        list = list.filter((n) => n.toLowerCase().includes(q));
      }
      return NextResponse.json({ success: true, items: list.slice(0, limit) });
    }

    if (type === 'derived') {
      const tags = await prisma.tag.findMany({
        where: { tagType: 'DERIVED' },
        select: { displayName: true },
        orderBy: { displayName: 'asc' },
      });
      let tagRanks: Record<string, string> = {};
      try {
        const content = await fs.readFile(path.join(process.cwd(), TAG_RANKS_PATH), 'utf-8');
        const parsed = JSON.parse(content);
        tagRanks = parsed.ranks || {};
      } catch {
        // ignore
      }
      let list = tags.map((t) => ({ displayName: t.displayName, rank: tagRanks[t.displayName] || '' }));
      if (q) {
        list = list.filter((n) => n.displayName.toLowerCase().includes(q));
      }
      return NextResponse.json({ success: true, items: list.slice(0, limit) });
    }

    if (type === 'structural') {
      const tags = await prisma.tag.findMany({
        where: { tagType: 'STRUCTURAL' },
        select: { displayName: true },
        orderBy: { displayName: 'asc' },
      });
      let list = tags.map((t) => t.displayName);
      if (q) {
        list = list.filter((n) => n.toLowerCase().includes(q));
      }
      return NextResponse.json({ success: true, items: list.slice(0, limit) });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('[manual-tagging/autocomplete]', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
