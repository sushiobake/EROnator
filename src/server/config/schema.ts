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
  hardConfidenceMinByPhase: z
    .object({
      enabled: z.boolean(),
      minPopularityBase: z.number().min(0).max(100).optional(),
      phases: z
        .object({
          q20: z.number().min(0).max(1),
          q25: z.number().min(0).max(1),
          q30: z.number().min(0).max(1),
        })
        .strict(),
    })
    .strict()
    .optional(),
  /**
   * HARD_CONFIRM で YES のとき、revealThreshold を待たず REVEAL へ進める。
   * TITLE_INITIAL / CHARACTER は常に即断定。AUTHOR は authorMinConfidence 以上のときのみ。
   */
  hardConfirmYesAutoReveal: z
    .object({
      enabled: z.boolean().optional(),
      authorMinConfidence: z.number().min(0).max(1).optional(),
    })
    .strict()
    .optional(),
}).strict();

const TopNForIGPhaseSchema = z
  .object({
    /** この質問番号（1-based・次に出す質問）以下なら topN を使用 */
    untilQuestionIndex: z.number().int().positive(),
    /** IG に載せる作品数。0 は全作品（totalWorks） */
    topN: z.number().int().min(0),
  })
  .strict();

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
  /**
   * EXPLORE_TAG の IG 計算に使う確率先頭 N 件。未設定時は 300（従来）。
   * 0 は全作品（totalWorks）。大きくすると無名作品の当たりやすさが上がるが計算コスト増。
   */
  topNForIG: z.number().int().min(0).optional(),
  /**
   * 質問番号ごとに topN を切り替え。untilQuestionIndex 昇順で先にマッチした段を採用。
   * 未設定または空なら topNForIG のみ使用。
   */
  topNForIGPhases: z.array(TopNForIGPhaseSchema).optional(),
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
  /**
   * 早期分岐レビュー（Q25/Q30/Q35/Q40 など）。
   * ①確度が minConfidence 未満 かつ ②実質候補が maxEffectiveCandidates 超（広すぎ＝絞れていない）のとき早期失敗。
   * maxConfidenceDelta5 は後方互換のためパースのみ（無視）。
   */
  earlyExitReview: z
    .object({
      enabled: z.boolean().optional(),
      reviewIndices: z.array(z.number().int().positive()),
      requiredConditions: z.number().int().min(2).max(2).optional(),
      thresholds: z
        .object({
          q20: z
            .object({
              minConfidence: z.number().min(0).max(1),
              maxEffectiveCandidates: z.number().positive(),
              maxConfidenceDelta5: z.number().min(0).max(1).optional(),
            })
            .strict()
            .optional(),
          q25: z
            .object({
              minConfidence: z.number().min(0).max(1),
              maxEffectiveCandidates: z.number().positive(),
              maxConfidenceDelta5: z.number().min(0).max(1).optional(),
            })
            .strict(),
          q30: z
            .object({
              minConfidence: z.number().min(0).max(1),
              maxEffectiveCandidates: z.number().positive(),
              maxConfidenceDelta5: z.number().min(0).max(1).optional(),
            })
            .strict(),
          q35: z
            .object({
              minConfidence: z.number().min(0).max(1),
              maxEffectiveCandidates: z.number().positive(),
              maxConfidenceDelta5: z.number().min(0).max(1).optional(),
            })
            .strict(),
          q40: z
            .object({
              minConfidence: z.number().min(0).max(1),
              maxEffectiveCandidates: z.number().positive(),
              maxConfidenceDelta5: z.number().min(0).max(1).optional(),
            })
            .strict(),
        })
        .strict(),
    })
    .strict()
    .optional(),
}).strict();

/** 新タグ質問（Q2/Q7/Q13 等）。未設定時は無効 */
const NewTagQuestionsSchema = z
  .object({
    enabled: z.boolean().optional(),
    slotIndices: z.array(z.number().int().positive()),
    variants: z.array(
      z
        .object({
          id: z.string(),
          tagKey: z.string(),
          displayText: z.string(),
        })
        .strict()
    ),
  })
  .strict();

/** ノイズ→推薦誘導（TITLE_SYLLABLE とタイトル第2枠がともに UNKNOWN の直後） */
const NoiseGuideRecommendSchema = z
  .object({
    enabled: z.boolean().optional(),
    questionText: z.string(),
  })
  .strict();

/** FAIL_LIST（FailHub）の表示・検索設定 */
const FailHubSchema = z
  .object({
    enabled: z.boolean().optional(),
    candidateCount: z.number().int().positive().optional(),
    searchDebounceMs: z.number().int().min(0).optional(),
    searchLimitDefault: z.number().int().positive().optional(),
    searchLimitMax: z.number().int().positive().optional(),
    showRecommendEntry: z.boolean().optional(),
  })
  .strict();

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
  /** 外れ① 作品名を直接入力する欄の上の一文（常時表示） */
  failListNotInListPrompt: z.string(),
  /** 互換のため残す。UIでは未使用 */
  failListBtnNotInList: z.string(),
  failListBtnRecommend: z.string(),
  failListBtnTop: z.string(),
  /** 外れ① 検索ブロックの見出し */
  failListSearchHeading: z.string(),
  failListSearchIntro: z.string(),
  failListSearchPlaceholder: z.string(),
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
  failListSubMobile: 'この中にある？　なければ検索か、作品名を教えてね。',
  failListSubPc: 'この中に近いものはある？　ないなら右で検索してみて。',
  failListNotInListPrompt: 'それでも見つからなければ、作品名を教えてくれると助かるわ。',
  failListBtnNotInList: '',
  failListBtnRecommend: '推薦してもらう',
  failListBtnTop: 'トップに戻る',
  failListSearchHeading: '候補にないなら、ここで検索してみて',
  failListSearchIntro: 'タイトルの一部でいいから入れてみて。',
  failListSearchPlaceholder: '例: 鬼、学園、寝取られ など',
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

/** 推薦・有名タグ質問のカテゴリ（優先度順と一致） */
export const RECOMMEND_FAMOUS_CATEGORY_KEYS = ['ストーリー', 'プレイ', 'キャラクター'] as const;
export type RecommendFamousCategoryKey = (typeof RECOMMEND_FAMOUS_CATEGORY_KEYS)[number];

/** 推薦モードの文言（管理画面で編集可能） */
const RecommendCopySchema = z.object({
  /** AIゲート前段（あなたの好みは？） */
  aiGatePreamble: z.string(),
  /** AIゲートメイン（AI生成作品？それとも違う？） */
  aiGateMain: z.string(),
  /** 初期画面メイン（あなたの好みは？） */
  initialMain: z.string(),
  /** 有名度選択の質問（やっぱり有名作品！等の上） */
  initialPopularityQuestion: z.string().optional(),
  /** 優先度の質問（あなたが優先したいのは？順位をつけて！） */
  initialPriorityQuestion: z.string(),
  /**
   * 有名タグ質問の共通フォールバック（カテゴリ別が未設定のとき）
   * 後方互換のため残す
   */
  questionFamous: z.string().optional(),
  /** 今の質問が「ストーリー」カテゴリのタグを聞いているときの文言（優先順位に関係なく） */
  questionFamousStory: z.string().optional(),
  /** 今の質問が「プレイ」カテゴリのタグを聞いているときの文言 */
  questionFamousPlay: z.string().optional(),
  /** 今の質問が「キャラクター」カテゴリのタグを聞いているときの文言 */
  questionFamousCharacter: z.string().optional(),
  /** 無名タグ質問4-6の文言 */
  questionUnknown: z.string(),
  /** 特に重視のプロンプト（廃止・互換用。新フローでは sortPrompt を使用） */
  importantPrompt: z.string().optional(),
  /** 整理プロンプトの共通フォールバック（前半・後半が空のとき） */
  sortPrompt: z.string().optional(),
  /** 整理ページ（前半・sort1）のキャラ台詞 */
  sortPromptFront: z.string().optional(),
  /** 整理ページ（後半・sort2）のキャラ台詞 */
  sortPromptBack: z.string().optional(),
  /** 考え中（あなたにぴったりの作品を探しているわ…） */
  thinkingText: z.string(),
  /** 推薦結果画面の見出し（例：こんな作品なんてどう？） */
  recommendResultsHeading: z.string().optional(),
  /** ボタン文言（初期画面の「次へ」等・整理ボタンのフォールバック） */
  btnNext: z.string().optional(),
  /** 整理ページ（前半・sort1）のメインボタン */
  btnNextSortFront: z.string().optional(),
  /** 整理ページ（後半・sort2）のメインボタン（例：結果を示す） */
  btnNextSortBack: z.string().optional(),
  btnRetry: z.string().optional(),
  btnOk: z.string().optional(),
  btnNotInList: z.string().optional(),
  /** 前半有名タグ：20→40 件に広げる */
  btnFamousExpand: z.string().optional(),
  /** 前半有名タグ：40→20 件に戻す */
  btnFamousCollapse: z.string().optional(),
  btnFix: z.string().optional(),
  /** 推薦モードのみ「ひとつ前に戻る」等（通常の btnFix と差し替え） */
  btnFixRecommend: z.string().optional(),
  btnTopReset: z.string().optional(),
  /** 有名タグ：カテゴリ内で0件のまま進もうとしたとき */
  famousPickMinHint: z.string().optional(),
}).strict();

export type RecommendCopy = z.infer<typeof RecommendCopySchema>;

const DEFAULT_QUESTION_FAMOUS =
  'あなたが望む同人誌にはどんな特徴がある？ 3つまで選んで！ 特に重要なものがあれば1つだけチェックして！';

/** 現在の有名タグ質問カテゴリに応じた文言（カテゴリ別 → questionFamous → デフォルト） */
export function getFamousQuestionForCategory(rc: RecommendCopy, cat: RecommendFamousCategoryKey): string {
  const specific =
    cat === 'ストーリー'
      ? rc.questionFamousStory
      : cat === 'プレイ'
        ? rc.questionFamousPlay
        : rc.questionFamousCharacter;
  if (specific != null && specific.trim() !== '') return specific;
  if (rc.questionFamous != null && rc.questionFamous.trim() !== '') return rc.questionFamous;
  return DEFAULT_QUESTION_FAMOUS;
}

export const DEFAULT_RECOMMEND_COPY: RecommendCopy = {
  aiGatePreamble: 'あなたの好みは？',
  aiGateMain: 'AI生成作品？それとも違う？',
  initialMain: 'あなたの好みは？',
  initialPopularityQuestion: 'やっぱり有名作品！　隠れた名作！　中間くらいの作品！',
  initialPriorityQuestion: 'あなたが優先したいのは？順位をつけて！',
  questionFamous: DEFAULT_QUESTION_FAMOUS,
  questionFamousStory: DEFAULT_QUESTION_FAMOUS,
  questionFamousPlay: DEFAULT_QUESTION_FAMOUS,
  questionFamousCharacter: DEFAULT_QUESTION_FAMOUS,
  questionUnknown: 'この中に欲しい特徴はある？ 3つまで選んで！',
  importantPrompt: '特に重視する要素はある？あれば選んで！',
  sortPrompt: '今選んでいる要素を、好きな順に５つ並べて',
  sortPromptFront: '今選んでいる要素を、好きな順に５つ並べて',
  sortPromptBack: '今選んでいる要素を、好きな順に５つ並べて',
  thinkingText: 'あなたにぴったりの作品を探しているわ…',
  recommendResultsHeading: 'こんな作品なんてどう？',
  btnNext: '次へ',
  btnNextSortFront: '次へ',
  btnNextSortBack: '次へ',
  btnRetry: 'やり直し',
  btnOk: 'これでok',
  btnNotInList: 'この中にはない',
  btnFamousExpand: '選択肢を増やす',
  btnFamousCollapse: '選択肢を減らす',
  btnFix: '修正する',
  btnFixRecommend: 'ひとつ前に戻る',
  btnTopReset: 'トップに戻る',
  famousPickMinHint: '１個くらい気になるやつ選んでよ！',
};

const DEFAULT_SORT_PROMPT_LINE =
  DEFAULT_RECOMMEND_COPY.sortPrompt ?? '今選んでいる要素を、好きな順に５つ並べて';

/** 整理（前半 sort1）：sortPromptFront → sortPrompt → デフォルト */
export function getSortPromptFront(rc: RecommendCopy): string {
  const a = rc.sortPromptFront?.trim();
  if (a) return a;
  const b = rc.sortPrompt?.trim();
  if (b) return b;
  return DEFAULT_SORT_PROMPT_LINE;
}

/** 整理（後半 sort2）：sortPromptBack → sortPrompt → デフォルト */
export function getSortPromptBack(rc: RecommendCopy): string {
  const a = rc.sortPromptBack?.trim();
  if (a) return a;
  const b = rc.sortPrompt?.trim();
  if (b) return b;
  return DEFAULT_SORT_PROMPT_LINE;
}

/** 整理（前半）のメインボタン：btnNextSortFront → btnNext → 次へ */
export function getBtnNextSortFront(rc: RecommendCopy): string {
  const a = rc.btnNextSortFront?.trim();
  if (a) return a;
  return rc.btnNext?.trim() || '次へ';
}

/** 整理（後半）のメインボタン：btnNextSortBack → btnNext → 次へ */
export function getBtnNextSortBack(rc: RecommendCopy): string {
  const a = rc.btnNextSortBack?.trim();
  if (a) return a;
  return rc.btnNext?.trim() || '次へ';
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
  /**
   * 管理画面用の短い変更メモ（本番ゲームロジックでは参照しない）。
   * 閾値変更の理由・日付などを残す用途。
   */
  adminConfigNotes: z.string().max(4000).optional(),
  /** ゲーム文言。未設定時は DEFAULT_GAME_COPY */
  gameCopy: GameCopySchema.optional(),
  /** 推薦モードの文言。未設定時は DEFAULT_RECOMMEND_COPY */
  recommendCopy: RecommendCopySchema.optional(),
  /** 考え中7種。未設定または旧形式のときは migrateThinking で新形式に */
  thinking: z.union([ThinkingSchema, LegacyThinkingSchema]).optional(),
  confirm: ConfirmSchema,
  algo: AlgoSchema,
  flow: FlowSchema,
  dataQuality: DataQualitySchema,
  popularity: PopularitySchema,
  newTagQuestions: NewTagQuestionsSchema.optional(),
  noiseGuideRecommend: NoiseGuideRecommendSchema.optional(),
  failHub: FailHubSchema.optional(),
}).strict();

export type MvpConfig = z.infer<typeof MvpConfigSchema>;
