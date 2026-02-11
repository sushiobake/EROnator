/**
 * タグの包括・統合 config の読み込みと「同一グループ」の解決。
 * config/tagIncludeUnify.json を読み、displayName から「扱いとして一緒にする」displayName のリストを返す。
 */

import fs from 'fs';
import path from 'path';

export interface TagIncludeUnifyConfig {
  include?: Record<string, string[]>;
  unify?: string[][];
}

let cache: Map<string, string[]> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1分

function loadConfig(): TagIncludeUnifyConfig {
  const filePath = path.join(process.cwd(), 'config', 'tagIncludeUnify.json');
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as TagIncludeUnifyConfig & { include?: Record<string, string[]>; unify?: string[][] };
    return {
      include: data.include ?? {},
      unify: data.unify ?? [],
    };
  } catch {
    return { include: {}, unify: [] };
  }
}

/**
 * 共通要素があるグループを1つにまとめる（収束するまで繰り返し）
 */
function mergeOverlapping(groups: Set<string>[]): Set<string>[] {
  let current = groups.map(g => new Set(g));
  for (;;) {
    let changed = false;
    const next: Set<string>[] = [];
    for (const g of current) {
      let merged = false;
      for (const r of next) {
        for (const x of g) {
          if (r.has(x)) {
            for (const y of g) r.add(y);
            merged = true;
            changed = true;
            break;
          }
        }
        if (merged) break;
      }
      if (!merged) next.push(new Set(g));
    }
    if (!changed) return next;
    current = next;
  }
}

function buildDisplayNameToGroup(): Map<string, string[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) {
    return cache;
  }
  const config = loadConfig();
  const groups: Set<string>[] = [];

  for (const [rep, included] of Object.entries(config.include ?? {})) {
    groups.push(new Set([rep, ...included]));
  }
  for (const arr of config.unify ?? []) {
    groups.push(new Set(arr));
  }

  const merged = mergeOverlapping(groups);
  const displayNameToGroup = new Map<string, string[]>();
  for (const g of merged) {
    const list = Array.from(g);
    for (const d of list) {
      displayNameToGroup.set(d, list);
    }
  }
  cache = displayNameToGroup;
  cacheTime = now;
  return displayNameToGroup;
}

/**
 * この displayName と「扱いとして一緒」にする displayName のリストを返す。
 * 設定に無い場合は [displayName] のみ。
 */
export function getGroupDisplayNames(displayName: string): string[] {
  const map = buildDisplayNameToGroup();
  return map.get(displayName) ?? [displayName];
}
