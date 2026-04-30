import type { QuizTier } from '../types';

export interface TierBuckets<T> {
  famous: T[];
  mid: T[];
  minor: T[];
}

function takeRandom<T>(items: T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function bucketByPopularity<T extends { popularityBase: number }>(sortedDesc: T[]): TierBuckets<T> {
  const famous = sortedDesc.slice(0, 40);
  const mid = sortedDesc.slice(40, 80);
  const tail = sortedDesc.slice(80);
  const tailAsc = [...tail].sort((a, b) => a.popularityBase - b.popularityBase);
  const minor = tailAsc.slice(0, 20);
  return { famous, mid, minor };
}

export function fillTierCounts<T extends { popularityBase: number; workId: string; tier: QuizTier }>(
  buckets: TierBuckets<T>,
  fallbackSortedDesc: T[],
): TierBuckets<T> {
  const used = new Set<string>();
  const mark = (arr: T[]) => {
    for (const i of arr) used.add(i.workId);
  };
  mark(buckets.famous);
  mark(buckets.mid);
  mark(buckets.minor);

  const fillFromFallback = (target: T[], need: number) => {
    if (need <= 0) return;
    const candidates = fallbackSortedDesc.filter((w) => !used.has(w.workId));
    const picks = takeRandom(candidates, need);
    for (const p of picks) {
      target.push(p);
      used.add(p.workId);
    }
  };

  fillFromFallback(buckets.famous, Math.max(0, 40 - buckets.famous.length));
  fillFromFallback(buckets.mid, Math.max(0, 40 - buckets.mid.length));
  fillFromFallback(buckets.minor, Math.max(0, 20 - buckets.minor.length));
  return buckets;
}
