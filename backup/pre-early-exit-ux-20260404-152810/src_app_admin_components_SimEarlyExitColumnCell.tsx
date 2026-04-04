'use client';

import type { CSSProperties } from 'react';
import type { EarlyExitStepSnapshot } from '@/types/earlyExitStepSnapshot';

/** 閾値の「安全側」を満たしたときの色（表の①②③列） */
export const EARLY_EXIT_OK_COLOR = '#2e7d32';

const MUTED = '#666';
const DIM = '#999';
const BODY = '#37474f';

const DELTA5_TITLE =
  '直近5問の回答種別だけで決まる、エンジン固定の3段階（内部値は必ず 0・0.03・0.06 のいずれか）。UNKNOWNが3回以上→0、YES/NOが4回以上→6、それ以外→3。連続量の「0.03刻み」ではありません。閾値（例0.04）とは実数で比較。表の表示は読みやすさのため×100した整数（0・3・6）。5問未満は未計算で「（5問未満）」で、この列の審査には使いません。';

function formatDelta5(v: number): string {
  if (!Number.isFinite(v)) return '（5問未満）';
  return String(Math.round(v * 100));
}

/** 直近５問（③）。ok＝偏り代理が有限かつ閾値より大きいとき緑（5問未満は緑にしない）。 */
export function SimRecentFiveExitColumnCell({
  ex,
  isReveal,
  ok,
}: {
  ex: EarlyExitStepSnapshot | undefined;
  isReveal: boolean;
  ok: boolean;
}) {
  if (isReveal || !ex) {
    return <span style={{ color: DIM }}>—</span>;
  }

  const mainStyle: CSSProperties = {
    fontSize: '0.72rem',
    lineHeight: 1.35,
    textAlign: 'left',
    color: ok ? EARLY_EXIT_OK_COLOR : MUTED,
    fontWeight: ok ? 600 : 400,
  };

  return (
    <div style={{ minWidth: 0 }} title={DELTA5_TITLE}>
      <span style={mainStyle}>{formatDelta5(ex.confidenceDelta5)}</span>
    </div>
  );
}

/** 審査タイミング行のみ、マッチ数と早期失敗の要約。 */
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

export { BODY as EARLY_EXIT_NEUTRAL_TEXT_COLOR };
