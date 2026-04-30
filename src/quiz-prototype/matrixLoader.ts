/**
 * workTagMatrix.json のプロトタイプ専用ローダー。
 * 本体ローダーを使わず、独立キャッシュで扱う。
 */

import fs from 'fs';
import path from 'path';

export interface WorkTagMatrixEntry {
  tagKey: string;
  derivedConfidence: number | null;
}

export interface WorkTagMatrixFile {
  version?: number;
  generatedAt?: string;
  workCount?: number;
  totalWorkTags?: number;
  workTagMap: Record<string, WorkTagMatrixEntry[]>;
}

let cached: WorkTagMatrixFile | null = null;

export function clearWorkTagMatrixCache(): void {
  cached = null;
}

export function loadWorkTagMatrixFile(): WorkTagMatrixFile | null {
  if (cached) return cached;
  try {
    const p = path.join(process.cwd(), 'data', 'workTagMatrix.json');
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf-8');
    cached = JSON.parse(raw) as WorkTagMatrixFile;
    return cached;
  } catch (err) {
    console.error('[quiz-prototype] workTagMatrix load failed:', err);
    return null;
  }
}

export function getTagEntriesForWork(workId: string): WorkTagMatrixEntry[] {
  const matrix = loadWorkTagMatrixFile();
  if (!matrix?.workTagMap) return [];
  return matrix.workTagMap[workId] ?? [];
}

/** 互換用 */
export function getTagKeysForWork(workId: string): string[] {
  return getTagEntriesForWork(workId).map((e) => e.tagKey);
}
