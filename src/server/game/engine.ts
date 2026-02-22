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
  shouldInsertConfirm,
  selectConfirmType,
  getNextHardConfirmType,
  type TagInfo,
} from '@/server/algo/questionSelection';
import { passesCoverageGate } from '@/server/algo/coverage';
import { hasDerivedFeature, updateWeightsForTagQuestion, updateWeightsForTagQuestionBayesian } from '@/server/algo/weightUpdate';
import { normalizeTitleForInitial } from '@/server/utils/normalizeTitle';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { getGroupDisplayNames } from '@/server/config/tagIncludeUnify';
import type { QuestionHistoryEntry } from '@/server/session/manager';
import { isTagBanned } from '@/server/admin/bannedTags';
import { getWorkTagMatrix, getWorkTagsFromMatrix } from '@/server/game/workTagMatrixLoader';
import fs from 'fs';
import path from 'path';

const CACHE_TTL = 5000; // 5秒キャッシュ

/** Phase 4: 汎用パターン（新タグ・BCタグ・未設定時） */
const DEFAULT_QUESTION_PATTERN = (displayName: string) => `${displayName}が関係している？`;

/** キャラタグ（Xタグ）用パターン */
const CHARACTER_QUESTION_PATTERN = (displayName: string) => `${displayName}というキャラクターが登場する？`;

/** まとめ質問キャッシュ（erotic=true は6問目以降のみ出題） */
let summaryQuestionsCache: Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean }> | null = null;
let summaryQuestionsCacheTime = 0;

function loadSummaryQuestions(): Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean }> {
  const now = Date.now();
  if (summaryQuestionsCache && now - summaryQuestionsCacheTime < CACHE_TTL) {
    return summaryQuestionsCache;
  }
  try {
    const filePath = path.join(process.cwd(), 'config', 'summaryQuestions.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as { summaryQuestions?: Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean }> };
    summaryQuestionsCache = data.summaryQuestions ?? [];
    summaryQuestionsCacheTime = now;
    return summaryQuestionsCache;
  } catch {
    return [];
  }
}

/** 抽象質問（旧ふわっと）タグの displayName 一覧 */
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
  const matrix = getWorkTagMatrix();
  if (matrix) {
    return getWorkTagsFromMatrix(workIds, options);
  }
  const result = await prisma.workTag.findMany({
    where: {
      workId: { in: workIds },
      ...(options?.tagKeys?.length ? { tagKey: { in: options.tagKeys } } : {}),
    },
    select: { workId: true, tagKey: true, derivedConfidence: true },
  });
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
 */
export async function initializeWeights(
  allowedWorkIds: string[],
  alpha: number
): Promise<WorkWeight[]> {
  // productUrlは必須（Prisma schemaでnullableではない）
  const works = await prisma.work.findMany({
    where: {
      workId: { in: allowedWorkIds },
    },
  });

  // popularityPlayBonusを環境変数で無効化可能（デバッグ中は常に0として扱う）
  const usePlayBonus = process.env.DISABLE_POPULARITY_PLAY_BONUS !== '1';
  
  return works.map(w => ({
    workId: w.workId,
    weight: calculateBasePrior(
      w.popularityBase,
      usePlayBonus ? w.popularityPlayBonus : 0,
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
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';
  displayText: string;
  tagKey?: string;
  hardConfirmType?: 'TITLE_INITIAL' | 'AUTHOR';
  hardConfirmValue?: string;
  isSummaryQuestion?: boolean;
  summaryQuestionId?: string;
  summaryDisplayNames?: string[];
  /** まとめ/エロ/抽象/通常の判別用（EXPLORE_TAG のみ。表示には使わずタグ・バッジ用） */
  exploreTagKind?: ExploreTagKind;
}

/** selectNextQuestion のオプション（REVEAL失敗直後など） */
export interface SelectNextQuestionOptions {
  /** 直前に REVEAL で不正解だった。次の1問は頭文字・作者を優先して正解に当てに行く */
  afterRevealWrong?: boolean;
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
  const questionIndex = questionCount + 1; // 次の質問番号（1-based）
  const usedSummaryIds = new Set(
    questionHistory
      .filter((q): q is QuestionHistoryEntry & { summaryQuestionId: string } => !!q.summaryQuestionId)
      .map(q => q.summaryQuestionId!)
  );
  const usedTagKeys = await buildUsedTagKeysFromHistory(questionHistory);

  // 1問目: 非エロのまとめ質問から完全ランダムで1つ選択（禁止タグは隔離して除外）
  if (questionCount === 0) {
    const summaries = loadSummaryQuestions();
    const unused = summaries.filter(s => !usedSummaryIds.has(s.id) && !s.erotic);
    if (unused.length > 0) {
      const shuffled = [...unused].sort(() => Math.random() - 0.5);
      for (const summary of shuffled) {
        const tags = await prisma.tag.findMany({
          where: { displayName: { in: summary.displayNames } },
          select: { tagKey: true, displayName: true },
        });
        const validTag = tags.find(t => !isTagBanned(t.displayName));
        if (validTag) {
          return {
            kind: 'EXPLORE_TAG',
            displayText: summary.questionText,
            tagKey: validTag.tagKey,
            isSummaryQuestion: true,
            summaryQuestionId: summary.id,
            summaryDisplayNames: summary.displayNames,
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
      console.log('[selectNextQuestion] Q1: まとめで出題できなかったため、通常タグでフォールバックしました。');
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

  // Confirm挿入判定
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
    // SOFT_CONFIRM vs HARD_CONFIRM選択
    const usedHardTypes = questionHistory
      .filter(q => q.kind === 'HARD_CONFIRM')
      .map(q => q.hardConfirmType!)
      .filter((t): t is 'TITLE_INITIAL' | 'AUTHOR' => !!t);

    // SOFT_CONFIRM候補（DERIVEDタグ）を探す（使用済みタグを除外）
    // パフォーマンス最適化: 行列があれば workTags を行列から取得（DB の重い JOIN を避ける）
    const workIds = weights.map(w => w.workId);
    const threshold = config.algo.derivedConfidenceThreshold;
    const matrix = getWorkTagMatrix();

    let derivedTags: Array<{ tagKey: string; displayName: string; questionText: string | null; workTags: Array<{ workId: string }> }>;

    if (matrix) {
      // 行列あり: Tag のみ DB、workTags は行列から
      const tagsFromDb = await prisma.tag.findMany({
        where: {
          tagType: 'DERIVED',
          tagKey: { notIn: Array.from(usedTagKeys) },
        },
        select: {
          tagKey: true,
          displayName: true,
          questionText: true,
        },
      });

      const tagKeys = tagsFromDb.map(t => t.tagKey);
      const workTagsRaw = tagKeys.length > 0
        ? getWorkTagsFromMatrix(workIds, { tagKeys })
        : [];
      const workTagsFiltered = workTagsRaw.filter(
        wt => hasDerivedFeature(wt.derivedConfidence, threshold)
      );
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
      // 行列なし: 従来通り prisma で workTags も取得
      derivedTags = await prisma.tag.findMany({
        where: {
          tagType: 'DERIVED',
          tagKey: { notIn: Array.from(usedTagKeys) },
        },
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
        console.log(`[selectNextQuestion] Direct SQLite query found ${derivedTags.length} DERIVED tags`);
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
      const probabilities = normalizeWeights(weights);
      const probMap = new Map(probabilities.map(p => [p.workId, p.probability]));
      const sortedByProb = [...probabilities].sort((a, b) => b.probability - a.probability);
      const top1WorkId = sortedByProb[0]?.workId ?? null;

      const pMin = config.algo.explorePValueMin ?? 0.05;
      const pMax = config.algo.explorePValueMax ?? 0.95;

      // 各タグについてp値を計算
      const tagScores = derivedTags
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
        console.log(`[SOFT_CONFIRM] ${top1TagsInBand.length > 0 ? 'top1狙い' : 'フォールバック'}: ${selectedTag.tag.displayName} (p: ${(selectedTag.p * 100).toFixed(1)}%)`);

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
        console.log(`[SOFT_CONFIRM] p値が [${pMin}, ${pMax}] 内のタグがないため、統一選択にフォールバック`);
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
        console.log(`[HARD_CONFIRM] 2連続防止: 直前がHARD_CONFIRMのため、EXPLORE_TAGにフォールバック`);
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

      // 確度上位N件の作品から頭文字・作者を選ぶ（titleInitialTopN: 1のとき従来どおりtop1のみ）
      const probsForTop1 = normalizeWeights(weights);
      const sortedByProb = [...probsForTop1].sort((a, b) => b.probability - a.probability);
      const topN = config.flow.titleInitialTopN ?? 1;
      const topWorkIds = sortedByProb.slice(0, topN).map(p => p.workId).filter(Boolean);
      
      if (topWorkIds.length === 0) {
        return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, undefined, usedTagKeys);
      }
      
      const topWorks = await prisma.work.findMany({
        where: { workId: { in: topWorkIds } },
        select: { workId: true, title: true, authorName: true },
      });
      const orderedWorks = topWorkIds
        .map(id => topWorks.find(w => w.workId === id))
        .filter((w): w is NonNullable<typeof w> => w != null);
      
      if (orderedWorks.length === 0) {
        return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, undefined, usedTagKeys);
      }
      
      // 上位から順に、未使用の頭文字があればTITLE_INITIALで返す
      for (const w of orderedWorks) {
        const initial = normalizeTitleForInitial(w.title ?? '');
        if (!usedTitleInitials.has(initial)) {
          console.log(`[HARD_CONFIRM] 当てに行く: TITLE_INITIAL "${initial}" (work: ${w.title})`);
          return {
            kind: 'HARD_CONFIRM',
            displayText: `タイトルが「${initial}」から始まる？`,
            hardConfirmType: 'TITLE_INITIAL',
            hardConfirmValue: initial,
          };
        }
      }
      // 上位から順に、未使用の作者名があればAUTHORで返す
      for (const w of orderedWorks) {
        const author = w.authorName ?? '(不明)';
        if (!usedAuthors.has(author)) {
          console.log(`[HARD_CONFIRM] 当てに行く: AUTHOR "${author}" (work: ${w.title})`);
          return {
            kind: 'HARD_CONFIRM',
            displayText: `……この作品の作者（サークル）、「${author}」かしら？`,
            hardConfirmType: 'AUTHOR',
            hardConfirmValue: author,
          };
        }
      }
      
      // 上位N件の頭文字・作者名もすべて使用済み → 統一選択にフォールバック
      console.log(`[HARD_CONFIRM] 上位${topN}件の頭文字・作者名は使用済み、統一選択にフォールバック`);
      const fallback = await selectUnifiedExploreOrSummary(qIndex, weights, probsForTop1, questionHistory, config, usedSummaryIds, usedTagKeys);
      if (fallback) return fallback;
      return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
    }
  }

  // REVEAL 失敗直後: 次の1問は頭文字・作者を聞いて、正解候補に早く当てに行く（EXPLORE の NO 連続を防ぐ）
  if (options?.afterRevealWrong) {
    const hardAfterReveal = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config);
    if (hardAfterReveal) {
      console.log('[selectNextQuestion] REVEAL失敗直後のため、HARD_CONFIRM（頭文字・作者）を優先');
      return hardAfterReveal;
    }
  }

  // Q2,3,4,5,7,8,9,11+: まとめと通常タグを同一ルールで選択（理想フロー）
  const unified = await selectUnifiedExploreOrSummary(qIndex, weights, probabilities, questionHistory, config, usedSummaryIds, usedTagKeys);
  if (unified) return unified;

  // p値バンドでEXPLOREが選べなかった場合のフォールバック: HARD_CONFIRM で頭文字/作者を聞く
  const fallbackEnabled = config.algo.explorePValueFallbackEnabled !== false && getExplorePValueBand(config) != null;
  if (fallbackEnabled) {
    const hardFallback = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config);
    if (hardFallback) {
      console.log('[selectNextQuestion] EXPLOREでp値範囲内のタグが無いため、HARD_CONFIRMにフォールバック');
      return hardFallback;
    }
  }

  // フォールバック: 通常タグのみ（Q4以降）
  if (qIndex >= 4) {
    const exploreResult = await selectExploreQuestion(weights, probabilities, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
    if (exploreResult) return exploreResult;
    if (fallbackEnabled) {
      const hardFallback = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config);
      if (hardFallback) {
        console.log('[selectNextQuestion] EXPLOREでp値範囲内のタグが無いため、HARD_CONFIRMにフォールバック');
        return hardFallback;
      }
    }
  }

  // 最後の砦: 候補のどれかが持つタグから未使用のものを1本選ぶ（カバレッジ・p値無視）
  const emergency = await tryEmergencyExploreFallback(weights, questionHistory, usedTagKeys);
  if (emergency) return emergency;

  return null;
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
 * HARD_CONFIRM を1つ生成（確度上位N件の頭文字 or 作者から未使用のものを選ぶ）。使用済みなら null。
 * p値フォールバック時や Confirm 挿入時に利用。
 */
async function tryGetHardConfirmQuestion(
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig
): Promise<QuestionData | null> {
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
  const sorted = [...probabilities].sort((a, b) => b.probability - a.probability);
  const topN = config.flow.titleInitialTopN ?? 1;
  const topWorkIds = sorted.slice(0, topN).map(p => p.workId).filter(Boolean);
  if (topWorkIds.length === 0) return null;
  const topWorks = await prisma.work.findMany({
    where: { workId: { in: topWorkIds } },
    select: { workId: true, title: true, authorName: true },
  });
  const orderedWorks = topWorkIds
    .map(id => topWorks.find(w => w.workId === id))
    .filter((w): w is NonNullable<typeof w> => w != null);
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
  const workIds = weights.map(w => w.workId);
  if (workIds.length === 0) return null;

  const workTags = await fetchWorkTags(workIds);
  const tagKeysFromWorks = new Set(workTags.map(wt => wt.tagKey));
  const candidateTagKeys = Array.from(tagKeysFromWorks).filter(tk => !usedTagKeys.has(tk));
  if (candidateTagKeys.length === 0) return null;

  const tagKey = candidateTagKeys[0];
  const tag = await prisma.tag.findUnique({
    where: { tagKey },
    select: { displayName: true, tagType: true, questionText: true },
  });
  if (!tag) return null;

  const abstractDisplayNames = loadAbstractDisplayNames();
  const eroticDisplayNames = loadEroticDisplayNames();
  const displayText = getTagQuestionText(
    tag.displayName,
    tag.tagType ?? undefined,
    tag.questionText
  );
  const exploreTagKind: ExploreTagKind = eroticDisplayNames.has(tag.displayName)
    ? 'erotic'
    : abstractDisplayNames.has(tag.displayName)
      ? 'abstract'
      : 'normal';
  console.log('[selectNextQuestion] 緊急フォールバック: 候補が持つタグから1本選択', tagKey);
  return {
    kind: 'EXPLORE_TAG',
    displayText,
    tagKey,
    exploreTagKind,
  };
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
    const tags = await prisma.tag.findMany({
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

  const tags = await prisma.tag.findMany({
    where: { displayName: { in: Array.from(displayNamesToMark) } },
    select: { tagKey: true },
  });
  return new Set(tags.map(t => t.tagKey));
}

/**
 * 理想フロー: まとめと通常タグを同一プールでルールに従って1つ選択
 * Q2-3: 非エロまとめのみ / Q4-5: 非エロまとめ+通常 / Q7-9: 全まとめ+全タグ(エロ解禁) / Q11+: 抽象も加える
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
  const workIds = weights.map(w => w.workId);
  const totalWorks = weights.length;
  const abstractDisplayNames = loadAbstractDisplayNames();
  const eroticDisplayNames = loadEroticDisplayNames();
  const summaries = loadSummaryQuestions();

  // 質問番号ごとのまとめ候補
  let summaryCandidates: Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean }> = [];
  if (questionIndex >= 2 && questionIndex <= 3) {
    summaryCandidates = summaries.filter(s => !usedSummaryIds.has(s.id) && !s.erotic);
  } else if (questionIndex >= 4 && questionIndex <= 5) {
    summaryCandidates = summaries.filter(s => !usedSummaryIds.has(s.id) && !s.erotic);
  } else if (questionIndex >= 7) {
    summaryCandidates = summaries.filter(s => !usedSummaryIds.has(s.id));
  }

  // まとめの displayNames → tagKeys 解決
  const allSummaryDisplayNames = new Set<string>();
  for (const s of summaryCandidates) for (const d of s.displayNames) allSummaryDisplayNames.add(d);
  const summaryDisplayNameToTagKeys = new Map<string, string[]>();
  if (allSummaryDisplayNames.size > 0) {
    const tTag1 = Date.now();
    const tagsInSummaries = await prisma.tag.findMany({
      where: { displayName: { in: Array.from(allSummaryDisplayNames) } },
      select: { tagKey: true, displayName: true },
    });
    console.log(`[perf] selectUnifiedExploreOrSummary tagsInSummaries: ${Date.now() - tTag1}ms`);
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
  const tFetch = Date.now();
  const workTagsAll = await fetchWorkTags(workIds);
  console.log(`[perf] selectUnifiedExploreOrSummary fetchWorkTags: ${Date.now() - tFetch}ms`);
  const tagWorkCountMap = new Map<string, number>();
  for (const wt of workTagsAll) {
    tagWorkCountMap.set(wt.tagKey, (tagWorkCountMap.get(wt.tagKey) || 0) + 1);
  }
  let passingTagKeys: string[] = [];
  for (const [tagKey, workCount] of tagWorkCountMap.entries()) {
    if (usedTagKeys.has(tagKey)) continue;
    if (!passesCoverageGate(workCount, totalWorks, config.dataQuality.minCoverageMode, config.dataQuality.minCoverageRatio, config.dataQuality.minCoverageWorks, config.dataQuality.maxCoverageRatio ?? null)) continue;
    passingTagKeys.push(tagKey);
  }
  if (questionIndex < 11) {
    const tFilter = Date.now();
    const tagsForFilter = await prisma.tag.findMany({
      where: { tagKey: { in: passingTagKeys } },
      select: { tagKey: true, displayName: true },
    });
    console.log(`[perf] selectUnifiedExploreOrSummary tagsForFilter: ${Date.now() - tFilter}ms`);
    passingTagKeys = passingTagKeys.filter(tagKey => {
      const tag = tagsForFilter.find(t => t.tagKey === tagKey);
      if (!tag) return true;
      if (questionIndex < 11 && abstractDisplayNames.has(tag.displayName)) return false;
      if (questionIndex < 7 && eroticDisplayNames.has(tag.displayName)) return false;
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

  // Q4以降のみ通常タグを候補に追加（Q2-3は非エロまとめのみ）
  if (questionIndex >= 4 && passingTagKeys.length > 0) {
    const tAll = Date.now();
    const allTags = await prisma.tag.findMany({
      where: { tagKey: { in: passingTagKeys } },
      select: { tagKey: true, displayName: true, tagType: true },
    });
    console.log(`[perf] selectUnifiedExploreOrSummary allTags: ${Date.now() - tAll}ms`);
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
      console.log(`[selectUnifiedExploreOrSummary] まとめ優先: ${summaryOnly.length}件に絞り込み`);
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
  if (useIG && !preferHighP) {
    selectedKey = selectExploreTagByIG(tagsForSelection, probabilities, workHasTag, pValueBand);
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
      selectedKey = selectExploreTagByIG(tagsForSelection, probabilities, workHasTag, undefined);
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
    if (selectedKey) {
      console.log('[selectUnifiedExploreOrSummary] p値バンドで候補0のためバンド外しで再選択');
    }
  }
  if (!selectedKey) return null;

  if (selectedKey.startsWith('summary:')) {
    const id = selectedKey.slice(8);
    const summary = summaryCandidates.find(s => s.id === id);
    if (!summary) return null;
    const tags = await prisma.tag.findMany({
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

  const selectedTag = await prisma.tag.findUnique({
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
  const opts = options ?? buildExploreOptions(questionHistory.length + 1);
  const { summaryOnlyTagKeys, questionIndex = opts.questionIndex ?? 0, abstractDisplayNames = new Set(), eroticDisplayNames = new Set() } = opts;
  const abstractSet = abstractDisplayNames.size > 0 ? abstractDisplayNames : loadAbstractDisplayNames();
  const eroticSet = eroticDisplayNames.size > 0 ? eroticDisplayNames : loadEroticDisplayNames();

  const resolvedUsedTagKeys = usedTagKeys ?? await buildUsedTagKeysFromHistory(questionHistory);

  // デバッグ: 使用済みタグを表示
  console.log(`[selectExploreQuestion] usedTagKeys (${resolvedUsedTagKeys.size}): ${Array.from(resolvedUsedTagKeys).slice(0, 10).join(', ')}${resolvedUsedTagKeys.size > 10 ? '...' : ''}`);

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

  // デバッグ: passingTagKeysの数を表示
  console.log(`[selectExploreQuestion] passingTagKeys: ${passingTagKeys.length} tags available`);
  
  if (passingTagKeys.length === 0) {
    console.log(`[selectExploreQuestion] No tags available, returning null`);
    return null;
  }

  // カバレッジゲートを通過したタグのみを取得
  let allTags = await prisma.tag.findMany({
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

  // Prismaで0件の場合、直接SQLiteで取得（フォールバック）
  if (allTags.length === 0 && passingTagKeys.length > 0) {
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
      console.log(`[selectExploreQuestion] Direct SQLite query found ${allTags.length} tags`);
    } catch (directError) {
      console.error('[selectExploreQuestion] Error in direct SQLite fallback:', directError);
      // フォールバックも失敗した場合は空配列のまま続行
    }
  }

  const availableTags: TagInfo[] = [];
  for (const tag of allTags) {
    // 使用済みタグを再度チェック（安全策）
    if (resolvedUsedTagKeys.has(tag.tagKey)) {
      console.log(`[selectExploreQuestion] WARNING: tag "${tag.tagKey}" was in allTags but should be excluded`);
      continue;
    }
    // 禁止タグは隔離（質問に使わない）
    if (isTagBanned(tag.displayName)) continue;
    // 抽象質問（旧ふわっと）: 11問目以降のみ候補
    if (questionIndex < 11 && abstractSet.has(tag.displayName)) {
      continue;
    }
    // エロ質問: 7問目以降のみ候補
    if (questionIndex < 7 && eroticSet.has(tag.displayName)) {
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

  console.log(`[selectExploreQuestion] availableTags: ${availableTags.length} (after filtering used tags)`);

  if (availableTags.length === 0) {
    console.log(`[selectExploreQuestion] No available tags after filtering`);
    return null;
  }

  // workHasTag関数（既に取得済みのworkTagsを使用）
  const workTagMap = new Map<string, Set<string>>();
  for (const wt of workTags) {
    if (passingTagKeys.includes(wt.tagKey)) {
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
  const selectedTagKey = useIG
    ? selectExploreTagByIG(availableTags, probabilities, workHasTag, pValueBand)
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
}

/**
 * 回答による重み更新
 */
export async function processAnswer(
  weights: WorkWeight[],
  question: QuestionData,
  answerChoice: string,
  config: MvpConfig
): Promise<WorkWeight[]> {
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
  } else if (question.kind === 'EXPLORE_TAG') {
    strength *= config.algo.exploreTagStrengthScale ?? 1.0;
  } else if (question.kind === 'SOFT_CONFIRM') {
    strength *= config.algo.softConfirmStrengthScale ?? 1.0;
  }

  if (question.kind === 'EXPLORE_TAG' || question.kind === 'SOFT_CONFIRM') {
    // Tag-based質問（包括・統合: 同一グループのタグをまとめて判定）
    const tagKey = question.tagKey!;
    const workIds = weights.map(w => w.workId);

    // まとめ質問のときは summaryDisplayNames をグループとして使用
    const summaryDisplayNames = (question as QuestionData & { summaryDisplayNames?: string[] }).summaryDisplayNames;
    let groupDisplayNames: string[];
    if (summaryDisplayNames?.length) {
      groupDisplayNames = summaryDisplayNames;
    } else {
      const askedTag = await prisma.tag.findUnique({
        where: { tagKey },
        select: { displayName: true },
      });
      const displayName = askedTag?.displayName ?? tagKey;
      groupDisplayNames = getGroupDisplayNames(displayName);
    }

    const groupTags = await prisma.tag.findMany({
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
      const epsilon = config.algo.bayesianEpsilon ?? 0.02;
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

    // 全Workを取得して判定
    const workIds = weights.map(w => w.workId);
    const works = await prisma.work.findMany({
      where: { workId: { in: workIds } },
    });

    const workMap = new Map(works.map(w => [w.workId, w]));

    let workHasFeature: (workId: string) => boolean;
    if (hardConfirmType === 'TITLE_INITIAL') {
      workHasFeature = (workId: string) => {
        const work = workMap.get(workId);
        if (!work) return false;
        const initial = normalizeTitleForInitial(work.title ?? '');
        return initial === expectedValue;
      };
    } else {
      // AUTHOR
      workHasFeature = (workId: string) => {
        const work = workMap.get(workId);
        if (!work) return false;
        return (work.authorName ?? '') === expectedValue;
      };
    }

    const useBayesian = config.algo.useBayesianUpdate !== false;
    if (useBayesian) {
      const epsilon = config.algo.bayesianEpsilon ?? 0.02;
      return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
    }
    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }
}
