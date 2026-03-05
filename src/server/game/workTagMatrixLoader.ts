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
let matrixLoadLogged = false;

/** プレビュー/Vercel で process.cwd() やトレース配置が異なる場合の候補パス */
function getMatrixCandidatePaths(): string[] {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'data', 'workTagMatrix.json'),
    path.join(cwd, '.next', 'server', 'data', 'workTagMatrix.json'),
    path.join(cwd, '..', '..', '..', 'data', 'workTagMatrix.json'), // cwd が .next/server/app/api/answer 等
    path.join(cwd, '..', '..', 'data', 'workTagMatrix.json'),       // cwd が .next/server 等
  ];
  // outputFileTracingIncludes がルートごとにファイルを置く場合
  for (const route of ['answer', 'start', 'reveal']) {
    candidates.push(path.join(cwd, '.next', 'server', 'app', 'api', route, 'data', 'workTagMatrix.json'));
  }
  return candidates;
}

/** Worker Thread 等から直接データを注入する */
export function setWorkTagMatrixDirect(data: WorkTagMatrix | null) {
  cachedMatrix = data;
}

export function getWorkTagMatrix(): WorkTagMatrix | null {
  if (process.env.DISABLE_WORKTAG_MATRIX === '1') return null;
  if (cachedMatrix) return cachedMatrix;
  const candidates = getMatrixCandidatePaths();
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as WorkTagMatrix;
      cachedMatrix = raw;
      return cachedMatrix;
    } catch (err) {
      if (!matrixLoadLogged) {
        console.warn('[WorkTag] Matrix load failed for path:', p, err);
      }
      continue;
    }
  }
  if (!matrixLoadLogged) {
    matrixLoadLogged = true;
    console.warn('[WorkTag] Matrix not found. Tried:', candidates, 'cwd:', process.cwd());
  }
  return null;
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
