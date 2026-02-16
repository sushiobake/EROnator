/**
 * 管理画面タグのランク別色（タグ＆質問リストを基準に統一）
 * S紫 / 追加S濃い紫 / A緑 / B黄 / C赤 / X青
 */

export const RANK_BG = {
  S: '#e8d5ff',
  AdditionalS: '#5a189a',
  A: '#d4edda',
  B: '#fff3cd',
  C: '#f8d7da',
  X: '#cfe2ff',
} as const;

export const RANK_TEXT = {
  S: '#6f42c1',
  AdditionalS: '#ffffff',
  A: '#155724',
  B: '#856404',
  C: '#721c24',
  X: '#084298',
} as const;

/** チップ用 bg + border（ManualTagging 等） */
export const RANK_CHIP = {
  S: { bg: '#e8d5ff', border: '#b794f6', text: '#6f42c1' },
  AdditionalS: { bg: '#5a189a', border: '#3c096c', text: '#ffffff' },
  A: { bg: '#d4edda', border: '#28a745', text: '#155724' },
  B: { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
  C: { bg: '#f8d7da', border: '#dc3545', text: '#721c24' },
  X: { bg: '#cfe2ff', border: '#0d6efd', text: '#084298' },
} as const;
