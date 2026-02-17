/**
 * タグの「付いている作品数（workCount）」に基づく表示用ユーティリティ
 * まとめ質問タブ・タグ管理タブで使用。他タブ（作品DB・インポート等）への移植も可能。
 * 最大値は 100 でキャップ（100以上は同じ濃さ）。
 * 色は rankColors（タグリスト・DB・作品インポートと統一）をベースに、濃さで workCount を表現。
 */

import { RANK_BG } from '../constants/rankColors';

export const WORK_COUNT_MAX_CAP = 100;

/**
 * workCount を 0〜1 の濃さ係数に変換。maxCap 以上は 1。
 */
export function getWorkCountIntensity(
  workCount: number | undefined,
  maxCap: number = WORK_COUNT_MAX_CAP
): number {
  if (workCount == null || workCount <= 0) return 0;
  const capped = Math.min(workCount, maxCap);
  return capped / maxCap;
}

/**
 * 表示用ラベル: "医者（3）" または workCount が無いときは "医者"
 */
export function getWorkCountLabel(displayName: string, workCount: number | undefined): string {
  if (workCount == null) return displayName;
  return `${displayName}（${workCount}）`;
}

/**
 * タグ管理テーブル・まとめ質問タグボタン共通：ランク色に乗せる透明度を workCount で変えるときの hex alpha（2桁）
 * 勾配をはっきりさせるため、最小は薄く・最大はほぼ不透明（intensity 0 → 0x50, 1 → 0xff）
 */
export function getWorkCountRowAlphaHex(intensity: number): string {
  const alpha = Math.round(80 + 175 * intensity); // 80〜255 (0x50〜0xff)
  return Math.min(255, alpha).toString(16).padStart(2, '0');
}

/** まとめ質問タブのセクション見出し → ランクキー（タグリストの RANK_BG と統一） */
export type SummarySectionRankKey = 'S' | 'A' | 'B';

const SECTION_LABEL_TO_RANK: Record<string, SummarySectionRankKey> = {
  'S（公式）': 'S',
  'A（採用）': 'A',
  'B（派生）': 'B',
};

/**
 * タグボタン用の背景色（まとめ質問タブ・タグリストと色を統一）
 * ランク（S/A/B）の RANK_BG をベースに、workCount の濃さで alpha を変える。
 * 編集未選択時も同じ色で表示する（disabled でも色は付ける）。
 */
export function getTagButtonBackgroundFromSection(
  sectionTypeLabel: string,
  workCount: number | undefined,
  _disabled?: boolean
): string {
  const rankKey = SECTION_LABEL_TO_RANK[sectionTypeLabel];
  const baseColor = rankKey ? RANK_BG[rankKey] : RANK_BG.B;
  const intensity = getWorkCountIntensity(workCount);
  const alphaHex = getWorkCountRowAlphaHex(intensity);
  return baseColor + alphaHex;
}
