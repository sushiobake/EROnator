/**
 * POST /api/recommend/unknown-tags
 * 後半（質問4以降）のタグ候補。最大100件（画面は20件×5）。
 *
 * rankedFamous を1つ以上持つ登録作品を母集団とし、その作品に付いたタグを集計。
 * 候補は次のいずれかで、関連度（母集団内の出現作品数）降順でソートする。
 * - 前半グリッド未表示の有名タグ（famousTagKeys にあり displayedFamousKeys にない）
 * - 無名タグ（tagCategories 側の「有名」定義に含まれない tagKey）
 * 前半整理で既に順位付けしたタグ（rankedFamous）は除外。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import fs from 'fs';
import path from 'path';

const TOTAL_TAGS = 100;

/** 有名タグの displayName（tagCategories の全タグ + include の代表）。これらを除外。 */
function loadFamousDisplayNames(): Set<string> {
  const names = new Set<string>();
  try {
    const catPath = path.join(process.cwd(), 'config', 'tagCategories.json');
    const catData = JSON.parse(fs.readFileSync(catPath, 'utf-8'));
    const tagsByCategory = catData.tagsByCategory ?? {};
    for (const arr of Object.values(tagsByCategory) as string[][]) {
      for (const dn of arr) names.add(dn);
    }
    const iuPath = path.join(process.cwd(), 'config', 'tagIncludeUnify.json');
    const iuData = JSON.parse(fs.readFileSync(iuPath, 'utf-8'));
    for (const rep of Object.keys(iuData.include ?? {})) names.add(rep);
    for (const group of iuData.unify ?? []) {
      if (group[0]) names.add(group[0]);
    }
  } catch {
    // ignore
  }
  return names;
}

/** 統合・包括の被包括・統合タグの displayName（代表にまとめられる側） */
function loadExcludedDisplayNames(): Set<string> {
  const excluded = new Set<string>();
  try {
    const p = path.join(process.cwd(), 'config', 'tagIncludeUnify.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const include = data.include ?? {};
    const unify = data.unify ?? [];
    for (const included of Object.values(include) as string[][]) {
      for (const x of included) excluded.add(x);
    }
    for (const group of unify) {
      for (let i = 1; i < group.length; i++) excluded.add(group[i]);
    }
  } catch {
    // ignore
  }
  return excluded;
}

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const rankedFamous: Array<{ tagKey: string; rank: number }> = Array.isArray(body.rankedFamous)
      ? body.rankedFamous.map((x: { tagKey?: string; rank?: number }) => ({
          tagKey: String(x?.tagKey ?? ''),
          rank: Number(x?.rank ?? 1),
        }))
      : [];
    const displayedFamousKeys = new Set<string>(
      Array.isArray(body.displayedFamousKeys) ? body.displayedFamousKeys.map((k: string) => String(k)) : []
    );
    const famousTagKeys: string[] = Array.isArray(body.famousTagKeys) ? body.famousTagKeys.map((k: string) => String(k)) : [];

    const famousDisplayNames = loadFamousDisplayNames();
    const excludedDisplayNames = loadExcludedDisplayNames();
    const allExcludedNames = new Set([...famousDisplayNames, ...excludedDisplayNames]);

    const allTagsForDisplay = await prisma.tag.findMany({
      select: { tagKey: true, displayName: true },
    });
    const tagDisplayMap = new Map<string, string>();
    for (const t of allTagsForDisplay) tagDisplayMap.set(t.tagKey, t.displayName);

    const rankedKeysSet = new Set(rankedFamous.map(t => t.tagKey).filter(Boolean));
    const tagKeysRanked = rankedFamous.map(t => t.tagKey).filter(Boolean);
    const famousKeysSet = new Set(famousTagKeys);

    const excludeTagKeys = new Set<string>();
    for (const k of famousTagKeys) excludeTagKeys.add(k);
    if (allExcludedNames.size > 0) {
      const rows = await prisma.tag.findMany({
        where: { displayName: { in: Array.from(allExcludedNames) } },
        select: { tagKey: true },
      });
      for (const r of rows) excludeTagKeys.add(r.tagKey);
    }

    const gameWorksWhere = { gameRegistered: true, needsReview: false };

    type Row = { tagKey: string; displayName: string; count: number; isFamous: boolean };
    const rows: Row[] = [];

    if (tagKeysRanked.length > 0) {
      const works = await prisma.work.findMany({
        where: { ...gameWorksWhere, workTags: { some: { tagKey: { in: tagKeysRanked } } } },
        select: { workId: true },
      });
      const workIds = works.map(w => w.workId);

      if (workIds.length > 0) {
        const grouped = await prisma.workTag.groupBy({
          by: ['tagKey'],
          _count: { tagKey: true },
          where: { workId: { in: workIds } },
        });

        for (const g of grouped) {
          const k = g.tagKey;
          if (rankedKeysSet.has(k)) continue;

          const isUnshownFamous = famousKeysSet.has(k) && !displayedFamousKeys.has(k);
          const isUnknown = !excludeTagKeys.has(k);
          if (!isUnshownFamous && !isUnknown) continue;

          rows.push({
            tagKey: k,
            displayName: tagDisplayMap.get(k) ?? k,
            count: g._count.tagKey,
            isFamous: isUnshownFamous,
          });
        }
        rows.sort((a, b) => b.count - a.count);
      }
    }

    if (rows.length === 0 && famousTagKeys.length > 0) {
      for (const tagKey of famousTagKeys) {
        if (displayedFamousKeys.has(tagKey) || rankedKeysSet.has(tagKey)) continue;
        rows.push({
          tagKey,
          displayName: tagDisplayMap.get(tagKey) ?? tagKey,
          count: 0,
          isFamous: true,
        });
      }
    }

    const tags = rows.slice(0, TOTAL_TAGS).map(({ tagKey, displayName, count, isFamous }) => ({
      tagKey,
      displayName,
      count,
      isFamous,
    }));

    return NextResponse.json({
      success: true,
      tags,
    });
  } catch (error) {
    console.error('Error in /api/recommend/unknown-tags POST:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
