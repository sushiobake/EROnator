/**
 * /api/admin/play-history-replay: 保存済み questionHistory を現在のDB・設定で再計算し、
 * 各ステップの p値・確度 を返す（詳細モーダル表示用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { getMvpConfig } from '@/server/config/loader';
import { filterWorksByAiGate, initializeWeights, processAnswer } from '@/server/game/engine';
import { normalizeWeights, calculateEffectiveCandidates } from '@/server/algo/scoring';
import { normalizeTitleForInitial } from '@/server/utils/normalizeTitle';
import { getTitleCharType } from '@/server/utils/titleCharType';
import { getAuthorCharType } from '@/server/utils/authorCharType';
import type { WorkWeight, WorkProbability } from '@/server/algo/types';
import type { QuestionHistoryEntry } from '@/server/session/manager';
import type { QuestionData } from '@/server/game/engine';
import type { AiGateChoice } from '@/server/algo/types';

export interface ReplayStep {
  qIndex: number;
  kind: string;
  displayText?: string;
  answer?: string;
  exploreTagKind?: string;
  specialQuestionType?: string;
  tagCoverage?: number;
  confidenceBefore?: number;
  confidenceAfter?: number;
  wasNoisy: boolean;
  durationSeconds?: number;
  missType?: 'clear' | 'weak';
  revealWorkId?: string;
  revealWorkTitle?: string;
  revealResult?: 'SUCCESS' | 'MISS';
  /** 分析対象作品の順位（1始まり）。質問後の分布基準は After */
  targetWorkRankBefore?: number | null;
  targetWorkRankAfter?: number | null;
  targetWorkProbabilityBefore?: number | null;
  targetWorkProbabilityAfter?: number | null;
  effectiveCandidatesBefore?: number | null;
  effectiveCandidatesAfter?: number | null;
}

export interface ReplayMeta {
  analysisTargetWorkId: string | null;
  analysisTargetTitle: string | null;
  /** リプレイの重み集合（gameRegistered+aiGate 後）に含まれるか */
  analysisTargetInPool: boolean;
  /** DB上の gameRegistered（プール外でも参照用） */
  analysisTargetGameRegistered: boolean | null;
  /** UI 用: active = ゲーム登録, reserve = 未登録 */
  analysisTargetSource: 'active' | 'reserve' | null;
}

type TargetWorkRow = {
  title: string | null;
  authorName: string | null;
  popularityBase: number | null;
  titleReadingInitial: string | null;
  gameRegistered: boolean | null;
};

function rankTargetInProbabilities(
  probabilities: WorkProbability[],
  targetWorkId: string | null
): { rank: number | null; probability: number | null } {
  if (!targetWorkId) return { rank: null, probability: null };
  const sorted = [...probabilities].sort((a, b) => {
    if (a.probability !== b.probability) return b.probability - a.probability;
    return a.workId.localeCompare(b.workId);
  });
  const row = sorted.find((p) => p.workId === targetWorkId);
  if (!row) return { rank: null, probability: null };
  return { rank: sorted.indexOf(row) + 1, probability: row.probability };
}

/** 正解（分析対象）作品に基づく期待回答 */
function getCorrectAnswerForEntry(
  entry: QuestionHistoryEntry,
  targetWork: TargetWorkRow,
  targetTagKeys: Set<string>,
  targetWorkTagDisplayNames: { displayName: string }[]
): 'YES' | 'NO' | null {
  if (entry.kind === 'NEW_TAG_QUESTION' && entry.tagKey) {
    return targetTagKeys.has(entry.tagKey) ? 'YES' : 'NO';
  }
  if (entry.kind === 'NOISE_GUIDE_RECOMMEND') {
    return null;
  }
  if (entry.kind === 'EXPLORE_TAG' || entry.kind === 'SOFT_CONFIRM') {
    const summaryDisplayNames = entry.summaryDisplayNames;
    const isSummary = !!(summaryDisplayNames?.length);
    let hasTag: boolean;
    if (isSummary && summaryDisplayNames?.length) {
      const targetSet = new Set(targetWorkTagDisplayNames.map((t) => t.displayName));
      hasTag = summaryDisplayNames.some((d) => targetSet.has(d));
    } else if (entry.tagKey) {
      hasTag = targetTagKeys.has(entry.tagKey);
    } else {
      return null;
    }
    return hasTag ? 'YES' : 'NO';
  }
  if (entry.kind === 'HARD_CONFIRM') {
    if (entry.hardConfirmType === 'TITLE_INITIAL') {
      const targetInitial = normalizeTitleForInitial(targetWork.title ?? '');
      const qInitial = entry.hardConfirmValue ?? '';
      return targetInitial === qInitial ? 'YES' : 'NO';
    }
    if (entry.hardConfirmType === 'CHARACTER' && entry.hardConfirmValue) {
      return targetTagKeys.has(entry.hardConfirmValue) ? 'YES' : 'NO';
    }
    return (targetWork.authorName ?? '') === entry.hardConfirmValue ? 'YES' : 'NO';
  }
  if (entry.kind === 'SPECIAL_QUESTION' && entry.specialQuestionType === 'SERIES') {
    const seriesTagKeys = entry.seriesTagKeys ?? ['off_e1f6b6c9ce', 'off_ad42c1ba79'];
    const hasSeries = seriesTagKeys.some((tk) => targetTagKeys.has(tk));
    return hasSeries ? 'YES' : 'NO';
  }
  if (entry.kind === 'SPECIAL_QUESTION' && entry.specialQuestionType === 'TITLE_CHAR_TYPE') {
    const targetCharType = getTitleCharType(targetWork.title ?? '');
    const expectedCharType = entry.titleCharType ?? 'KANJI';
    const matches =
      expectedCharType === 'HIRAGANA_OR_KATAKANA'
        ? targetCharType === 'HIRAGANA' || targetCharType === 'KATAKANA'
        : targetCharType === expectedCharType;
    return matches ? 'YES' : 'NO';
  }
  if (entry.kind === 'SPECIAL_QUESTION' && entry.specialQuestionType === 'TITLE_LENGTH_STYLE') {
    const len = (targetWork.title ?? '').length;
    const yesMin = entry.titleLengthYesMin ?? 10;
    return len >= yesMin ? 'YES' : 'NO';
  }
  if (entry.kind === 'SPECIAL_QUESTION' && entry.specialQuestionType === 'POPULARITY') {
    const th = entry.popularityThreshold ?? 30;
    const base = targetWork.popularityBase ?? 0;
    return base >= th ? 'YES' : 'NO';
  }
  if (
    entry.kind === 'SPECIAL_QUESTION' &&
    (entry.specialQuestionType === 'TITLE_SYLLABLE' || entry.specialQuestionType === 'TITLE_SYLLABLE_2')
  ) {
    const initial = (targetWork.titleReadingInitial ?? '').trim()[0] ?? '';
    const chars = entry.syllableChars ?? [];
    if (!initial || chars.length === 0) return null;
    return chars.includes(initial) ? 'YES' : 'NO';
  }
  if (entry.kind === 'SPECIAL_QUESTION' && entry.specialQuestionType === 'AUTHOR_CHAR_TYPE') {
    const ct = getAuthorCharType(targetWork.authorName ?? '');
    const expected = entry.authorCharType;
    if (expected === 'HIRAGANA_OR_KATAKANA') {
      return ct === 'HIRAGANA' || ct === 'KATAKANA' ? 'YES' : 'NO';
    }
    if (expected === 'KANJI_OR_ALPHA') {
      return ct === 'KANJI' || ct === 'ALPHA' ? 'YES' : 'NO';
    }
    return null;
  }
  return null;
}

function getMissType(userAnswer: string | undefined, correctAnswer: 'YES' | 'NO'): 'clear' | 'weak' | null {
  if (!userAnswer) return null;
  const u = userAnswer;
  if (correctAnswer === 'YES') {
    if (u === 'NO') return 'clear';
    if (u === 'PROBABLY_NO') return 'weak';
    return null;
  }
  if (correctAnswer === 'NO') {
    if (u === 'YES') return 'clear';
    if (u === 'PROBABLY_YES') return 'weak';
    return null;
  }
  return null;
}

function historyEntryToQuestionData(entry: QuestionHistoryEntry): QuestionData {
  return {
    kind: entry.kind,
    displayText: entry.displayText ?? '',
    tagKey: entry.tagKey,
    newTagVariantId: entry.newTagVariantId,
    hardConfirmType: entry.hardConfirmType,
    hardConfirmValue: entry.hardConfirmValue,
    isSummaryQuestion: entry.isSummaryQuestion,
    summaryQuestionId: entry.summaryQuestionId,
    summaryDisplayNames: entry.summaryDisplayNames,
    exploreTagKind: entry.exploreTagKind,
    specialQuestionType: entry.specialQuestionType,
    seriesTagKeys: entry.seriesTagKeys,
    titleCharType: entry.titleCharType,
    popularityThreshold: entry.popularityThreshold,
    syllableChars: entry.syllableChars,
    authorCharType: entry.authorCharType,
    titleLengthYesMin: entry.titleLengthYesMin,
    titleLengthNoMax: entry.titleLengthNoMax,
    revealWorkId: entry.revealWorkId,
    revealWorkTitle: entry.revealWorkTitle,
    revealResult: entry.revealResult,
  };
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const questionHistory = body.questionHistory as QuestionHistoryEntry[] | undefined;
    const aiGateChoice = (body.aiGateChoice ?? null) as AiGateChoice | null;
    const outcome = (body.outcome ?? null) as string | null;
    const resultWorkId = (body.resultWorkId ?? null) as string | null;
    const explicitAnalysisId =
      typeof body.analysisTargetWorkId === 'string' && body.analysisTargetWorkId.trim()
        ? body.analysisTargetWorkId.trim()
        : null;

    if (!Array.isArray(questionHistory) || questionHistory.length === 0) {
      return NextResponse.json({
        success: true,
        steps: [] as ReplayStep[],
        meta: {
          analysisTargetWorkId: null,
          analysisTargetTitle: null,
          analysisTargetInPool: false,
          analysisTargetGameRegistered: null,
          analysisTargetSource: null,
        } satisfies ReplayMeta,
      });
    }

    const config = getMvpConfig();

    const resolvedAnalysisId =
      explicitAnalysisId ||
      ((outcome === 'SUCCESS' || outcome === 'ALMOST_SUCCESS') && resultWorkId ? resultWorkId : null) ||
      null;

    let targetWorkRow: TargetWorkRow | null = null;
    let correctTagKeys = new Set<string>();
    let correctWorkTagDisplayNames: { displayName: string }[] = [];

    if (resolvedAnalysisId) {
      const work = await prisma.work.findUnique({
        where: { workId: resolvedAnalysisId },
        select: {
          title: true,
          authorName: true,
          popularityBase: true,
          titleReadingInitial: true,
          gameRegistered: true,
          workTags: { select: { tagKey: true, tag: { select: { displayName: true } } } },
        },
      });
      if (work) {
        targetWorkRow = {
          title: work.title,
          authorName: work.authorName,
          popularityBase: work.popularityBase,
          titleReadingInitial: work.titleReadingInitial,
          gameRegistered: work.gameRegistered,
        };
        correctTagKeys = new Set(work.workTags.map((wt) => wt.tagKey));
        correctWorkTagDisplayNames = work.workTags.map((wt) => ({ displayName: wt.tag.displayName }));
      }
    }

    const allWorks = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: {
        workId: true,
        isAi: true,
        popularityBase: true,
        popularityPlayBonus: true,
      },
    });

    const filteredWorkIds = filterWorksByAiGate(
      allWorks.map((w) => ({
        workId: w.workId,
        isAi: w.isAi as 'AI' | 'HAND' | 'UNKNOWN',
      })),
      aiGateChoice ?? 'DONT_CARE'
    );

    const poolSet = new Set(filteredWorkIds);
    const analysisTargetInPool = resolvedAnalysisId ? poolSet.has(resolvedAnalysisId) : false;

    let weights: WorkWeight[] = await initializeWeights(filteredWorkIds, config.algo.alpha);

    const sortedEntries = [...questionHistory].sort((a, b) => (a.qIndex ?? 0) - (b.qIndex ?? 0));
    const steps: ReplayStep[] = [];

    for (const entry of sortedEntries) {
      const entryKind = (entry as { kind?: string }).kind;
      if (entryKind === 'REVEAL') {
        const probs = normalizeWeights(weights);
        const sortedTop = [...probs].sort((a, b) => {
          if (a.probability !== b.probability) return b.probability - a.probability;
          return a.workId.localeCompare(b.workId);
        });
        const topProb = sortedTop[0]?.probability ?? 0;
        const eff = calculateEffectiveCandidates(probs);
        const e = entry as QuestionHistoryEntry & {
          revealResult?: string;
          revealWorkId?: string;
          revealWorkTitle?: string;
        };
        const tBefore = rankTargetInProbabilities(probs, resolvedAnalysisId);
        steps.push({
          qIndex: entry.qIndex ?? steps.length + 1,
          kind: 'REVEAL',
          displayText: entry.displayText,
          answer: entry.answer,
          tagCoverage: undefined,
          confidenceBefore: topProb,
          confidenceAfter: topProb,
          wasNoisy: false,
          ...(entry.durationSeconds != null && { durationSeconds: entry.durationSeconds }),
          revealResult: (e.revealResult as 'SUCCESS' | 'MISS') ?? 'SUCCESS',
          revealWorkId: e.revealWorkId,
          revealWorkTitle: e.revealWorkTitle,
          targetWorkRankBefore: tBefore.rank,
          targetWorkRankAfter: tBefore.rank,
          targetWorkProbabilityBefore: tBefore.probability,
          targetWorkProbabilityAfter: tBefore.probability,
          effectiveCandidatesBefore: eff,
          effectiveCandidatesAfter: eff,
        });
        continue;
      }

      const probabilities = normalizeWeights(weights);
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const confidenceBefore = sorted[0]?.probability ?? 0;
      const effBefore = calculateEffectiveCandidates(probabilities);
      const tBefore = rankTargetInProbabilities(probabilities, resolvedAnalysisId);

      let tagCoverage: number | undefined;
      const question = historyEntryToQuestionData(entry);
      if (question.tagKey) {
        const workIdsWithTag = await prisma.workTag.findMany({
          where: {
            tagKey: question.tagKey,
            workId: { in: weights.map((w) => w.workId) },
          },
          select: { workId: true },
        });
        const tagWorkIds = new Set(workIdsWithTag.map((wt) => wt.workId));
        tagCoverage = probabilities.filter((p) => tagWorkIds.has(p.workId)).reduce((sum, p) => sum + p.probability, 0);
      }

      const answerChoice =
        entry.answer && ['YES', 'NO', 'PROBABLY_YES', 'PROBABLY_NO', 'UNKNOWN', 'DONT_CARE'].includes(entry.answer)
          ? entry.answer
          : entry.answer === 'YES'
            ? 'YES'
            : entry.answer === 'NO'
              ? 'NO'
              : 'DONT_CARE';
      weights = await processAnswer(weights, question, answerChoice, config);

      const newProbabilities = normalizeWeights(weights);
      const newSorted = [...newProbabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const confidenceAfter = newSorted[0]?.probability ?? 0;
      const effAfter = calculateEffectiveCandidates(newProbabilities);
      const tAfter = rankTargetInProbabilities(newProbabilities, resolvedAnalysisId);

      let missType: 'clear' | 'weak' | undefined;
      if (
        targetWorkRow &&
        (entry.kind === 'EXPLORE_TAG' ||
          entry.kind === 'SOFT_CONFIRM' ||
          entry.kind === 'HARD_CONFIRM' ||
          entry.kind === 'SPECIAL_QUESTION' ||
          entry.kind === 'NEW_TAG_QUESTION')
      ) {
        const correctAnswer = getCorrectAnswerForEntry(entry, targetWorkRow, correctTagKeys, correctWorkTagDisplayNames);
        if (correctAnswer) {
          const mt = getMissType(entry.answer, correctAnswer);
          if (mt) missType = mt;
        }
      }

      steps.push({
        qIndex: entry.qIndex ?? steps.length + 1,
        kind: entry.kind,
        displayText: entry.displayText,
        answer: entry.answer,
        exploreTagKind: entry.exploreTagKind,
        specialQuestionType: entry.specialQuestionType,
        tagCoverage,
        confidenceBefore,
        confidenceAfter,
        wasNoisy: false,
        ...(entry.durationSeconds != null && { durationSeconds: entry.durationSeconds }),
        ...(missType && { missType }),
        targetWorkRankBefore: tBefore.rank,
        targetWorkRankAfter: tAfter.rank,
        targetWorkProbabilityBefore: tBefore.probability,
        targetWorkProbabilityAfter: tAfter.probability,
        effectiveCandidatesBefore: effBefore,
        effectiveCandidatesAfter: effAfter,
      });
    }

    const revealThreshold = config.confirm?.revealThreshold ?? 0.6;
    const finalProbs = normalizeWeights(weights);
    const finalSorted = [...finalProbs].sort((a, b) => {
      if (a.probability !== b.probability) return b.probability - a.probability;
      return a.workId.localeCompare(b.workId);
    });
    const finalConfidence = finalSorted[0]?.probability ?? 0;
    const topWorkId = finalSorted[0]?.workId;
    const hasStoredReveal = sortedEntries.some((e) => (e as { kind?: string }).kind === 'REVEAL');
    if (!hasStoredReveal && finalConfidence >= revealThreshold && topWorkId) {
      const topWork = await prisma.work.findUnique({
        where: { workId: topWorkId },
        select: { title: true },
      });
      const revealResult = outcome === 'SUCCESS' ? 'SUCCESS' : 'MISS';
      const tFin = rankTargetInProbabilities(finalProbs, resolvedAnalysisId);
      const effFin = calculateEffectiveCandidates(finalProbs);
      steps.push({
        qIndex: steps.length + 1,
        kind: 'REVEAL',
        displayText: `断定: この作品は「${topWork?.title ?? topWorkId}」ですか？`,
        answer: outcome === 'SUCCESS' ? 'CORRECT' : 'WRONG',
        tagCoverage: undefined,
        confidenceBefore: finalConfidence,
        confidenceAfter: finalConfidence,
        wasNoisy: false,
        revealWorkId: topWorkId,
        revealWorkTitle: topWork?.title ?? undefined,
        revealResult,
        targetWorkRankBefore: tFin.rank,
        targetWorkRankAfter: tFin.rank,
        targetWorkProbabilityBefore: tFin.probability,
        targetWorkProbabilityAfter: tFin.probability,
        effectiveCandidatesBefore: effFin,
        effectiveCandidatesAfter: effFin,
      });
    }

    const meta: ReplayMeta = {
      analysisTargetWorkId: resolvedAnalysisId,
      analysisTargetTitle: targetWorkRow?.title ?? null,
      analysisTargetInPool,
      analysisTargetGameRegistered: targetWorkRow ? targetWorkRow.gameRegistered : null,
      analysisTargetSource:
        targetWorkRow == null
          ? null
          : targetWorkRow.gameRegistered === true
            ? 'active'
            : targetWorkRow.gameRegistered === false
              ? 'reserve'
              : null,
    };

    return NextResponse.json({
      success: true,
      steps,
      meta,
    });
  } catch (e) {
    console.error('[admin/play-history-replay]', e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
