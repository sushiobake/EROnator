/**
 * ParamSet を MvpConfig に適用（ディスク上の mvpConfig は変更しない）
 */
import type { ParamSet } from '@/types/thresholdOptimizer';
import type { getMvpConfig } from '@/server/config/loader';

export type MvpConfig = ReturnType<typeof getMvpConfig>;

export function applyParamSetToConfig(baseConfig: MvpConfig, paramSet: ParamSet): MvpConfig {
  const config = JSON.parse(JSON.stringify(baseConfig)) as MvpConfig;

  config.confirm.confidenceConfirmBand = [
    paramSet.confidenceConfirmBandLower,
    paramSet.confidenceConfirmBandUpper,
  ];
  config.confirm.hardConfidenceMin = paramSet.hardConfidenceMin;
  config.flow.hardConfirmInjectionRatio = paramSet.hardConfirmInjectionRatio;

  if (paramSet.softConfidenceMin != null) {
    config.confirm.softConfidenceMin = paramSet.softConfidenceMin;
  }
  if (paramSet.maxQuestions != null) {
    config.flow.maxQuestions = paramSet.maxQuestions;
  }

  const er = config.flow.earlyExitReview;
  if (!er) return config;

  if (paramSet.reviewIndices.length === 0) {
    er.enabled = false;
  } else {
    er.enabled = true;
    er.reviewIndices = [...paramSet.reviewIndices];
    const th = er.thresholds as Record<
      string,
      { minConfidence: number; maxEffectiveCandidates: number; maxConfidenceDelta5?: number }
    >;
    for (const [key, value] of Object.entries(paramSet.earlyExitThresholds)) {
      const prev = th[key];
      th[key] = {
        ...prev,
        minConfidence: value.minConfidence,
        maxEffectiveCandidates: value.maxEffectiveCandidates,
      };
    }
  }

  return config;
}
