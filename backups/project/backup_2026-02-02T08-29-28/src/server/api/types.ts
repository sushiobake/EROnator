/**
 * API型定義
 * Data exposure policy遵守: クライアントへ返すのは「表示に必要な最小限の情報」のみ
 */

/**
 * クライアントへ返すWork情報（最小限）
 * - 全量を返さない（Spec/Brief: Data exposure policy）
 */
export interface WorkResponse {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null; // 許可ホスト判定後のみ返す
}

/**
 * クライアントへ返すTag情報（最小限）
 * - タグ全量を返さない（Brief: 辞書・tags_ui.tsv等の全量を配布しない）
 */
export interface TagResponse {
  tagKey: string;
  displayName: string;
}

/**
 * 質問情報（最小限）
 * - 質問プール全体・候補質問一覧・質問IDの全量を返さない（Brief）
 */
export interface QuestionResponse {
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';
  displayText: string;
  tagKey?: string; // EXPLORE_TAG, SOFT_CONFIRM用
  hardConfirmType?: 'TITLE_INITIAL' | 'AUTHOR'; // HARD_CONFIRM用
  hardConfirmValue?: string; // HARD_CONFIRM用（例: "あ", "サークルA"）
}

/**
 * セッション状態（最小限）
 * - 内部属性（推定根拠/evidence、confidenceの詳細内訳）は返さない（Brief）
 */
export interface SessionStateResponse {
  questionCount: number;
  confidence: number; // P(top1)のみ（詳細内訳は返さない）
  topWork?: WorkResponse; // 上位1件のみ（全量は返さない）
}

/**
 * FAIL_LIST応答（上位N件のみ）
 * - 候補作品の全量や上位大量リストは返さない（Brief: 上位K件以上は返さない）
 */
export interface FailListResponse {
  candidates: WorkResponse[]; // 最大N件（config.failListN）
}

/**
 * デバッグ用フィールドは本番で無効化（Brief）
 */
export interface DebugFields {
  // 本番環境では除外
  internalWeights?: never;
  allProbabilities?: never;
  questionPool?: never;
  tagDictionary?: never;
}

/**
 * REVEAL分析（断定時の確度・タグ整合度）
 * デバッグモード時のみ返す
 */
export interface RevealAnalysisResponse {
  confidence: number;
  tagAlignment: {
    matchedTags: string[];
    unmatchedTags: string[];
    alignmentScore: number;
  };
  questionSummary: {
    totalQuestions: number;
    exploreTagCount: number;
    confirmCount: number;
    keyTags: Array<{
      tagKey: string;
      displayName: string;
      answered: 'YES' | 'PROBABLY_YES' | 'NO' | 'PROBABLY_NO' | 'UNKNOWN' | 'DONT_CARE';
    }>;
  };
}
