'use client';

import type { CSSProperties } from 'react';
import type { EarlyExitStepSnapshot } from '@/types/earlyExitStepSnapshot';

/** Green when sim row is on the safe side of early-exit thresholds (columns 1-2). */
export const EARLY_EXIT_OK_COLOR = '#2e7d32';

const DIM = '#999';

/** Review rows only: match count and early-exit summary. */
export function SimEarlyExitJudgmentColumnCell({
  ex,
  isReveal,
}: {
  ex: EarlyExitStepSnapshot | undefined;
  isReveal: boolean;
}) {
  if (isReveal || !ex) {
    return <span style={{ color: DIM }}>—</span>;
  }

  if (!ex.isReviewPoint) {
    return <span style={{ color: DIM, fontSize: '0.72rem' }}>—</span>;
  }

  const req = ex.requiredConditions ?? 2;
  const key = ex.reviewKey ?? '—';

  return (
    <div
      style={{
        fontSize: '0.72rem',
        textAlign: 'left',
        lineHeight: 1.35,
        padding: '0.2rem 0',
        fontWeight: 700,
        color: ex.wouldEarlyExit ? '#b71c1c' : '#1565c0',
      }}
    >
      {key} {ex.matchedCount}/{req}
      {ex.wouldEarlyExit ? ' → 早期失敗' : '（継続）'}
    </div>
  );
}

export const EARLY_EXIT_NEUTRAL_TEXT_COLOR = '#37474f';
