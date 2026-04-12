'use client';

import type { CSSProperties } from 'react';
import { mergeEarlyExitReview, type EarlyExitQ } from '@/app/admin/utils/earlyExitReviewMerged';

const wrap: CSSProperties = {
  flex: '0 1 auto',
  marginLeft: 'auto',
  minWidth: 0,
  maxWidth: 'min(100%, 56rem)',
  fontSize: '0.72rem',
  lineHeight: 1.35,
  color: '#37474f',
  textAlign: 'left',
};

const row: CSSProperties = { marginTop: '0.08rem' };

/** シミュ枠の右余白用。最大3行で横に情報を詰める。 */
export function SimEarlyExitThresholdsSummary({ flow }: { flow?: { earlyExitReview?: unknown } }) {
  const ee = mergeEarlyExitReview(flow?.earlyExitReview);

  if (!ee.enabled) {
    return (
      <div style={wrap}>
        <span style={{ fontWeight: 600 }}>早期失敗審査</span> <span style={{ color: '#757575' }}>OFF</span>
      </div>
    );
  }

  const qs: EarlyExitQ[] = ['q25', 'q30', 'q35', 'q40'];
  const line3 = qs
    .map((q) => {
      const t = ee.thresholds[q];
      const n = q.slice(1);
      return `${n}問:①${(t.minConfidence * 100).toFixed(0)}%②>${t.maxEffectiveCandidates}（広さ）`;
    })
    .join('　｜　');

  return (
    <div style={wrap} title="設定タブの flow.earlyExitReview と同じ（未保存の編集はシミュに反映されないことがあります）">
      <div style={{ fontWeight: 600 }}>
        早期失敗（現在のコンフィグ）　{ee.reviewIndices.join('・')}問直後に審査、①と②の<strong>両方</strong>で発動
      </div>
      <div style={row}>
        ①<strong>確度</strong>（→の右）が下限未満　②<strong>実質候補</strong>が「広さ」閾値超（件数）
      </div>
      <div style={{ ...row, wordBreak: 'break-word' }}>{line3}</div>
    </div>
  );
}
