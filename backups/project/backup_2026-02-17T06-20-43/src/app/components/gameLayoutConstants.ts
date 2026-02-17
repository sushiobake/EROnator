/**
 * ゲーム画面レイアウト定数（ブラウザ間で安定させるため px ベース）
 * ・左は余白が少しある
 * ・右はたくさんある
 * ・上もある程度ある
 * ・下は余白がない
 */

/** ステージ固定サイズ（キャラ・白板・文字のバランスを保つためまとめて scale する） */
export const STAGE_WIDTH_PX = 1200;
export const STAGE_HEIGHT_PX = 800;

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

/** キャラと台詞ボックスの間隔（固定して離れない） */
export const CHARACTER_TO_SPEECH_GAP_PX = 16;

/** コンテンツ開始位置 = キャラゾーン + 固定隙間（キャラと台詞の距離を常に一定に） */
export const CONTENT_OFFSET_LEFT_PX = CHARACTER_ZONE_WIDTH_PX + CHARACTER_TO_SPEECH_GAP_PX;

/** ホワイトボード風エリア（台詞・質問・正解・推薦を右中央に置く） */
export const WHITEBOARD_MAX_WIDTH_PX = 520;
export const WHITEBOARD_PADDING_PX = 32;
export const WHITEBOARD_GAP_PX = 24;
export const WHITEBOARD_BORDER_RADIUS_PX = 12;
