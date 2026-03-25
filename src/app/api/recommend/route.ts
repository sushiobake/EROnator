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
import {
  buildDisplayNameToTagKeyDeterministic,
  getFamousTagsGroupedForApi,
} from '@/server/recommend/famousTagsEngine';
import fs from 'fs';
import path from 'path';

function loadIncludeUnify(): { include: Record<string, string[]>; unify: string[][] } {
  try {
    const p = path.join(process.cwd(), 'config', 'tagIncludeUnify.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return { include: data.include ?? {}, unify: data.unify ?? [] };
  } catch {
    return { include: {}, unify: [] };
  }
}

/** tagKey → 代表 tagKey のマッピング（統合・包括適用用） */
async function loadTagKeyToRepresentative(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { include, unify } = loadIncludeUnify();
  const displayNameToTagKey = await buildDisplayNameToTagKeyDeterministic(prisma);
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
    const grouped = await getFamousTagsGroupedForApi(prisma);
    return NextResponse.json({ success: true, tags: grouped });
  } catch (error) {
    console.error('Error in /api/recommend GET:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** 新フロー: 順位に応じた重み（1位=5, 2位=4, 3位=3, 4位=2, 5位=1） */
const RANK_WEIGHTS: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

/** 好みマッチ度・並び: 50 + tagMatchRatio×35 + popAlign×15（レビュー平均は popularityBase に含まれるため二重加算しない） */
const RECOMMEND_PREF_BASE = 50;
const RECOMMEND_PREF_TAG_WEIGHT = 35;
const RECOMMEND_PREF_POP_WEIGHT = 15;

type PopularityChoice = 'famous' | 'hidden' | 'middle';

function parsePopularityChoice(body: { popularityChoice?: unknown }): PopularityChoice {
  const v = body.popularityChoice;
  if (v === 'famous' || v === 'hidden' || v === 'middle') return v;
  return 'middle';
}

/** 取得した候補作品群から動的にスケール（将来 max 55 までデータが伸びても追従） */
function computeMaxPopFromWorks(works: Array<{ popularityBase: number | null | undefined }>): number {
  let m = 0;
  for (const w of works) m = Math.max(m, w.popularityBase ?? 0);
  return Math.max(1, m);
}

function targetPopForChoice(choice: PopularityChoice, maxPop: number): number {
  if (choice === 'famous') return maxPop;
  if (choice === 'hidden') return 0;
  return maxPop / 2;
}

/** 0〜1。作品の popularityBase がユーザーの嗜好ターゲットに近いほど高い */
function computePopAlign(workPop: number, targetPop: number, maxPop: number): number {
  const dist = Math.abs(workPop - targetPop);
  return Math.max(0, Math.min(1, 1 - dist / maxPop));
}

function computePreferenceScore(tagMatchRatio: number, popAlign: number): number {
  const raw =
    RECOMMEND_PREF_BASE + tagMatchRatio * RECOMMEND_PREF_TAG_WEIGHT + popAlign * RECOMMEND_PREF_POP_WEIGHT;
  return Math.min(100, Math.max(50, raw));
}

const POPULARITY_CHOICE_LABEL: Record<PopularityChoice, string> = {
  famous: 'やっぱり有名作品',
  hidden: '隠れた名作',
  middle: '中間くらい',
};

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

    const popularityChoice = parsePopularityChoice(body);
    const maxPop = computeMaxPopFromWorks(works);
    const targetPop = targetPopForChoice(popularityChoice, maxPop);

    let maxPossibleWeight = 0;
    for (const wgt of tagKeyToWeight.values()) maxPossibleWeight += wgt;

    const scored = works.map(w => {
      const workPop = Math.max(0, w.popularityBase ?? 0);
      const popAlign = computePopAlign(workPop, targetPop, maxPop);

      let tagMatchRatio: number;
      if (useNewScoring) {
        let weightedMatchSum = 0;
        for (const wt of w.workTags) {
          const k = normalizeTagKey(wt.tagKey);
          const wgt = tagKeyToWeight.get(k);
          if (wgt) weightedMatchSum += wgt;
        }
        tagMatchRatio = maxPossibleWeight > 0 ? weightedMatchSum / maxPossibleWeight : 1;
      } else {
        const selectedSet = new Set(legacyTagKeys);
        const hasTags = selectedSet.size > 0;
        const matchedTags = w.workTags.filter(wt => selectedSet.has(wt.tagKey));
        tagMatchRatio = hasTags ? matchedTags.length / selectedSet.size : 1;
      }

      const prefScore = computePreferenceScore(tagMatchRatio, popAlign);
      const score = prefScore;
      const matchRate = parseFloat(prefScore.toFixed(1));

      const matchedTagCount = useNewScoring
        ? w.workTags.filter(wt => allSelectedSet.has(normalizeTagKey(wt.tagKey))).length
        : w.workTags.filter(wt => legacyTagKeys.includes(wt.tagKey)).length;
      const totalSelected = useNewScoring ? allSelectedSet.size : legacyTagKeys.length;

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

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.workId.localeCompare(b.workId);
    });
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

      const tagMetaByKey = new Map<string, { weight: number; source: string }>();
      for (const t of tagsWithWeights) tagMetaByKey.set(t.tagKey, { weight: t.weight, source: t.source });

      const worksDebug = recommendedWorks.map(rec => {
        const work = works.find(w => w.workId === rec.workId);
        const workTags = work?.workTags ?? [];
        const tags = workTags.map(wt => ({
          tagKey: wt.tagKey,
          displayName: tagKeyToDisplayName.get(wt.tagKey) ?? wt.tagKey,
        }));

        const workPop = Math.max(0, work?.popularityBase ?? 0);
        const distToTarget = Math.abs(workPop - targetPop);
        const popAlign = computePopAlign(workPop, targetPop, maxPop);

        let tagMatchRatio: number;
        let weightedMatchSum: number | null = null;
        const matchedTags: Array<{ tagKey: string; displayName: string; weight: number; source: string }> = [];
        const unmatchedSelected: Array<{ tagKey: string; displayName: string; weight: number; source: string }> = [];

        if (useNewScoring) {
          weightedMatchSum = 0;
          const matchedKeysOneRow = new Set<string>();
          for (const wt of workTags) {
            const k = normalizeTagKey(wt.tagKey);
            const wgt = tagKeyToWeight.get(k);
            if (wgt) {
              weightedMatchSum += wgt;
              if (!matchedKeysOneRow.has(k)) {
                matchedKeysOneRow.add(k);
                const meta = tagMetaByKey.get(k);
                matchedTags.push({
                  tagKey: k,
                  displayName: tagKeyToDisplayName.get(wt.tagKey) ?? tagKeyToDisplayName.get(k) ?? k,
                  weight: wgt,
                  source: meta?.source ?? '—',
                });
              }
            }
          }
          tagMatchRatio = maxPossibleWeight > 0 ? weightedMatchSum / maxPossibleWeight : 1;
          for (const selKey of tagKeyToWeight.keys()) {
            let hit = false;
            for (const wt of workTags) {
              if (normalizeTagKey(wt.tagKey) === selKey) {
                hit = true;
                break;
              }
            }
            if (!hit) {
              const wgt = tagKeyToWeight.get(selKey) ?? 0;
              const meta = tagMetaByKey.get(selKey);
              unmatchedSelected.push({
                tagKey: selKey,
                displayName: tagKeyToDisplayName.get(selKey) ?? selKey,
                weight: wgt,
                source: meta?.source ?? '—',
              });
            }
          }
        } else {
          const selectedSet = new Set(legacyTagKeys);
          const hasTags = selectedSet.size > 0;
          const matchedKeys = new Set<string>();
          for (const wt of workTags) {
            if (selectedSet.has(wt.tagKey) && !matchedKeys.has(wt.tagKey)) {
              matchedKeys.add(wt.tagKey);
              matchedTags.push({
                tagKey: wt.tagKey,
                displayName: tagKeyToDisplayName.get(wt.tagKey) ?? wt.tagKey,
                weight: 1,
                source: 'レガシー',
              });
            }
          }
          tagMatchRatio = hasTags ? matchedKeys.size / selectedSet.size : 1;
          if (hasTags) {
            for (const k of new Set(legacyTagKeys)) {
              if (!matchedKeys.has(k)) {
                unmatchedSelected.push({
                  tagKey: k,
                  displayName: tagKeyToDisplayName.get(k) ?? k,
                  weight: 1,
                  source: 'レガシー',
                });
              }
            }
          }
        }

        const tagPortion = tagMatchRatio * RECOMMEND_PREF_TAG_WEIGHT;
        const popPortion = popAlign * RECOMMEND_PREF_POP_WEIGHT;
        const sumBeforeClamp = RECOMMEND_PREF_BASE + tagPortion + popPortion;
        const totalAfterClamp = computePreferenceScore(tagMatchRatio, popAlign);

        return {
          workId: rec.workId,
          title: rec.title,
          matchRate: rec.matchRate,
          score: rec.score,
          tags,
          matchedTags,
          unmatchedSelected,
          formula: {
            workPopularityBase: workPop,
            targetPop,
            maxPop,
            distanceToTarget: distToTarget,
            popAlign,
            tagMatchRatio,
            weightedMatchSum,
            maxPossibleWeight: useNewScoring ? maxPossibleWeight : null,
            matchedTagCount: rec.matchedTagCount,
            totalSelectedTags: rec.totalSelectedTags,
            base: RECOMMEND_PREF_BASE,
            tagMultiplier: RECOMMEND_PREF_TAG_WEIGHT,
            popMultiplier: RECOMMEND_PREF_POP_WEIGHT,
            tagPortion,
            popPortion,
            sumBeforeClamp,
            totalAfterClamp,
            matchRateRounded: rec.matchRate,
          },
        };
      });

      debug = {
        tagsWithWeights,
        works: worksDebug,
        scoringContext: {
          popularityChoice,
          popularityChoiceLabel: POPULARITY_CHOICE_LABEL[popularityChoice],
          useNewScoring,
          maxPossibleWeight: useNewScoring ? maxPossibleWeight : null,
          formulaLine: `好みマッチ度 = clamp(50, 100, ${RECOMMEND_PREF_BASE} + tagMatchRatio×${RECOMMEND_PREF_TAG_WEIGHT} + popAlign×${RECOMMEND_PREF_POP_WEIGHT})`,
        },
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
