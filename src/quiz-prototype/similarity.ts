/**
 * 派生タグに重みを付けた類似度計算
 */

import type { QuizWork } from './types';

function getWeightForTag(work: QuizWork, tagKey: string): number {
  return work.derivedTags.some((t) => t.tagKey === tagKey) ? 2 : 1;
}

export function weightedTagSimilarity(a: QuizWork, b: QuizWork): number {
  const keys = new Set<string>([...a.tagKeys, ...b.tagKeys]);
  let numerator = 0;
  let denominator = 0;

  for (const k of keys) {
    const aw = a.tagKeys.includes(k) ? getWeightForTag(a, k) : 0;
    const bw = b.tagKeys.includes(k) ? getWeightForTag(b, k) : 0;
    numerator += Math.min(aw, bw);
    denominator += Math.max(aw, bw);
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

export function pickTopSimilar(target: QuizWork, pool: QuizWork[], k: number): QuizWork[] {
  const scored: { work: QuizWork; sim: number }[] = [];
  for (const w of pool) {
    if (w.workId === target.workId) continue;
    const sim = weightedTagSimilarity(target, w);
    scored.push({ work: w, sim });
  }
  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, k).map((s) => s.work);
}
