import type { MvpConfig } from '@/server/config/schema';

/**
 * HARD vs SOFT split uses hardConfidenceMin. For high-popularity top-1 works,
 * optionally raise this bar during Q20–Q30 only, then fall back to global min from Q31+.
 */
export function getEffectiveHardConfidenceMin(
  config: MvpConfig,
  nextQuestionIndex1Based: number,
  top1PopularityBase: number | null | undefined
): number {
  const base = config.confirm.hardConfidenceMin;
  const byPhase = config.confirm.hardConfidenceMinByPhase;
  if (!byPhase?.enabled || !byPhase.phases) return base;
  const minPop = byPhase.minPopularityBase ?? 50;
  const pop = top1PopularityBase ?? 0;
  if (pop < minPop) return base;
  const { q20, q25, q30 } = byPhase.phases;
  if (nextQuestionIndex1Based < 20) return base;
  if (nextQuestionIndex1Based >= 31) return base;
  if (nextQuestionIndex1Based >= 30) return q30;
  if (nextQuestionIndex1Based >= 25) return q25;
  return q20;
}
