/**
 * ゲームエンジン（アルゴリズムとDBの橋渡し）
 */

import { prisma } from '@/server/db/client';
import type { WorkWeight, WorkProbability, AiGateChoice } from '@/server/algo/types';
import {
  calculateBasePrior,
  normalizeWeights,
  calculateConfidence,
  calculateEffectiveCandidates,
  calculateEffectiveConfirmThreshold,
} from '@/server/algo/scoring';
import {
  selectExploreTag,
  selectExploreTagByIG,
  filterTagsByPValueBandForIG,
  limitTagsByPValueNearHalf,
  shouldInsertConfirm,
  selectConfirmType,
  getNextHardConfirmType,
  type TagInfo,
} from '@/server/algo/questionSelection';
import { passesCoverageGate } from '@/server/algo/coverage';
import { hasDerivedFeature, updateWeightsForTagQuestion, updateWeightsForTagQuestionBayesian, updateWeightsForPopularitySoft, applyRevealPenalty } from '@/server/algo/weightUpdate';
import { normalizeTitleForInitial } from '@/server/utils/normalizeTitle';
import { getTitleReadingInitials } from '@/server/utils/titleReadingInitial';
import { selectSpecialQuestion, type SpecialQuestionType } from '@/server/algo/specialQuestionSelection';
import { getTitleCharType } from '@/server/utils/titleCharType';
import { getAuthorCharType } from '@/server/utils/authorCharType';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { getGroupDisplayNames } from '@/server/config/tagIncludeUnify';
import type { QuestionHistoryEntry, SessionState } from '@/server/session/manager';
import { getRevealThresholdForQuestion, getEffectiveMaxQuestions } from '@/server/config/flowUtils';
import { isTagBanned } from '@/server/admin/bannedTags';
import { SERIES_TAG_KEYS } from '@/server/algo/types';
import { getWorkTagMatrix, getWorkTagsFromMatrix } from '@/server/game/workTagMatrixLoader';
import {
  ensureTagCacheLoaded,
  isTagCacheReady,
  getTagByKey,
  getTagsByTagKeys,
  getTagsByDisplayNames,
  getTagKeysByDisplayName,
  getTagKeysByType,
  type CachedTag,
} from '@/server/game/tagCacheLoader';
import { perfStart, perfEnd } from '@/server/simulationPerf';
import fs from 'fs';
import path from 'path';

const CACHE_TTL = 5000; // 5秒キャッシュ

/** Worker Thread 等で prisma を介さずに Work データを参照するためのグローバルキャッシュ */
export interface SimWorkData {
  workId: string;
  title: string | null;
  authorName: string | null;
  popularityBase: number | null;
  popularityPlayBonus: number | null;
  titleReadingInitial: string | null;
}
let _simWorkDataMap: Map<string, SimWorkData> | null = null;
export function setSimWorkDataMap(map: Map<string, SimWorkData> | null) { _simWorkDataMap = map; }
export function getSimWorkDataMap() { return _simWorkDataMap; }

/** Phase 4: 汎用パターン（新タグ・BCタグ・未設定時） */
const DEFAULT_QUESTION_PATTERN = (displayName: string) => `${displayName}が関係している？`;

/** キャラタグ（Xタグ）用パターン */
const CHARACTER_QUESTION_PATTERN = (displayName: string) => `${displayName}というキャラクターが登場する？`;

/** まとめ質問キャッシュ（erotic=true は6問目以降のみ出題、disabled=true は候補に含めない） */
let summaryQuestionsCache: Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean; disabled?: boolean }> | null = null;
let summaryQuestionsCacheTime = 0;

function loadSummaryQuestions(): Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean; disabled?: boolean }> {
  const now = Date.now();
  if (summaryQuestionsCache && now - summaryQuestionsCacheTime < CACHE_TTL) {
    return summaryQuestionsCache;
  }
  try {
    const filePath = path.join(process.cwd(), 'config', 'summaryQuestions.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as { summaryQuestions?: Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean; disabled?: boolean }> };
    summaryQuestionsCache = data.summaryQuestions ?? [];
    summaryQuestionsCacheTime = now;
    return summaryQuestionsCache;
  } catch {
    return [];
  }
}

/** 使用不可タグの displayName 一覧（質問候補に含めない） */
let abstractDisplayNamesCache: Set<string> | null = null;
let abstractDisplayNamesCacheTime = 0;

function loadAbstractDisplayNames(): Set<string> {
  const now = Date.now();
  if (abstractDisplayNamesCache && now - abstractDisplayNamesCacheTime < CACHE_TTL) {
    return abstractDisplayNamesCache;
  }
  try {
    const filePath = path.join(process.cwd(), 'config', 'vagueTags.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as { displayNames?: string[] };
    abstractDisplayNamesCache = new Set(data.displayNames ?? []);
    abstractDisplayNamesCacheTime = now;
    return abstractDisplayNamesCache;
  } catch {
    return new Set();
  }
}

/** エロ質問タグの displayName 一覧 */
let eroticDisplayNamesCache: Set<string> | null = null;
let eroticDisplayNamesCacheTime = 0;

function loadEroticDisplayNames(): Set<string> {
  const now = Date.now();
  if (eroticDisplayNamesCache && now - eroticDisplayNamesCacheTime < CACHE_TTL) {
    return eroticDisplayNamesCache;
  }
  try {
    const filePath = path.join(process.cwd(), 'config', 'eroticTags.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as { displayNames?: string[] };
    eroticDisplayNamesCache = new Set(data.displayNames ?? []);
    eroticDisplayNamesCacheTime = now;
    return eroticDisplayNamesCache;
  } catch {
    return new Set();
  }
}

/**
 * タグの質問文を取得（DB唯一。未設定時はキャラ用 or 汎用）
 */
/** WorkTag を行列または DB から取得（行列があれば行列を優先） */
async function fetchWorkTags(
  workIds: string[],
  options?: { tagKeys?: string[] }
): Promise<Array<{ workId: string; tagKey: string; derivedConfidence: number | null }>> {
  if (workIds.length === 0) return [];
  const t = perfStart('fetchWorkTags');
  const matrix = getWorkTagMatrix();
  if (matrix) {
    const out = getWorkTagsFromMatrix(workIds, options);
    perfEnd('fetchWorkTags', t);
    return out;
  }
  const result = await prisma.workTag.findMany({
    where: {
      workId: { in: workIds },
      ...(options?.tagKeys?.length ? { tagKey: { in: options.tagKeys } } : {}),
    },
    select: { workId: true, tagKey: true, derivedConfidence: true },
  });
  perfEnd('fetchWorkTags', t);
  return result.map((r) => ({
    workId: r.workId,
    tagKey: r.tagKey,
    derivedConfidence: r.derivedConfidence ?? null,
  }));
}

function getTagQuestionText(
  displayName: string,
  tagType?: string,
  dbQuestionText?: string | null
): string {
  if (dbQuestionText && dbQuestionText.trim()) {
    return dbQuestionText.trim();
  }
  if (tagType === 'STRUCTURAL') {
    return CHARACTER_QUESTION_PATTERN(displayName);
  }
  return DEFAULT_QUESTION_PATTERN(displayName);
}

/**
 * AI_GATEフィルタ適用（Spec §2.1）
 */
export function filterWorksByAiGate(
  works: Array<{ workId: string; isAi: string }>,
  aiGateChoice: AiGateChoice
): string[] {
  if (aiGateChoice === 'YES') {
    return works.filter(w => w.isAi === 'AI').map(w => w.workId);
  }
  if (aiGateChoice === 'NO') {
    return works.filter(w => w.isAi === 'HAND').map(w => w.workId);
  }
  // DONT_CARE: 全て許可
  return works.map(w => w.workId);
}

/**
 * 初期重み計算（AI_GATE後）
 * allowedWorkIds のみ指定した場合は DB から取得（従来どおり）
 */
export async function initializeWeights(
  allowedWorkIds: string[],
  alpha: number
): Promise<WorkWeight[]> {
  const works = await prisma.work.findMany({
    where: {
      workId: { in: allowedWorkIds },
    },
  });
  return initializeWeightsFromWorks(
    works.map((w) => ({
      workId: w.workId,
      popularityBase: w.popularityBase,
      popularityPlayBonus: w.popularityPlayBonus,
    })),
    alpha
  );
}

/**
 * 既に取得した Work 情報から初期重みを計算（DB クエリなし）
 * /api/start で findMany 1 回に統合するために使用
 */
export function initializeWeightsFromWorks(
  works: Array<{
    workId: string;
    popularityBase: number | null;
    popularityPlayBonus: number | null;
  }>,
  alpha: number
): WorkWeight[] {
  const usePlayBonus = process.env.DISABLE_POPULARITY_PLAY_BONUS !== '1';
  return works.map((w) => ({
    workId: w.workId,
    weight: calculateBasePrior(
      w.popularityBase ?? 0,
      usePlayBonus ? (w.popularityPlayBonus ?? 0) : 0,
      alpha
    ),
  }));
}

/**
 * 質問生成（最小限の情報のみ返す）
 */
/** EXPLORE_TAG の出所（管理・シミュ用。質問文は変えずタグで判別する） */
export type ExploreTagKind = 'summary' | 'erotic' | 'abstract' | 'normal';

export interface QuestionData {
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM' | 'SPECIAL_QUESTION' | 'REVEAL' | 'NEW_TAG_QUESTION' | 'NOISE_GUIDE_RECOMMEND';
  displayText: string;
  tagKey?: string;
  /** NEW_TAG_QUESTION: newTagQuestions.variants[].id */
  newTagVariantId?: string;
  hardConfirmType?: 'TITLE_INITIAL' | 'AUTHOR' | 'CHARACTER';
  hardConfirmValue?: string;
  isSummaryQuestion?: boolean;
  summaryQuestionId?: string;
  summaryDisplayNames?: string[];
  /** まとめ/エロ/抽象/通常の判別用（EXPLORE_TAG のみ。表示には使わずタグ・バッジ用） */
  exploreTagKind?: ExploreTagKind;
  /** SPECIAL_QUESTION の種別 */
  specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' | 'TITLE_SYLLABLE_2' | 'AUTHOR_CHAR_TYPE' | 'TITLE_LENGTH_STYLE';
  /** SPECIAL_QUESTION SERIES の判定用タグキー */
  seriesTagKeys?: string[];
  /** SPECIAL_QUESTION TITLE_CHAR_TYPE の聞く文字種 */
  titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA';
  /** SPECIAL_QUESTION POPULARITY の閾値（popularityBase >= で「有名」） */
  popularityThreshold?: number;
  /** SPECIAL_QUESTION TITLE_SYLLABLE / TITLE_SYLLABLE_2 の対象文字 */
  syllableChars?: string[];
  /** SPECIAL_QUESTION TITLE_SYLLABLE の rangeId（編集用） */
  titleSyllableRangeId?: string;
  /** SPECIAL_QUESTION TITLE_SYLLABLE_2 の親rangeId・枝（編集用） */
  titleSyllable2RangeId?: string;
  titleSyllable2Branch?: 'yesBranch' | 'noBranch';
  /** SPECIAL_QUESTION AUTHOR_CHAR_TYPE の聞く文字種 */
  authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA';
  /** SPECIAL_QUESTION TITLE_LENGTH_STYLE: YES 判定の最小文字数 */
  titleLengthYesMin?: number;
  /** SPECIAL_QUESTION TITLE_LENGTH_STYLE: NO 側で「短め」に寄せる上限文字数 */
  titleLengthNoMax?: number;
  /** REVEAL 断定（履歴からの再構築用） */
  revealWorkId?: string;
  revealWorkTitle?: string;
  revealResult?: 'SUCCESS' | 'MISS' | string;
}

/** selectNextQuestion のオプション（REVEAL失敗直後など） */
export interface SelectNextQuestionOptions {
  /** 直前に REVEAL で不正解だった。次の1問は頭文字・作者を優先して正解に当てに行く */
  afterRevealWrong?: boolean;
  /** 断定で「いいえ」にした作品の workId 一覧。これらは候補から除外し、頭文字・REVEAL に使わない */
  revealRejectedWorkIds?: string[];
}

/** Q5・Q12 がともに UNKNOWN のとき、次の qIndex 13 でノイズ（設計書 v1.5） */
function shouldOfferNoiseGuideRecommend(
  questionHistory: QuestionHistoryEntry[],
  nextQIndex: number,
  config: MvpConfig
): boolean {
  if (config.noiseGuideRecommend?.enabled === false) return false;
  if (questionHistory.some(q => q.kind === 'NOISE_GUIDE_RECOMMEND')) return false;
  const q5 = questionHistory.find(
    h => h.qIndex === 5 && h.kind === 'SPECIAL_QUESTION' && h.specialQuestionType === 'TITLE_SYLLABLE'
  );
  const q12 = questionHistory.find(
    h =>
      h.qIndex === 12 &&
      h.kind === 'SPECIAL_QUESTION' &&
      (h.specialQuestionType === 'TITLE_CHAR_TYPE' || h.specialQuestionType === 'TITLE_LENGTH_STYLE')
  );
  if (!q5 || !q12) return false;
  if (q5.answer !== 'UNKNOWN' || q12.answer !== 'UNKNOWN') return false;
  return nextQIndex === 13;
}

type EarlyExitThreshold = {
  minConfidence: number;
  maxEffectiveCandidates: number;
  maxConfidenceDelta5: number;
};

function getEarlyExitThreshold(
  qIndex: number,
  config: MvpConfig
): { threshold: EarlyExitThreshold; requiredConditions: number } | null {
  const review = config.flow.earlyExitReview;
  if (!review || review.enabled === false) return null;
  if (!review.reviewIndices.includes(qIndex)) return null;
  const key = (`q${qIndex}` as 'q25' | 'q30' | 'q35' | 'q40');
  const threshold = review.thresholds[key];
  if (!threshold) return null;
  return { threshold, requiredConditions: review.requiredConditions ?? 2 };
}

function getConfidenceDelta5(questionHistory: QuestionHistoryEntry[]): number {
  const answered = questionHistory.filter(h => typeof h.answer === 'string');
  if (answered.length < 5) return Number.POSITIVE_INFINITY;
  const last5 = answered.slice(-5);
  // qIndex をキーに質問前後の確度を厳密保存していないため、ここでは回答傾向の荒い代理値として扱う。
  // 仕様上は「直近5問でほぼ動いていないか」を見る目的なので、answer の偏りから保守的に近似する。
  const strongCount = last5.filter(h => h.answer === 'YES' || h.answer === 'NO').length;
  const unknownCount = last5.filter(h => h.answer === 'UNKNOWN' || h.answer === 'DONT_CARE').length;
  if (unknownCount >= 3) return 0.0;
  if (strongCount >= 4) return 0.06;
  return 0.03;
}

function shouldEarlyExit(
  newQuestionCount: number,
  confidence: number,
  effectiveCandidates: number,
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig
): boolean {
  const review = getEarlyExitThreshold(newQuestionCount, config);
  if (!review) return false;
  const { threshold, requiredConditions } = review;
  const confidenceDelta5 = getConfidenceDelta5(questionHistory);
  let matched = 0;
  if (confidence < threshold.minConfidence) matched += 1;
  if (effectiveCandidates > threshold.maxEffectiveCandidates) matched += 1;
  if (confidenceDelta5 <= threshold.maxConfidenceDelta5) matched += 1;
  return matched >= requiredConditions;
}

function tryNewTagQuestion(
  qIndex: number,
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig
): QuestionData | null {
  const nt = config.newTagQuestions;
  if (!nt || nt.enabled === false || !nt.variants?.length || !nt.slotIndices?.length) return null;
  const slots = nt.slotIndices;
  const variants = nt.variants;
  for (let i = 0; i < variants.length && i < slots.length; i++) {
    const variant = variants[i]!;
    const slot = slots[i]!;
    if (questionHistory.some(h => h.kind === 'NEW_TAG_QUESTION' && h.tagKey === variant.tagKey)) {
      continue;
    }
    let wantIndex = slot;
    if (slot === 13 && questionHistory.some(h => h.qIndex === 13 && h.kind === 'NOISE_GUIDE_RECOMMEND')) {
      wantIndex = 14;
    }
    if (qIndex === wantIndex) {
      return {
        kind: 'NEW_TAG_QUESTION',
        displayText: variant.displayText,
        tagKey: variant.tagKey,
        newTagVariantId: variant.id,
      };
    }
  }
  return null;
}

/**
 * 次の質問を選択・生成
 */
export async function selectNextQuestion(
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  questionCount: number,
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig,
  options?: SelectNextQuestionOptions
): Promise<QuestionData | null> {
  const t = perfStart('selectNextQuestion');
  try {
  // 断定で「いいえ」にした作品を候補から除外（同じ作品の頭文字が後から出るのを防ぐ）
  if (options?.revealRejectedWorkIds?.length) {
    const rejectedSet = new Set(options.revealRejectedWorkIds);
    const filtered = weights.filter(w => !rejectedSet.has(w.workId));
    if (filtered.length === 0) return null;
    weights = filtered;
    probabilities = normalizeWeights(filtered);
  }

  await ensureTagCacheLoaded();
  const questionIndex = questionCount + 1; // 次の質問番号（1-based）
  const usedSummaryIds = new Set(
    questionHistory
      .filter((q): q is QuestionHistoryEntry & { summaryQuestionId: string } => !!q.summaryQuestionId)
      .map(q => q.summaryQuestionId!)
  );
  const tUsed = perfStart('buildUsedTagKeysFromHistory');
  const usedTagKeys = await buildUsedTagKeysFromHistory(questionHistory);
  perfEnd('buildUsedTagKeysFromHistory', tUsed);

  // 1問目: 非エロのまとめ質問のうち、現状の作品・タグで最適なトップ3からランダムで1つ選択
  if (questionCount === 0) {
    const summaries = loadSummaryQuestions();
    const unused = summaries.filter(s => !usedSummaryIds.has(s.id) && !s.erotic && !s.disabled);
    if (unused.length > 0) {
      const workIds = weights.map(w => w.workId);
      const workTagsAll = await fetchWorkTags(workIds);
      const workTagMap = new Map<string, Set<string>>();
      for (const wt of workTagsAll) {
        if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, new Set());
        workTagMap.get(wt.workId)!.add(wt.tagKey);
      }
      const probMap = new Map(probabilities.map(p => [p.workId, p.probability]));

      const scored: Array<{ summary: typeof unused[0]; distanceFromHalf: number }> = [];
      for (const summary of unused) {
        const tags = isTagCacheReady()
          ? getTagsByDisplayNames(summary.displayNames)
          : await prisma.tag.findMany({
              where: { displayName: { in: summary.displayNames } },
              select: { tagKey: true, displayName: true },
            });
        const validTag = tags.find(t => !isTagBanned(t.displayName));
        if (!validTag) continue;

        const tagKeys = tags.map(t => t.tagKey);
        let p = 0;
        for (const wid of workIds) {
          const workTags = workTagMap.get(wid);
          if (workTags && tagKeys.some(tk => workTags.has(tk))) {
            p += probMap.get(wid) ?? 0;
          }
        }
        scored.push({ summary, distanceFromHalf: Math.abs(p - 0.5) });
      }

      if (scored.length > 0) {
        scored.sort((a, b) => a.distanceFromHalf - b.distanceFromHalf);
        const top3 = scored.slice(0, 3);
        const chosen = top3[Math.floor(Math.random() * top3.length)]!.summary;
        const tags = isTagCacheReady()
          ? getTagsByDisplayNames(chosen.displayNames)
          : await prisma.tag.findMany({
              where: { displayName: { in: chosen.displayNames } },
              select: { tagKey: true, displayName: true },
            });
        const validTag = tags.find(t => !isTagBanned(t.displayName));
        if (validTag) {
          return {
            kind: 'EXPLORE_TAG',
            displayText: chosen.questionText,
            tagKey: validTag.tagKey,
            isSummaryQuestion: true,
            summaryQuestionId: chosen.id,
            summaryDisplayNames: chosen.displayNames,
            exploreTagKind: 'summary',
          };
        }
      }
      // まとめの displayNames に非禁止タグが無い、またはDBに無い → フォールバック
      console.warn(
        `[selectNextQuestion] Q1: まとめの displayNames に非禁止タグが0件でした。フォールバックします。`
      );
    } else {
      console.warn('[selectNextQuestion] Q1: 非エロの未使用まとめが0件です。');
    }
    // フォールバック: 通常タグから1問目を出題（抽象・エロは1問目では出さない）
    const q1Fallback = await selectExploreQuestion(weights, probabilities, questionHistory, config, buildExploreOptions(1), usedTagKeys);
    if (q1Fallback) {
      return q1Fallback;
    }
    console.warn('[selectNextQuestion] Q1: フォールバック後も候補が無く、null を返します。');
    return null;
  }

  const confidence = calculateConfidence(probabilities);
  const effectiveCandidates = calculateEffectiveCandidates(probabilities);
  const effectiveConfirmThreshold = calculateEffectiveConfirmThreshold(
    weights.length,
    config.flow.effectiveConfirmThresholdParams.min,
    config.flow.effectiveConfirmThresholdParams.max,
    config.flow.effectiveConfirmThresholdParams.divisor
  );

  const qIndex = questionIndex;

  // REVEAL 失敗直後: 次の1問は頭文字・作者を聞いて、正解候補に早く当てに行く（EXPLORE の NO 連続を防ぐ）
  if (options?.afterRevealWrong) {
    const hardAfterReveal = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
    if (hardAfterReveal) {
      return hardAfterReveal;
    }
  }

  if (shouldOfferNoiseGuideRecommend(questionHistory, qIndex, config)) {
    const ngr = config.noiseGuideRecommend;
    return {
      kind: 'NOISE_GUIDE_RECOMMEND',
      displayText: ngr?.questionText ?? 'もしかして…特定の作品やタイトルにこだわりがない？',
    };
  }

  const newTagQ = tryNewTagQuestion(qIndex, questionHistory, config);
  if (newTagQ) {
    return newTagQ;
  }

  // Special Question 枠（Q3, Q5, Q9, Q12）: Confirm より優先（特別質問で効率よく絞る）
  const baseSpecialSlots = config.flow.specialQuestionSlotIndices ?? [3, 5, 9, 12];
  const hasSpecialAnsweredUnknown = questionHistory.some(
    q => q.kind === 'SPECIAL_QUESTION' && q.answer === 'UNKNOWN'
  );
  let specialSlotIndices = hasSpecialAnsweredUnknown && !baseSpecialSlots.includes(11)
    ? [...baseSpecialSlots, 11]
    : [...baseSpecialSlots];

  // 救済特別質問（Q20, Q24）: 絞り込めていない場合のみ TITLE_SYLLABLE_2 / AUTHOR_CHAR_TYPE
  const rescue = config.flow.rescueSpecialCondition;
  if (rescue && rescue.slotIndices.includes(qIndex)) {
    const meetsRescue =
      effectiveCandidates > rescue.effectiveCandidatesMin || confidence < rescue.confidenceMax;
    if (meetsRescue) {
      specialSlotIndices = [...specialSlotIndices, qIndex];
    }
  }

  if (specialSlotIndices.includes(qIndex)) {
    const usedSpecialTypes = new Set<SpecialQuestionType>(
      questionHistory
        .filter((q): q is QuestionHistoryEntry & { specialQuestionType: SpecialQuestionType } =>
          q.kind === 'SPECIAL_QUESTION' && !!q.specialQuestionType
        )
        .map(q => q.specialQuestionType!)
    );
    const titleCharTypeAnsweredUnknown = questionHistory.some(
      q => q.kind === 'SPECIAL_QUESTION' && q.specialQuestionType === 'TITLE_CHAR_TYPE' && q.answer === 'UNKNOWN'
    );
    const workIds = weights.map(w => w.workId);
    const historyForRescue = questionHistory.map(q => ({
      kind: q.kind,
      specialQuestionType: q.specialQuestionType,
      syllableChars: q.syllableChars,
      answer: q.answer,
    }));
    const specialResult = await selectSpecialQuestion(
      probabilities,
      usedSpecialTypes,
      workIds,
      qIndex,
      titleCharTypeAnsweredUnknown,
      historyForRescue
    );
    if (specialResult) {
      return {
        kind: 'SPECIAL_QUESTION',
        displayText: specialResult.displayText,
        specialQuestionType: specialResult.specialQuestionType,
        seriesTagKeys: specialResult.seriesTagKeys,
        titleCharType: specialResult.titleCharType,
        popularityThreshold: specialResult.popularityThreshold,
        syllableChars: specialResult.syllableChars,
        authorCharType: specialResult.authorCharType,
        titleSyllableRangeId: specialResult.titleSyllableRangeId,
        titleSyllable2RangeId: specialResult.titleSyllable2RangeId,
        titleSyllable2Branch: specialResult.titleSyllable2Branch,
        titleLengthYesMin: specialResult.titleLengthYesMin,
        titleLengthNoMax: specialResult.titleLengthNoMax,
      };
    }
  }

  // Confirm挿入判定（特別質問スロットで候補が無かった場合、または非スロット時に適用）
  const shouldConfirm = shouldInsertConfirm(
    qIndex,
    confidence,
    effectiveCandidates,
    {
      qForcedIndices: config.confirm.qForcedIndices,
      confidenceConfirmBand: config.confirm.confidenceConfirmBand,
      effectiveConfirmThreshold,
    }
  );

  if (shouldConfirm) {
    const tConfirm = perfStart('selectNextQuestion_confirm');
    try {
    // SOFT_CONFIRM vs HARD_CONFIRM選択
    const usedHardTypes = questionHistory
      .filter(q => q.kind === 'HARD_CONFIRM')
      .map(q => q.hardConfirmType!)
      .filter((t): t is 'TITLE_INITIAL' | 'AUTHOR' => !!t);

    // top1を先に特定（SOFT_CONFIRMはtop1狙いなので、top1が持つタグだけ取得すれば十分）
    const probsForConfirm = normalizeWeights(weights);
    const sortedByProb = [...probsForConfirm].sort((a, b) => b.probability - a.probability);
    const top1WorkId = sortedByProb[0]?.workId ?? null;

    const workIds = weights.map(w => w.workId);
    const threshold = config.algo.derivedConfidenceThreshold;
    const matrix = getWorkTagMatrix();

    let derivedTags: Array<{ tagKey: string; displayName: string; questionText: string | null; workTags: Array<{ workId: string }> }>;

    // パフォーマンス最適化: top1が持つDERIVEDタグだけ取得（全DERIVED→99%捨て を回避）
    if (top1WorkId != null) {
      if (matrix) {
        const allDerivedTagKeys = getTagKeysByType('DERIVED', { notIn: usedTagKeys });
        const top1WorkTags = getWorkTagsFromMatrix([top1WorkId], { tagKeys: allDerivedTagKeys });
        const top1TagKeys = [...new Set(
          top1WorkTags
            .filter(wt => hasDerivedFeature(wt.derivedConfidence, threshold))
            .map(wt => wt.tagKey)
        )];
        if (top1TagKeys.length > 0) {
          const tagsFromDb = isTagCacheReady()
            ? getTagsByTagKeys(top1TagKeys)
            : await prisma.tag.findMany({
                where: { tagKey: { in: top1TagKeys } },
                select: { tagKey: true, displayName: true, questionText: true },
              });
          const workTagsRaw = getWorkTagsFromMatrix(workIds, { tagKeys: top1TagKeys });
          const workTagsFiltered = workTagsRaw.filter(wt => hasDerivedFeature(wt.derivedConfidence, threshold));
          const tagToWorkIds = new Map<string, Array<{ workId: string }>>();
          for (const wt of workTagsFiltered) {
            if (!tagToWorkIds.has(wt.tagKey)) tagToWorkIds.set(wt.tagKey, []);
            tagToWorkIds.get(wt.tagKey)!.push({ workId: wt.workId });
          }
          derivedTags = tagsFromDb.map(t => ({
            tagKey: t.tagKey,
            displayName: t.displayName,
            questionText: t.questionText,
            workTags: tagToWorkIds.get(t.tagKey) ?? [],
          }));
        } else {
          derivedTags = [];
        }
      } else {
        const top1WorkTags = await prisma.workTag.findMany({
          where: {
            workId: top1WorkId,
            derivedConfidence: { gte: threshold },
            tag: { tagType: 'DERIVED', tagKey: { notIn: Array.from(usedTagKeys) } },
          },
          include: { tag: { select: { tagKey: true, displayName: true, questionText: true } } },
        });
        const top1TagKeys = top1WorkTags.map(wt => wt.tag.tagKey);
        if (top1TagKeys.length > 0) {
          derivedTags = await prisma.tag.findMany({
            where: { tagKey: { in: top1TagKeys } },
            select: {
              tagKey: true,
              displayName: true,
              questionText: true,
              workTags: {
                where: {
                  workId: { in: workIds },
                  derivedConfidence: { gte: threshold },
                },
                select: { workId: true },
              },
            },
          });
        } else {
          derivedTags = [];
        }
      }
    } else {
      derivedTags = [];
    }

    // Prismaで0件の場合（行列なし時のみ）、直接SQLiteで取得（フォールバック）
    if (derivedTags.length === 0 && !matrix) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite3 = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const db = sqlite3(dbPath, { readonly: true });
        const workIds = weights.map(w => w.workId);
        const placeholders = workIds.map(() => '?').join(',');
        
        // DERIVEDタグを取得（使用済みタグを除外）
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const directTags = db.prepare(`
          SELECT 
            t.tagKey,
            t.displayName,
            t.questionText
          FROM Tag t
          WHERE t.tagType = 'DERIVED'
            AND t.tagKey NOT IN (${Array.from(usedTagKeys).map(() => '?').join(',')})
        `).all(...Array.from(usedTagKeys)) as Array<{
          tagKey: string;
          displayName: string;
          questionText: string | null;
        }>;
        
        // 各タグのworkTagsを取得
        derivedTags = directTags.map(tag => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const workTags = db.prepare(`
            SELECT workId
            FROM WorkTag
            WHERE tagKey = ?
              AND workId IN (${placeholders})
              AND derivedConfidence >= ?
          `).all(tag.tagKey, ...workIds, config.algo.derivedConfidenceThreshold) as Array<{
            workId: string;
          }>;
          
          return {
            tagKey: tag.tagKey,
            displayName: tag.displayName,
            questionText: tag.questionText ?? null,
            workTags,
          };
        });
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        db.close();
      } catch (directError) {
        console.error('[selectNextQuestion] Error in direct SQLite fallback:', directError);
        // フォールバックも失敗した場合は空配列のまま続行
      }
    }

    // 禁止タグは隔離（質問に使わない）
    derivedTags = derivedTags.filter(t => !isTagBanned(t.displayName));

    const hasSoftConfirmData = derivedTags.some(tag => tag.workTags.length > 0);

    const confirmType = selectConfirmType(confidence, hasSoftConfirmData, {
      softConfidenceMin: config.confirm.softConfidenceMin,
      hardConfidenceMin: config.confirm.hardConfidenceMin,
    });

    if (confirmType === 'SOFT_CONFIRM' && derivedTags.length > 0) {
      // SOFT_CONFIRM: top1を狙う（top1が持つDERIVEDタグのうち、p値バンド内で0.5に近いものを選択）
      // コンフィグの p バンド（explorePValueMin/Max、未設定時 0.05〜0.95）を使用
      const probMap = new Map(probsForConfirm.map(p => [p.workId, p.probability]));

      const pMin = config.algo.explorePValueMin ?? 0.05;
      const pMax = config.algo.explorePValueMax ?? 0.95;

      // 使用不可タグを除外（統合グループのいずれかが使用不可なら除外）
      const abstractForConfirm = loadAbstractDisplayNames();
      const derivedTagsFiltered = abstractForConfirm.size > 0
        ? derivedTags.filter(tag => !getGroupDisplayNames(tag.displayName).some(dn => abstractForConfirm.has(dn)))
        : derivedTags;

      // 各タグについてp値を計算
      const tagScores = derivedTagsFiltered
        .filter(tag => tag.workTags.length > 0)
        .map(tag => {
          const p = tag.workTags.reduce((sum, wt) => {
            return sum + (probMap.get(wt.workId) || 0);
          }, 0);
          return {
            tag,
            p,
            distanceFromHalf: Math.abs(p - 0.5),
            top1Has: top1WorkId != null && tag.workTags.some((wt: { workId: string }) => wt.workId === top1WorkId),
          };
        });

      // top1が持つタグのうち、p値バンド内のもの（top1狙い）
      const top1TagsInBand = tagScores.filter(t => t.top1Has && t.p >= pMin && t.p <= pMax);
      const usableTags = top1TagsInBand.length > 0
        ? top1TagsInBand
        : tagScores.filter(t => t.p >= pMin && t.p <= pMax); // フォールバック: top1のタグがバンド内に無ければ従来どおり全候補から

      if (usableTags.length > 0) {
        usableTags.sort((a, b) => {
          if (a.distanceFromHalf !== b.distanceFromHalf) {
            return a.distanceFromHalf - b.distanceFromHalf;
          }
          return a.tag.tagKey.localeCompare(b.tag.tagKey);
        });
        const selectedTag = usableTags[0];

        const displayText = getTagQuestionText(
          selectedTag.tag.displayName,
          'DERIVED',
          selectedTag.tag.questionText
        );
        return {
          kind: 'SOFT_CONFIRM',
          displayText,
          tagKey: selectedTag.tag.tagKey,
        };
      } else {
        const fallback = await selectUnifiedExploreOrSummary(qIndex, weights, probabilities, questionHistory, config, usedSummaryIds, usedTagKeys);
        if (fallback) return fallback;
        return await selectExploreQuestion(weights, probabilities, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
      }
    }
    
    // SOFT_CONFIRMのタグがない、またはHARD_CONFIRMの場合
    if (confirmType === 'HARD_CONFIRM' || derivedTags.length === 0) {
      // HARD_CONFIRM: 「当てに行く」スタイル
      // - top1の作品の頭文字/作者名を直接質問
      // - 2連続で発生しない（直前がHARD_CONFIRMならスキップ）
      // - 同じ値は使用済みなら除外
      
      // 直前がHARD_CONFIRMなら、EXPLORE_TAGにフォールバック（2連続防止）
      const lastQuestion = questionHistory[questionHistory.length - 1];
      if (lastQuestion?.kind === 'HARD_CONFIRM') {
        return await selectExploreQuestion(weights, probabilities, questionHistory, config, undefined, usedTagKeys);
      }

      // 使用済みの値を取得
      const usedTitleInitials = new Set(
        questionHistory
          .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'TITLE_INITIAL')
          .map(q => q.hardConfirmValue!)
          .filter(v => v)
      );
      const usedAuthors = new Set(
        questionHistory
          .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'AUTHOR')
          .map(q => q.hardConfirmValue!)
          .filter(v => v)
      );
      const usedCharacterTagKeys = new Set(
        questionHistory
          .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'CHARACTER')
          .map(q => q.hardConfirmValue!)
          .filter(v => v)
      );

      // 確度上位N件の作品から頭文字・作者・キャラクターを選ぶ（titleInitialTopN: 1のとき従来どおりtop1のみ）
      const probsForTop1 = normalizeWeights(weights);
      const sortedByProb = [...probsForTop1].sort((a, b) => b.probability - a.probability);
      const topN = config.flow.titleInitialTopN ?? 1;
      const topWorkIds = sortedByProb.slice(0, topN).map(p => p.workId).filter(Boolean);
      
      if (topWorkIds.length === 0) {
        return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, undefined, usedTagKeys);
      }
      
      const topWorks = _simWorkDataMap
        ? topWorkIds.map(id => _simWorkDataMap!.get(id)).filter((w): w is SimWorkData => w != null)
        : await prisma.work.findMany({
            where: { workId: { in: topWorkIds } },
            select: { workId: true, title: true, authorName: true },
          });
      const orderedWorks = topWorkIds
        .map(id => topWorks.find(w => w.workId === id))
        .filter((w): w is NonNullable<typeof w> => w != null);
      
      if (orderedWorks.length === 0) {
        return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, undefined, usedTagKeys);
      }
      
      // 20問目まで: タイトル頭文字を優先（早期成功は有名作品で作者・キャラを知らない想定）
      // 21問目以降: タイトル頭文字・作者・キャラクターの3種類をランダムに選択（キャラがなければ2種類）
      const useRandomSelection = qIndex >= 21;

      const titleInitialCandidates: { initial: string }[] = [];
      const authorCandidates: { author: string }[] = [];
      for (const w of orderedWorks) {
        const initial = normalizeTitleForInitial(w.title ?? '');
        if (!usedTitleInitials.has(initial)) titleInitialCandidates.push({ initial });
        const author = w.authorName ?? '(不明)';
        if (!usedAuthors.has(author)) authorCandidates.push({ author });
      }

      let characterCandidates: { tagKey: string; displayName: string }[] = [];
      if (useRandomSelection) {
        const characterTags = isTagCacheReady()
          ? getTagsByTagKeys(getTagKeysByType('STRUCTURAL'), { tagTypes: ['STRUCTURAL'] })
          : await prisma.tag.findMany({
              where: {
                tagType: 'STRUCTURAL',
                category: { in: ['CHARACTER', 'キャラクター'] },
              },
              select: { tagKey: true, displayName: true },
            });
        const characterTagKeys = new Set(characterTags.map(t => t.tagKey));
        const topWorkTags = await fetchWorkTags(topWorkIds, {
          tagKeys: characterTagKeys.size > 0 ? [...characterTagKeys] : undefined,
        });
        const charTagKeyToDisplay = new Map(characterTags.map(t => [t.tagKey, t.displayName ?? t.tagKey]));
        const usedCharKeys = new Set<string>();
        for (const wt of topWorkTags) {
          if (characterTagKeys.has(wt.tagKey) && !usedCharacterTagKeys.has(wt.tagKey) && !usedCharKeys.has(wt.tagKey)) {
            usedCharKeys.add(wt.tagKey);
            characterCandidates.push({
              tagKey: wt.tagKey,
              displayName: charTagKeyToDisplay.get(wt.tagKey) ?? wt.tagKey,
            });
          }
        }
      }

      if (useRandomSelection && (titleInitialCandidates.length > 0 || authorCandidates.length > 0 || characterCandidates.length > 0)) {
        const allCandidates: Array<{ type: 'TITLE_INITIAL' | 'AUTHOR' | 'CHARACTER'; data: unknown }> = [];
        for (const c of titleInitialCandidates) allCandidates.push({ type: 'TITLE_INITIAL', data: c });
        for (const c of authorCandidates) allCandidates.push({ type: 'AUTHOR', data: c });
        for (const c of characterCandidates) allCandidates.push({ type: 'CHARACTER', data: c });
        if (allCandidates.length > 0) {
          const chosen = allCandidates[Math.floor(Math.random() * allCandidates.length)];
          if (chosen.type === 'TITLE_INITIAL') {
            const { initial } = chosen.data as { initial: string };
            return {
              kind: 'HARD_CONFIRM',
              displayText: `タイトルが「${initial}」から始まる？`,
              hardConfirmType: 'TITLE_INITIAL',
              hardConfirmValue: initial,
            };
          }
          if (chosen.type === 'AUTHOR') {
            const { author } = chosen.data as { author: string };
            return {
              kind: 'HARD_CONFIRM',
              displayText: `……この作品の作者（サークル）、「${author}」かしら？`,
              hardConfirmType: 'AUTHOR',
              hardConfirmValue: author,
            };
          }
          if (chosen.type === 'CHARACTER') {
            const { tagKey, displayName } = chosen.data as { tagKey: string; displayName: string };
            return {
              kind: 'HARD_CONFIRM',
              displayText: CHARACTER_QUESTION_PATTERN(displayName),
              hardConfirmType: 'CHARACTER',
              hardConfirmValue: tagKey,
            };
          }
        }
      }

      // 20問目まで、またはランダムで候補が無い場合: 従来どおり頭文字→作者の順で返す
      for (const w of orderedWorks) {
        const initial = normalizeTitleForInitial(w.title ?? '');
        if (!usedTitleInitials.has(initial)) {
          return {
            kind: 'HARD_CONFIRM',
            displayText: `タイトルが「${initial}」から始まる？`,
            hardConfirmType: 'TITLE_INITIAL',
            hardConfirmValue: initial,
          };
        }
      }
      for (const w of orderedWorks) {
        const author = w.authorName ?? '(不明)';
        if (!usedAuthors.has(author)) {
          return {
            kind: 'HARD_CONFIRM',
            displayText: `……この作品の作者（サークル）、「${author}」かしら？`,
            hardConfirmType: 'AUTHOR',
            hardConfirmValue: author,
          };
        }
      }
      
      // 上位N件の頭文字・作者名・キャラもすべて使用済み → 統一選択にフォールバック
      const fallback = await selectUnifiedExploreOrSummary(qIndex, weights, probsForTop1, questionHistory, config, usedSummaryIds, usedTagKeys);
      if (fallback) return fallback;
      return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
    }
    } finally {
      perfEnd('selectNextQuestion_confirm', tConfirm);
    }
  }

  // Q2,3,4,5,7,8,9,11+: まとめと通常タグを同一ルールで選択（理想フロー）
  // 21問目以降: 一定確率で先に HARD_CONFIRM（キャラ・作者・タイトル）を試し、出題機会を確保
  const hardConfirmInjectionRatio = config.flow.hardConfirmInjectionRatio ?? 0.25;
  if (qIndex >= 21 && typeof hardConfirmInjectionRatio === 'number' && hardConfirmInjectionRatio > 0 && Math.random() < hardConfirmInjectionRatio) {
    const hardInjected = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
    if (hardInjected) return hardInjected;
  }
  const unified = await selectUnifiedExploreOrSummary(qIndex, weights, probabilities, questionHistory, config, usedSummaryIds, usedTagKeys);
  if (unified) return unified;

  // p値バンドでEXPLOREが選べなかった場合のフォールバック: HARD_CONFIRM で頭文字/作者を聞く
  const fallbackEnabled = config.algo.explorePValueFallbackEnabled !== false && getExplorePValueBand(config) != null;
  if (fallbackEnabled) {
    const hardFallback = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
    if (hardFallback) {
      return hardFallback;
    }
  }

  // フォールバック: 通常タグのみ（Q4以降）
  if (qIndex >= 4) {
    const exploreResult = await selectExploreQuestion(weights, probabilities, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
    if (exploreResult) return exploreResult;
    if (fallbackEnabled) {
      const hardFallback = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
      if (hardFallback) return hardFallback;
    }
  }

  // 最後の砦: 候補のどれかが持つタグから未使用のものを1本選ぶ（カバレッジ・p値無視）
  const emergency = await tryEmergencyExploreFallback(weights, questionHistory, usedTagKeys);
  if (emergency) return emergency;

  return null;
  } finally {
    perfEnd('selectNextQuestion', t);
  }
}

interface SelectExploreOptions {
  summaryOnlyTagKeys?: Set<string>;
  questionIndex?: number;
  abstractDisplayNames?: Set<string>;
  eroticDisplayNames?: Set<string>;
}

/** Q4以降のフォールバック用: 抽象/エロフィルタのみ（まとめ制限なし） */
function buildExploreOptions(questionIndex: number): SelectExploreOptions {
  return {
    questionIndex,
    abstractDisplayNames: loadAbstractDisplayNames(),
    eroticDisplayNames: loadEroticDisplayNames(),
  };
}

/** p値バンド用: config から EXPLORE の p 値範囲を取得。未設定なら undefined */
function getExplorePValueBand(config: MvpConfig): { pValueMin: number; pValueMax: number } | undefined {
  const min = config.algo.explorePValueMin;
  const max = config.algo.explorePValueMax;
  if (min != null && max != null) return { pValueMin: min, pValueMax: max };
  return undefined;
}

/**
 * HARD_CONFIRM を1つ生成（確度上位N件の頭文字 or 作者 or キャラクターから未使用のものを選ぶ）。使用済みなら null。
 * p値フォールバック時や Confirm 挿入時に利用。
 * 20問目まで: タイトル頭文字優先。21問目以降: 3種類をランダムに選択。
 */
async function tryGetHardConfirmQuestion(
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig,
  qIndex: number
): Promise<QuestionData | null> {
  const t = perfStart('tryGetHardConfirmQuestion');
  try {
  const usedTitleInitials = new Set(
    questionHistory
      .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'TITLE_INITIAL')
      .map(q => q.hardConfirmValue!)
      .filter(v => v)
  );
  const usedAuthors = new Set(
    questionHistory
      .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'AUTHOR')
      .map(q => q.hardConfirmValue!)
      .filter(v => v)
  );
  const usedCharacterTagKeys = new Set(
    questionHistory
      .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'CHARACTER')
      .map(q => q.hardConfirmValue!)
      .filter(v => v)
  );
  const sorted = [...probabilities].sort((a, b) => b.probability - a.probability);
  const topN = config.flow.titleInitialTopN ?? 1;
  // 21問目以降はキャラ・作者の候補を増やすため、確度上位を多めに参照
  const effectiveTopN = qIndex >= 20 ? Math.max(topN, 10) : topN;
  const topWorkIds = sorted.slice(0, effectiveTopN).map(p => p.workId).filter(Boolean);
  if (topWorkIds.length === 0) return null;
  const topWorks = _simWorkDataMap
    ? topWorkIds.map(id => _simWorkDataMap!.get(id)).filter((w): w is SimWorkData => w != null)
    : await prisma.work.findMany({
        where: { workId: { in: topWorkIds } },
        select: { workId: true, title: true, authorName: true },
      });
  const orderedWorks = topWorkIds
    .map(id => topWorks.find(w => w.workId === id))
    .filter((w): w is NonNullable<typeof w> => w != null);

  const useRandomSelection = qIndex >= 20; // qIndex=questionCount, 20=Q21
  const titleInitialCandidates: { initial: string }[] = [];
  const authorCandidates: { author: string }[] = [];
  for (const w of orderedWorks) {
    const initial = normalizeTitleForInitial(w.title ?? '');
    if (!usedTitleInitials.has(initial)) titleInitialCandidates.push({ initial });
    const author = w.authorName ?? '(不明)';
    if (!usedAuthors.has(author)) authorCandidates.push({ author });
  }

  let characterCandidates: { tagKey: string; displayName: string }[] = [];
  if (useRandomSelection) {
    const characterTags = isTagCacheReady()
      ? getTagsByTagKeys(getTagKeysByType('STRUCTURAL'), { tagTypes: ['STRUCTURAL'] })
      : await prisma.tag.findMany({
          where: {
            tagType: 'STRUCTURAL',
            category: { in: ['CHARACTER', 'キャラクター'] },
          },
          select: { tagKey: true, displayName: true },
        });
    const characterTagKeys = new Set(characterTags.map(t => t.tagKey));
    const topWorkTags = await fetchWorkTags(topWorkIds, {
      tagKeys: characterTagKeys.size > 0 ? [...characterTagKeys] : undefined,
    });
    const charTagKeyToDisplay = new Map(characterTags.map(t => [t.tagKey, t.displayName ?? t.tagKey]));
    const usedCharKeys = new Set<string>();
    for (const wt of topWorkTags) {
      if (characterTagKeys.has(wt.tagKey) && !usedCharacterTagKeys.has(wt.tagKey) && !usedCharKeys.has(wt.tagKey)) {
        usedCharKeys.add(wt.tagKey);
        characterCandidates.push({
          tagKey: wt.tagKey,
          displayName: charTagKeyToDisplay.get(wt.tagKey) ?? wt.tagKey,
        });
      }
    }
  }

  if (useRandomSelection && (titleInitialCandidates.length > 0 || authorCandidates.length > 0 || characterCandidates.length > 0)) {
    const allCandidates: Array<{ type: 'TITLE_INITIAL' | 'AUTHOR' | 'CHARACTER'; data: unknown }> = [];
    for (const c of titleInitialCandidates) allCandidates.push({ type: 'TITLE_INITIAL', data: c });
    for (const c of authorCandidates) allCandidates.push({ type: 'AUTHOR', data: c });
    for (const c of characterCandidates) allCandidates.push({ type: 'CHARACTER', data: c });
    if (allCandidates.length > 0) {
      const chosen = allCandidates[Math.floor(Math.random() * allCandidates.length)];
      if (chosen.type === 'TITLE_INITIAL') {
        const { initial } = chosen.data as { initial: string };
        return {
          kind: 'HARD_CONFIRM',
          displayText: `タイトルが「${initial}」から始まる？`,
          hardConfirmType: 'TITLE_INITIAL',
          hardConfirmValue: initial,
        };
      }
      if (chosen.type === 'AUTHOR') {
        const { author } = chosen.data as { author: string };
        return {
          kind: 'HARD_CONFIRM',
          displayText: `……この作品の作者（サークル）、「${author}」かしら？`,
          hardConfirmType: 'AUTHOR',
          hardConfirmValue: author,
        };
      }
      if (chosen.type === 'CHARACTER') {
        const { tagKey, displayName } = chosen.data as { tagKey: string; displayName: string };
        return {
          kind: 'HARD_CONFIRM',
          displayText: CHARACTER_QUESTION_PATTERN(displayName),
          hardConfirmType: 'CHARACTER',
          hardConfirmValue: tagKey,
        };
      }
    }
  }

  for (const w of orderedWorks) {
    const initial = normalizeTitleForInitial(w.title ?? '');
    if (!usedTitleInitials.has(initial)) {
      return {
        kind: 'HARD_CONFIRM',
        displayText: `タイトルが「${initial}」から始まる？`,
        hardConfirmType: 'TITLE_INITIAL',
        hardConfirmValue: initial,
      };
    }
  }
  for (const w of orderedWorks) {
    const author = w.authorName ?? '(不明)';
    if (!usedAuthors.has(author)) {
      return {
        kind: 'HARD_CONFIRM',
        displayText: `……この作品の作者（サークル）、「${author}」かしら？`,
        hardConfirmType: 'AUTHOR',
        hardConfirmValue: author,
      };
    }
  }
  return null;
  } finally {
    perfEnd('tryGetHardConfirmQuestion', t);
  }
}

/**
 * 緊急フォールバック: 候補のどれかが持つタグのうち未使用のものを1本選んで EXPLORE_TAG を返す。
 * カバレッジ・p値は無視。selectNextQuestion が null を返す直前の最後の砦。
 */
async function tryEmergencyExploreFallback(
  weights: WorkWeight[],
  questionHistory: QuestionHistoryEntry[],
  usedTagKeys: Set<string>
): Promise<QuestionData | null> {
  const t = perfStart('tryEmergencyExploreFallback');
  try {
  const workIds = weights.map(w => w.workId);
  if (workIds.length === 0) return null;

  const workTags = await fetchWorkTags(workIds);
  const tagKeysFromWorks = new Set(workTags.map(wt => wt.tagKey));
  let candidateTagKeys = Array.from(tagKeysFromWorks).filter(tk => !usedTagKeys.has(tk));
  if (candidateTagKeys.length === 0) return null;

  // 使用不可タグは除外（統合グループのいずれかが使用不可なら除外）
  const abstractSet = loadAbstractDisplayNames();
  if (abstractSet.size > 0) {
    const tagsForFilter = isTagCacheReady()
      ? candidateTagKeys.map(k => getTagByKey(k)).filter((t): t is NonNullable<typeof t> => t != null)
      : await prisma.tag.findMany({
          where: { tagKey: { in: candidateTagKeys } },
          select: { tagKey: true, displayName: true },
        });
    const excludedKeys = new Set(
      tagsForFilter.filter(t => getGroupDisplayNames(t.displayName).some(dn => abstractSet.has(dn))).map(t => t.tagKey)
    );
    candidateTagKeys = candidateTagKeys.filter(tk => !excludedKeys.has(tk));
  }
  if (candidateTagKeys.length === 0) return null;

  const tagKey = candidateTagKeys[0];
  const tag = isTagCacheReady()
    ? getTagByKey(tagKey)
    : await prisma.tag.findUnique({
        where: { tagKey },
        select: { displayName: true, tagType: true, questionText: true },
      });
  if (!tag) return null;

  const eroticDisplayNames = loadEroticDisplayNames();
  const displayText = getTagQuestionText(
    tag.displayName,
    tag.tagType ?? undefined,
    tag.questionText
  );
  const exploreTagKind: ExploreTagKind = eroticDisplayNames.has(tag.displayName)
    ? 'erotic'
    : abstractSet.has(tag.displayName)
      ? 'abstract'
      : 'normal';
  return {
    kind: 'EXPLORE_TAG',
    displayText,
    tagKey,
    exploreTagKind,
  };
  } finally {
    perfEnd('tryEmergencyExploreFallback', t);
  }
}

/**
 * 履歴から「使用済みタグ」を構築する（統合・包括を反映）
 * ①通常タグ: 出題した tagKey は回答が — でも使用済み。その displayName が属するグループの全 tagKey を使用済みにする
 * ②まとめ質問: 「いいえ」と答えた場合のみ、そのまとめの summaryDisplayNames に含まれる全 tagKey を使用済みにする
 */
async function buildUsedTagKeysFromHistory(
  questionHistory: QuestionHistoryEntry[]
): Promise<Set<string>> {
  const displayNamesToMark = new Set<string>();
  const nonSummaryTagKeys: string[] = [];

  for (const q of questionHistory) {
    if (q.summaryDisplayNames?.length && q.answer === 'NO') {
      for (const d of q.summaryDisplayNames) displayNamesToMark.add(d);
    } else if (q.tagKey) {
      // 一度出した質問は — でも使用済みにする（同じ質問の繰り返しを防ぐ）
      nonSummaryTagKeys.push(q.tagKey);
    }
  }

  if (nonSummaryTagKeys.length > 0) {
    const tags = isTagCacheReady()
      ? getTagsByTagKeys([...new Set(nonSummaryTagKeys)])
      : await prisma.tag.findMany({
          where: { tagKey: { in: [...new Set(nonSummaryTagKeys)] } },
          select: { displayName: true },
        });
    for (const tag of tags) {
      if (tag.displayName) {
        const group = getGroupDisplayNames(tag.displayName);
        for (const d of group) displayNamesToMark.add(d);
      }
    }
  }

  if (displayNamesToMark.size === 0) return new Set<string>();

  const tags = isTagCacheReady()
    ? getTagsByDisplayNames(Array.from(displayNamesToMark))
    : await prisma.tag.findMany({
        where: { displayName: { in: Array.from(displayNamesToMark) } },
        select: { tagKey: true },
      });
  return new Set(tags.map(t => t.tagKey));
}

/**
 * 理想フロー: まとめと通常タグを同一プールでルールに従って1つ選択
 * Q2-3: 非エロまとめのみ（最適選択） / Q4-5: 全まとめ（エロ解禁）のみ（最適選択） / Q6+: 全まとめ+全タグ（使用不可タグは除外、最適選択）
 */
async function selectUnifiedExploreOrSummary(
  questionIndex: number,
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig,
  usedSummaryIds: Set<string>,
  usedTagKeys: Set<string>
): Promise<QuestionData | null> {
  const t = perfStart('selectUnifiedExploreOrSummary');
  try {
  const workIds = weights.map(w => w.workId);
  const totalWorks = weights.length;
  const abstractDisplayNames = loadAbstractDisplayNames();
  const eroticDisplayNames = loadEroticDisplayNames();
  const summaries = loadSummaryQuestions();

  // 質問番号ごとのまとめ候補（disabled は除外）
  // Q2-3: 非エロまとめ / Q4-5: 全まとめ（エロ解禁） / Q6+: 全まとめ
  let summaryCandidates: Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean; disabled?: boolean }> = [];
  if (questionIndex >= 2 && questionIndex <= 3) {
    summaryCandidates = summaries.filter(s => !s.disabled && !usedSummaryIds.has(s.id) && !s.erotic);
  } else if (questionIndex >= 4 && questionIndex <= 5) {
    summaryCandidates = summaries.filter(s => !s.disabled && !usedSummaryIds.has(s.id)); // エロ解禁
  } else if (questionIndex >= 6) {
    summaryCandidates = summaries.filter(s => !s.disabled && !usedSummaryIds.has(s.id)); // Q6+ 全まとめ
  }

  // まとめの displayNames → tagKeys 解決
  const allSummaryDisplayNames = new Set<string>();
  for (const s of summaryCandidates) for (const d of s.displayNames) allSummaryDisplayNames.add(d);
  const summaryDisplayNameToTagKeys = new Map<string, string[]>();
  if (allSummaryDisplayNames.size > 0) {
    const tagsInSummaries = isTagCacheReady()
      ? getTagsByDisplayNames(Array.from(allSummaryDisplayNames))
      : await prisma.tag.findMany({
          where: { displayName: { in: Array.from(allSummaryDisplayNames) } },
          select: { tagKey: true, displayName: true },
        });
    for (const t of tagsInSummaries) {
      if (!summaryDisplayNameToTagKeys.has(t.displayName)) {
        summaryDisplayNameToTagKeys.set(t.displayName, []);
      }
      summaryDisplayNameToTagKeys.get(t.displayName)!.push(t.tagKey);
    }
  }

  const summaryTagKeysMap = new Map<string, string[]>();
  const allSummaryTagKeys = new Set<string>();
  for (const s of summaryCandidates) {
    const tagKeys: string[] = [];
    for (const dn of s.displayNames) {
      const keys = summaryDisplayNameToTagKeys.get(dn) ?? [];
      for (const k of keys) {
        tagKeys.push(k);
        allSummaryTagKeys.add(k);
      }
    }
    if (tagKeys.length > 0) summaryTagKeysMap.set(s.id, tagKeys);
  }

  // 通常タグ候補（カバレッジゲート＋質問番号フィルタ）
  const workTagsAll = await fetchWorkTags(workIds);
  const tagWorkCountMap = new Map<string, number>();
  for (const wt of workTagsAll) {
    tagWorkCountMap.set(wt.tagKey, (tagWorkCountMap.get(wt.tagKey) || 0) + 1);
  }
  let passingTagKeys: string[] = [];
  for (const [tagKey, workCount] of tagWorkCountMap.entries()) {
    if (SERIES_TAG_KEYS.includes(tagKey as (typeof SERIES_TAG_KEYS)[number])) continue;
    if (usedTagKeys.has(tagKey)) continue;
    if (!passesCoverageGate(workCount, totalWorks, config.dataQuality.minCoverageMode, config.dataQuality.minCoverageRatio, config.dataQuality.minCoverageWorks, config.dataQuality.maxCoverageRatio ?? null)) continue;
    passingTagKeys.push(tagKey);
  }
  // 使用不可タグは常に除外。エロはQ4未満で除外（Q2-5はまとめのみで通常タグは追加しないため、実質Q6+用）
  if (passingTagKeys.length > 0) {
    const tagsForFilter = isTagCacheReady()
      ? getTagsByTagKeys(passingTagKeys)
      : await prisma.tag.findMany({
          where: { tagKey: { in: passingTagKeys } },
          select: { tagKey: true, displayName: true },
        });
    passingTagKeys = passingTagKeys.filter(tagKey => {
      const tag = tagsForFilter.find(t => t.tagKey === tagKey);
      if (!tag) return true;
      // 使用不可: 質問候補に含めない（統合グループのいずれかが使用不可なら除外）
      const group = getGroupDisplayNames(tag.displayName);
      if (group.some(dn => abstractDisplayNames.has(dn))) return false;
      if (questionIndex < 4 && eroticDisplayNames.has(tag.displayName)) return false;
      return true;
    });
  }

  const allTagKeysForWork = new Set([...allSummaryTagKeys, ...passingTagKeys]);
  const workTagMap = new Map<string, Set<string>>();
  for (const wt of workTagsAll) {
    if (!allTagKeysForWork.has(wt.tagKey)) continue;
    if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, new Set());
    workTagMap.get(wt.workId)!.add(wt.tagKey);
  }

  const workHasTag = (workId: string, key: string): boolean => {
    if (key.startsWith('summary:')) {
      const id = key.slice(8);
      const sTagKeys = summaryTagKeysMap.get(id);
      if (!sTagKeys?.length) return false;
      const workSet = workTagMap.get(workId);
      if (!workSet) return false;
      return sTagKeys.some(tk => workSet.has(tk));
    }
    return workTagMap.get(workId)?.has(key) ?? false;
  };

  const availableTags: TagInfo[] = [];
  for (const s of summaryCandidates) {
    if (!summaryTagKeysMap.has(s.id)) continue;
    let workCount = 0;
    for (const wid of workIds) {
      if (workHasTag(wid, 'summary:' + s.id)) workCount++;
    }
    availableTags.push({
      tagKey: 'summary:' + s.id,
      displayName: s.label,
      tagType: 'OFFICIAL',
      workCount,
    });
  }

  // Q6以降のみ通常タグを候補に追加（Q2-5はまとめのみ）
  if (questionIndex >= 6 && passingTagKeys.length > 0) {
    const allTags = isTagCacheReady()
      ? getTagsByTagKeys(passingTagKeys)
      : await prisma.tag.findMany({
          where: { tagKey: { in: passingTagKeys } },
          select: { tagKey: true, displayName: true, tagType: true },
        });
    for (const tag of allTags) {
      const workCount = tagWorkCountMap.get(tag.tagKey) || 0;
      availableTags.push({
        tagKey: tag.tagKey,
        displayName: tag.displayName,
        tagType: (tag.tagType as 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL') || 'DERIVED',
        workCount,
      });
    }
  }

  if (availableTags.length === 0) return null;

  // まとめ質問を優先: summaryPreferRatio の確率でまとめのみに絞る
  let tagsForSelection = availableTags;
  const summaryPreferRatio = config.flow.summaryPreferRatio ?? 0;
  if (summaryPreferRatio > 0 && Math.random() < summaryPreferRatio) {
    const summaryOnly = availableTags.filter(t => t.tagKey.startsWith('summary:'));
    if (summaryOnly.length > 0) {
      tagsForSelection = summaryOnly;
    }
  }

  // 連続NOで当たりを1問挟む: 直近の回答がすべてNOなら p 高めのタグを選ぶ
  let consecutiveNoCount = 0;
  for (let i = questionHistory.length - 1; i >= 0; i--) {
    const ans = questionHistory[i].answer;
    if (ans === 'NO') consecutiveNoCount++;
    else break;
  }
  const consecutiveNoForAtari = config.flow.consecutiveNoForAtari ?? 3;
  const preferHighP = consecutiveNoCount >= consecutiveNoForAtari;
  const useIG = config.algo.useIGForExploreSelection !== false;

  const pValueBand = getExplorePValueBand(config);
  let selectedKey: string | null;

  // 案1: IG計算は常に上位N件のworksのみ使用（序盤の23秒遅延を解消）
  const topNForIG = 300;
  const probsForIG = (() => {
    const sorted = [...probabilities].sort((a, b) => b.probability - a.probability);
    const topN = sorted.slice(0, Math.min(topNForIG, sorted.length));
    const sum = topN.reduce((s, p) => s + p.probability, 0);
    return sum > 0 ? topN.map(p => ({ workId: p.workId, probability: p.probability / sum })) : probabilities;
  })();

  if (useIG && !preferHighP) {
    // 案3: p値で候補を事前絞り（同じpValueBandなら結果は同じ、IG計算が軽くなる）
    let tagsForIG = pValueBand
      ? filterTagsByPValueBandForIG(tagsForSelection, probsForIG, workHasTag, pValueBand)
      : tagsForSelection;
    // 案2: タグ候補が多すぎる場合、p値0.5に近い上位50件に絞る
    tagsForIG = limitTagsByPValueNearHalf(tagsForIG, probsForIG, workHasTag, 50);
    selectedKey = selectExploreTagByIG(tagsForIG, probsForIG, workHasTag, pValueBand);
  } else {
    selectedKey = selectExploreTag(
      tagsForSelection,
      probabilities,
      workHasTag,
      0,
      null,
      pValueBand,
      preferHighP
    );
  }
  if (!selectedKey && pValueBand) {
    if (useIG && !preferHighP) {
      // バンド外し時は全候補で再試行（案2でタグ数は制限）
      const tagsRetry = limitTagsByPValueNearHalf(tagsForSelection, probsForIG, workHasTag, 50);
      selectedKey = selectExploreTagByIG(tagsRetry, probsForIG, workHasTag, undefined);
    } else {
      selectedKey = selectExploreTag(
        tagsForSelection,
        probabilities,
        workHasTag,
        0,
        null,
        undefined,
        preferHighP
      );
    }
  }
  if (!selectedKey) return null;

  if (selectedKey.startsWith('summary:')) {
    const id = selectedKey.slice(8);
    const summary = summaryCandidates.find(s => s.id === id);
    if (!summary) return null;
    const tags = isTagCacheReady()
      ? getTagsByDisplayNames(summary.displayNames)
      : await prisma.tag.findMany({
          where: { displayName: { in: summary.displayNames } },
          select: { tagKey: true },
          take: 1,
        });
    const tagKey = tags[0]?.tagKey ?? null;
    if (!tagKey) return null;
    return {
      kind: 'EXPLORE_TAG',
      displayText: summary.questionText,
      tagKey,
      isSummaryQuestion: true,
      summaryQuestionId: summary.id,
      summaryDisplayNames: summary.displayNames,
      exploreTagKind: 'summary',
    };
  }

  const selectedTag = isTagCacheReady()
    ? getTagByKey(selectedKey)
    : await prisma.tag.findUnique({
        where: { tagKey: selectedKey },
        select: { displayName: true, tagType: true, questionText: true },
      });
  if (!selectedTag) return null;
  const displayText = getTagQuestionText(
    selectedTag.displayName,
    selectedTag.tagType ?? undefined,
    selectedTag.questionText
  );
  const exploreTagKind: ExploreTagKind = eroticDisplayNames.has(selectedTag.displayName)
    ? 'erotic'
    : abstractDisplayNames.has(selectedTag.displayName)
      ? 'abstract'
      : 'normal';
  return {
    kind: 'EXPLORE_TAG',
    displayText,
    tagKey: selectedKey,
    exploreTagKind,
  };
  } finally {
    perfEnd('selectUnifiedExploreOrSummary', t);
  }
}

/**
 * EXPLORE_TAG質問選択
 */
async function selectExploreQuestion(
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig,
  options?: SelectExploreOptions | null,
  usedTagKeys?: Set<string>
): Promise<QuestionData | null> {
  const t = perfStart('selectExploreQuestion');
  try {
  const opts = options ?? buildExploreOptions(questionHistory.length + 1);
  const { summaryOnlyTagKeys, questionIndex = opts.questionIndex ?? 0, abstractDisplayNames = new Set(), eroticDisplayNames = new Set() } = opts;
  const abstractSet = abstractDisplayNames.size > 0 ? abstractDisplayNames : loadAbstractDisplayNames();
  const eroticSet = eroticDisplayNames.size > 0 ? eroticDisplayNames : loadEroticDisplayNames();

  const resolvedUsedTagKeys = usedTagKeys ?? await buildUsedTagKeysFromHistory(questionHistory);

  // パフォーマンス最適化: WorkTagsを先に取得して、カバレッジゲートを通過するタグのみを取得
  const workIds = weights.map(w => w.workId);
  const totalWorks = weights.length;

  // まず、WorkTagsを取得してタグごとの作品数を集計
  const workTags = await fetchWorkTags(workIds);

  // タグごとの作品数を集計
  const tagWorkCountMap = new Map<string, number>();
  for (const wt of workTags) {
    tagWorkCountMap.set(wt.tagKey, (tagWorkCountMap.get(wt.tagKey) || 0) + 1);
  }

  // カバレッジゲートを通過するタグのみをフィルタ
  // 下限: タグを持つ作品が少なすぎるタグを除外
  // 上限: 全員が持っているタグを除外（確度が変わらないため）
  let passingTagKeys: string[] = [];
  for (const [tagKey, workCount] of tagWorkCountMap.entries()) {
    if (SERIES_TAG_KEYS.includes(tagKey as (typeof SERIES_TAG_KEYS)[number])) continue;
    if (!resolvedUsedTagKeys.has(tagKey) && passesCoverageGate(
      workCount,
      totalWorks,
      config.dataQuality.minCoverageMode,
      config.dataQuality.minCoverageRatio,
      config.dataQuality.minCoverageWorks,
      config.dataQuality.maxCoverageRatio ?? null // 上限（未設定の場合はチェックなし）
    )) {
      passingTagKeys.push(tagKey);
    }
  }

  // 2・3問目: まとめ質問に含まれるタグのみに制限
  if (summaryOnlyTagKeys && summaryOnlyTagKeys.size > 0) {
    passingTagKeys = passingTagKeys.filter(k => summaryOnlyTagKeys!.has(k));
  }

  if (passingTagKeys.length === 0) return null;

  // カバレッジゲートを通過したタグのみを取得（キャッシュ優先）
  const allTagsRaw = isTagCacheReady()
    ? getTagsByTagKeys(passingTagKeys, { tagTypes: ['OFFICIAL', 'DERIVED'] })
    : await prisma.tag.findMany({
        where: {
          tagKey: { in: passingTagKeys },
          tagType: { in: ['OFFICIAL', 'DERIVED'] },
        },
        select: {
          tagKey: true,
          displayName: true,
          tagType: true,
          questionText: true,
        },
      });
  let allTags = allTagsRaw.map((t) => ({
    tagKey: t.tagKey,
    displayName: t.displayName,
    tagType: (t.tagType ?? 'DERIVED') as string,
    questionText: t.questionText,
  }));

  // Prismaで0件の場合、直接SQLiteで取得（フォールバック・キャッシュ未使用時のみ）
  if (allTags.length === 0 && passingTagKeys.length > 0 && !isTagCacheReady()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite3 = require('better-sqlite3');
      const path = require('path');
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const db = sqlite3(dbPath, { readonly: true });
      const placeholders = passingTagKeys.map(() => '?').join(',');
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      allTags = db.prepare(`
        SELECT tagKey, displayName, tagType, questionText
        FROM Tag
        WHERE tagKey IN (${placeholders})
          AND tagType IN ('OFFICIAL', 'DERIVED')
      `).all(...passingTagKeys) as Array<{
        tagKey: string;
        displayName: string;
        tagType: string;
        questionText: string | null;
      }>;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      db.close();
    } catch (directError) {
      console.error('[selectExploreQuestion] Error in direct SQLite fallback:', directError);
      // フォールバックも失敗した場合は空配列のまま続行
    }
  }

  const availableTags: TagInfo[] = [];
  for (const tag of allTags) {
    // 使用済みタグを再度チェック（安全策）
    if (resolvedUsedTagKeys.has(tag.tagKey)) continue;
    // 禁止タグは隔離（質問に使わない）
    if (isTagBanned(tag.displayName)) continue;
    // 使用不可: 質問候補に含めない（統合グループのいずれかが使用不可なら除外）
    if (getGroupDisplayNames(tag.displayName).some(dn => abstractSet.has(dn))) continue;
    // エロ質問: Q4以降のみ候補
    if (questionIndex < 4 && eroticSet.has(tag.displayName)) {
      continue;
    }
    const workCount = tagWorkCountMap.get(tag.tagKey) || 0;
    availableTags.push({
      tagKey: tag.tagKey,
      displayName: tag.displayName,
      tagType: tag.tagType as 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL',
      workCount,
    });
  }

  if (availableTags.length === 0) return null;

  // workHasTag関数（既に取得済みのworkTagsを使用）
  const passingTagKeysSet = new Set(passingTagKeys);
  const workTagMap = new Map<string, Set<string>>();
  for (const wt of workTags) {
    if (passingTagKeysSet.has(wt.tagKey)) {
      if (!workTagMap.has(wt.workId)) {
        workTagMap.set(wt.workId, new Set());
      }
      workTagMap.get(wt.workId)!.add(wt.tagKey);
    }
  }

  const workHasTag = (workId: string, tagKey: string): boolean => {
    const tags = workTagMap.get(workId);
    if (!tags) return false;
    return tags.has(tagKey);
  };

  // 確度とtop1を計算（後半モード用）
  const sorted = [...probabilities].sort((a, b) => {
    if (a.probability !== b.probability) {
      return b.probability - a.probability;
    }
    return a.workId.localeCompare(b.workId);
  });
  const confidence = sorted[0]?.probability ?? 0;
  const topWorkId = sorted[0]?.workId ?? null;

  const pValueBand = getExplorePValueBand(config);
  const useIG = config.algo.useIGForExploreSelection !== false;
  // 案1: IG計算は常に上位N件のworksのみ使用
  const topNForIG = 300;
  const probsForIG = (() => {
    const sorted = [...probabilities].sort((a, b) => b.probability - a.probability);
    const topN = sorted.slice(0, Math.min(topNForIG, sorted.length));
    const sum = topN.reduce((s, p) => s + p.probability, 0);
    return sum > 0 ? topN.map(p => ({ workId: p.workId, probability: p.probability / sum })) : probabilities;
  })();
  // 案3: useIG時はp値で候補を事前絞り（IG計算軽量化）
  let tagsForIG = useIG && pValueBand
    ? filterTagsByPValueBandForIG(availableTags, probsForIG, workHasTag, pValueBand)
    : availableTags;
  // 案2: タグ候補が多すぎる場合、p値0.5に近い上位50件に絞る
  tagsForIG = useIG ? limitTagsByPValueNearHalf(tagsForIG, probsForIG, workHasTag, 50) : tagsForIG;
  const selectedTagKey = useIG
    ? selectExploreTagByIG(tagsForIG, probsForIG, workHasTag, pValueBand)
    : selectExploreTag(
        availableTags,
        probabilities,
        workHasTag,
        confidence,
        topWorkId,
        pValueBand
      );
  if (!selectedTagKey) {
    return null;
  }

  const selectedTag = allTags.find(t => t.tagKey === selectedTagKey);
  if (!selectedTag) {
    return null;
  }

  const displayText = getTagQuestionText(
    selectedTag.displayName,
    selectedTag.tagType,
    selectedTag.questionText
  );
  const exploreTagKind: ExploreTagKind = eroticSet.has(selectedTag.displayName)
    ? 'erotic'
    : abstractSet.has(selectedTag.displayName)
      ? 'abstract'
      : 'normal';

  return {
    kind: 'EXPLORE_TAG',
    displayText,
    tagKey: selectedTagKey,
    exploreTagKind,
  };
  } finally {
    perfEnd('selectExploreQuestion', t);
  }
}

/** HARD_CONFIRM 用の Work 情報（事前取得して渡すと DB クエリを省略） */
export interface WorkInfoForConfirm {
  title: string | null;
  authorName: string | null;
}

export interface ProcessAnswerOptions {
  /** workId → title/authorName のマップ。HARD_CONFIRM 時に prisma の代わりに使用 */
  workInfoMap?: Map<string, WorkInfoForConfirm>;
  /** workId → tagKeys のマップ。HARD_CONFIRM CHARACTER 時に WorkTag の代わりに使用 */
  workTagMap?: Map<string, Set<string>>;
}

/**
 * 回答による重み更新
 */
/** P4: フェーズ別イプシロン。EC に応じて epsilon を返す */
function getBayesianEpsilon(effectiveCandidates: number, config: MvpConfig): number {
  const phases = config.algo.bayesianEpsilonPhases;
  if (phases) {
    if (effectiveCandidates > 200) return phases.early;
    if (effectiveCandidates > 20) return phases.mid;
    return phases.late;
  }
  return config.algo.bayesianEpsilon ?? 0.02;
}

export async function processAnswer(
  weights: WorkWeight[],
  question: QuestionData,
  answerChoice: string,
  config: MvpConfig,
  options?: ProcessAnswerOptions
): Promise<WorkWeight[]> {
  const t = perfStart('processAnswer');
  try {
  await ensureTagCacheLoaded();
  const probabilities = normalizeWeights(weights);
  const effectiveCandidates = calculateEffectiveCandidates(probabilities);
  const epsilon = getBayesianEpsilon(effectiveCandidates, config);

  const strengthMap: Record<string, number> = {
    YES: 1.0,
    PROBABLY_YES: 0.6,
    UNKNOWN: 0,
    PROBABLY_NO: -0.6,
    NO: -1.0,
    DONT_CARE: 0,
  };

  let strength = strengthMap[answerChoice] ?? 0;
  const isSummaryQuestion = !!(question as QuestionData & { isSummaryQuestion?: boolean }).isSummaryQuestion;
  if (isSummaryQuestion) {
    const scale = config.algo.summaryQuestionStrengthScale ?? 0.6;
    strength = (strength > 0 ? 1 : strength < 0 ? -1 : 0) * scale;
  } else if (question.kind === 'EXPLORE_TAG' || question.kind === 'NEW_TAG_QUESTION') {
    strength *= config.algo.exploreTagStrengthScale ?? 1.0;
  } else if (question.kind === 'SOFT_CONFIRM') {
    strength *= config.algo.softConfirmStrengthScale ?? 1.0;
  }

  if (question.kind === 'NOISE_GUIDE_RECOMMEND') {
    return weights.map(w => ({ workId: w.workId, weight: w.weight }));
  }

  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'SERIES') {
    // Type 3: シリーズもの/総集編（タグベース、ベイズ更新を流用）
    const seriesTagKeys = question.seriesTagKeys ?? ['off_e1f6b6c9ce', 'off_ad42c1ba79'];
    const workIds = weights.map(w => w.workId);
    const workTags = await fetchWorkTags(workIds, { tagKeys: seriesTagKeys });
    const workTagMap = new Map<string, Set<string>>();
    for (const wt of workTags) {
      if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, new Set());
      workTagMap.get(wt.workId)!.add(wt.tagKey);
    }
    const workHasFeature = (workId: string): boolean => {
      const tags = workTagMap.get(workId);
      return !!tags && seriesTagKeys.some(tk => tags.has(tk));
    };
    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }

  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_CHAR_TYPE') {
    // Type 5: タイトル文字種（漢字/カタカナ/ひらがな）
    const expectedCharType = question.titleCharType!;
    const workIds = weights.map(w => w.workId);
    let workMap: Map<string, WorkInfoForConfirm>;

    if (options?.workInfoMap) {
      workMap = options.workInfoMap;
    } else {
      const works = await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, title: true, authorName: true },
      });
      workMap = new Map(works.map(w => [w.workId, w]));
    }

    const workHasFeature = (workId: string): boolean => {
      const work = workMap.get(workId);
      if (!work) return false;
      const charType = getTitleCharType(work.title ?? '');
      if (expectedCharType === 'HIRAGANA_OR_KATAKANA') {
        return charType === 'HIRAGANA' || charType === 'KATAKANA';
      }
      return charType === expectedCharType;
    };

    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }

  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'POPULARITY') {
    const threshold = question.popularityThreshold ?? 40;
    const workIds = weights.map(w => w.workId);
    const works = _simWorkDataMap
      ? workIds.map(id => _simWorkDataMap!.get(id)).filter((w): w is SimWorkData => w != null)
      : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, popularityBase: true, popularityPlayBonus: true },
        });
    const worksMap = new Map(works.map(w => [w.workId, w]));
    const workPopularity = (workId: string): number => {
      const w = worksMap.get(workId);
      if (!w) return 0;
      return (w.popularityBase ?? 0) + (w.popularityPlayBonus ?? 0);
    };
    return updateWeightsForPopularitySoft(weights, workPopularity, threshold, answerChoice, 0.15, epsilon);
  }

  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_SYLLABLE') {
    const syllableChars = question.syllableChars ?? [];
    const charSet = new Set(syllableChars);
    const workIds = weights.map(w => w.workId);
    const works = _simWorkDataMap
      ? workIds.map(id => _simWorkDataMap!.get(id)).filter((w): w is SimWorkData => w != null)
      : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, titleReadingInitial: true },
        });
    const worksMap = new Map(works.map(w => [w.workId, w]));
    const workHasFeature = (workId: string): boolean => {
      const w = worksMap.get(workId);
      const initials = getTitleReadingInitials(w?.titleReadingInitial);
      if (initials.length === 0) return false;
      return initials.some((c) => charSet.has(c));
    };
    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }

  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_SYLLABLE_2') {
    const syllableChars = question.syllableChars ?? [];
    const charSet = new Set(syllableChars);
    const workIds = weights.map(w => w.workId);
    const works = _simWorkDataMap
      ? workIds.map(id => _simWorkDataMap!.get(id)).filter((w): w is SimWorkData => w != null)
      : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, titleReadingInitial: true },
        });
    const worksMap = new Map(works.map(w => [w.workId, w]));
    const workHasFeature = (workId: string): boolean => {
      const w = worksMap.get(workId);
      const initials = getTitleReadingInitials(w?.titleReadingInitial);
      if (initials.length === 0) return false;
      return initials.some((c) => charSet.has(c));
    };
    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }

  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'AUTHOR_CHAR_TYPE') {
    // 救済: 作者名の文字種（ひらがなorカタカナ vs 漢字orアルファベット）
    const expectedCharType = question.authorCharType!;
    const workIds = weights.map(w => w.workId);
    let workMap: Map<string, WorkInfoForConfirm>;

    if (options?.workInfoMap) {
      workMap = options.workInfoMap;
    } else {
      const works = await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, title: true, authorName: true },
      });
      workMap = new Map(works.map(w => [w.workId, w]));
    }

    const workHasFeature = (workId: string): boolean => {
      const work = workMap.get(workId);
      if (!work) return false;
      const ct = getAuthorCharType(work.authorName ?? '');
      if (expectedCharType === 'HIRAGANA_OR_KATAKANA') {
        return ct === 'HIRAGANA' || ct === 'KATAKANA';
      }
      return ct === 'KANJI' || ct === 'ALPHA';
    };

    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }

  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_LENGTH_STYLE') {
    const yesMin = question.titleLengthYesMin ?? 10;
    const noMax = question.titleLengthNoMax ?? 20;
    const workIds = weights.map(w => w.workId);
    let workMap: Map<string, WorkInfoForConfirm>;
    if (options?.workInfoMap) {
      workMap = options.workInfoMap;
    } else {
      const works = await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, title: true, authorName: true },
      });
      workMap = new Map(works.map(w => [w.workId, w]));
    }
    const workHasFeature = (workId: string): boolean => {
      const len = (workMap.get(workId)?.title ?? '').length;
      if (answerChoice === 'UNKNOWN') {
        return len >= yesMin;
      }
      if (answerChoice === 'NO' || answerChoice === 'PROBABLY_NO') {
        return len > noMax;
      }
      return len >= yesMin;
    };
    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }

  if (question.kind === 'EXPLORE_TAG' || question.kind === 'NEW_TAG_QUESTION' || question.kind === 'SOFT_CONFIRM') {
    // Tag-based質問（包括・統合: 同一グループのタグをまとめて判定）
    const tagKey = question.tagKey!;
    const workIds = weights.map(w => w.workId);

    // まとめ質問のときは summaryDisplayNames をグループとして使用
    const summaryDisplayNames = (question as QuestionData & { summaryDisplayNames?: string[] }).summaryDisplayNames;
    let groupDisplayNames: string[];
    if (summaryDisplayNames?.length) {
      groupDisplayNames = summaryDisplayNames;
    } else {
      const askedTag = isTagCacheReady()
        ? getTagByKey(tagKey)
        : await prisma.tag.findUnique({
            where: { tagKey },
            select: { displayName: true },
          });
      const displayName = askedTag?.displayName ?? tagKey;
      groupDisplayNames = getGroupDisplayNames(displayName);
    }

    const groupTags = isTagCacheReady()
      ? getTagsByDisplayNames(groupDisplayNames)
      : await prisma.tag.findMany({
          where: { displayName: { in: groupDisplayNames } },
          select: { tagKey: true },
        });
    const groupTagKeys = groupTags.map(t => t.tagKey);

    const workTags = await fetchWorkTags(workIds, {
      tagKeys: groupTagKeys.length > 0 ? groupTagKeys : [tagKey],
    });

    const workTagMap = new Map<string, Array<number | null>>();
    for (const wt of workTags) {
      if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, []);
      workTagMap.get(wt.workId)!.push(wt.derivedConfidence);
    }

    const workHasFeature = (workId: string): boolean => {
      const confs = workTagMap.get(workId);
      if (!confs || confs.length === 0) return false;
      const anyPass = confs.some(derivedConf => {
        if (question.kind === 'SOFT_CONFIRM') {
          return hasDerivedFeature(derivedConf, config.algo.derivedConfidenceThreshold);
        }
        if (derivedConf === undefined) return false;
        if (derivedConf === null) return true;
        return hasDerivedFeature(derivedConf, config.algo.derivedConfidenceThreshold);
      });
      return anyPass;
    };

    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength,
      config.algo.beta
    );
  } else {
    // HARD_CONFIRM
    // 質問のhardConfirmValueから判定（top1は質問生成時に確定済み）
    const expectedValue = question.hardConfirmValue!;
    const hardConfirmType = question.hardConfirmType!;

    const workIds = weights.map(w => w.workId);
    let workMap: Map<string, WorkInfoForConfirm>;

    if (options?.workInfoMap) {
      // 事前取得済みの workInfoMap を使用（DB クエリ省略）
      workMap = options.workInfoMap;
    } else {
      // フォールバック: DB から取得
      const works = await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, title: true, authorName: true },
      });
      workMap = new Map(works.map(w => [w.workId, w]));
    }

    let workHasFeature: (workId: string) => boolean;
    if (hardConfirmType === 'TITLE_INITIAL') {
      workHasFeature = (workId: string) => {
        const work = workMap.get(workId);
        if (!work) return false;
        const initial = normalizeTitleForInitial(work.title ?? '');
        return initial === expectedValue;
      };
    } else if (hardConfirmType === 'AUTHOR') {
      workHasFeature = (workId: string) => {
        const work = workMap.get(workId);
        if (!work) return false;
        return (work.authorName ?? '') === expectedValue;
      };
    } else {
      // CHARACTER: hardConfirmValue = tagKey
      let tagKeyMap: Map<string, Set<string>>;
      if (options?.workTagMap) {
        tagKeyMap = options.workTagMap;
      } else {
        const workTags = await fetchWorkTags(workIds, { tagKeys: [expectedValue] });
        tagKeyMap = new Map();
        for (const wt of workTags) {
          if (!tagKeyMap.has(wt.workId)) tagKeyMap.set(wt.workId, new Set());
          tagKeyMap.get(wt.workId)!.add(wt.tagKey);
        }
      }
      workHasFeature = (workId: string) => {
        const tags = tagKeyMap.get(workId);
        return !!tags?.has(expectedValue);
      };
    }

    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }
  } finally {
    perfEnd('processAnswer', t);
  }
}

/** 回答後の応答種別 */
export type AnswerResponseState = 'REVEAL' | 'FAIL_LIST' | 'QUIZ' | 'RECOMMEND' | 'TOP';

/** 回答処理の結果（API が I/O とレスポンス構築に使用） */
export interface AnswerResponseResult {
  state: AnswerResponseState;
  /** REVEAL の場合: 表示する作品の workId */
  revealWorkId?: string;
  /** REVEAL の場合: 強制 REVEAL かどうか */
  forcedReveal?: boolean;
  /** QUIZ の場合: 次の質問 */
  nextQuestion?: QuestionData;
  /** セッション更新内容（全パターン共通）。weightsHistory は渡さず、呼び出し側で saveWeightsSnapshot を 1 行 INSERT。 */
  sessionUpdates: {
    weights: Record<string, number>;
    questionCount: number;
    questionHistory: QuestionHistoryEntry[];
  };
  /** QUIZ の場合の confidence（sessionState 用） */
  confidence?: number;
}

/** 確度順で未出の top1 workId を取得 */
function getTopWorkIdFromProbabilities(
  probabilities: WorkProbability[],
  revealRejectedWorkIds: string[]
): string | null {
  const rejectedSet = new Set(revealRejectedWorkIds ?? []);
  const sorted = [...probabilities].sort((a, b) => {
    if (a.probability !== b.probability) return b.probability - a.probability;
    return a.workId.localeCompare(b.workId);
  });
  return sorted.find(p => !rejectedSet.has(p.workId))?.workId ?? sorted[0]?.workId ?? null;
}

/**
 * 回答後の応答を決定（REVEAL / FAIL_LIST / QUIZ）
 * API の判定ロジックを集約。I/O（DB・SessionManager）は呼び出し側が担当。
 */
export async function handleAnswerResponse(
  session: SessionState,
  currentQuestion: QuestionHistoryEntry,
  updatedWeights: WorkWeight[],
  probabilities: WorkProbability[],
  confidence: number,
  historyWithAnswer: QuestionHistoryEntry[],
  weightsMap: Record<string, number>,
  newQuestionCount: number,
  newWeightsHistory: Array<{ qIndex: number; weights: Record<string, number> }>,
  config: MvpConfig
): Promise<AnswerResponseResult> {
  // weightsHistory は sessionUpdates に含めない（updateSession が全削除+全再作成するため重い）。呼び出し側で saveWeightsSnapshot を 1 行 INSERT する。
  const baseSessionUpdates = {
    weights: weightsMap,
    questionCount: newQuestionCount,
    questionHistory: historyWithAnswer,
  };

  // REVEAL 時は質問数に含めない（特別スロット Q3/Q5/Q9/Q16 を潰さないため）
  const revealSessionUpdates = {
    weights: weightsMap,
    questionCount: session.questionCount,
    questionHistory: historyWithAnswer,
  };

  const lastAnswered = historyWithAnswer[historyWithAnswer.length - 1];
  if (
    lastAnswered?.kind === 'NOISE_GUIDE_RECOMMEND' &&
    (lastAnswered.answer === 'YES' || lastAnswered.answer === 'PROBABLY_YES')
  ) {
    return {
      state: 'RECOMMEND',
      sessionUpdates: baseSessionUpdates,
    };
  }
  if (
    lastAnswered?.kind === 'NOISE_GUIDE_RECOMMEND' &&
    (lastAnswered.answer === 'NO' || lastAnswered.answer === 'PROBABLY_NO')
  ) {
    return {
      state: 'TOP',
      sessionUpdates: baseSessionUpdates,
    };
  }

  // 1. REVEAL 判定（confidence >= threshold）
  const revealThreshold = getRevealThresholdForQuestion(newQuestionCount - 1, config.confirm.revealThreshold);
  if (confidence >= revealThreshold) {
    const revealWorkId = getTopWorkIdFromProbabilities(probabilities, session.revealRejectedWorkIds ?? []);
    if (revealWorkId) {
      return {
        state: 'REVEAL',
        revealWorkId,
        sessionUpdates: revealSessionUpdates,
      };
    }
  }

  // 2. REVEAL 失敗回数上限 → FAIL_LIST
  if (session.revealMissCount >= (config.flow.maxRevealMisses as number)) {
    return {
      state: 'FAIL_LIST',
      sessionUpdates: baseSessionUpdates,
    };
  }

  const effectiveCandidates = calculateEffectiveCandidates(probabilities);

  // 2.5 早期分岐（Q25/Q30/Q35/Q40）
  if (shouldEarlyExit(newQuestionCount, confidence, effectiveCandidates, historyWithAnswer, config)) {
    return {
      state: 'FAIL_LIST',
      sessionUpdates: baseSessionUpdates,
    };
  }

  // 3. maxQuestions 到達 → 強制 REVEAL（わからない+1問、Q30かつ候補<50で+5問、最大40問）
  const effectiveMax = getEffectiveMaxQuestions(config.flow.maxQuestions as number, confidence, {
    questionHistory: historyWithAnswer,
    effectiveCandidates,
    questionCount: newQuestionCount,
  });
  if (newQuestionCount >= effectiveMax) {
    const forceRevealId = getTopWorkIdFromProbabilities(probabilities, session.revealRejectedWorkIds ?? []);
    if (forceRevealId) {
      return {
        state: 'REVEAL',
        revealWorkId: forceRevealId,
        forcedReveal: true,
        sessionUpdates: revealSessionUpdates,
      };
    }
  }

  // 4. 次の質問を選択（断定で外した作品は候補から除外）
  const nextQuestion = await selectNextQuestion(
    updatedWeights,
    probabilities,
    newQuestionCount,
    historyWithAnswer,
    config,
    { revealRejectedWorkIds: session.revealRejectedWorkIds ?? undefined }
  );

  if (!nextQuestion) {
    // 質問が無い → 強制 REVEAL または FAIL_LIST
    const forceRevealId = getTopWorkIdFromProbabilities(probabilities, session.revealRejectedWorkIds ?? []);
    if (forceRevealId) {
      return {
        state: 'REVEAL',
        revealWorkId: forceRevealId,
        forcedReveal: true,
        sessionUpdates: revealSessionUpdates,
      };
    }
    return {
      state: 'FAIL_LIST',
      sessionUpdates: baseSessionUpdates,
    };
  }

  // 5. QUIZ: 次の質問を履歴に追加
  const nextQIndex = currentQuestion.qIndex + 1;
  const newHistory: QuestionHistoryEntry[] = [...historyWithAnswer, {
    qIndex: nextQIndex,
    kind: nextQuestion.kind,
    tagKey: nextQuestion.tagKey,
    hardConfirmType: nextQuestion.hardConfirmType,
    hardConfirmValue: nextQuestion.hardConfirmValue,
    displayText: nextQuestion.displayText,
    isSummaryQuestion: nextQuestion.isSummaryQuestion,
    summaryQuestionId: nextQuestion.summaryQuestionId,
    summaryDisplayNames: nextQuestion.summaryDisplayNames,
    exploreTagKind: (nextQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
    specialQuestionType: (nextQuestion as { specialQuestionType?: SpecialQuestionType }).specialQuestionType,
    seriesTagKeys: (nextQuestion as { seriesTagKeys?: string[] }).seriesTagKeys,
    titleCharType: (nextQuestion as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType,
    popularityThreshold: (nextQuestion as { popularityThreshold?: number }).popularityThreshold,
    syllableChars: (nextQuestion as { syllableChars?: string[] }).syllableChars,
    authorCharType: (nextQuestion as { authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA' }).authorCharType,
    titleLengthYesMin: (nextQuestion as QuestionData).titleLengthYesMin,
    titleLengthNoMax: (nextQuestion as QuestionData).titleLengthNoMax,
    newTagVariantId: (nextQuestion as QuestionData).newTagVariantId,
  }];
  return {
    state: 'QUIZ',
    nextQuestion,
    confidence,
    sessionUpdates: {
      weights: weightsMap,
      questionCount: newQuestionCount,
      questionHistory: newHistory,
    },
  };
}

/** REVEAL 回答後の応答種別 */
export type RevealResponseState = 'SUCCESS' | 'FAIL_LIST' | 'QUIZ';

/** REVEAL 回答処理の結果（API が I/O とレスポンス構築に使用） */
export interface RevealResponseResult {
  state: RevealResponseState;
  /** SUCCESS の場合: 正解作品の workId */
  topWorkId?: string;
  /** FAIL_LIST / QUIZ の場合: セッション更新内容 */
  sessionUpdates?: {
    weights: Record<string, number>;
    revealRejectedWorkIds: string[];
    revealMissCount: number;
    questionCount?: number;
    questionHistory?: QuestionHistoryEntry[];
    weightsHistory?: Array<{ qIndex: number; weights: Record<string, number> }>;
  };
  /** QUIZ の場合: 次の質問 */
  nextQuestion?: QuestionData;
  /** QUIZ の場合の confidence（sessionState 用） */
  confidence?: number;
}

/**
 * REVEAL 回答後の応答を決定（SUCCESS / FAIL_LIST / QUIZ）
 * API の判定ロジックを集約。I/O（DB・SessionManager）は呼び出し側が担当。
 */
export async function handleRevealResponse(
  session: SessionState,
  answer: 'YES' | 'NO',
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  config: MvpConfig
): Promise<RevealResponseResult> {
  // 出題時（handleAnswerResponse）と同じ: 拒否済みを除いた確率先頭＝ユーザーに表示している断定対象
  const revealedWorkId = getTopWorkIdFromProbabilities(
    probabilities,
    session.revealRejectedWorkIds ?? []
  );

  if (!revealedWorkId) {
    throw new Error('No reveal target work found');
  }

  if (answer === 'YES') {
    return { state: 'SUCCESS', topWorkId: revealedWorkId };
  }

  // NO: ペナルティ適用（同シリーズの作品にも軽めのペナルティ）
  let sameSeriesWorkIds: string[] = [];
  try {
    if (!_simWorkDataMap) {
      const topWork = await prisma.work.findUnique({
        where: { workId: revealedWorkId },
        select: { seriesInfo: true },
      });
      if (topWork?.seriesInfo) {
        const parsed = JSON.parse(topWork.seriesInfo) as { id?: string };
        if (parsed.id) {
          const seriesWorks = await prisma.$queryRawUnsafe<Array<{ workId: string }>>(
            `SELECT "workId" FROM "Work" WHERE "seriesInfo" LIKE $1 AND "workId" != $2`,
            `%"id":"${parsed.id}"%`,
            revealedWorkId
          );
          sameSeriesWorkIds = seriesWorks.map(w => w.workId);
        }
      }
    }
  } catch {
    // seriesInfo parse error - skip series penalty
  }
  const penalizedWeights = applyRevealPenalty(
    weights,
    revealedWorkId,
    config.algo.revealPenalty,
    sameSeriesWorkIds
  );
  const penalizedMap: Record<string, number> = {};
  for (const w of penalizedWeights) {
    penalizedMap[w.workId] = w.weight;
  }

  const prevRejected = session.revealRejectedWorkIds ?? [];
  const newRejected = prevRejected.includes(revealedWorkId)
    ? prevRejected
    : [...prevRejected, revealedWorkId];
  const newMissCount = session.revealMissCount + 1;

  const baseSessionUpdates = {
    weights: penalizedMap,
    revealRejectedWorkIds: newRejected,
    revealMissCount: newMissCount,
  };

  // FAIL_LIST 判定（maxRevealMisses 到達）
  if (newMissCount >= (config.flow.maxRevealMisses as number)) {
    return { state: 'FAIL_LIST', sessionUpdates: baseSessionUpdates };
  }

  // QUIZ に戻る: 次の質問を選択（今回含め断定で外した作品は候補から除外）
  const penalizedProbabilities = normalizeWeights(penalizedWeights);
  const nextQuestion = await selectNextQuestion(
    penalizedWeights,
    penalizedProbabilities,
    session.questionCount,
    session.questionHistory,
    config,
    { afterRevealWrong: true, revealRejectedWorkIds: newRejected }
  );

  if (!nextQuestion) {
    return { state: 'FAIL_LIST', sessionUpdates: baseSessionUpdates };
  }

  const maxQIndex = session.questionHistory.length > 0
    ? Math.max(...session.questionHistory.map((e) => e.qIndex ?? 0))
    : 0;
  const newQIndex = maxQIndex + 1;
  const newHistory: QuestionHistoryEntry[] = [
    ...session.questionHistory,
    {
      qIndex: newQIndex,
      kind: nextQuestion.kind,
      tagKey: nextQuestion.tagKey,
      hardConfirmType: nextQuestion.hardConfirmType,
      hardConfirmValue: nextQuestion.hardConfirmValue,
      displayText: nextQuestion.displayText,
      isSummaryQuestion: nextQuestion.isSummaryQuestion,
      summaryQuestionId: nextQuestion.summaryQuestionId,
      summaryDisplayNames: nextQuestion.summaryDisplayNames,
      exploreTagKind: (nextQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
      specialQuestionType: (nextQuestion as { specialQuestionType?: SpecialQuestionType }).specialQuestionType,
      seriesTagKeys: (nextQuestion as { seriesTagKeys?: string[] }).seriesTagKeys,
      titleCharType: (nextQuestion as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType,
      popularityThreshold: (nextQuestion as { popularityThreshold?: number }).popularityThreshold,
      syllableChars: (nextQuestion as { syllableChars?: string[] }).syllableChars,
      authorCharType: (nextQuestion as { authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA' }).authorCharType,
      titleLengthYesMin: (nextQuestion as QuestionData).titleLengthYesMin,
      titleLengthNoMax: (nextQuestion as QuestionData).titleLengthNoMax,
      newTagVariantId: (nextQuestion as QuestionData).newTagVariantId,
    },
  ];
  const confidence = calculateConfidence(penalizedProbabilities);

  return {
    state: 'QUIZ',
    nextQuestion,
    confidence,
    sessionUpdates: {
      ...baseSessionUpdates,
      questionCount: newQIndex,
      questionHistory: newHistory,
    },
  };
}
