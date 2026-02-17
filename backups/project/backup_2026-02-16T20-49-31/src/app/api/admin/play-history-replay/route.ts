/**
 * /api/admin/play-history-replay: 保存済み questionHistory を現在のDB・設定で再計算し、
 * 各ステップの p値・確度 を返す（詳細モーダル表示用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { getMvpConfig } from '@/server/config/loader';
import { filterWorksByAiGate, initializeWeights, processAnswer } from '@/server/game/engine';
import { normalizeWeights } from '@/server/algo/scoring';
import { normalizeTitleForInitial } from '@/server/utils/normalizeTitle';
import type { WorkWeight } from '@/server/algo/types';
import type { QuestionHistoryEntry } from '@/server/session/manager';
import type { QuestionData } from '@/server/game/engine';
import type { AiGateChoice } from '@/server/algo/types';

export interface ReplayStep {
  qIndex: number;
  kind: string;
  displayText?: string;
  answer?: string;
  exploreTagKind?: string;
  tagCoverage?: number;
  confidenceBefore?: number;
  confidenceAfter?: number;
  wasNoisy: boolean;
  /** SUCCESS 時のみ: 正解と逆の回答だったか。clear=明確な逆(はい⇔いいえ), weak=たぶんの逆 */
  missType?: 'clear' | 'weak';
  /** REVEAL 時のみ */
  revealWorkId?: string;
  revealWorkTitle?: string;
  revealResult?: 'SUCCESS' | 'MISS';
}

/** 正解作品に基づく正答（SUCCESS 時のミス判定用） */
function getCorrectAnswerForEntry(
  entry: QuestionHistoryEntry,
  targetWork: { title: string | null; authorName: string | null },
  targetTagKeys: Set<string>,
  targetWorkTagDisplayNames: { displayName: string }[]
): 'YES' | 'NO' | null {
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
    return (targetWork.authorName ?? '') === entry.hardConfirmValue ? 'YES' : 'NO';
  }
  return null;
}

/** ユーザー回答と正解を比較し、ミス種別を返す。SUCCESS 時のみ使用 */
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
    hardConfirmType: entry.hardConfirmType,
    hardConfirmValue: entry.hardConfirmValue,
    isSummaryQuestion: entry.isSummaryQuestion,
    summaryQuestionId: entry.summaryQuestionId,
    summaryDisplayNames: entry.summaryDisplayNames,
    exploreTagKind: entry.exploreTagKind,
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

    if (!Array.isArray(questionHistory) || questionHistory.length === 0) {
      return NextResponse.json({
        success: true,
        steps: [] as ReplayStep[],
      });
    }

    const config = getMvpConfig();

    // SUCCESS 時のみ: 正解作品を読み込み、ミス判定用のタグ・表示名を用意
    let correctWorkForMiss: { title: string | null; authorName: string | null } | null = null;
    let correctTagKeys = new Set<string>();
    let correctWorkTagDisplayNames: { displayName: string }[] = [];
    if (outcome === 'SUCCESS' && resultWorkId) {
      const work = await prisma.work.findUnique({
        where: { workId: resultWorkId },
        select: { title: true, authorName: true, workTags: { select: { tagKey: true, tag: { select: { displayName: true } } } } },
      });
      if (work) {
        correctWorkForMiss = { title: work.title, authorName: work.authorName };
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

    let weights: WorkWeight[] = await initializeWeights(
      filteredWorkIds,
      config.algo.alpha
    );

    const sortedEntries = [...questionHistory].sort(
      (a, b) => (a.qIndex ?? 0) - (b.qIndex ?? 0)
    );
    const steps: ReplayStep[] = [];

    for (const entry of sortedEntries) {
      const probabilities = normalizeWeights(weights);
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const confidenceBefore = sorted[0]?.probability ?? 0;

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
        tagCoverage = probabilities
          .filter((p) => tagWorkIds.has(p.workId))
          .reduce((sum, p) => sum + p.probability, 0);
      }

      const answerChoice = (entry.answer && ['YES', 'NO', 'PROBABLY_YES', 'PROBABLY_NO', 'UNKNOWN', 'DONT_CARE'].includes(entry.answer))
        ? entry.answer
        : (entry.answer === 'YES' ? 'YES' : entry.answer === 'NO' ? 'NO' : 'DONT_CARE');
      weights = await processAnswer(weights, question, answerChoice, config);

      const newProbabilities = normalizeWeights(weights);
      const newSorted = [...newProbabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const confidenceAfter = newSorted[0]?.probability ?? 0;

      let missType: 'clear' | 'weak' | undefined;
      if (correctWorkForMiss && (entry.kind === 'EXPLORE_TAG' || entry.kind === 'SOFT_CONFIRM' || entry.kind === 'HARD_CONFIRM')) {
        const correctAnswer = getCorrectAnswerForEntry(entry, correctWorkForMiss, correctTagKeys, correctWorkTagDisplayNames);
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
        tagCoverage,
        confidenceBefore,
        confidenceAfter,
        wasNoisy: false,
        ...(missType && { missType }),
      });
    }

    // 最後の確度が閾値以上なら REVEAL ステップを1件追加（断定した作品・当たり外れを表示用）
    const revealThreshold = config.confirm?.revealThreshold ?? 0.6;
    const finalProbs = normalizeWeights(weights);
    const finalSorted = [...finalProbs].sort((a, b) => {
      if (a.probability !== b.probability) return b.probability - a.probability;
      return a.workId.localeCompare(b.workId);
    });
    const finalConfidence = finalSorted[0]?.probability ?? 0;
    const topWorkId = finalSorted[0]?.workId;
    if (finalConfidence >= revealThreshold && topWorkId) {
      const topWork = await prisma.work.findUnique({
        where: { workId: topWorkId },
        select: { title: true },
      });
      const revealResult = outcome === 'SUCCESS' ? 'SUCCESS' : 'MISS';
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
      });
    }

    return NextResponse.json({
      success: true,
      steps,
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
