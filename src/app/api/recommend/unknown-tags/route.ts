/**
 * POST /api/recommend/unknown-tags
 * 前半で未表示の有名タグ ＋ 無名タグを返す。最大100件（5バッチ×20）。
 *
 * 新フロー: rankedFamous + displayedFamousKeys を受け取り、
 * - 前半で表示されなかった有名タグ（famousTagKeys - displayedFamousKeys）を先頭に
 * - 無名タグ（tagCategories に含まれない）を続けて返す。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import fs from 'fs';
import path from 'path';

const BATCH_SIZE = 20;
const TOTAL_TAGS = 100;

type CategoryLabel = 'ストーリー' | 'プレイ' | 'キャラクター';

/** Tag.category（細かい）→ 推薦カテゴリ */
const FINE_TO_RECOMMEND: Record<string, CategoryLabel> = {
  'シチュエーション/系統': 'ストーリー',
  シチュエーション: 'ストーリー',
  関係性: 'ストーリー',
  'プレイ・行為': 'プレイ',
  場所: 'プレイ',
  'キャラ・職業': 'キャラクター',
  属性: 'キャラクター',
  キャラクター: 'キャラクター',
};

/** tagCategories の displayName → 推薦カテゴリ（Tag.category が null のときのフォールバック） */
const CATEGORY_MAP: Record<string, string[]> = {
  ストーリー: ['シチュエーション/系統', '関係性'],
  プレイ: ['プレイ・行為', '場所'],
  キャラクター: ['キャラ・職業', '属性', 'キャラクター'],
};

function loadDisplayNameToRecommendCategory(): Map<string, CategoryLabel> {
  const map = new Map<string, CategoryLabel>();
  try {
    const p = path.join(process.cwd(), 'config', 'tagCategories.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const tagsByCategory = data.tagsByCategory ?? {};
    for (const [recCat, sourceKeys] of Object.entries(CATEGORY_MAP)) {
      for (const sk of sourceKeys) {
        for (const dn of tagsByCategory[sk] ?? []) {
          map.set(dn, recCat as CategoryLabel);
        }
      }
    }
  } catch {
    // ignore
  }
  return map;
}

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
    const priorityOrder: CategoryLabel[] = Array.isArray(body.priorityOrder)
      ? body.priorityOrder
          .slice(0, 3)
          .filter((c: string) => ['ストーリー', 'プレイ', 'キャラクター'].includes(c)) as CategoryLabel[]
      : [];

    const famousDisplayNames = loadFamousDisplayNames();
    const excludedDisplayNames = loadExcludedDisplayNames();
    const allExcludedNames = new Set([...famousDisplayNames, ...excludedDisplayNames]);

    const allTagsForDisplay = await prisma.tag.findMany({
      select: { tagKey: true, displayName: true },
    });
    const tagDisplayMap = new Map<string, string>();
    for (const t of allTagsForDisplay) tagDisplayMap.set(t.tagKey, t.displayName);

    const result: Array<{ tagKey: string; displayName: string; count?: number; isFamous?: boolean }> = [];
    const used = new Set<string>();

    const unshownFamousKeys = famousTagKeys.filter(k => !displayedFamousKeys.has(k));
    for (const tagKey of unshownFamousKeys) {
      if (used.has(tagKey)) continue;
      used.add(tagKey);
      result.push({
        tagKey,
        displayName: tagDisplayMap.get(tagKey) ?? tagKey,
        count: 0,
        isFamous: true,
      });
      if (result.length >= TOTAL_TAGS) {
        return NextResponse.json({ success: true, tags: result });
      }
    }

    const excludeTagKeys = new Set<string>();
    for (const k of famousTagKeys) excludeTagKeys.add(k);
    if (allExcludedNames.size > 0) {
      const rows = await prisma.tag.findMany({
        where: { displayName: { in: Array.from(allExcludedNames) } },
        select: { tagKey: true },
      });
      for (const r of rows) excludeTagKeys.add(r.tagKey);
    }

    const displayNameToRecCat = loadDisplayNameToRecommendCategory();
    const tagKeys = rankedFamous.map(t => t.tagKey).filter(Boolean);
    const tagRows = await prisma.tag.findMany({
      where: { tagKey: { in: tagKeys } },
      select: { tagKey: true, displayName: true, category: true },
    });
    const recommendCategoryByKey = new Map<string, CategoryLabel | null>();
    for (const r of tagRows) {
      let recCat: CategoryLabel | null = r.category ? (FINE_TO_RECOMMEND[r.category] ?? null) : null;
      if (!recCat && r.displayName) recCat = displayNameToRecCat.get(r.displayName) ?? null;
      recommendCategoryByKey.set(r.tagKey, recCat);
    }

    const gameWorksWhere = { gameRegistered: true, needsReview: false };

    async function aggregateUnknownFromWorks(
      workIds: string[],
      exclude: Set<string>
    ): Promise<Array<{ tagKey: string; displayName: string; count: number }>> {
      if (workIds.length === 0) return [];
      const workTags = await prisma.workTag.groupBy({
        by: ['tagKey'],
        _count: { tagKey: true },
        where: {
          workId: { in: workIds },
          tagKey: { notIn: Array.from(exclude) },
        },
      });
      return workTags
        .map(row => ({
          tagKey: row.tagKey,
          displayName: tagDisplayMap.get(row.tagKey) ?? row.tagKey,
          count: row._count.tagKey,
        }))
        .sort((a, b) => b.count - a.count);
    }

    function addBatch(
      candidates: Array<{ tagKey: string; displayName: string; count: number }>,
      maxTotal: number
    ) {
      for (const c of candidates) {
        if (used.has(c.tagKey)) continue;
        used.add(c.tagKey);
        result.push({ tagKey: c.tagKey, displayName: c.displayName, count: c.count, isFamous: false });
        if (result.length >= maxTotal) return;
      }
    }

    const excludeCur = new Set(excludeTagKeys);
    for (const r of result) excludeCur.add(r.tagKey);

    const priority1 = priorityOrder[0] ?? null;
    const priority2 = priorityOrder[1] ?? null;

    if (tagKeys.length > 0) {
      const w = await prisma.work.findMany({
        where: { ...gameWorksWhere, workTags: { some: { tagKey: { in: tagKeys } } } },
        select: { workId: true },
      });
      const batch1 = await aggregateUnknownFromWorks(w.map(x => x.workId), excludeCur);
      addBatch(batch1, TOTAL_TAGS);
    }
    for (const r of result) excludeCur.add(r.tagKey);

    if (result.length < TOTAL_TAGS && priority1) {
      const p1Keys = tagKeys.filter(k => recommendCategoryByKey.get(k) === priority1);
      if (p1Keys.length > 0) {
        const w = await prisma.work.findMany({
          where: { ...gameWorksWhere, workTags: { some: { tagKey: { in: p1Keys } } } },
          select: { workId: true },
        });
        const batch2 = await aggregateUnknownFromWorks(w.map(x => x.workId), excludeCur);
        addBatch(batch2, TOTAL_TAGS);
      }
    }
    for (const r of result) excludeCur.add(r.tagKey);

    if (result.length < TOTAL_TAGS && priority2) {
      const p2Keys = tagKeys.filter(k => recommendCategoryByKey.get(k) === priority2);
      if (p2Keys.length > 0) {
        const w = await prisma.work.findMany({
          where: { ...gameWorksWhere, workTags: { some: { tagKey: { in: p2Keys } } } },
          select: { workId: true },
        });
        const batch3 = await aggregateUnknownFromWorks(w.map(x => x.workId), excludeCur);
        addBatch(batch3, TOTAL_TAGS);
      }
    }

    return NextResponse.json({
      success: true,
      tags: result.slice(0, TOTAL_TAGS),
    });
  } catch (error) {
    console.error('Error in /api/recommend/unknown-tags POST:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
