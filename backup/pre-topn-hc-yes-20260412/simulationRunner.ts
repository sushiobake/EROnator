/**
 * シミュレーション実行ロジック（route.ts / Worker Thread 両方から利用）
 */

import { getMvpConfig } from '../config/loader';
import { getRevealThresholdForQuestion, getEffectiveMaxQuestions } from '../config/flowUtils';
import { getTitleSyllableRanges } from '../config/specialQuestionsLoader';
import { selectNextQuestion, processAnswer, filterWorksByAiGate, getEarlyExitStepSnapshot, type WorkInfoForConfirm } from '../game/engine';
import { getWorkTagsFromMatrix } from '../game/workTagMatrixLoader';
import {
  perfStart,
  perfEnd,
  createPerfAccumulator,
  runWithPerfAccumulator,
  toPerfSummary,
} from '../simulationPerf';
import { normalizeWeights, calculateEffectiveCandidates } from '../algo/scoring';
import { normalizeTitleForInitial } from '../utils/normalizeTitle';
import { getTitleCharType, getTitleReadingInitialFromTitle } from '../utils/titleCharType';
import { getTitleReadingInitials } from '../utils/titleReadingInitial';
import { getAuthorCharType } from '../utils/authorCharType';
import type { WorkWeight, WorkProbability, AiGateChoice } from '../algo/types';
import type { QuestionHistoryEntry } from '../session/manager';
import type { EarlyExitStepSnapshot } from '@/types/earlyExitStepSnapshot';

/** 新タグ質問はシミュでは常に UNKNOWN（設計: DESIGN-new-tag-special-noise-v1 §シミュレーション） */
export function isNewTagQuestionForSimulation(
  question: { kind: string; tagKey?: string },
  qIndex: number,
  config: ReturnType<typeof getMvpConfig>
): boolean {
  if (question.kind === 'NEW_TAG_QUESTION') return true;
  const ext = config as ReturnType<typeof getMvpConfig> & {
    newTagQuestions?: { tagKeys?: string[]; slotIndices?: number[] };
  };
  const keys = ext.newTagQuestions?.tagKeys;
  const slots = ext.newTagQuestions?.slotIndices ?? [2, 7, 13];
  return !!(keys?.length && question.tagKey && keys.includes(question.tagKey) && slots.includes(qIndex));
}

// ─── Interfaces ───


/** 断定閾値未満のクイズ1手の直後: 本番 answer API の「断定ミス上限→早期失敗一覧」と同順。 */
export function evaluateSimulationEarlyExitAfterQuizAnswer(args: {
  newConfidence: number;
  revealThreshold: number;
  revealMissCount: number;
  maxRevealMisses: number;
  questionCountAfterThisAnswer: number;
  effectiveCandidatesAfter: number;
  questionHistory: QuestionHistoryEntry[];
  config: ReturnType<typeof getMvpConfig>;
  newSorted: WorkProbability[];
  revealedWrongWorkIds: Set<string>;
}): { stop: true; endedBy: SimulationDiagnostic['endedBy']; finalWorkId: string | null } | { stop: false } {
  if (args.newConfidence >= args.revealThreshold) {
    return { stop: false };
  }
  if (args.revealMissCount >= args.maxRevealMisses) {
    const finalWorkId =
      args.newSorted.find(p => !args.revealedWrongWorkIds.has(p.workId))?.workId ??
      args.newSorted[0]?.workId ??
      null;
    return { stop: true, endedBy: 'REVEAL', finalWorkId };
  }
  if (
    getEarlyExitStepSnapshot(
      args.questionCountAfterThisAnswer,
      args.newConfidence,
      args.effectiveCandidatesAfter,
      args.questionHistory,
      args.config
    ).wouldEarlyExit
  ) {
    const finalWorkId =
      args.newSorted.find(p => !args.revealedWrongWorkIds.has(p.workId))?.workId ??
      args.newSorted[0]?.workId ??
      null;
    return { stop: true, endedBy: 'EARLY_FAIL_REVIEW', finalWorkId };
  }
  return { stop: false };
}

export interface SimulationStep {
  qIndex: number;
  question: {
    kind: string;
    displayText: string;
    tagKey?: string;
    hardConfirmType?: string;
    hardConfirmValue?: string;
    exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal';
    specialQuestionType?: string;
    titleCharType?: string;
    authorCharType?: string;
    titleSyllableRangeId?: string;
    titleSyllable2RangeId?: string;
    titleSyllable2Branch?: 'yesBranch' | 'noBranch';
  };
  answer: string;
  wasNoisy: boolean;
  confidenceBefore: number;
  confidenceAfter: number;
  top1WorkId: string;
  top1Probability: number;
  tagCoverage?: number;
  revealWorkId?: string;
  revealWorkTitle?: string;
  revealResult?: 'SUCCESS' | 'MISS';
  effectiveCandidates?: number;
  preferHighP?: boolean;
  /** 回答直後の早期失敗審査スナップショット（クイズ行のみ） */
  earlyExit?: EarlyExitStepSnapshot;
}

export interface WorkDetails {
  workId: string;
  title: string;
  authorName: string | null;
  isAi: string | null;
  popularityBase: number | null;
  reviewCount: number | null;
  reviewAverage: number | null;
  commentText: string | null;
  tags: Array<{
    tagKey: string;
    displayName: string;
    tagType: string;
    derivedConfidence: number | null;
  }>;
}

export interface SimulationDiagnostic {
  endedBy: 'REVEAL' | 'MAX_QUESTIONS' | 'NO_MORE_QUESTIONS' | 'EARLY_FAIL_REVIEW' | 'OTHER';
  correctRank: number;
  correctStillInCandidates: boolean;
  top1Confidence: number;
  candidatesCount: number;
}

export interface SimulationAnalysisData {
  wasNoisyCount: number;
  firstNoisyStepIndex: number;
  noisyStepIndices: number[];
  correctRank: number;
  top1Confidence: number;
  totalQuestions: number;
  noisyRatio: number;
}

export interface SimulationResult {
  success: boolean;
  targetWorkId: string;
  targetWorkTitle: string;
  finalWorkId: string | null;
  finalWorkTitle: string | null;
  questionCount: number;
  steps: SimulationStep[];
  outcome: 'SUCCESS' | 'WRONG_REVEAL' | 'FAIL_LIST' | 'MAX_QUESTIONS' | 'ERROR';
  diagnostic?: SimulationDiagnostic;
  analysisData?: SimulationAnalysisData;
  workDetails?: WorkDetails;
  errorMessage?: string;
}

export interface SharedBatchContext {
  allWorks: Array<{
    workId: string;
    isAi: string | null;
    popularityBase: number | null;
    popularityPlayBonus: number | null;
    title: string | null;
    authorName: string | null;
  }>;
  workTitleMap: Map<string, string>;
  workDetailMap: Map<string, {
    workId: string;
    title: string;
    authorName: string | null;
    isAi: string | null;
    popularityBase: number | null;
    popularityPlayBonus: number | null;
    titleReadingInitial: string | null;
    reviewCount: number | null;
    reviewAverage: number | null;
    commentText: string | null;
  }>;
  workTagMap: Map<string, Array<{ tagKey: string; displayName: string; tagType: string; derivedConfidence: number | null }>>;
}

// ─── Helper Functions ───

export function getCorrectAnswer(
  question: {
    kind: string;
    tagKey?: string;
    hardConfirmType?: string;
    hardConfirmValue?: string;
    isSummaryQuestion?: boolean;
    summaryDisplayNames?: string[];
    specialQuestionType?: string;
    seriesTagKeys?: string[];
    titleCharType?: 'KANJI' | 'KATAKANA' | 'HIRAGANA';
    authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA';
    popularityThreshold?: number;
    syllableChars?: string[];
  },
  targetWork: {
    title: string | null;
    authorName: string | null;
    popularityBase?: number | null;
    popularityPlayBonus?: number | null;
    titleReadingInitial?: string | null;
  },
  targetTags: Set<string>,
  targetWorkTags: { displayName: string }[]
): string {
  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'SERIES') {
    const seriesTagKeys = question.seriesTagKeys ?? ['off_e1f6b6c9ce', 'off_ad42c1ba79'];
    return seriesTagKeys.some(tk => targetTags.has(tk)) ? 'YES' : 'NO';
  }
  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_CHAR_TYPE') {
    const targetCharType = getTitleCharType(targetWork.title ?? '');
    const expectedCharType = (question as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType ?? 'KANJI';
    if (expectedCharType === 'HIRAGANA_OR_KATAKANA') {
      return (targetCharType === 'HIRAGANA' || targetCharType === 'KATAKANA') ? 'YES' : 'NO';
    }
    return targetCharType === expectedCharType ? 'YES' : 'NO';
  }
  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'POPULARITY') {
    const threshold = (question as { popularityThreshold?: number }).popularityThreshold ?? 30;
    const pop = (targetWork.popularityBase ?? 0) + (targetWork.popularityPlayBonus ?? 0);
    return pop >= threshold ? 'YES' : 'NO';
  }
  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_SYLLABLE') {
    const syllableChars = (question as { syllableChars?: string[] }).syllableChars ?? [];
    const initials = getTitleReadingInitials(targetWork.titleReadingInitial);
    const fallback = getTitleReadingInitialFromTitle(targetWork.title ?? '');
    const toCheck: string[] = initials.length > 0 ? initials : fallback ? [fallback] : [];
    return toCheck.some((c) => syllableChars.includes(c)) ? 'YES' : 'NO';
  }
  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_SYLLABLE_2') {
    const syllableChars = (question as { syllableChars?: string[] }).syllableChars ?? [];
    const initials = getTitleReadingInitials(targetWork.titleReadingInitial);
    const fallback = getTitleReadingInitialFromTitle(targetWork.title ?? '');
    const toCheck: string[] = initials.length > 0 ? initials : fallback ? [fallback] : [];
    return toCheck.some((c) => syllableChars.includes(c)) ? 'YES' : 'NO';
  }
  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'AUTHOR_CHAR_TYPE') {
    const ct = getAuthorCharType(targetWork.authorName ?? '');
    const expectedCharType = (question as { authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA' }).authorCharType ?? 'HIRAGANA_OR_KATAKANA';
    if (expectedCharType === 'HIRAGANA_OR_KATAKANA') {
      return (ct === 'HIRAGANA' || ct === 'KATAKANA') ? 'YES' : 'NO';
    }
    return (ct === 'KANJI' || ct === 'ALPHA') ? 'YES' : 'NO';
  }
  if (question.kind === 'SPECIAL_QUESTION' && question.specialQuestionType === 'TITLE_LENGTH_STYLE') {
    const len = (targetWork.title ?? '').length;
    const yesMin = (question as { titleLengthYesMin?: number }).titleLengthYesMin ?? 10;
    return len >= yesMin ? 'YES' : 'NO';
  }
  if (question.kind === 'NOISE_GUIDE_RECOMMEND') {
    return 'NO';
  }
  if (question.kind === 'NEW_TAG_QUESTION' && question.tagKey) {
    return targetTags.has(question.tagKey) ? 'YES' : 'NO';
  }
  if (question.kind === 'NEW_TAG_QUESTION') {
    return 'NO';
  }
  if (question.kind === 'EXPLORE_TAG' || question.kind === 'SOFT_CONFIRM') {
    const summaryDisplayNames = question.summaryDisplayNames;
    const isSummaryQuestion = !!question.isSummaryQuestion || (summaryDisplayNames?.length ?? 0) > 0;
    let hasTag: boolean;
    if (isSummaryQuestion && summaryDisplayNames?.length) {
      const targetDisplayNames = new Set(targetWorkTags.map(t => t.displayName));
      hasTag = summaryDisplayNames.some(d => targetDisplayNames.has(d));
    } else {
      hasTag = targetTags.has(question.tagKey!);
    }
    return hasTag ? 'YES' : 'NO';
  }
  if (question.kind === 'HARD_CONFIRM') {
    if (question.hardConfirmType === 'TITLE_INITIAL') {
      const targetInitial = normalizeTitleForInitial(targetWork.title ?? '');
      const questionInitial = question.hardConfirmValue ?? '';
      return targetInitial === questionInitial ? 'YES' : 'NO';
    }
    if (question.hardConfirmType === 'CHARACTER') {
      const tagKey = question.hardConfirmValue ?? '';
      return targetTags.has(tagKey) ? 'YES' : 'NO';
    }
    return (targetWork.authorName ?? '') === question.hardConfirmValue ? 'YES' : 'NO';
  }
  return 'DONT_CARE';
}

export function pickAnswerFromAmbiguity(
  correctAnswer: 'YES' | 'NO',
  ambiguityLevel: number,
  questionKind: string
): 'YES' | 'NO' | 'PROBABLY_YES' | 'PROBABLY_NO' | 'UNKNOWN' {
  const L = Math.max(1, Math.min(10, Math.round(ambiguityLevel)));
  if (L === 1) return correctAnswer;

  const wrongRate = 0.0133 * (L - 1);
  const correctRate = L <= 9 ? 1 - 0.1 * (L - 1) : 0.08;
  const vagueRate = 1 - correctRate - wrongRate;

  const isSoft = questionKind === 'SOFT_CONFIRM';
  const w = isSoft ? 0.5 : 1;
  const wrong = wrongRate * w;
  const vague = vagueRate * w;
  const correct = 1 - wrong - vague;

  const r = Math.random();
  if (r < correct) return correctAnswer;
  if (r < correct + wrong) return correctAnswer === 'YES' ? 'NO' : 'YES';
  const v = r - correct - wrong;
  if (v < vague * 0.75) return correctAnswer === 'YES' ? 'PROBABLY_YES' : 'PROBABLY_NO';
  if (v < vague * 0.9) return correctAnswer === 'YES' ? 'PROBABLY_NO' : 'PROBABLY_YES';
  return 'UNKNOWN';
}

// ─── Main Simulation ───

export async function runSimulation(
  targetWorkId: string,
  ambiguityLevel: number,
  aiGateChoice: string,
  config: ReturnType<typeof getMvpConfig>,
  sharedContext: SharedBatchContext,
  includePerf = false
): Promise<(SimulationResult & { perfSummary?: Record<string, number> }) | null> {
  try {
    const targetWorkBase = sharedContext.workDetailMap.get(targetWorkId);
    const targetWorkTagsRaw = sharedContext.workTagMap.get(targetWorkId);

    if (!targetWorkBase) return null;

    const targetWork = {
      ...targetWorkBase,
      title: targetWorkBase.title ?? '(不明)',
      workTags: (targetWorkTagsRaw ?? []).map(t => ({
        tagKey: t.tagKey,
        derivedConfidence: t.derivedConfidence,
        tag: { displayName: t.displayName, tagType: t.tagType },
      })),
    };

    const targetTags = new Set(targetWork.workTags.map(wt => wt.tagKey));
    const targetWorkTagsForAnswer = targetWork.workTags.map(wt => ({ displayName: wt.tag.displayName }));

    const workDetails: WorkDetails = {
      workId: targetWork.workId,
      title: targetWork.title,
      authorName: targetWork.authorName,
      isAi: targetWork.isAi,
      popularityBase: targetWork.popularityBase,
      reviewCount: targetWork.reviewCount,
      reviewAverage: targetWork.reviewAverage,
      commentText: targetWork.commentText,
      tags: targetWork.workTags.map(wt => ({
        tagKey: wt.tagKey,
        displayName: wt.tag.displayName,
        tagType: wt.tag.tagType,
        derivedConfidence: wt.derivedConfidence,
      })),
    };

    const allWorks = sharedContext.allWorks;
    const workTitleMap = sharedContext.workTitleMap;
    const workInfoMap = new Map<string, WorkInfoForConfirm>(
      allWorks.map(w => [w.workId, { title: w.title, authorName: w.authorName }])
    );

    const filteredWorks = filterWorksByAiGate(
      allWorks.map(w => ({
        workId: w.workId,
        isAi: w.isAi as 'AI' | 'HAND' | 'UNKNOWN',
      })),
      aiGateChoice as AiGateChoice
    );

    const workMap = new Map(allWorks.map(w => [w.workId, w]));
    let weights: WorkWeight[] = filteredWorks
      .filter(workId => workMap.has(workId))
      .map(workId => {
        const work = workMap.get(workId)!;
        return { workId, weight: (work.popularityBase ?? 1) + (work.popularityPlayBonus ?? 0) };
      });

    const steps: SimulationStep[] = [];
    const questionHistory: QuestionHistoryEntry[] = [];
    let questionCount = 0;
    let outcome: SimulationResult['outcome'] = 'MAX_QUESTIONS';
    let finalWorkId: string | null = null;
    let revealMissCount = 0;
    let endedBy: SimulationDiagnostic['endedBy'] = 'OTHER';
    const revealedWrongWorkIds = new Set<string>();

    const perfAcc = createPerfAccumulator(includePerf);
    await runWithPerfAccumulator(perfAcc, async () => {
    const simT = perfStart('runSimulation');
    while (true) {
      const probabilities = normalizeWeights(weights);
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const confidence = sorted[0]?.probability ?? 0;
      const topWorkId = sorted[0]?.workId ?? '';
      const effectiveCandidates = calculateEffectiveCandidates(probabilities);
      if (questionCount >= getEffectiveMaxQuestions(config.flow.maxQuestions, confidence, {
        questionHistory,
        effectiveCandidates,
        questionCount,
      })) break;

      const question = await selectNextQuestion(
        weights,
        probabilities,
        questionCount,
        questionHistory,
        config,
        { revealRejectedWorkIds: revealedWrongWorkIds.size > 0 ? [...revealedWrongWorkIds] : undefined }
      );
      if (!question) {
        endedBy = 'NO_MORE_QUESTIONS';
        const forceRevealWorkId = sorted[0]?.workId;
        if (forceRevealWorkId) {
          const revealWorkTitle = workTitleMap.get(forceRevealWorkId) ?? '(不明)';
          const isCorrect = forceRevealWorkId === targetWorkId;
          steps.push({
            qIndex: questionCount,
            question: { kind: 'REVEAL', displayText: `(強制) この作品は「${revealWorkTitle}」ですか？`, specialQuestionType: undefined, hardConfirmType: undefined },
            answer: isCorrect ? 'CORRECT' : 'WRONG',
            wasNoisy: false,
            confidenceBefore: confidence,
            confidenceAfter: confidence,
            top1WorkId: forceRevealWorkId,
            top1Probability: confidence,
            revealWorkId: forceRevealWorkId,
            revealWorkTitle,
            revealResult: isCorrect ? 'SUCCESS' : 'MISS',
          });
          outcome = isCorrect ? 'SUCCESS' : 'FAIL_LIST';
          finalWorkId = forceRevealWorkId;
        } else {
          outcome = 'FAIL_LIST';
        }
        break;
      }

      questionCount++;
      const qIndex = questionCount;

      const correctAnswer = getCorrectAnswer(
        question as Parameters<typeof getCorrectAnswer>[0],
        targetWork,
        targetTags,
        targetWorkTagsForAnswer
      );

      const baseAnswer = correctAnswer as 'YES' | 'NO';
      const actualAnswer = isNewTagQuestionForSimulation(
        question as { kind: string; tagKey?: string },
        qIndex,
        config
      )
        ? 'UNKNOWN'
        : question.kind === 'HARD_CONFIRM'
          ? baseAnswer
          : pickAnswerFromAmbiguity(baseAnswer, ambiguityLevel, question.kind);
      const wasNoisy = actualAnswer !== baseAnswer;

      let consecutiveNoCountBatch = 0;
      for (let i = questionHistory.length - 1; i >= 0; i--) {
        if (questionHistory[i]?.answer === 'NO') consecutiveNoCountBatch++;
        else break;
      }
      const consecutiveNoForAtariBatch = config.flow.consecutiveNoForAtari ?? 5;
      const preferHighPBatch = consecutiveNoCountBatch >= consecutiveNoForAtariBatch;

      questionHistory.push({
        qIndex,
        kind: question.kind,
        tagKey: question.tagKey,
        hardConfirmType: question.hardConfirmType,
        hardConfirmValue: question.hardConfirmValue,
        isSummaryQuestion: (question as { isSummaryQuestion?: boolean }).isSummaryQuestion,
        summaryQuestionId: (question as { summaryQuestionId?: string }).summaryQuestionId,
        summaryDisplayNames: (question as { summaryDisplayNames?: string[] }).summaryDisplayNames,
        answer: actualAnswer,
        exploreTagKind: (question as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
        specialQuestionType: (question as { specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' | 'TITLE_SYLLABLE_2' | 'AUTHOR_CHAR_TYPE' | 'TITLE_LENGTH_STYLE' }).specialQuestionType,
        seriesTagKeys: (question as { seriesTagKeys?: string[] }).seriesTagKeys,
        titleCharType: (question as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType,
        popularityThreshold: (question as { popularityThreshold?: number }).popularityThreshold,
        syllableChars: (question as { syllableChars?: string[] }).syllableChars,
        authorCharType: (question as { authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA' }).authorCharType,
        titleLengthYesMin: (question as { titleLengthYesMin?: number }).titleLengthYesMin,
        titleLengthNoMax: (question as { titleLengthNoMax?: number }).titleLengthNoMax,
      });

      let tagCoverage: number | undefined;
      if (question.tagKey) {
        const tagCovT = perfStart('tagCoverage');
        const workIds = weights.map(w => w.workId);
        const tagWorkIds = new Set(getWorkTagsFromMatrix(workIds, { tagKeys: [question.tagKey] }).map(wt => wt.workId));
        tagCoverage = probabilities
          .filter(p => tagWorkIds.has(p.workId))
          .reduce((sum, p) => sum + p.probability, 0);
        perfEnd('tagCoverage', tagCovT);
      }

      weights = await processAnswer(weights, question, actualAnswer, config, { workInfoMap });

      const newProbabilities = normalizeWeights(weights);
      const newSorted = [...newProbabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const newConfidence = newSorted[0]?.probability ?? 0;

      const q = question as { tagKey?: string; displayText: string; kind: string; hardConfirmType?: string; hardConfirmValue?: string; exploreTagKind?: string; specialQuestionType?: string; titleCharType?: string; authorCharType?: string; syllableChars?: string[]; titleSyllableRangeId?: string; titleSyllable2RangeId?: string; titleSyllable2Branch?: 'yesBranch' | 'noBranch' };
      const syllableChars = q.kind === 'SPECIAL_QUESTION' ? q.syllableChars : undefined;
      const rangeId = q.kind === 'SPECIAL_QUESTION' && q.titleSyllableRangeId
        ? q.titleSyllableRangeId
        : syllableChars?.length
          ? (() => {
              const ranges = getTitleSyllableRanges();
              const charSet = new Set(syllableChars);
              for (const r of ranges) {
                const rSet = new Set(r.chars ?? []);
                if (rSet.size > 0 && rSet.size === charSet.size && [...rSet].every((c: string) => charSet.has(c))) {
                  return r.id ?? undefined;
                }
              }
              return undefined;
            })()
          : undefined;
      steps.push({
        qIndex,
        question: {
          kind: q.kind,
          displayText: q.displayText,
          tagKey: q.tagKey,
          hardConfirmType: q.hardConfirmType,
          hardConfirmValue: q.hardConfirmValue,
          exploreTagKind: q.kind === 'EXPLORE_TAG' ? (q.exploreTagKind as 'summary' | 'erotic' | 'abstract' | 'normal' | undefined) : undefined,
          specialQuestionType: q.kind === 'SPECIAL_QUESTION' ? q.specialQuestionType : undefined,
          titleCharType: q.kind === 'SPECIAL_QUESTION' ? q.titleCharType : undefined,
          authorCharType: q.kind === 'SPECIAL_QUESTION' ? q.authorCharType : undefined,
          titleSyllableRangeId: rangeId,
          titleSyllable2RangeId: q.kind === 'SPECIAL_QUESTION' ? q.titleSyllable2RangeId : undefined,
          titleSyllable2Branch: q.kind === 'SPECIAL_QUESTION' ? q.titleSyllable2Branch : undefined,
        },
        answer: actualAnswer,
        wasNoisy,
        confidenceBefore: confidence,
        confidenceAfter: newConfidence,
        top1WorkId: topWorkId,
        top1Probability: confidence,
        tagCoverage,
        effectiveCandidates: calculateEffectiveCandidates(probabilities),
        preferHighP: question.kind === 'EXPLORE_TAG' ? preferHighPBatch : undefined,
        earlyExit: getEarlyExitStepSnapshot(
          questionCount,
          newConfidence,
          calculateEffectiveCandidates(newProbabilities),
          questionHistory,
          config
        ),
      });

      const revealThreshold = getRevealThresholdForQuestion(questionCount - 1, config.confirm.revealThreshold);
      if (newConfidence >= revealThreshold) {
        const revealWorkId = newSorted.find(p => !revealedWrongWorkIds.has(p.workId))?.workId ?? null;
        if (revealWorkId) {
          const revealWorkTitle = workTitleMap.get(revealWorkId) ?? '(不明)';
          const isCorrect = revealWorkId === targetWorkId;
          steps.push({
            qIndex: questionCount,
            question: {
              kind: 'REVEAL',
              displayText: `断定: この作品は「${revealWorkTitle}」ですか？`,
              specialQuestionType: undefined,
              hardConfirmType: undefined,
            },
            answer: isCorrect ? 'CORRECT' : 'WRONG',
            wasNoisy: false,
            confidenceBefore: newConfidence,
            confidenceAfter: newConfidence,
            top1WorkId: revealWorkId,
            top1Probability: newConfidence,
            revealWorkId,
            revealWorkTitle,
            revealResult: isCorrect ? 'SUCCESS' : 'MISS',
            effectiveCandidates: calculateEffectiveCandidates(newProbabilities),
          });
          if (isCorrect) {
            endedBy = 'REVEAL';
            outcome = 'SUCCESS';
            finalWorkId = revealWorkId;
            break;
          } else {
            revealedWrongWorkIds.add(revealWorkId);
            revealMissCount++;
            if (revealMissCount >= config.flow.maxRevealMisses) {
              endedBy = 'REVEAL';
              outcome = 'FAIL_LIST';
              finalWorkId = revealWorkId;
              break;
            }
            weights = weights.map(w => ({
              workId: w.workId,
              weight: w.workId === revealWorkId ? w.weight * config.algo.revealPenalty : w.weight,
            }));
          }
        }
      }
      const earlyFailSim = evaluateSimulationEarlyExitAfterQuizAnswer({
        newConfidence,
        revealThreshold,
        revealMissCount,
        maxRevealMisses: config.flow.maxRevealMisses as number,
        questionCountAfterThisAnswer: questionCount,
        effectiveCandidatesAfter: calculateEffectiveCandidates(newProbabilities),
        questionHistory,
        config,
        newSorted,
        revealedWrongWorkIds,
      });
      if (earlyFailSim.stop) {
        endedBy = earlyFailSim.endedBy;
        outcome = 'FAIL_LIST';
        finalWorkId = earlyFailSim.finalWorkId;
        break;
      }
    }

    perfEnd('runSimulation', simT);
    });

    if (outcome === 'MAX_QUESTIONS' && questionCount >= config.flow.maxQuestions) {
      endedBy = 'MAX_QUESTIONS';
      const finalProbs = normalizeWeights(weights);
      const finalSorted = [...finalProbs].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const forceRevealId = finalSorted.find(p => !revealedWrongWorkIds.has(p.workId))?.workId ?? finalSorted[0]?.workId;
      const forceRevealConf = finalSorted.find(p => p.workId === forceRevealId)?.probability ?? finalSorted[0]?.probability ?? 0;
      if (forceRevealId) {
        const revealWorkTitle = workTitleMap.get(forceRevealId) ?? '(不明)';
        const isCorrect = forceRevealId === targetWorkId;
        steps.push({
          qIndex: questionCount,
          question: { kind: 'REVEAL', displayText: `(maxQuestions強制) この作品は「${revealWorkTitle}」ですか？`, specialQuestionType: undefined, hardConfirmType: undefined },
          answer: isCorrect ? 'CORRECT' : 'WRONG',
          wasNoisy: false,
          confidenceBefore: forceRevealConf,
          confidenceAfter: forceRevealConf,
          top1WorkId: forceRevealId,
          top1Probability: forceRevealConf,
          revealWorkId: forceRevealId,
          revealWorkTitle,
          revealResult: isCorrect ? 'SUCCESS' : 'MISS',
          effectiveCandidates: calculateEffectiveCandidates(finalProbs),
        });
        outcome = isCorrect ? 'SUCCESS' : 'MAX_QUESTIONS';
        finalWorkId = forceRevealId;
      }
    }

    const finalProbsDiag = normalizeWeights(weights);
    const sortedDiag = [...finalProbsDiag].sort((a, b) => {
      if (a.probability !== b.probability) return b.probability - a.probability;
      return a.workId.localeCompare(b.workId);
    });
    const correctRankIdx = sortedDiag.findIndex(p => p.workId === targetWorkId);
    const diagnostic: SimulationDiagnostic = {
      endedBy,
      correctRank: correctRankIdx === -1 ? -1 : correctRankIdx + 1,
      correctStillInCandidates: weights.some(w => w.workId === targetWorkId),
      top1Confidence: sortedDiag[0]?.probability ?? 0,
      candidatesCount: weights.length,
    };

    let finalWorkTitle: string | null = null;
    if (finalWorkId) {
      finalWorkTitle = workTitleMap.get(finalWorkId) ?? null;
    }

    const noisySteps = steps.filter(s => s.wasNoisy);
    const firstNoisyIdx = noisySteps.length > 0 ? steps.findIndex(s => s.wasNoisy) : -1;
    const analysisData: SimulationAnalysisData = {
      wasNoisyCount: noisySteps.length,
      firstNoisyStepIndex: firstNoisyIdx,
      noisyStepIndices: steps.filter(s => s.wasNoisy).map(s => s.qIndex),
      correctRank: diagnostic.correctRank,
      top1Confidence: diagnostic.top1Confidence,
      totalQuestions: questionCount,
      noisyRatio: questionCount > 0 ? noisySteps.length / questionCount : 0,
    };

    const perfSummary = toPerfSummary(perfAcc);
    return {
      success: outcome === 'SUCCESS',
      targetWorkId,
      targetWorkTitle: targetWork.title,
      finalWorkId,
      finalWorkTitle,
      questionCount,
      steps,
      outcome,
      diagnostic,
      analysisData,
      workDetails,
      ...(perfSummary && { perfSummary }),
    };
  } catch (error) {
    console.error('Error in runSimulation:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      targetWorkId,
      targetWorkTitle: '(実行エラー)',
      finalWorkId: null,
      finalWorkTitle: null,
      questionCount: 0,
      steps: [],
      outcome: 'ERROR',
      errorMessage: message,
    };
  }
}
