import type { QuestionKind, HardConfirmType, WorkProbability } from './types';
import { passesCoverageGate } from './coverage';
import { calculateEffectiveCandidates } from './scoring';

/**
 * Question Selection (Spec §6)
 */

export interface TagInfo {
  tagKey: string;
  displayName: string;
  tagType: 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL';
  workCount: number;
}

export interface QuestionCandidate {
  kind: QuestionKind;
  tagKey?: string; // EXPLORE_TAG, SOFT_CONFIRM用
  hardConfirmType?: HardConfirmType; // HARD_CONFIRM用
  displayText?: string; // 質問文（後で生成）
}

/**
 * EXPLORE_TAG選択 (Spec §6.1)
 * p = sum_{w: hasTag(w)} P(w) が 0.5 に近いタグを選択
 * Tie-break: tagKey昇順（決定論的）
 */
export function selectExploreTag(
  availableTags: TagInfo[],
  probabilities: WorkProbability[],
  workHasTag: (workId: string, tagKey: string) => boolean
): string | null {
  if (availableTags.length === 0) {
    return null;
  }
  
  // pを計算して0.5に近い順にソート
  const candidates = availableTags.map(tag => {
    const p = probabilities
      .filter(p => workHasTag(p.workId, tag.tagKey))
      .reduce((sum, p) => sum + p.probability, 0);
    
    return {
      tagKey: tag.tagKey,
      distanceFromHalf: Math.abs(p - 0.5),
    };
  });
  
  // 0.5に近い順、同点時はtagKey昇順（決定論的）
  candidates.sort((a, b) => {
    if (a.distanceFromHalf !== b.distanceFromHalf) {
      return a.distanceFromHalf - b.distanceFromHalf;
    }
    return a.tagKey.localeCompare(b.tagKey);
  });
  
  return candidates[0].tagKey;
}

/**
 * Confirm挿入判定 (Spec §6.2)
 */
export function shouldInsertConfirm(
  qIndex: number,
  confidence: number,
  effectiveCandidates: number,
  config: {
    qForcedIndices: number[];
    confidenceConfirmBand: [number, number];
    effectiveConfirmThreshold: number;
  }
): boolean {
  // 1) qIndex強制
  if (config.qForcedIndices.includes(qIndex)) {
    return true;
  }
  
  // 2) confidence in band
  const [bandMin, bandMax] = config.confidenceConfirmBand;
  if (confidence >= bandMin && confidence <= bandMax) {
    return true;
  }
  
  // 3) effectiveCandidates <= threshold
  if (effectiveCandidates <= config.effectiveConfirmThreshold) {
    return true;
  }
  
  return false;
}

/**
 * SOFT_CONFIRM vs HARD_CONFIRM選択 (Spec §6.2)
 */
export function selectConfirmType(
  confidence: number,
  hasSoftConfirmData: boolean,
  config: {
    softConfidenceMin: number;
    hardConfidenceMin: number;
  }
): 'SOFT_CONFIRM' | 'HARD_CONFIRM' {
  if (confidence >= config.softConfidenceMin && hasSoftConfirmData) {
    return 'SOFT_CONFIRM';
  }
  
  if (confidence >= config.hardConfidenceMin) {
    return 'HARD_CONFIRM';
  }
  
  // Fallback
  return 'HARD_CONFIRM';
}

/**
 * HardConfirm順序管理 (Spec §12.3)
 * 固定順: TitleInitial → Author
 */
export function getNextHardConfirmType(
  usedTypes: HardConfirmType[]
): HardConfirmType | null {
  const order: HardConfirmType[] = ['TITLE_INITIAL', 'AUTHOR'];
  
  for (const type of order) {
    if (!usedTypes.includes(type)) {
      return type;
    }
  }
  
  return null; // 全て使用済み
}
