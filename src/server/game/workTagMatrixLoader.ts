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

export function getWorkTagMatrix(): WorkTagMatrix | null {
  if (process.env.DISABLE_WORKTAG_MATRIX === '1') return null;
  if (cachedMatrix) return cachedMatrix;
  try {
    const p = path.join(process.cwd(), 'data', 'workTagMatrix.json');
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as WorkTagMatrix;
    cachedMatrix = raw;
    return cachedMatrix;
  } catch {
    return null;
  }
}

/**
 * 行列から workId リストに対する WorkTag 配列を取得。
 * 形式は prisma.workTag.findMany の select { workId, tagKey, derivedConfidence } と同等。
 */
export function getWorkTagsFromMatrix(
  workIds: string[],
  options?: { tagKeys?: string[] }
): WorkTagEntry[] {
  const matrix = getWorkTagMatrix();
  if (!matrix?.workTagMap) return [];
  const results: WorkTagEntry[] = [];
  for (const workId of workIds) {
    const list = matrix.workTagMap[workId] ?? [];
    for (const e of list) {
      if (options?.tagKeys && options.tagKeys.length > 0 && !options.tagKeys.includes(e.tagKey)) {
        continue;
      }
      results.push({
        workId,
        tagKey: e.tagKey,
        derivedConfidence: e.derivedConfidence ?? null,
      });
    }
  }
  return results;
}
