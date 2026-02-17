/**
 * GET: 包括・統合一覧（表示用）
 * Phase 3: tagIncludeUnify.json + DB問い合わせテンプレート + ランク情報
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import fs from 'fs';
import path from 'path';

function getRank(displayName: string, officialSet: Set<string>, ranks: Record<string, string>): 'S' | 'A' | 'B' | 'C' | 'X' {
  if (officialSet.has(displayName)) return 'S';
  const r = ranks[displayName];
  if (r === 'A') return 'A';
  if (r === 'B') return 'B';
  if (r === 'C') return 'C';
  return 'A'; // 未設定DERIVEDはA扱いで表示
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();

    const root = process.cwd();
    const includeUnifyPath = path.join(root, 'config', 'tagIncludeUnify.json');
    const ranksPath = path.join(root, 'config', 'tagRanks.json');
    const officialPath = path.join(root, 'config', 'officialTagsCache.json');
    const tagCategoriesPath = path.join(root, 'config', 'tagCategories.json');

    const includeUnify = JSON.parse(fs.readFileSync(includeUnifyPath, 'utf-8')) as {
      include?: Record<string, string[]>;
      unify?: string[][];
    };

    // DBのみ（Tag.questionText が唯一の参照先）
    const displayNamesForTemplates = new Set<string>();
    for (const rep of Object.keys(includeUnify.include ?? {})) displayNamesForTemplates.add(rep);
    for (const included of Object.values(includeUnify.include ?? {})) {
      for (const d of included) displayNamesForTemplates.add(d);
    }
    for (const group of includeUnify.unify ?? []) {
      for (const d of group) displayNamesForTemplates.add(d);
    }
    const dbTemplatesMap = new Map<string, string>();
    if (displayNamesForTemplates.size > 0) {
      const tagsFromDb = await prisma.tag.findMany({
        where: { displayName: { in: Array.from(displayNamesForTemplates) } },
        select: { displayName: true, questionText: true },
      });
      for (const t of tagsFromDb) {
        if (t.questionText?.trim() && !dbTemplatesMap.has(t.displayName)) {
          dbTemplatesMap.set(t.displayName, t.questionText.trim());
        }
      }
    }
    let ranks: Record<string, string> = {};
    try {
      ranks = JSON.parse(fs.readFileSync(ranksPath, 'utf-8')).ranks ?? {};
    } catch {
      // ignore
    }
    let officialSet = new Set<string>();
    try {
      const officialData = JSON.parse(fs.readFileSync(officialPath, 'utf-8'));
      if (Array.isArray(officialData.tags)) {
        officialSet = new Set(officialData.tags as string[]);
      }
    } catch {
      // ignore
    }

    const defaultPattern = (displayName: string) => `${displayName}が関係している？`;
    const questionText = (displayName: string) =>
      dbTemplatesMap.get(displayName) ?? defaultPattern(displayName);

    const includeList: Array<{
      representative: string;
      rank: string;
      questionText: string;
      included: Array<{ displayName: string; rank: string }>;
    }> = [];

    for (const [rep, included] of Object.entries(includeUnify.include ?? {})) {
      includeList.push({
        representative: rep,
        rank: getRank(rep, officialSet, ranks),
        questionText: questionText(rep),
        included: included.map(displayName => ({
          displayName,
          rank: getRank(displayName, officialSet, ranks),
        })),
      });
    }

    const unifyList: Array<{
      tags: Array<{ displayName: string; rank: string }>;
      questionText: string;
    }> = [];

    const rankOrder = (r: string) => ({ S: 0, A: 1, B: 2, C: 3, N: 4, X: 5 }[r] ?? 6);
    for (const group of includeUnify.unify ?? []) {
      const tagsWithRank = group.map(displayName => ({
        displayName,
        rank: getRank(displayName, officialSet, ranks),
      }));
      tagsWithRank.sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));
      const first = tagsWithRank[0];
      unifyList.push({
        tags: tagsWithRank,
        questionText: first ? questionText(first.displayName) : '',
      });
    }

    // 代表タグの表示カテゴリ（tagCategories.tagsByCategory から。DBに無くても本来のカテゴリに表示する用）
    const representativeCategory: Record<string, string> = {};
    let tagsByCategory: Record<string, string[]> = {};
    try {
      const catData = JSON.parse(fs.readFileSync(tagCategoriesPath, 'utf-8')) as { tagsByCategory?: Record<string, string[]> };
      tagsByCategory = catData.tagsByCategory ?? {};
    } catch {
      // ignore
    }
    for (const [cat, list] of Object.entries(tagsByCategory)) {
      for (const displayName of list) {
        if (!representativeCategory[displayName]) representativeCategory[displayName] = cat;
      }
    }
    for (const item of includeList) {
      if (!representativeCategory[item.representative]) representativeCategory[item.representative] = 'その他';
    }
    for (const group of unifyList) {
      const first = group.tags[0];
      if (first && !representativeCategory[first.displayName]) representativeCategory[first.displayName] = 'その他';
    }

    return NextResponse.json({
      success: true,
      include: includeList,
      unify: unifyList,
      representativeCategory,
    });
  } catch (error) {
    console.error('[include-unify-view]', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
