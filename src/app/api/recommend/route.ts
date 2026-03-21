/**
 * GET /api/recommend - 推薦用の有名タグをカテゴリ別に取得（ストーリー・プレイ・キャラクター、各40件）
 * POST /api/recommend - 選ばれたタグに基づき最終優先順位でスコアし、推薦結果を取得
 *
 * 統合・包括（tagIncludeUnify.json）はタグを使用するすべての場面で適用する。
 * - GET: 代表タグのみ返す。被包括・統合タグは除外。
 * - POST: スコア計算で作品のタグを代表タグに正規化してマッチ判定。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import fs from 'fs';
import path from 'path';

/** 推薦フローで使う3カテゴリ。tagCategories のキーにマッピング */
const RECOMMEND_CATEGORIES = ['ストーリー', 'プレイ', 'キャラクター'] as const;
const FAMOUS_PER_CATEGORY = 40;

/** 推薦カテゴリ → tagCategories の tagsByCategory キー */
const CATEGORY_MAP: Record<string, string[]> = {
  ストーリー: ['シチュエーション/系統', '関係性'],
  プレイ: ['プレイ・行為', '場所'],
  キャラクター: ['キャラ・職業', '属性', 'キャラクター'],
};

function loadIncludeUnify(): { include: Record<string, string[]>; unify: string[][] } {
  try {
    const p = path.join(process.cwd(), 'config', 'tagIncludeUnify.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return { include: data.include ?? {}, unify: data.unify ?? [] };
  } catch {
    return { include: {}, unify: [] };
  }
}

function loadTagsByCategory(): Record<string, string[]> {
  try {
    const p = path.join(process.cwd(), 'config', 'tagCategories.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return data.tagsByCategory ?? {};
  } catch {
    return {};
  }
}

/** tagKey → 代表 tagKey のマッピング（統合・包括適用用） */
async function loadTagKeyToRepresentative(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { include, unify } = loadIncludeUnify();
  const allTags = await prisma.tag.findMany({ select: { tagKey: true, displayName: true } });
  const displayNameToTagKey = new Map<string, string>();
  for (const t of allTags) {
    if (!displayNameToTagKey.has(t.displayName)) displayNameToTagKey.set(t.displayName, t.tagKey);
  }
  for (const [rep, subs] of Object.entries(include)) {
    const repKey = displayNameToTagKey.get(rep);
    if (!repKey) continue;
    for (const sub of subs) {
      const subKey = displayNameToTagKey.get(sub);
      if (subKey) map.set(subKey, repKey);
    }
  }
  for (const group of unify) {
    const repKey = displayNameToTagKey.get(group[0]);
    if (!repKey) continue;
    for (let i = 1; i < group.length; i++) {
      const subKey = displayNameToTagKey.get(group[i]);
      if (subKey) map.set(subKey, repKey);
    }
  }
  return map;
}

export async function GET() {
  try {
    await ensurePrismaConnected();

    const { include, unify } = loadIncludeUnify();
    const tagsByCategory = loadTagsByCategory();

    const excluded = new Set<string>();
    for (const included of Object.values(include)) {
      for (const x of included) excluded.add(x);
    }
    for (const group of unify) {
      for (let i = 1; i < group.length; i++) excluded.add(group[i]);
    }

    const allTags = await prisma.tag.findMany({
      select: { tagKey: true, displayName: true },
    });
    const displayNameToTagKey = new Map<string, string>();
    for (const t of allTags) {
      if (!displayNameToTagKey.has(t.displayName)) displayNameToTagKey.set(t.displayName, t.tagKey);
    }

    const workTagCounts = await prisma.workTag.groupBy({
      by: ['tagKey'],
      _count: { tagKey: true },
      having: { tagKey: { _count: { gte: 10 } } },
    });
    const countByKey = new Map(workTagCounts.map(w => [w.tagKey, w._count.tagKey]));

    const grouped: Record<string, Array<{ tagKey: string; displayName: string; count: number }>> = {
      ストーリー: [],
      プレイ: [],
      キャラクター: [],
    };

    for (const recCat of RECOMMEND_CATEGORIES) {
      const sourceNames = new Set<string>();
      for (const sourceKey of CATEGORY_MAP[recCat]) {
        for (const dn of tagsByCategory[sourceKey] ?? []) sourceNames.add(dn);
      }
      const seen = new Set<string>();
      for (const displayName of sourceNames) {
        if (excluded.has(displayName)) continue;
        const tagKey = displayNameToTagKey.get(displayName);
        if (!tagKey) continue;
        let count = countByKey.get(tagKey) ?? 0;
        if (include[displayName]) {
          for (const sub of include[displayName]) {
            const sk = displayNameToTagKey.get(sub);
            if (sk) count += countByKey.get(sk) ?? 0;
          }
        }
        const unifyGroup = unify.find(g => g.includes(displayName));
        if (unifyGroup && unifyGroup[0] === displayName) {
          for (let i = 1; i < unifyGroup.length; i++) {
            const uk = displayNameToTagKey.get(unifyGroup[i]);
            if (uk) count += countByKey.get(uk) ?? 0;
          }
        }
        if (count < 10) continue;
        if (seen.has(displayName)) continue;
        seen.add(displayName);
        grouped[recCat].push({ tagKey, displayName, count });
      }
      grouped[recCat].sort((a, b) => b.count - a.count);
      grouped[recCat] = grouped[recCat].slice(0, FAMOUS_PER_CATEGORY);
    }

    return NextResponse.json({ success: true, tags: grouped });
  } catch (error) {
    console.error('Error in /api/recommend GET:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** 新フロー: 順位に応じた重み（1位=5, 2位=4, 3位=3, 4位=2, 5位=1） */
const RANK_WEIGHTS: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();

    const tagKeyToRep = await loadTagKeyToRepresentative();
    const normalizeTagKey = (k: string) => tagKeyToRep.get(k) ?? k;

    const body = await request.json();
    const rankedFinal: Array<{ tagKey: string; rank: number }> = Array.isArray(body.rankedFinal)
      ? body.rankedFinal.map((x: { tagKey?: string; rank?: number }) => ({
          tagKey: String(x?.tagKey ?? ''),
          rank: Math.min(5, Math.max(1, Number(x?.rank ?? 1))),
        }))
      : [];
    const legacyTagKeys: string[] = Array.isArray(body.tagKeys) ? body.tagKeys : [];
    const selectedFamous: Array<{ tagKey: string; important: boolean }> = Array.isArray(body.selectedFamous)
      ? body.selectedFamous.map((x: { tagKey?: string; important?: boolean }) => ({
          tagKey: String(x?.tagKey ?? ''),
          important: Boolean(x?.important),
        }))
      : [];
    const selectedUnknown: Array<{ tagKey: string; important: boolean }> = Array.isArray(body.selectedUnknown)
      ? body.selectedUnknown.map((x: { tagKey?: string; important?: boolean }) => ({
          tagKey: String(x?.tagKey ?? ''),
          important: Boolean(x?.important),
        }))
      : [];
    const famousTagKeysSet = new Set(
      (body.famousTagKeys && Array.isArray(body.famousTagKeys) ? body.famousTagKeys : []).map((k: string) => String(k))
    );

    const allTagKeys = new Set<string>();
    if (rankedFinal.length > 0) {
      for (const t of rankedFinal) allTagKeys.add(t.tagKey);
    } else {
      for (const t of selectedFamous) allTagKeys.add(t.tagKey);
      for (const t of selectedUnknown) allTagKeys.add(t.tagKey);
    }
    if (legacyTagKeys.length > 0) {
      legacyTagKeys.forEach(k => allTagKeys.add(k));
    }

    const whereClause =
      allTagKeys.size === 0
        ? { gameRegistered: true, needsReview: false }
        : {
            gameRegistered: true,
            needsReview: false,
            workTags: { some: { tagKey: { in: Array.from(allTagKeys) } } },
          };

    const works = await prisma.work.findMany({
      where: whereClause,
      select: {
        workId: true,
        title: true,
        authorName: true,
        productUrl: true,
        thumbnailUrl: true,
        reviewAverage: true,
        reviewCount: true,
        popularityBase: true,
        workTags: { select: { tagKey: true } },
      },
      orderBy: { popularityBase: 'desc' },
      take: allTagKeys.size === 0 ? 500 : 2000,
    });

    const tagKeyToWeight = new Map<string, number>();
    if (rankedFinal.length > 0) {
      for (const t of rankedFinal) {
        tagKeyToWeight.set(t.tagKey, RANK_WEIGHTS[t.rank] ?? 1);
      }
    } else {
      const importantUnknownSet = new Set(selectedUnknown.filter(t => t.important).map(t => t.tagKey));
      const importantFamousSet = new Set(selectedFamous.filter(t => t.important).map(t => t.tagKey));
      const famousSet = new Set(selectedFamous.map(t => t.tagKey));
      const unknownSet = new Set(selectedUnknown.map(t => t.tagKey));
      for (const k of importantUnknownSet) tagKeyToWeight.set(k, 3);
      for (const k of importantFamousSet) tagKeyToWeight.set(k, 2.5);
      for (const k of unknownSet) { if (!tagKeyToWeight.has(k)) tagKeyToWeight.set(k, 1.5); }
      for (const k of famousSet) { if (!tagKeyToWeight.has(k)) tagKeyToWeight.set(k, 1); }
    }
    const useNewScoring = rankedFinal.length > 0 || selectedFamous.length > 0 || selectedUnknown.length > 0;
    const allSelectedSet = new Set(tagKeyToWeight.keys());

    const scored = works.map(w => {
      let score: number;
      if (useNewScoring) {
        let sum = 0;
        for (const wt of w.workTags) {
          const k = normalizeTagKey(wt.tagKey);
          const wgt = tagKeyToWeight.get(k);
          if (wgt) sum += wgt;
        }
        const popularityScore = Math.min(1, (w.popularityBase ?? 0) / 50);
        const reviewScore = w.reviewAverage ? w.reviewAverage / 5 : 0;
        score = sum * 0.7 + popularityScore * 0.2 + reviewScore * 0.1;
      } else {
        const selectedSet = new Set(legacyTagKeys);
        const hasTags = selectedSet.size > 0;
        const matchedTags = w.workTags.filter(wt => selectedSet.has(wt.tagKey));
        const matchScore = hasTags ? matchedTags.length / selectedSet.size : 1;
        const popularityScore = Math.min(1, (w.popularityBase ?? 0) / 50);
        const reviewScore = w.reviewAverage ? w.reviewAverage / 5 : 0;
        score = hasTags
          ? matchScore * 0.6 + popularityScore * 0.25 + reviewScore * 0.15
          : popularityScore * 0.6 + reviewScore * 0.4;
      }

      const matchedTagCount = useNewScoring
        ? w.workTags.filter(wt => allSelectedSet.has(normalizeTagKey(wt.tagKey))).length
        : w.workTags.filter(wt => legacyTagKeys.includes(wt.tagKey)).length;
      const totalSelected = useNewScoring ? allSelectedSet.size : legacyTagKeys.length;
      const matchRate = totalSelected > 0 ? Math.min(100, Math.round((matchedTagCount / totalSelected) * 100)) : 100;

      return {
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        productUrl: w.productUrl,
        thumbnailUrl: w.thumbnailUrl,
        reviewAverage: w.reviewAverage,
        reviewCount: w.reviewCount,
        matchedTagCount,
        totalSelectedTags: totalSelected,
        matchRate,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const recommendedWorks = scored.slice(0, 10);

    const wantDebug = body.debug === true;
    let debug: Record<string, unknown> | undefined;
    if (wantDebug) {
      const allTagKeysForDisplay = new Set<string>();
      if (rankedFinal.length > 0) {
        for (const t of rankedFinal) allTagKeysForDisplay.add(t.tagKey);
      } else {
        for (const t of selectedFamous) allTagKeysForDisplay.add(t.tagKey);
        for (const t of selectedUnknown) allTagKeysForDisplay.add(t.tagKey);
      }
      for (const w of scored.slice(0, 10)) {
        const w2 = works.find(x => x.workId === w.workId);
        if (w2) for (const wt of w2.workTags) allTagKeysForDisplay.add(wt.tagKey);
      }
      const tagRows = await prisma.tag.findMany({
        where: { tagKey: { in: Array.from(allTagKeysForDisplay) } },
        select: { tagKey: true, displayName: true },
      });
      const tagKeyToDisplayName = new Map(tagRows.map(r => [r.tagKey, r.displayName]));

      const tagsWithWeights: Array<{ tagKey: string; displayName: string; weight: number; source: string }> = [];
      if (rankedFinal.length > 0) {
        for (const t of rankedFinal) {
          const w = RANK_WEIGHTS[t.rank] ?? 1;
          tagsWithWeights.push({
            tagKey: t.tagKey,
            displayName: tagKeyToDisplayName.get(t.tagKey) ?? t.tagKey,
            weight: w,
            source: `${t.rank}位`,
          });
        }
      } else {
        for (const t of selectedFamous) {
          const w = t.important ? 2.5 : 1;
          tagsWithWeights.push({
            tagKey: t.tagKey,
            displayName: tagKeyToDisplayName.get(t.tagKey) ?? t.tagKey,
            weight: w,
            source: '有名',
          });
        }
        for (const t of selectedUnknown) {
          const w = t.important ? 3 : 1.5;
          tagsWithWeights.push({
            tagKey: t.tagKey,
            displayName: tagKeyToDisplayName.get(t.tagKey) ?? t.tagKey,
            weight: w,
            source: '無名',
          });
        }
      }

      const worksDebug = recommendedWorks.map(rec => {
        const work = works.find(w => w.workId === rec.workId);
        const workTags = work?.workTags ?? [];
        const tags = workTags.map(wt => ({
          tagKey: wt.tagKey,
          displayName: tagKeyToDisplayName.get(wt.tagKey) ?? wt.tagKey,
        }));
        return {
          workId: rec.workId,
          title: rec.title,
          matchRate: rec.matchRate,
          score: rec.score,
          tags,
        };
      });

      debug = {
        tagsWithWeights,
        works: worksDebug,
      };
    }

    return NextResponse.json({
      success: true,
      recommendedWorks,
      totalMatched: scored.length,
      ...(debug ? { debug } : {}),
    });
  } catch (error) {
    console.error('Error in /api/recommend POST:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
