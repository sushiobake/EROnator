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
  /**
   * EXPLORE_TAGの質問選択を情報利得(IG)で行う。false なら従来の p≈0.5 に近いタグを選ぶ。
   * ロールバック時は false にすると従来挙動に戻る。未設定時は true（IGを使用）。
   */
  useIGForExploreSelection: z.boolean().optional(),
  /**
   * タグ質問・HARD_CONFIRMの重み更新をベイズ（事後確率）で行う。false なら従来の強度×beta。
   * ロールバック時は false にすると従来挙動に戻る。未設定時は true（ベイズを使用）。
   */
  useBayesianUpdate: z.boolean().optional(),
  /**
   * ベイズ更新時の尤度の下限（確率0で殺さない）。0.02 なら尤度は [0.02, 0.98]。未設定時 0.02。
   * bayesianEpsilonPhases が設定されている場合はフェーズ別に上書き。
   */
  bayesianEpsilon: z.number().min(0).max(0.5).optional(),
  /**
   * P4: フェーズ別イプシロン。EC（effectiveCandidates）に応じて epsilon を変える。
   * 前半 EC>200 → early, 中盤 20<EC<=200 → mid, 後半 EC<=20 → late。
   * 未設定時は bayesianEpsilon を全フェーズで使用。
   */
  bayesianEpsilonPhases: z
    .object({
      early: z.number().min(0).max(0.5),
      mid: z.number().min(0).max(0.5),
      late: z.number().min(0).max(0.5),
    })
    .strict()
    .optional(),
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
  /**
   * 21問目以降、unified の前に HARD_CONFIRM（タイトル頭文字・作者・キャラ）を試す確率。0〜1。0で無効。未設定時は 0.25。
   */
  hardConfirmInjectionRatio: z.number().min(0).max(1).optional(),
  /**
   * Special Question を挿入する質問番号（1-based）。例: [3, 5, 9, 16] で Q3, Q5, Q9, Q16。
   * 未設定時は [3, 5, 9, 16]。
   */
  specialQuestionSlotIndices: z.array(z.number().int().positive()).optional(),
  /**
   * 救済特別質問（Q20, Q24）: 絞り込めていない場合のみ TITLE_SYLLABLE_2 / AUTHOR_CHAR_TYPE を挿入。
   * 未設定時は無効。
   */
  rescueSpecialCondition: z
    .object({
      slotIndices: z.array(z.number().int().positive()),
      effectiveCandidatesMin: z.number().positive(),
      confidenceMax: z.number().min(0).max(1),
    })
    .strict()
    .optional(),
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

/** ゲーム内表示文言（トップ・質問前段・断定・正解・外れ・おすすめ・AI_GATE） */
const GameCopySchema = z.object({
  /** トップ画面。{workCount} は作品数に置換。行は配列で最大5行程度 */
  topLines: z.array(z.string()).min(1).max(5),
  /** 質問の前段（質問文の直上1行） */
  questionPreamble: z.string(),
  /** 断定画面：前段＋メイン */
  revealPreamble: z.string(),
  revealMain: z.string(),
  /** 正解時：キャラ台詞＋成功タイトル＋おすすめタイトル */
  successSpeech: z.string(),
  successTitle: z.string(),
  recommendTitle: z.string(),
  /** 外れ① FAIL_LIST（リスト表示） */
  failListSpeech: z.string(),
  failListSubMobile: z.string(),
  failListSubPc: z.string(),
  /** 外れ② ALMOST_SUCCESS（惜しかった） */
  almostSuccessSpeech: z.string(),
  /** AI_GATE（最初のゲート）前段＋メイン */
  aiGatePreamble: z.string(),
  aiGateMain: z.string(),
}).strict();

export const DEFAULT_GAME_COPY = {
  topLines: [
    '有名な同人誌を妄想してみて。',
    '{workCount}作品の中から当ててあげるわ。',
    '私は何でもお見通しだから。',
  ],
  questionPreamble: 'あなたが妄想した作品は……',
  revealPreamble: 'あなたが妄想した作品は……',
  revealMain: 'ズバリ！コレ…でしょ！',
  successSpeech: '正解！？やっぱりね！',
  successTitle: '正解！？やっぱりね！',
  recommendTitle: 'そんなあなたには…おすすめもあるわ！',
  failListSpeech: 'うーん…ちょっとわからなかったわ。',
  failListSubMobile: '下のリストにある？',
  failListSubPc: 'ちなみにこの中にはある？',
  almostSuccessSpeech: 'それか～～～！次回は当てるからね！',
  aiGatePreamble: 'あなたが妄想した作品は……',
  aiGateMain: 'AI生成作品ではない？',
};

/** 考え中：7種類。inGameは early/mid/late/closing で各最大5候補＋表示モード。画像は /ilust/ の固定ファイル名 */
const InGameThinkingLevelSchema = z.object({
  texts: z.array(z.string()).min(1).max(5),
});
const InGameThinkingSchema = z.object({
  displayMode: z.enum(['random', 'sequential']),
  early: InGameThinkingLevelSchema,
  mid: InGameThinkingLevelSchema,
  late: InGameThinkingLevelSchema,
  closing: InGameThinkingLevelSchema,
}).strict();

const SingleThinkingSchema = z.object({
  text: z.string(),
}).strict();

const ThinkingSchema = z.object({
  inGame: InGameThinkingSchema,
  opening: SingleThinkingSchema,
  endingCorrect: SingleThinkingSchema,
  endingWrong: SingleThinkingSchema,
  /** 失敗リストで作品を選んだときの考え中 */
  failListSelect: SingleThinkingSchema.optional(),
  /** 失敗リストで「リストにない」を送ったときの考え中 */
  failListNotInList: SingleThinkingSchema.optional(),
}).strict();

/** 旧形式（thinking: { displayMode, early, mid, late, closing }）互換用 */
const LegacyThinkingSchema = z.object({
  displayMode: z.enum(['random', 'sequential']),
  early: z.array(z.string()).min(1).max(5),
  mid: z.array(z.string()).min(1).max(5),
  late: z.array(z.string()).min(1).max(5),
  closing: z.array(z.string()).min(1).max(5),
}).strict();

export type ThinkingConfig = z.infer<typeof ThinkingSchema>;

/** 旧形式を新形式に変換。既に新形式なら返す（不足している failListSelect / failListNotInList はデフォルトで補う） */
export function migrateThinking(raw: unknown): ThinkingConfig {
  const r = raw as Record<string, unknown> | undefined;
  if (r && typeof r === 'object' && 'inGame' in r && r.inGame && Array.isArray((r.inGame as { early?: { texts?: unknown } })?.early?.texts)) {
    const nr = raw as ThinkingConfig;
    return {
      ...nr,
      failListSelect: nr.failListSelect ?? { text: '考え中…' },
      failListNotInList: nr.failListNotInList ?? { text: '考え中…' },
    };
  }
  const old = r as { displayMode?: string; early?: string[]; mid?: string[]; late?: string[]; closing?: string[] } | undefined;
  const base = {
    failListSelect: { text: '考え中…' },
    failListNotInList: { text: '考え中…' },
  };
  if (!old || !Array.isArray(old.early)) {
    return {
      inGame: {
        displayMode: 'sequential',
        early: { texts: ['考え中…'] },
        mid: { texts: ['なんとなく見えてきた…'] },
        late: { texts: ['おっ……これは……！'] },
        closing: { texts: ['わかったかも……！'] },
      },
      opening: { text: '考え中…' },
      endingCorrect: { text: 'わかった！' },
      endingWrong: { text: 'うーん…次は…' },
      ...base,
    };
  }
  return {
    inGame: {
      displayMode: (old.displayMode === 'random' ? 'random' : 'sequential') as 'random' | 'sequential',
      early: { texts: old.early?.length ? old.early : ['考え中…'] },
      mid: { texts: old.mid?.length ? old.mid : ['なんとなく見えてきた…'] },
      late: { texts: old.late?.length ? old.late : ['おっ……これは……！'] },
      closing: { texts: old.closing?.length ? old.closing : ['わかったかも……！'] },
    },
    opening: { text: '考え中…' },
    endingCorrect: { text: 'わかった！' },
    endingWrong: { text: 'うーん…次は…' },
    ...base,
  };
}

export const DEFAULT_THINKING = {
  inGame: {
    displayMode: 'sequential' as const,
    early: { texts: ['考え中…'] },
    mid: { texts: ['なんとなく見えてきた…'] },
    late: { texts: ['おっ……これは……！'] },
    closing: { texts: ['わかったかも……！'] },
  },
  opening: { text: '考え中…' },
  endingCorrect: { text: 'わかった！' },
  endingWrong: { text: 'うーん…次は…' },
  failListSelect: { text: '考え中…' },
  failListNotInList: { text: '考え中…' },
};

export const MvpConfigSchema = z.object({
  version: z.literal('v1.5'),
  /** ゲーム文言。未設定時は DEFAULT_GAME_COPY */
  gameCopy: GameCopySchema.optional(),
  /** 考え中7種。未設定または旧形式のときは migrateThinking で新形式に */
  thinking: z.union([ThinkingSchema, LegacyThinkingSchema]).optional(),
  confirm: ConfirmSchema,
  algo: AlgoSchema,
  flow: FlowSchema,
  dataQuality: DataQualitySchema,
  popularity: PopularitySchema,
}).strict();

export type MvpConfig = z.infer<typeof MvpConfigSchema>;
