/**
 * 閾値最適化: ParamSet グリッド生成（DESIGN-threshold-optimizer-v1.md §6）
 */
import type { ParamSet } from '@/types/thresholdOptimizer';

export function generatePhase1ParamSets(): ParamSet[] {
  const sets: ParamSet[] = [];
  let id = 1;

  const confirmConfigs: Array<[number, number, number, number]> = [
    [0.25, 0.7, 0.45, 0.1],
    [0.25, 0.55, 0.5, 0.05],
    [0.25, 0.55, 0.55, 0.0],
    [0.2, 0.6, 0.5, 0.05],
    [0.3, 0.65, 0.5, 0.1],
    [0.25, 0.5, 0.6, 0.0],
  ];

  const earlyExitConfigs = [
    {
      label: 'current',
      reviewIndices: [25, 30, 35] as number[],
      thresholds: {
        q25: { minConfidence: 0.22, maxEffectiveCandidates: 15 },
        q30: { minConfidence: 0.18, maxEffectiveCandidates: 20 },
        q35: { minConfidence: 0.15, maxEffectiveCandidates: 25 },
      },
    },
    {
      label: 'strict',
      reviewIndices: [25, 30, 35] as number[],
      thresholds: {
        q25: { minConfidence: 0.26, maxEffectiveCandidates: 12 },
        q30: { minConfidence: 0.22, maxEffectiveCandidates: 18 },
        q35: { minConfidence: 0.18, maxEffectiveCandidates: 22 },
      },
    },
    {
      label: 'loose',
      reviewIndices: [25, 30, 35] as number[],
      thresholds: {
        q25: { minConfidence: 0.18, maxEffectiveCandidates: 20 },
        q30: { minConfidence: 0.14, maxEffectiveCandidates: 25 },
        q35: { minConfidence: 0.12, maxEffectiveCandidates: 30 },
      },
    },
    {
      label: 'tight-narrow',
      reviewIndices: [25, 30, 35] as number[],
      thresholds: {
        q25: { minConfidence: 0.2, maxEffectiveCandidates: 10 },
        q30: { minConfidence: 0.16, maxEffectiveCandidates: 15 },
        q35: { minConfidence: 0.13, maxEffectiveCandidates: 20 },
      },
    },
    {
      label: 'wide-narrow',
      reviewIndices: [25, 30, 35] as number[],
      thresholds: {
        q25: { minConfidence: 0.2, maxEffectiveCandidates: 25 },
        q30: { minConfidence: 0.16, maxEffectiveCandidates: 30 },
        q35: { minConfidence: 0.13, maxEffectiveCandidates: 35 },
      },
    },
    {
      label: 'aggressive-q25',
      reviewIndices: [25, 30, 35] as number[],
      thresholds: {
        q25: { minConfidence: 0.3, maxEffectiveCandidates: 20 },
        q30: { minConfidence: 0.2, maxEffectiveCandidates: 22 },
        q35: { minConfidence: 0.15, maxEffectiveCandidates: 25 },
      },
    },
  ];

  for (const confirm of confirmConfigs) {
    for (const earlyExit of earlyExitConfigs) {
      sets.push({
        id: `ps_${String(id).padStart(3, '0')}`,
        label: `C[${confirm[0]}-${confirm[1]}]H${confirm[2]}I${confirm[3]}_E-${earlyExit.label}`,
        confidenceConfirmBandLower: confirm[0],
        confidenceConfirmBandUpper: confirm[1],
        hardConfidenceMin: confirm[2],
        hardConfirmInjectionRatio: confirm[3],
        reviewIndices: earlyExit.reviewIndices,
        earlyExitThresholds: earlyExit.thresholds,
      });
      id++;
    }
  }

  return sets;
}

/**
 * 早期失敗条件②「広すぎ」版のスイープ用。Confirm は Phase3 勝者 ps_034 に固定。
 * minConfidence × maxEffectiveCandidates（超過で②マッチ）の 3×3 グリッド。
 */
export function generateEarlyExitV2ParamSets(): ParamSet[] {
  const [bl, bu, hm, inj] = [0.25, 0.5, 0.6, 0] as const;
  const confAxis = [
    {
      label: 'c-cons',
      q25: 0.06,
      q30: 0.08,
      q35: 0.1,
    },
    {
      label: 'c-mod',
      q25: 0.08,
      q30: 0.1,
      q35: 0.12,
    },
    {
      label: 'c-aggr',
      q25: 0.1,
      q30: 0.13,
      q35: 0.16,
    },
  ];
  const ecAxis = [
    { label: 'w-loose', q25: 100, q30: 70, q35: 40 },
    { label: 'w-mod', q25: 80, q30: 50, q35: 30 },
    { label: 'w-tight', q25: 50, q30: 30, q35: 20 },
  ];
  const sets: ParamSet[] = [];
  let id = 1;
  for (const c of confAxis) {
    for (const w of ecAxis) {
      sets.push({
        id: `ps_v2_${String(id).padStart(2, '0')}`,
        label: `EE2_${c.label}_${w.label}`,
        confidenceConfirmBandLower: bl,
        confidenceConfirmBandUpper: bu,
        hardConfidenceMin: hm,
        hardConfirmInjectionRatio: inj,
        reviewIndices: [25, 30, 35],
        earlyExitThresholds: {
          q25: { minConfidence: c.q25, maxEffectiveCandidates: w.q25 },
          q30: { minConfidence: c.q30, maxEffectiveCandidates: w.q30 },
          q35: { minConfidence: c.q35, maxEffectiveCandidates: w.q35 },
        },
      });
      id++;
    }
  }
  return sets;
}

type McRow = { q25: number; q30: number; q35: number };
type EcRow = { q25: number; q30: number; q35: number };

const V3_MC_LEVELS: McRow[] = [
  { q25: 0.04, q30: 0.06, q35: 0.08 },
  { q25: 0.05, q30: 0.07, q35: 0.09 },
  { q25: 0.06, q30: 0.08, q35: 0.1 },
  { q25: 0.07, q30: 0.09, q35: 0.11 },
  { q25: 0.08, q30: 0.1, q35: 0.12 },
];

const V3_EC_LEVELS: EcRow[] = [
  { q25: 50, q30: 30, q35: 20 },
  { q25: 65, q30: 40, q35: 25 },
  { q25: 80, q30: 50, q35: 30 },
  { q25: 90, q30: 60, q35: 35 },
  { q25: 100, q30: 70, q35: 40 },
];

function v3EeFrom(mc: McRow, ec: EcRow): ParamSet['earlyExitThresholds'] {
  return {
    q25: { minConfidence: mc.q25, maxEffectiveCandidates: ec.q25 },
    q30: { minConfidence: mc.q30, maxEffectiveCandidates: ec.q30 },
    q35: { minConfidence: mc.q35, maxEffectiveCandidates: ec.q35 },
  };
}

/**
 * V3 包括最適化: 早期失敗×Confirm×bandLower×maxQ×Q20 など 45 通り（baseline は別）
 */
export function generateV3ComprehensiveParamSets(): ParamSet[] {
  const sets: ParamSet[] = [];
  let seq = 1;
  const nextId = (): string => `ps_v3_${String(seq++).padStart(3, '0')}`;

  const CF1 = { bl: 0.25, bu: 0.5, hm: 0.6, inj: 0 };

  // Group A: 5×5 EE グリッド（25）
  for (let mi = 0; mi < 5; mi++) {
    for (let ei = 0; ei < 5; ei++) {
      sets.push({
        id: nextId(),
        label: `V3_A_MC${mi + 1}_EC${ei + 1}`,
        confidenceConfirmBandLower: CF1.bl,
        confidenceConfirmBandUpper: CF1.bu,
        hardConfidenceMin: CF1.hm,
        hardConfirmInjectionRatio: CF1.inj,
        reviewIndices: [25, 30, 35],
        earlyExitThresholds: v3EeFrom(V3_MC_LEVELS[mi], V3_EC_LEVELS[ei]),
      });
    }
  }

  // Group B: EE (MC2–4 × EC3) × CF2–4（9）
  const mcIdxB = [1, 2, 3] as const;
  const cfB = [
    { label: 'CF2', bl: 0.25, bu: 0.45, hm: 0.65, inj: 0 },
    { label: 'CF3', bl: 0.25, bu: 0.55, hm: 0.55, inj: 0 },
    { label: 'CF4', bl: 0.25, bu: 0.5, hm: 0.6, inj: 0.05 },
  ];
  for (const mi of mcIdxB) {
    for (const cf of cfB) {
      sets.push({
        id: nextId(),
        label: `V3_B_MC${mi + 1}_EC3_${cf.label}`,
        confidenceConfirmBandLower: cf.bl,
        confidenceConfirmBandUpper: cf.bu,
        hardConfidenceMin: cf.hm,
        hardConfirmInjectionRatio: cf.inj,
        reviewIndices: [25, 30, 35],
        earlyExitThresholds: v3EeFrom(V3_MC_LEVELS[mi], V3_EC_LEVELS[2]),
      });
    }
  }

  // Group C: bandLower 変化（4）— MC3×EC3×CF1
  const bandLowers = [0.15, 0.2, 0.3, 0.35];
  for (const bl of bandLowers) {
    sets.push({
      id: nextId(),
      label: `V3_C_bl${bl}`,
      confidenceConfirmBandLower: bl,
      confidenceConfirmBandUpper: CF1.bu,
      hardConfidenceMin: CF1.hm,
      hardConfirmInjectionRatio: CF1.inj,
      reviewIndices: [25, 30, 35],
      earlyExitThresholds: v3EeFrom(V3_MC_LEVELS[2], V3_EC_LEVELS[2]),
    });
  }

  // Group D: maxQuestions（2）
  for (const maxQ of [30, 40] as const) {
    sets.push({
      id: nextId(),
      label: `V3_D_maxQ${maxQ}`,
      confidenceConfirmBandLower: CF1.bl,
      confidenceConfirmBandUpper: CF1.bu,
      hardConfidenceMin: CF1.hm,
      hardConfirmInjectionRatio: CF1.inj,
      reviewIndices: [25, 30, 35],
      earlyExitThresholds: v3EeFrom(V3_MC_LEVELS[2], V3_EC_LEVELS[2]),
      maxQuestions: maxQ,
    });
  }

  // Group E: Q20 レビュー追加（3）
  const q40 = { minConfidence: 0.1, maxEffectiveCandidates: 40 };
  const eGroup: Array<{ mi: 1 | 2 | 3; q20c: number }> = [
    { mi: 1, q20c: 0.02 },
    { mi: 2, q20c: 0.03 },
    { mi: 3, q20c: 0.04 },
  ];
  for (const eg of eGroup) {
    sets.push({
      id: nextId(),
      label: `V3_E_Q20_MC${eg.mi + 1}`,
      confidenceConfirmBandLower: CF1.bl,
      confidenceConfirmBandUpper: CF1.bu,
      hardConfidenceMin: CF1.hm,
      hardConfirmInjectionRatio: CF1.inj,
      reviewIndices: [20, 25, 30, 35],
      earlyExitThresholds: {
        q20: { minConfidence: eg.q20c, maxEffectiveCandidates: 150 },
        ...v3EeFrom(V3_MC_LEVELS[eg.mi], V3_EC_LEVELS[2]),
        q40: q40,
      },
    });
  }

  // Group F: CF×bandLower 交差（2）
  sets.push({
    id: nextId(),
    label: 'V3_F_CF2_bl020',
    confidenceConfirmBandLower: 0.2,
    confidenceConfirmBandUpper: 0.45,
    hardConfidenceMin: 0.65,
    hardConfirmInjectionRatio: 0,
    reviewIndices: [25, 30, 35],
    earlyExitThresholds: v3EeFrom(V3_MC_LEVELS[2], V3_EC_LEVELS[2]),
  });
  sets.push({
    id: nextId(),
    label: 'V3_F_CF3_bl030',
    confidenceConfirmBandLower: 0.3,
    confidenceConfirmBandUpper: 0.55,
    hardConfidenceMin: 0.55,
    hardConfirmInjectionRatio: 0,
    reviewIndices: [25, 30, 35],
    earlyExitThresholds: v3EeFrom(V3_MC_LEVELS[2], V3_EC_LEVELS[2]),
  });

  if (sets.length !== 45) {
    throw new Error(`generateV3ComprehensiveParamSets: expected 45 sets, got ${sets.length}`);
  }
  return sets;
}

export function getBaselineParamSet(): ParamSet {
  return {
    id: 'baseline',
    label: 'Baseline (earlyExit OFF, current confirm)',
    confidenceConfirmBandLower: 0.25,
    confidenceConfirmBandUpper: 0.7,
    hardConfidenceMin: 0.45,
    hardConfirmInjectionRatio: 0.1,
    reviewIndices: [],
    earlyExitThresholds: {},
  };
}

export function getParamSetsByIds(all: ParamSet[], ids: string[]): ParamSet[] {
  const set = new Set(ids);
  return all.filter((p) => set.has(p.id));
}
