/**
 * ゲーム画面レイアウト定数（ブラウザ間で安定させるため px ベース）
 * ・左は余白が少しある
 * ・右はたくさんある
 * ・上もある程度ある
 * ・下は余白がない
 */

/** キャラ左余白（px） */
export const CHARACTER_LEFT_PX = 16;

/** キャラ幅（px）かなり大きく */
export const CHARACTER_WIDTH_PX = 520;

/** キャラ高さ（px）画面に対して手前に大きく */
export const CHARACTER_HEIGHT_PX = 720;

/** キャラ上余白（下は0のため、上で調整） */
export const CHARACTER_TOP_MARGIN_PX = 32;

/** キャラエリア幅 = 左余白 + キャラ幅（コンテンツの左スペーサーに使用） */
export const CHARACTER_ZONE_WIDTH_PX = CHARACTER_LEFT_PX + CHARACTER_WIDTH_PX;

/** コンテンツ開始位置 = キャラゾーン + 隙間 */
export const CONTENT_OFFSET_LEFT_PX = CHARACTER_ZONE_WIDTH_PX + 24;
