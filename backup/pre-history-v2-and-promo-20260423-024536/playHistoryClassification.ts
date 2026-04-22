/**
 * プレイ履歴を「見るべきかどうか」の観点で分類するユーティリティ。
 * 管理画面の履歴一覧に品質バッジを付け、ソート／フィルタの判定根拠として使う。
 *
 * 区分:
 *   - valid  : 学びになる・有効なプレイ（正解 / 近似 / 作品名提供 / FANZAクリック）
 *   - review : 分析価値のある失敗（質問を多く重ねたが当てられず、情報提供なし）
 *   - short  : 短時間でサンプルとしての価値が薄いプレイ
 *   - noise  : バウンス / 連打 / 即離脱
 */

export type PlayQualityCategory = 'valid' | 'review' | 'short' | 'noise';

export interface PlayQualityBadge {
  category: PlayQualityCategory;
  /** 表示用ラベル（例: 「✅ 有効」） */
  label: string;
  /** より短い表現（ソートキーやタイトル用） */
  shortLabel: string;
  /** badge 前景色 */
  color: string;
  /** badge 背景色 */
  bg: string;
  /** 判定理由（デバッグ表示・tooltip 用） */
  reasons: string[];
}

export interface PlayHistoryLike {
  outcome: string;
  questionCount: number;
  resultWorkId: string | null;
  submittedTitleText: string | null;
  clickedFanza?: boolean | null;
  sessionStartedAt?: string | null;
  createdAt: string;
  questionHistory?: unknown;
}

const COLORS = {
  valid:  { fg: '#14532d', bg: '#dcfce7', border: '#16a34a' },
  review: { fg: '#9a3412', bg: '#ffedd5', border: '#ea580c' },
  short:  { fg: '#334155', bg: '#e2e8f0', border: '#64748b' },
  noise:  { fg: '#6b7280', bg: '#f3f4f6', border: '#9ca3af' },
};

function makeBadge(
  category: PlayQualityCategory,
  label: string,
  shortLabel: string,
  reasons: string[]
): PlayQualityBadge {
  const c = COLORS[category];
  return {
    category,
    label,
    shortLabel,
    color: c.fg,
    bg: c.bg,
    reasons,
  };
}

interface QuestionStep {
  answer?: string;
}

function computeDurationSec(row: PlayHistoryLike): number | null {
  if (!row.sessionStartedAt || !row.createdAt) return null;
  const start = new Date(row.sessionStartedAt).getTime();
  const end = new Date(row.createdAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 1000);
}

function computeAnswerDominance(row: PlayHistoryLike): { total: number; maxRatio: number } {
  if (!Array.isArray(row.questionHistory)) return { total: 0, maxRatio: 0 };
  const counts: Record<string, number> = {};
  for (const raw of row.questionHistory as QuestionStep[]) {
    const ans = typeof raw?.answer === 'string' ? raw.answer : null;
    if (!ans) continue;
    counts[ans] = (counts[ans] ?? 0) + 1;
  }
  const values = Object.values(counts);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return { total: 0, maxRatio: 0 };
  const max = Math.max(0, ...values);
  return { total, maxRatio: max / total };
}

export function classifyPlayHistoryRow(row: PlayHistoryLike): PlayQualityBadge {
  const reasons: string[] = [];
  const q = row.questionCount ?? 0;
  const hasSubmitted = !!(row.submittedTitleText && row.submittedTitleText.trim());
  const clicked = !!row.clickedFanza;
  const durationSec = computeDurationSec(row);
  const { total: ansTotal, maxRatio } = computeAnswerDominance(row);

  // --- ノイズ判定（優先度最高）----------------------------------------
  if (q === 0) {
    reasons.push('質問 0 問（バウンス）');
    return makeBadge('noise', '💤 ノイズ', 'バウンス', reasons);
  }
  if (durationSec != null && durationSec < 5) {
    reasons.push(`滞在 ${durationSec}秒（即離脱）`);
    return makeBadge('noise', '💤 ノイズ', '即離脱', reasons);
  }
  if (q >= 8 && maxRatio >= 0.85 && ansTotal > 0) {
    reasons.push(`同一回答 ${Math.round(maxRatio * 100)}%（連打疑い）`);
    return makeBadge('noise', '💤 ノイズ', '連打疑い', reasons);
  }

  // --- 有効判定（情報として価値がある）---------------------------------
  if (row.outcome === 'SUCCESS') {
    reasons.push('正解');
    return makeBadge('valid', '✅ 有効', '正解', reasons);
  }
  if (row.outcome === 'ALMOST_SUCCESS') {
    reasons.push('候補から選択（近似）');
    return makeBadge('valid', '✅ 有効', '近似', reasons);
  }
  if (hasSubmitted) {
    reasons.push('作品名を提供してくれたプレイ');
    return makeBadge('valid', '✅ 有効', '情報提供', reasons);
  }
  if (clicked) {
    reasons.push('FANZAで見るをクリック');
    return makeBadge('valid', '✅ 有効', '興味あり', reasons);
  }

  // --- 短時間（質問が少ない / 滞在が短い）------------------------------
  if (q < 5) {
    reasons.push(`質問 ${q} 問のみ`);
    return makeBadge('short', '⏱ 短時間', `${q}問`, reasons);
  }
  if (durationSec != null && durationSec < 15) {
    reasons.push(`滞在 ${durationSec}秒`);
    return makeBadge('short', '⏱ 短時間', `${durationSec}秒`, reasons);
  }

  // --- 要レビュー（分析価値のある失敗）---------------------------------
  reasons.push(`質問 ${q} 問の ${row.outcome}（情報提供なし）`);
  return makeBadge('review', '🔍 要確認', row.outcome, reasons);
}

/** UI セレクトボックス用のフィルタ定義 */
export const PLAY_QUALITY_FILTER_OPTIONS: Array<{
  value: '' | PlayQualityCategory | 'validOrReview';
  label: string;
  description: string;
}> = [
  { value: '', label: 'すべて', description: '全てのプレイを表示' },
  {
    value: 'validOrReview',
    label: '✅🔍 有効＋要確認（=見る価値あり）',
    description: '正解・近似・情報提供・FANZA関心・分析価値のある失敗',
  },
  { value: 'valid',  label: '✅ 有効のみ',    description: '正解・近似・作品名提供・FANZAクリック' },
  { value: 'review', label: '🔍 要確認のみ',  description: '質問を重ねたが当てられなかったプレイ' },
  { value: 'short',  label: '⏱ 短時間のみ',  description: '質問少 or 滞在短' },
  { value: 'noise',  label: '💤 ノイズのみ',  description: 'バウンス・即離脱・連打疑い' },
];

export function matchesQualityFilter(
  badge: PlayQualityBadge,
  filter: '' | PlayQualityCategory | 'validOrReview'
): boolean {
  if (!filter) return true;
  if (filter === 'validOrReview') return badge.category === 'valid' || badge.category === 'review';
  return badge.category === filter;
}
