/**
 * 推薦モード「有名タグ」取得ロジック（環境間で一致させるための単一ソース）
 *
 * - displayName → tagKey は常に決定的（同一 displayName が複数ある場合は tagKey 昇順で先頭）
 * - コンフィグ recommendFamousTags.json が有効なら、表示順はコンフィグ固定（件数は参考表示）
 * - 無効時は tagCategories + 件数集計で算出（従来と同様だがマッピングは決定的）
 */

import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';

export const RECOMMEND_CATEGORIES = ['ストーリー', 'プレイ', 'キャラクター'] as const;
export type RecommendCategoryLabel = (typeof RECOMMEND_CATEGORIES)[number];

export const FAMOUS_PER_CATEGORY = 40;

/** 推薦カテゴリ → tagCategories の tagsByCategory キー */
export const CATEGORY_MAP: Record<string, string[]> = {
  ストーリー: ['シチュエーション/系統', '関係性'],
  プレイ: ['プレイ・行為', '場所'],
  キャラクター: ['キャラ・職業', '属性', 'キャラクター'],
};

export type FamousTagItem = { tagKey: string; displayName: string; count: number };

export type RecommendFamousTagsFile = {
  version: number;
  /** false のときはカテゴリ自動算出にフォールバック */
  useConfigSlots: boolean;
  /** 各カテゴリ 40 件の表示名（順序＝画面の並び） */
  slots: Record<RecommendCategoryLabel, string[]>;
};

const CONFIG_BASENAME = 'recommendFamousTags.json';

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

export function loadRecommendFamousTagsFile(): RecommendFamousTagsFile | null {
  try {
    const p = path.join(process.cwd(), 'config', CONFIG_BASENAME);
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as RecommendFamousTagsFile;
    if (!data || typeof data !== 'object') return null;
    if (!data.slots || typeof data.slots !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

/** 同一 displayName が複数 tagKey のとき、常に同じ代表を選ぶ */
export async function buildDisplayNameToTagKeyDeterministic(
  prisma: PrismaClient
): Promise<Map<string, string>> {
  const allTags = await prisma.tag.findMany({
    select: { tagKey: true, displayName: true },
    orderBy: [{ displayName: 'asc' }, { tagKey: 'asc' }],
  });
  const displayNameToTagKey = new Map<string, string>();
  for (const t of allTags) {
    if (!displayNameToTagKey.has(t.displayName)) displayNameToTagKey.set(t.displayName, t.tagKey);
  }
  return displayNameToTagKey;
}

async function buildCountByKey(prisma: PrismaClient): Promise<Map<string, number>> {
  const workTagCounts = await prisma.workTag.groupBy({
    by: ['tagKey'],
    _count: { tagKey: true },
    having: { tagKey: { _count: { gte: 10 } } },
  });
  return new Map(workTagCounts.map((w) => [w.tagKey, w._count.tagKey]));
}

/** 全 tagKey の件数（ジェネレーター用・閾値なし） */
export async function buildCountByKeyFull(prisma: PrismaClient): Promise<Map<string, number>> {
  const workTagCounts = await prisma.workTag.groupBy({
    by: ['tagKey'],
    _count: { tagKey: true },
  });
  return new Map(workTagCounts.map((w) => [w.tagKey, w._count.tagKey]));
}

export function computeCountForDisplayName(
  displayName: string,
  tagKey: string,
  countByKey: Map<string, number>,
  displayNameToTagKey: Map<string, string>,
  include: Record<string, string[]>,
  unify: string[][]
): number {
  let count = countByKey.get(tagKey) ?? 0;
  if (include[displayName]) {
    for (const sub of include[displayName]) {
      const sk = displayNameToTagKey.get(sub);
      if (sk) count += countByKey.get(sk) ?? 0;
    }
  }
  const unifyGroup = unify.find((g) => g.includes(displayName));
  if (unifyGroup && unifyGroup[0] === displayName) {
    for (let i = 1; i < unifyGroup.length; i++) {
      const uk = displayNameToTagKey.get(unifyGroup[i]);
      if (uk) count += countByKey.get(uk) ?? 0;
    }
  }
  return count;
}

/**
 * 初回 recommendFamousTags.json 用: 各カテゴリ 40 件の displayName を可能な限り埋める。
 * まず件数>=10 で並べ、足りなければ閾値を下げて補完する。
 */
export async function buildSlotsDisplayNamesForConfigFile(
  prisma: PrismaClient
): Promise<Record<RecommendCategoryLabel, string[]>> {
  const { include, unify } = loadIncludeUnify();
  const tagsByCategory = loadTagsByCategory();
  const displayNameToTagKey = await buildDisplayNameToTagKeyDeterministic(prisma);
  const countByKeyFull = await buildCountByKeyFull(prisma);

  const excluded = new Set<string>();
  for (const included of Object.values(include)) {
    for (const x of included) excluded.add(x);
  }
  for (const group of unify) {
    for (let i = 1; i < group.length; i++) excluded.add(group[i]);
  }

  const result: Record<RecommendCategoryLabel, string[]> = {
    ストーリー: [],
    プレイ: [],
    キャラクター: [],
  };

  for (const recCat of RECOMMEND_CATEGORIES) {
    const sourceNames: string[] = [];
    for (const sourceKey of CATEGORY_MAP[recCat]) {
      for (const dn of tagsByCategory[sourceKey] ?? []) sourceNames.push(dn);
    }

    const tryAdd = (minCount: number, picked: Set<string>, out: string[]) => {
      const candidates: { displayName: string; count: number }[] = [];
      const seenLocal = new Set<string>();
      for (const displayName of sourceNames) {
        if (excluded.has(displayName)) continue;
        if (picked.has(displayName)) continue;
        if (seenLocal.has(displayName)) continue;
        seenLocal.add(displayName);
        const tagKey = displayNameToTagKey.get(displayName);
        if (!tagKey) continue;
        const count = computeCountForDisplayName(
          displayName,
          tagKey,
          countByKeyFull,
          displayNameToTagKey,
          include,
          unify
        );
        if (count < minCount) continue;
        candidates.push({ displayName, count });
      }
      candidates.sort((a, b) => b.count - a.count);
      for (const c of candidates) {
        if (out.length >= FAMOUS_PER_CATEGORY) break;
        if (picked.has(c.displayName)) continue;
        picked.add(c.displayName);
        out.push(c.displayName);
      }
    };

    const picked = new Set<string>();
    const out: string[] = [];
    for (const min of [10, 5, 1, 0]) {
      if (out.length >= FAMOUS_PER_CATEGORY) break;
      tryAdd(min, picked, out);
    }
    result[recCat] = out.slice(0, FAMOUS_PER_CATEGORY);
  }

  return result;
}

/** カテゴリ由来の候補から有名タグを算出（従来ロジック、マッピングのみ決定的） */
export async function buildFamousTagsFromCategories(
  prisma: PrismaClient
): Promise<Record<RecommendCategoryLabel, FamousTagItem[]>> {
  const { include, unify } = loadIncludeUnify();
  const tagsByCategory = loadTagsByCategory();

  const excluded = new Set<string>();
  for (const included of Object.values(include)) {
    for (const x of included) excluded.add(x);
  }
  for (const group of unify) {
    for (let i = 1; i < group.length; i++) excluded.add(group[i]);
  }

  const displayNameToTagKey = await buildDisplayNameToTagKeyDeterministic(prisma);
  const countByKey = await buildCountByKey(prisma);

  const grouped: Record<RecommendCategoryLabel, FamousTagItem[]> = {
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
      const count = computeCountForDisplayName(
        displayName,
        tagKey,
        countByKey,
        displayNameToTagKey,
        include,
        unify
      );
      if (count < 10) continue;
      if (seen.has(displayName)) continue;
      seen.add(displayName);
      grouped[recCat].push({ tagKey, displayName, count });
    }
    grouped[recCat].sort((a, b) => b.count - a.count);
    grouped[recCat] = grouped[recCat].slice(0, FAMOUS_PER_CATEGORY);
  }

  return grouped;
}

/** コンフィグの slots 順で有名タグを返す（未登録のタグはスキップ） */
export async function buildFamousTagsFromConfigSlots(
  prisma: PrismaClient,
  file: RecommendFamousTagsFile
): Promise<Record<RecommendCategoryLabel, FamousTagItem[]>> {
  const { include, unify } = loadIncludeUnify();
  const displayNameToTagKey = await buildDisplayNameToTagKeyDeterministic(prisma);
  const countByKey = await buildCountByKey(prisma);

  const excluded = new Set<string>();
  for (const included of Object.values(include)) {
    for (const x of included) excluded.add(x);
  }
  for (const group of unify) {
    for (let i = 1; i < group.length; i++) excluded.add(group[i]);
  }

  const grouped: Record<RecommendCategoryLabel, FamousTagItem[]> = {
    ストーリー: [],
    プレイ: [],
    キャラクター: [],
  };

  for (const recCat of RECOMMEND_CATEGORIES) {
    const names = file.slots[recCat] ?? [];
    const seen = new Set<string>();
    for (const displayName of names) {
      const dn = String(displayName).trim();
      if (!dn) continue;
      if (excluded.has(dn)) continue;
      if (seen.has(dn)) continue;
      seen.add(dn);
      const tagKey = displayNameToTagKey.get(dn);
      if (!tagKey) continue;
      const count = computeCountForDisplayName(
        dn,
        tagKey,
        countByKey,
        displayNameToTagKey,
        include,
        unify
      );
      grouped[recCat].push({ tagKey, displayName: dn, count });
    }
  }

  return grouped;
}

export function shouldUseConfigSlots(file: RecommendFamousTagsFile | null): boolean {
  if (!file) return false;
  if (file.useConfigSlots === false) return false;
  for (const c of RECOMMEND_CATEGORIES) {
    const arr = file.slots[c];
    if (!Array.isArray(arr) || arr.length !== FAMOUS_PER_CATEGORY) return false;
  }
  return true;
}

/** GET /api/recommend 用 */
export async function getFamousTagsGroupedForApi(
  prisma: PrismaClient
): Promise<Record<RecommendCategoryLabel, FamousTagItem[]>> {
  const file = loadRecommendFamousTagsFile();
  if (shouldUseConfigSlots(file)) {
    return buildFamousTagsFromConfigSlots(prisma, file!);
  }
  return buildFamousTagsFromCategories(prisma);
}

export type RecommendFamousValidation = {
  ok: boolean;
  /** 保存してはいけない（件数・空スロット） */
  errors: string[];
  /** DB に無い表示名（保存は可だが GET でスキップされる） */
  warnings: string[];
  lengths: Record<RecommendCategoryLabel, number>;
  missingInDb: Record<RecommendCategoryLabel, number>;
};

/** 管理画面用: slots の件数・DB 未登録の表示名 */
export async function validateRecommendFamousConfig(
  prisma: PrismaClient,
  file: RecommendFamousTagsFile
): Promise<RecommendFamousValidation> {
  const displayNameToTagKey = await buildDisplayNameToTagKeyDeterministic(prisma);
  const errors: string[] = [];
  const warnings: string[] = [];
  const lengths = { ストーリー: 0, プレイ: 0, キャラクター: 0 };
  const missingInDb = { ストーリー: 0, プレイ: 0, キャラクター: 0 };

  for (const c of RECOMMEND_CATEGORIES) {
    const arr = file.slots[c] ?? [];
    lengths[c] = arr.length;
    if (arr.length !== FAMOUS_PER_CATEGORY) {
      errors.push(`${c}: expected ${FAMOUS_PER_CATEGORY} slots, got ${arr.length}`);
    }
    let miss = 0;
    let empty = 0;
    for (const dn of arr) {
      const d = String(dn).trim();
      if (!d) {
        empty++;
        continue;
      }
      if (!displayNameToTagKey.has(d)) miss++;
    }
    missingInDb[c] = miss;
    if (empty > 0) errors.push(`${c}: ${empty} empty slot(s)`);
    if (miss > 0) warnings.push(`${c}: ${miss} displayName(s) not found in Tag table`);
  }

  const ok = errors.length === 0 && warnings.length === 0;
  return { ok, errors, warnings, lengths, missingInDb };
}
