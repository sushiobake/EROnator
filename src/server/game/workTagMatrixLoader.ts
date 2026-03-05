/**
 * WorkTag 行列のローダー
 * 事前生成した workTagMatrix.json をメモリに載せ、DB クエリの代わりに使用する。
 */

import fs from 'fs';
import path from 'path';

export interface WorkTagEntry {
  workId: string;
  tagKey: string;
  derivedConfidence: number | null;
}

export interface WorkTagMatrix {
  version?: number;
  generatedAt?: string;
  workCount?: number;
  totalWorkTags?: number;
  workTagMap: Record<string, Array<{ tagKey: string; derivedConfidence: number | null }>>;
}

let cachedMatrix: WorkTagMatrix | null = null;

/** Worker Thread 等から直接データを注入する */
export function setWorkTagMatrixDirect(data: WorkTagMatrix | null) {
  cachedMatrix = data;
}

export function getWorkTagMatrix(): WorkTagMatrix | null {
  if (process.env.DISABLE_WORKTAG_MATRIX === '1') {
    console.log('[perf] getWorkTagMatrix: DISABLED');
    return null;
  }
  if (cachedMatrix) return cachedMatrix;
  try {
    const p = path.join(process.cwd(), 'data', 'workTagMatrix.json');
    if (!fs.existsSync(p)) {
      console.log('[perf] getWorkTagMatrix: NULL(file not found)');
      return null;
    }
    const t0 = Date.now();
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as WorkTagMatrix;
    cachedMatrix = raw;
    console.log('[perf] getWorkTagMatrix: LOADED', Date.now() - t0, 'ms');
    return cachedMatrix;
  } catch (err) {
    console.error('[WorkTag] Matrix load failed:', err);
    console.log('[perf] getWorkTagMatrix: NULL(error)');
    return null;
  }
}

/**
 * 行列から workId リストに対する WorkTag 配列を取得。
 * 形式は prisma.workTag.findMany の select { workId, tagKey, derivedConfidence } と同等。
 * 5386 works × 12 tags のループを高速化（プリロード＋事前確保でアロケーション削減）。
 */
export function getWorkTagsFromMatrix(
  workIds: string[],
  options?: { tagKeys?: string[] }
): WorkTagEntry[] {
  const matrix = getWorkTagMatrix();
  if (!matrix?.workTagMap) return [];
  const map = matrix.workTagMap;
  const filterTagKeys = options?.tagKeys?.length ? options.tagKeys : null;
  const n = workIds.length;
  const estimated = n * 14; // 1 work あたり平均 12 タグ程度、余裕を持って 14
  const results: WorkTagEntry[] = new Array(estimated);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const workId = workIds[i];
    const list = map[workId];
    if (!list) continue;
    for (let j = 0; j < list.length; j++) {
      const e = list[j];
      if (filterTagKeys && !filterTagKeys.includes(e.tagKey)) continue;
      results[idx++] = {
        workId,
        tagKey: e.tagKey,
        derivedConfidence: e.derivedConfidence ?? null,
      };
    }
  }
  results.length = idx;
  return results;
}
