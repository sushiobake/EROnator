/**
 * F@NZA王クイズ プロトタイプ用の型定義（エロネイター本体とは独立）
 */

export type QuizTier = 'famous' | 'mid' | 'minor';

export interface QuizDisplayTag {
  tagKey: string;
  displayName: string;
  isDerived: boolean;
  confidence?: number | null;
}

export interface QuizWork {
  workId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string | null;
  popularityBase: number;
  /** サンプル画像（先頭から最大8枚を保持） */
  sampleImages: string[];
  /** 類似度計算用（互換のため保持） */
  tagKeys: string[];
  derivedTags: QuizDisplayTag[];
  officialTags: QuizDisplayTag[];
  structuralTags: QuizDisplayTag[];
  tier: QuizTier;
  /** "human" | "ai" | "untagged" | null — Work.tagSource の生値 */
  tagSource?: string | null;
}

export interface QuizChoice {
  id: 'A' | 'B' | 'C' | 'D';
  workId: string;
  title: string;
  authorName: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  questionId: string;
  /** 出題ごとにランダム選出された3枚のサンプル画像。枚数は常に3。 */
  images: string[];
  hintSentences: string[];
  choices: QuizChoice[];
  correctWorkId: string;
  correctThumbnailUrl: string | null;
  /** デバッグ用：作品DBに紐づくすべてのタグ（displayName） */
  debugAllTags?: {
    derived: string[];
    official: string[];
    structural: string[];
  };
}

export interface QuizGenerateResponse {
  questions: QuizQuestion[];
}

export interface QuizPoolSummary {
  totalCandidates: number;
  totalSelected: number;
  famousCount: number;
  midCount: number;
  minorCount: number;
}
