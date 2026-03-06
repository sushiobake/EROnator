/**
 * ゲーム画面レイアウト定数（ブラウザ間で安定させるため px ベース）
 * ・左は余白が少しある
 * ・右はたくさんある
 * ・上もある程度ある
 * ・下は余白がない
 */

/** ステージ固定サイズ（白板・キャラを1.3倍にした分だけ幅を拡張） */
export const STAGE_WIDTH_PX = 1645;
/** 白板を上に1.1倍分確保するため高さを増やした（キャラ・フチは scale で同じ見え方） */
export const STAGE_HEIGHT_PX = 865;

/** キャラ左余白（px） */
export const CHARACTER_LEFT_PX = 16;

/** キャラ幅（px）相対的に小さくなったため1.3倍に（540*1.3） */
export const CHARACTER_WIDTH_PX = 702;

/** キャラ高さ（px）幅に合わせて1.3倍。はみ出し（髪）OK */
export const CHARACTER_HEIGHT_PX = 936;

/** キャラ上余白（下は0のため、上で調整） */
export const CHARACTER_TOP_MARGIN_PX = 32;

/** キャラエリア幅 = 左余白 + キャラ幅（コンテンツの左スペーサーに使用） */
export const CHARACTER_ZONE_WIDTH_PX = CHARACTER_LEFT_PX + CHARACTER_WIDTH_PX;

/** キャラと台詞ボックスの間隔（固定して離れない） */
export const CHARACTER_TO_SPEECH_GAP_PX = 16;

/** コンテンツ開始位置 = キャラゾーン + 固定隙間（キャラと台詞の距離を常に一定に） */
export const CONTENT_OFFSET_LEFT_PX = CHARACTER_ZONE_WIDTH_PX + CHARACTER_TO_SPEECH_GAP_PX;

/** ホワイトボード風エリア（台詞・質問・正解・推薦）。さらに1.3倍 = 676*1.3 */
export const WHITEBOARD_MAX_WIDTH_PX = 879;
/** 白板の通常幅（おすすめ5件以外）。false にすると常に広い白板で現状に戻る */
export const USE_NARROW_WHITEBOARD = true;
/** 白板の狭い幅（USE_NARROW_WHITEBOARD 時のみ使用）。広いサイズの約半分を1.2倍 */
export const WHITEBOARD_NARROW_WIDTH_PX = 528;
export const WHITEBOARD_PADDING_PX = 32;
export const WHITEBOARD_GAP_PX = 24;
export const WHITEBOARD_BORDER_RADIUS_PX = 12;
