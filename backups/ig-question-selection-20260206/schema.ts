import { z } from 'zod';

/**
 * MVP Config Schema (v1.5)
 * Source of truth: MVP_CONFIG_SCHEMA_v1.5.md
 * スキーマ外キーは起動時エラー（strict mode）
 */

const ConfirmSchema = z.object({
  revealThreshold: z.number().min(0).max(1),
  confidenceConfirmBand: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).refine(
    (val) => val[0] <= val[1],
    { message: 'confidenceConfirmBand[0] must be <= confidenceConfirmBand[1]' }
  ),
  qForcedIndices: z.array(z.number().int().positive()),
  softConfidenceMin: z.number().min(0).max(1),
  hardConfidenceMin: z.number().min(0).max(1),
}).strict();

const AlgoSchema = z.object({
  beta: z.number().positive(),
  alpha: z.number().min(0).max(1),
  derivedConfidenceThreshold: z.number().min(0).max(1),
  revealPenalty: z.number().positive().max(1),
  /** EXPLORE_TAGでp値がこの範囲外のタグは出題しない。未設定時はフィルタなし */
  explorePValueMin: z.number().min(0).max(1).optional(),
  explorePValueMax: z.number().min(0).max(1).optional(),
  /** p値が範囲内のタグが無いときHARD_CONFIRM/REVEALにフォールバックする */
  explorePValueFallbackEnabled: z.boolean().optional(),
  /** まとめ質問の回答強度のスケール。1.0=通常タグと同程度、0.6=控えめ。未設定時0.6 */
  summaryQuestionStrengthScale: z.number().positive().optional(),
  /** EXPLORE_TAG（まとめ以外）の回答強度のスケール。1.0=変更なし。未設定時1.0 */
  exploreTagStrengthScale: z.number().positive().optional(),
  /** SOFT_CONFIRMの回答強度のスケール。1.0=変更なし。未設定時1.0 */
  softConfirmStrengthScale: z.number().positive().optional(),
}).strict();

const FlowSchema = z.object({
  maxQuestions: z.number().int().positive(),
  maxRevealMisses: z.number().int().positive(),
  failListN: z.number().int().positive(),
  effectiveConfirmThresholdFormula: z.enum(['A']),
  effectiveConfirmThresholdParams: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    divisor: z.number().int().positive(),
  }).strict().refine(
    (val) => val.max >= val.min,
    { message: 'effectiveConfirmThresholdParams.max must be >= min' }
  ),
  /** 連続NOがこの数以上なら次の1問は「当たり」狙い（p高めのタグを選ぶ）。未設定時は3 */
  consecutiveNoForAtari: z.number().int().min(1).optional(),
  /** まとめ質問を優先して選ぶ確率。0〜1。未設定時は0（優先なし） */
  summaryPreferRatio: z.number().min(0).max(1).optional(),
  /**
   * HARD_CONFIRMでタイトル頭文字・作者を選ぶとき、確度順の上位何件の作品から選ぶか。
   * - 1: 確度1位のみ（従来どおり）。正解が1位になればその頭文字を聞ける。
   * - 2以上: 1位〜N位から未使用の頭文字・作者を順に選ぶ。バリエーションは増えるが、
   *   正解がtop-Nに入らないと正解の頭文字を聞けずMAX_QUESTIONSで終わるリスクあり。
   * 推奨: 2か3で試す。未設定時は1。
   */
  titleInitialTopN: z.number().int().min(1).optional(),
}).strict();

const DataQualitySchema = z.object({
  minCoverageMode: z.enum(['RATIO', 'WORKS', 'AUTO']),
  minCoverageRatio: z.number().min(0).max(1).nullable(),
  minCoverageWorks: z.number().int().nonnegative().nullable(),
  maxCoverageRatio: z.number().min(0).max(1).nullable().optional(), // 上限（全員持っているタグを除外）
}).strict();

const PopularitySchema = z.object({
  playBonusOnSuccess: z.number().nonnegative(),
}).strict();

export const MvpConfigSchema = z.object({
  version: z.literal('v1.5'),
  confirm: ConfirmSchema,
  algo: AlgoSchema,
  flow: FlowSchema,
  dataQuality: DataQualitySchema,
  popularity: PopularitySchema,
}).strict();

export type MvpConfig = z.infer<typeof MvpConfigSchema>;
