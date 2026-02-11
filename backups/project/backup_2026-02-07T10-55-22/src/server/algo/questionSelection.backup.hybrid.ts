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
 * EXPLORE_TAG選択 (Spec §6.1 - ハイブリッド版)
 * 
 * ハイブリッドアプローチ:
 * 1. カバレッジ0.3〜0.7のタグを候補に絞る（極端なものを除外）
 * 2. その中でtop1が持つタグがあれば優先
 * 3. なければ0.5に最も近いものを選ぶ
 * 
 * これにより:
 * - NOでも崩壊しない（30〜70%の作品が持つタグなので）
 * - 収束も促進（top1が持つタグを優先するので正解に向かう）
 * 
 * Tie-break: tagKey昇順（決定論的）
 */
export function selectExploreTag(
  availableTags: TagInfo[],
  probabilities: WorkProbability[],
  workHasTag: (workId: string, tagKey: string) => boolean,
  confidence: number = 0, // 現在の確度
  topWorkId: string | null = null // top1のworkId
): string | null {
  if (availableTags.length === 0) {
    return null;
  }
  
  // pを計算（各タグを持つ作品の確率の合計）
  const candidates = availableTags.map(tag => {
    const p = probabilities
      .filter(prob => workHasTag(prob.workId, tag.tagKey))
      .reduce((sum, prob) => sum + prob.probability, 0);
    
    // top1がこのタグを持っているかどうか
    const top1HasTag = topWorkId ? workHasTag(topWorkId, tag.tagKey) : false;
    
    return {
      tagKey: tag.tagKey,
      coverage: p,
      distanceFromHalf: Math.abs(p - 0.5),
      top1HasTag,
    };
  });
  
  // ハイブリッド: カバレッジ0.3〜0.7の候補を優先
  const safeCandidates = candidates.filter(c => c.coverage >= 0.3 && c.coverage <= 0.7);
  
  // 安全な候補がある場合
  if (safeCandidates.length > 0) {
    // top1が持つタグがあれば優先
    const top1SafeTags = safeCandidates.filter(c => c.top1HasTag);
    
    if (top1SafeTags.length > 0) {
      // top1が持つタグの中で0.5に近いものを選ぶ
      top1SafeTags.sort((a, b) => {
        if (a.distanceFromHalf !== b.distanceFromHalf) {
          return a.distanceFromHalf - b.distanceFromHalf;
        }
        return a.tagKey.localeCompare(b.tagKey);
      });
      console.log(`[selectExploreTag] ハイブリッド: top1が持つ安全タグ: ${top1SafeTags[0].tagKey} (coverage: ${top1SafeTags[0].coverage.toFixed(2)})`);
      return top1SafeTags[0].tagKey;
    }
    
    // top1が持つタグがなければ、0.5に最も近いものを選ぶ
    safeCandidates.sort((a, b) => {
      if (a.distanceFromHalf !== b.distanceFromHalf) {
        return a.distanceFromHalf - b.distanceFromHalf;
      }
      return a.tagKey.localeCompare(b.tagKey);
    });
    console.log(`[selectExploreTag] ハイブリッド: 安全タグ(top1なし): ${safeCandidates[0].tagKey} (coverage: ${safeCandidates[0].coverage.toFixed(2)})`);
    return safeCandidates[0].tagKey;
  }
  
  // 安全な候補がない場合は、全候補から0.5に近いものを選ぶ（フォールバック）
  candidates.sort((a, b) => {
    if (a.distanceFromHalf !== b.distanceFromHalf) {
      return a.distanceFromHalf - b.distanceFromHalf;
    }
    return a.tagKey.localeCompare(b.tagKey);
  });
  
  console.log(`[selectExploreTag] フォールバック: ${candidates[0].tagKey} (coverage: ${candidates[0].coverage.toFixed(2)})`);
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
 * 
 * 確度が高い場合（hardConfidenceMin以上）はHARD_CONFIRMを優先
 * それ以外でSOFT_CONFIRMのデータがあればSOFT_CONFIRM
 */
export function selectConfirmType(
  confidence: number,
  hasSoftConfirmData: boolean,
  config: {
    softConfidenceMin: number;
    hardConfidenceMin: number;
  }
): 'SOFT_CONFIRM' | 'HARD_CONFIRM' {
  // 確度が高い場合はHARD_CONFIRMを優先（ズルい質問で一気に絞る）
  if (confidence >= config.hardConfidenceMin) {
    return 'HARD_CONFIRM';
  }
  
  // 確度が中程度でSOFT_CONFIRMのデータがあればSOFT_CONFIRM
  if (confidence >= config.softConfidenceMin && hasSoftConfirmData) {
    return 'SOFT_CONFIRM';
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
