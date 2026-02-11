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
 * EXPLORE_TAG用 p値バンドオプション（configで指定時のみ使用）
 */
export interface ExplorePValueBand {
  pValueMin: number;
  pValueMax: number;
}

/**
 * EXPLORE_TAG選択 (Spec §6.1 - シンプル版)
 * 
 * - 全タグの中から、pが0.5に最も近いものを選ぶ
 * - pValueBand を渡した場合: p が [min, max] 内のタグのみ候補。該当が無ければ null（呼び出し元で HARD_CONFIRM 等にフォールバック）
 * Tie-break: tagKey昇順（決定論的）
 */
export function selectExploreTag(
  availableTags: TagInfo[],
  probabilities: WorkProbability[],
  workHasTag: (workId: string, tagKey: string) => boolean,
  confidence: number = 0, // 現在の確度（未使用だが互換性のため残す）
  topWorkId: string | null = null, // top1のworkId（未使用だが互換性のため残す）
  pValueBand?: ExplorePValueBand | null,
  /** 連続NO時: true なら p が高いタグを選ぶ（当たりを挟む） */
  preferHighP: boolean = false
): string | null {
  if (availableTags.length === 0) {
    return null;
  }
  
  // pを計算（各タグを持つ作品の確率の合計）
  const candidates = availableTags.map(tag => {
    const p = probabilities
      .filter(prob => workHasTag(prob.workId, tag.tagKey))
      .reduce((sum, prob) => sum + prob.probability, 0);
    
    return {
      tagKey: tag.tagKey,
      coverage: p,
      distanceFromHalf: Math.abs(p - 0.5),
    };
  });
  
  // p値バンドが指定されている場合、範囲内の候補に限定
  let filtered = candidates;
  if (pValueBand != null) {
    filtered = candidates.filter(
      c => c.coverage >= pValueBand.pValueMin && c.coverage <= pValueBand.pValueMax
    );
    if (filtered.length === 0) {
      console.log(
        `[selectExploreTag] p値が [${pValueBand.pValueMin}, ${pValueBand.pValueMax}] 内のタグが0件のため null（HARD_CONFIRM等にフォールバック）`
      );
      return null;
    }
  }
  
  // 通常: 0.5に最も近いものを選ぶ / 連続NO時: p が高いものを選ぶ（当たり狙い）
  filtered.sort((a, b) => {
    if (preferHighP) {
      if (a.coverage !== b.coverage) return b.coverage - a.coverage;
    } else {
      if (a.distanceFromHalf !== b.distanceFromHalf) {
        return a.distanceFromHalf - b.distanceFromHalf;
      }
    }
    return a.tagKey.localeCompare(b.tagKey);
  });
  
  const selected = filtered[0];
  console.log(`[selectExploreTag] ${preferHighP ? '当たり狙い' : 'シンプル'}: ${selected.tagKey} (p: ${selected.coverage.toFixed(2)})`);
  return selected.tagKey;
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
  
  // Fallback: 単調にならないよう、SOFT のデータがあるときは 50% で SOFT / 50% で HARD にする
  if (hasSoftConfirmData) {
    return Math.random() < 0.5 ? 'SOFT_CONFIRM' : 'HARD_CONFIRM';
  }
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
