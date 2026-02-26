/**
 * Tag テーブルのキャッシュローダー
 * シミュレーション中の prisma.tag.findMany/findUnique をメモリ参照に置き換え、
 * 1問あたり 3〜7 秒かかっていた DB クエリを削減する。
 *
 * DISABLE_TAG_CACHE=1 で無効化可能。
 */

import { prisma } from '@/server/db/client';

export interface CachedTag {
  tagKey: string;
  displayName: string;
  tagType: string | null;
  questionText: string | null;
}

let tagByKey: Map<string, CachedTag> | null = null;
let tagByDisplayName: Map<string, CachedTag[]> | null = null;
let loadPromise: Promise<void> | null = null;

async function loadTagCache(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const rows = await prisma.tag.findMany({
      select: { tagKey: true, displayName: true, tagType: true, questionText: true },
    });
    tagByKey = new Map();
    tagByDisplayName = new Map();
    for (const r of rows) {
      const t: CachedTag = {
        tagKey: r.tagKey,
        displayName: r.displayName ?? '',
        tagType: r.tagType,
        questionText: r.questionText,
      };
      tagByKey.set(r.tagKey, t);
      const dn = t.displayName;
      if (!tagByDisplayName.has(dn)) tagByDisplayName.set(dn, []);
      tagByDisplayName.get(dn)!.push(t);
    }
  })();
  return loadPromise;
}

/** キャッシュをロード（初回のみ DB アクセス） */
export async function ensureTagCacheLoaded(): Promise<void> {
  if (process.env.DISABLE_TAG_CACHE === '1') return;
  await loadTagCache();
}

/** キャッシュが利用可能か */
export function isTagCacheReady(): boolean {
  return tagByKey !== null && tagByDisplayName !== null && process.env.DISABLE_TAG_CACHE !== '1';
}

/** tagKey でタグ取得（同期・キャッシュ利用時のみ） */
export function getTagByKey(tagKey: string): CachedTag | null {
  if (!tagByKey) return null;
  return tagByKey.get(tagKey) ?? null;
}

/** 複数 tagKey でタグ取得（同期） */
export function getTagsByTagKeys(
  tagKeys: string[],
  filter?: { tagTypes?: string[] }
): CachedTag[] {
  if (!tagByKey) return [];
  const results: CachedTag[] = [];
  for (const k of tagKeys) {
    const t = tagByKey.get(k);
    if (!t) continue;
    if (filter?.tagTypes?.length && (!t.tagType || !filter.tagTypes.includes(t.tagType))) continue;
    results.push(t);
  }
  return results;
}

/** displayName でタグ取得（同期・複数可） */
export function getTagsByDisplayNames(displayNames: string[]): CachedTag[] {
  if (!tagByDisplayName) return [];
  const seen = new Set<string>();
  const results: CachedTag[] = [];
  for (const dn of displayNames) {
    const list = tagByDisplayName.get(dn) ?? [];
    for (const t of list) {
      if (!seen.has(t.tagKey)) {
        seen.add(t.tagKey);
        results.push(t);
      }
    }
  }
  return results;
}

/** displayName に対応する tagKey 一覧（1つの displayName） */
export function getTagKeysByDisplayName(displayName: string): string[] {
  if (!tagByDisplayName) return [];
  const list = tagByDisplayName.get(displayName) ?? [];
  return list.map(t => t.tagKey);
}

/** 指定 type の tagKey 一覧（notIn で除外可能） */
export function getTagKeysByType(
  tagType: string,
  options?: { notIn?: Set<string> }
): string[] {
  if (!tagByKey) return [];
  const results: string[] = [];
  for (const [k, t] of tagByKey) {
    if (t.tagType !== tagType) continue;
    if (options?.notIn?.has(k)) continue;
    results.push(k);
  }
  return results;
}
