/**
 * /api/admin/simulate: シミュレーション実行API
 *
 * 指定した作品を「正解」として、自動回答でゲームをシミュレーション
 * 曖昧さレベル（1-10）に応じて PROBABLY / 逆回答 / UNKNOWN を混ぜる
 * 後方互換: noiseRate / noiseRates も受け付ける
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { isSqlite } from '@/server/db/is-sqlite';
import { getMvpConfig } from '@/server/config/loader';
import { getRevealThresholdForQuestion, getEffectiveMaxQuestions } from '@/server/config/flowUtils';
import { selectNextQuestion, processAnswer, filterWorksByAiGate, setSimWorkDataMap, type WorkInfoForConfirm, type SimWorkData } from '@/server/game/engine';
import { getWorkTagMatrix, getWorkTagsFromMatrix } from '@/server/game/workTagMatrixLoader';
import { ensureTagCacheLoaded, getAllCachedTags } from '@/server/game/tagCacheLoader';
import {
  perfStart,
  perfEnd,
  createPerfAccumulator,
  runWithPerfAccumulator,
  toPerfSummary,
} from '@/server/simulationPerf';
import { normalizeWeights, calculateConfidence, calculateEffectiveCandidates } from '@/server/algo/scoring';
import { normalizeTitleForInitial } from '@/server/utils/normalizeTitle';
import { getTitleCharType, getTitleReadingInitialFromTitle } from '@/server/utils/titleCharType';
import { getTitleReadingInitials } from '@/server/utils/titleReadingInitial';
import { getAuthorCharType } from '@/server/utils/authorCharType';
import type { WorkWeight, AiGateChoice } from '@/server/algo/types';
import type { QuestionHistoryEntry } from '@/server/session/manager';
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { cpus } from 'os';
import { setSimProgress, clearSimProgress } from '@/server/bulk/progressStore';

interface SimulationStep {
  qIndex: number;
  question: {
    kind: string;
    displayText: string;
    tagKey?: string;
    hardConfirmType?: string;
    hardConfirmValue?: string;
    exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal';
    specialQuestionType?: string;
  };
  answer: string;
  wasNoisy: boolean; // ノイズで間違えたか
  confidenceBefore: number;
  confidenceAfter: number;
  top1WorkId: string;
  top1Probability: number;
  // タグの確率ベースカバレッジ（p値）- デバッグ用
  tagCoverage?: number; // p = Σ P(w) for works that have the tag
  // REVEAL用追加フィールド
  revealWorkId?: string;
  revealWorkTitle?: string;
  revealResult?: 'SUCCESS' | 'MISS';
  // デバッグ・分析用
  effectiveCandidates?: number;
  preferHighP?: boolean; // 当たり狙いで選ばれたか
}

interface WorkDetails {
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

/** Task A: 失敗型の切り分け用（(1)終了条件 (2)誤排除 (3)収束しない） */
export interface SimulationDiagnostic {
  endedBy: 'REVEAL' | 'MAX_QUESTIONS' | 'NO_MORE_QUESTIONS' | 'OTHER';
  correctRank: number; // 正解の順位（1-based、候補にいなければ -1）
  correctStillInCandidates: boolean;
  top1Confidence: number;
  candidatesCount: number;
}

/** 分析用データ（JSON保存・分析表示用） */
export interface SimulationAnalysisData {
  wasNoisyCount: number;
  firstNoisyStepIndex: number; // 0-based、ノイズなしなら -1
  noisyStepIndices: number[]; // wasNoisy だった step の qIndex 一覧
  correctRank: number; // diagnostic と同じ（分析用に重複）
  top1Confidence: number; // diagnostic と同じ（分析用に重複）
  totalQuestions: number; // questionCount（分析用に重複）
  noisyRatio: number; // wasNoisyCount / totalQuestions（0〜1）
}

interface SimulationResult {
  success: boolean;
  targetWorkId: string;
  targetWorkTitle: string;
  finalWorkId: string | null;
  finalWorkTitle: string | null;
  questionCount: number;
  steps: SimulationStep[];
  outcome: 'SUCCESS' | 'WRONG_REVEAL' | 'FAIL_LIST' | 'MAX_QUESTIONS' | 'ERROR';
  /** Task A: 失敗型の確定用 */
  diagnostic?: SimulationDiagnostic;
  /** 分析用（wasNoisy数・correctRank等） */
  analysisData?: SimulationAnalysisData;
  workDetails?: WorkDetails;
  /** 実行時エラー時のみ */
  errorMessage?: string;
}

/** バッチ用: 全トライアルで共有するデータ（DB クエリ完全排除） */
interface SharedBatchContext {
  allWorks: Array<{
    workId: string;
    isAi: string | null;
    popularityBase: number | null;
    popularityPlayBonus: number | null;
    title: string | null;
    authorName: string | null;
  }>;
  workTitleMap: Map<string, string>;
  /** 全作品の詳細（targetWork 用 DB クエリ排除） */
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
  /** workId→タグ配列（行列から構築） */
  workTagMap: Map<string, Array<{ tagKey: string; displayName: string; tagType: string; derivedConfidence: number | null }>>;
}

/** シミュ用: 正解作品に基づく正答を1か所で判定（まとめ質問・頭文字正規化対応）。両ループで共通利用。 */
function getCorrectAnswer(
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
    const hasSeries = seriesTagKeys.some(tk => targetTags.has(tk));
    return hasSeries ? 'YES' : 'NO';
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

/** 曖昧さレベル 1-10 に基づき回答を決定。L=1: 常に正解、L=10: かなり曖昧 */
function pickAnswerFromAmbiguity(
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

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    
    const body = await request.json();
    const {
      targetWorkId,
      ambiguityLevel = 2, // 1-10（デフォルト: サンプル50・曖昧さ2 に合わせる）
      noiseRate = 0, // 後方互換
      noiseRates,
      aiGateChoice = 'BOTH',
      includePerf = false, // true で計測結果をレスポンスに含める
    } = body;

    const level = ambiguityLevel != null ? Math.max(1, Math.min(10, Number(ambiguityLevel))) : 2;

    if (!targetWorkId) {
      return NextResponse.json(
        { error: 'targetWorkId is required' },
        { status: 400 }
      );
    }

    const config = getMvpConfig();

    // 単体シミュレーションでも行列・Tag キャッシュをプリロード
    getWorkTagMatrix();
    await ensureTagCacheLoaded();

    // 正解作品を取得（タグの詳細情報も含む。POPULARITY/TITLE_SYLLABLE用にpopularityPlayBonus, titleReadingInitialも取得）
    const targetWork = await prisma.work.findUnique({
      where: { workId: targetWorkId },
      select: {
        workId: true,
        title: true,
        authorName: true,
        isAi: true,
        popularityBase: true,
        popularityPlayBonus: true,
        titleReadingInitial: true,
        reviewCount: true,
        reviewAverage: true,
        commentText: true,
        workTags: {
          select: {
            tagKey: true,
            derivedConfidence: true,
            tag: {
              select: {
                displayName: true,
                tagType: true,
              },
            },
          },
        },
      },
    });

    if (!targetWork) {
      return NextResponse.json(
        { error: 'Target work not found' },
        { status: 404 }
      );
    }

    // 正解作品が持つタグのセット
    const targetTags = new Set(targetWork.workTags.map(wt => wt.tagKey));
    
    // タグ詳細情報を整形
    const targetWorkTags = targetWork.workTags.map(wt => ({
      tagKey: wt.tagKey,
      displayName: wt.tag.displayName,
      tagType: wt.tag.tagType,
      derivedConfidence: wt.derivedConfidence,
    }));

    // ゲーム登録済みかつ要注意でない作品のみ取得（HARD_CONFIRM 用に title/authorName も取得）
    const allWorks = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: {
        workId: true,
        title: true,
        authorName: true,
        isAi: true,
        popularityBase: true,
        popularityPlayBonus: true,
      },
    });

    // AI_GATEフィルタ適用
    const filteredWorks = filterWorksByAiGate(
      allWorks.map(w => ({
        workId: w.workId,
        isAi: w.isAi as 'AI' | 'HAND' | 'UNKNOWN',
      })),
      aiGateChoice as AiGateChoice
    );

    // workIdからWorkへのマップを作成
    const workMap = new Map(allWorks.map(w => [w.workId, w]));

    // HARD_CONFIRM 用の Work 情報マップ（DB クエリ省略）
    const workInfoMap = new Map<string, WorkInfoForConfirm>(
      allWorks.map(w => [w.workId, { title: w.title, authorName: w.authorName }])
    );

    // 初期重み（filteredWorksはstring[]なのでworkIdそのもの）
    let weights: WorkWeight[] = filteredWorks
      .filter(workId => workMap.has(workId))
      .map(workId => {
        const work = workMap.get(workId)!;
        return {
          workId,
          weight: (work.popularityBase ?? 1) + (work.popularityPlayBonus ?? 0),
        };
      });

    // シミュレーション開始
    const steps: SimulationStep[] = [];
    const questionHistory: QuestionHistoryEntry[] = [];
    let questionCount = 0;
    let outcome: SimulationResult['outcome'] = 'MAX_QUESTIONS';
    let finalWorkId: string | null = null;
    let revealMissCount = 0;
    let endedBy: SimulationDiagnostic['endedBy'] = 'OTHER';
    /** REVEALで不正解だった workId。同じ作品は再REVEALしない。 */
    const revealedWrongWorkIds = new Set<string>();

    const perfAcc = createPerfAccumulator(includePerf);
    await runWithPerfAccumulator(perfAcc, async () => {
    const simT = perfStart('runSimulation');
    while (true) {
      // 正規化
      const probabilities = normalizeWeights(weights);
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
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

      // 次の質問を選択
      const question = await selectNextQuestion(
        weights,
        probabilities,
        questionCount,
        questionHistory,
        config
      );

      if (!question) {
        // 質問が null → 強制 REVEAL（終了条件で負けないようにする）
        endedBy = 'NO_MORE_QUESTIONS';
        const forceRevealWorkId = sorted[0]?.workId;
        if (forceRevealWorkId) {
          const revealWork = await prisma.work.findUnique({
            where: { workId: forceRevealWorkId },
            select: { title: true },
          });
          const revealWorkTitle = revealWork?.title ?? '(不明)';
          const isCorrect = forceRevealWorkId === targetWorkId;
          // REVEALは質問数に含めない（特別スロットを潰さないため）
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

      // 自動回答を決定（共通ヘルパーでまとめ・頭文字正規化対応）
      const correctAnswer = getCorrectAnswer(
        question as { kind: string; tagKey?: string; hardConfirmType?: string; hardConfirmValue?: string; isSummaryQuestion?: boolean; summaryDisplayNames?: string[] },
        targetWork,
        targetTags,
        targetWorkTags
      );

      // 曖昧さレベルに基づき回答を決定（HARD は常に正解）
      const baseAnswer = correctAnswer as 'YES' | 'NO';
      const actualAnswer =
        question.kind === 'HARD_CONFIRM'
          ? baseAnswer
          : pickAnswerFromAmbiguity(baseAnswer, level, question.kind);
      const wasNoisy = actualAnswer !== baseAnswer;

      // preferHighP: この質問選択時に連続NOだったか（当たり狙いモード）
      let consecutiveNoCount = 0;
      for (let i = questionHistory.length - 1; i >= 0; i--) {
        if (questionHistory[i]?.answer === 'NO') consecutiveNoCount++;
        else break;
      }
      const consecutiveNoForAtari = config.flow.consecutiveNoForAtari ?? 5;
      const preferHighP = consecutiveNoCount >= consecutiveNoForAtari;

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
        specialQuestionType: (question as { specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' | 'TITLE_SYLLABLE_2' | 'AUTHOR_CHAR_TYPE' }).specialQuestionType,
        seriesTagKeys: (question as { seriesTagKeys?: string[] }).seriesTagKeys,
        titleCharType: (question as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType,
        popularityThreshold: (question as { popularityThreshold?: number }).popularityThreshold,
        syllableChars: (question as { syllableChars?: string[] }).syllableChars,
        authorCharType: (question as { authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA' }).authorCharType,
      });

      // 回答処理
      const updatedWeights = await processAnswer(
        weights,
        question,
        actualAnswer,
        config,
        { workInfoMap }
      );
      weights = updatedWeights;

      // 更新後の確信度を計算
      const newProbabilities = normalizeWeights(weights);
      const newSorted = [...newProbabilities].sort((a, b) => {
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
        return a.workId.localeCompare(b.workId);
      });
      const newConfidence = newSorted[0]?.probability ?? 0;

      // タグのp値（確率ベースカバレッジ）を計算
      let tagCoverage: number | undefined;
      if (question.tagKey) {
        const tagCovT = perfStart('tagCoverage');
        // このタグを持つ作品を取得
        const workIdsWithTag = await prisma.workTag.findMany({
          where: {
            tagKey: question.tagKey,
            workId: { in: weights.map(w => w.workId) },
          },
          select: { workId: true },
        });
        const tagWorkIds = new Set(workIdsWithTag.map(wt => wt.workId));
        // p = Σ P(w) for works that have the tag
        tagCoverage = probabilities
          .filter(p => tagWorkIds.has(p.workId))
          .reduce((sum, p) => sum + p.probability, 0);
        perfEnd('tagCoverage', tagCovT);
      }

      // ステップを記録（EXPLORE_TAG のとき exploreTagKind を付与し、シミュで種別がわかるようにする）
      const stepEffectiveCandidates = calculateEffectiveCandidates(probabilities);
      steps.push({
        qIndex,
        question: {
          kind: question.kind,
          displayText: question.displayText,
          tagKey: question.tagKey,
          hardConfirmType: question.hardConfirmType,
          hardConfirmValue: question.hardConfirmValue,
          exploreTagKind: question.kind === 'EXPLORE_TAG' ? (question as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind : undefined,
          specialQuestionType: question.kind === 'SPECIAL_QUESTION' ? (question as { specialQuestionType?: string }).specialQuestionType : undefined,
        },
        answer: actualAnswer,
        wasNoisy,
        confidenceBefore: confidence,
        confidenceAfter: newConfidence,
        top1WorkId: topWorkId,
        top1Probability: confidence,
        tagCoverage,
        effectiveCandidates: stepEffectiveCandidates,
        preferHighP: question.kind === 'EXPLORE_TAG' ? preferHighP : undefined,
      });

      // REVEAL判定（既出＝一度不正解だった作品は候補から外す）
      const revealThreshold = getRevealThresholdForQuestion(questionCount - 1, config.confirm.revealThreshold);
      if (newConfidence >= revealThreshold) {
        const revealWorkId = newSorted.find(p => !revealedWrongWorkIds.has(p.workId))?.workId ?? null;
        if (revealWorkId) {
          // REVEAL対象の作品タイトルを取得
          const revealWork = await prisma.work.findUnique({
            where: { workId: revealWorkId },
            select: { title: true },
          });
          const revealWorkTitle = revealWork?.title ?? '(不明)';
          const isCorrect = revealWorkId === targetWorkId;

          // REVEALステップを追加（REVEALは質問数に含めない）
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
            revealWorkId: revealWorkId,
            revealWorkTitle: revealWorkTitle,
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
            // ペナルティ: revealされた作品の重みを下げる
            weights = weights.map(w => ({
              workId: w.workId,
              weight: w.workId === revealWorkId
                ? w.weight * config.algo.revealPenalty
                : w.weight,
            }));
          }
        }
        // revealWorkId が null（上位がすべて既出）の場合は REVEAL せず次の質問へ
      }
    }

    perfEnd('runSimulation', simT);
    });

    // ループ正常終了（maxQuestions 到達）→ 強制 REVEAL（既出は候補から外す）
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
        const revealWork = await prisma.work.findUnique({
          where: { workId: forceRevealId },
          select: { title: true },
        });
        const revealWorkTitle = revealWork?.title ?? '(不明)';
        const isCorrect = forceRevealId === targetWorkId;
        // REVEALは質問数に含めない
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

    // 最終結果を取得
    let finalWorkTitle: string | null = null;
    if (finalWorkId) {
      const finalWork = await prisma.work.findUnique({
        where: { workId: finalWorkId },
        select: { title: true },
      });
      finalWorkTitle = finalWork?.title ?? null;
    }

    // Task A: 失敗型の確定用診断（endedBy, correctRank, correctStillInCandidates, top1Confidence, candidatesCount）
    const finalProbsForDiag = normalizeWeights(weights);
    const sortedForDiag = [...finalProbsForDiag].sort((a, b) => {
      if (a.probability !== b.probability) return b.probability - a.probability;
      return a.workId.localeCompare(b.workId);
    });
    const correctRankIdx = sortedForDiag.findIndex(p => p.workId === targetWorkId);
    const diagnostic: SimulationDiagnostic = {
      endedBy,
      correctRank: correctRankIdx === -1 ? -1 : correctRankIdx + 1,
      correctStillInCandidates: weights.some(w => w.workId === targetWorkId),
      top1Confidence: sortedForDiag[0]?.probability ?? 0,
      candidatesCount: weights.length,
    };
    // 分析用データ（wasNoisy数・ノイズ発生ステップ等）
    const noisySteps = steps.filter(s => s.wasNoisy);
    const firstNoisyIdx = noisySteps.length > 0
      ? steps.findIndex(s => s.wasNoisy)
      : -1;
    const analysisData: SimulationAnalysisData = {
      wasNoisyCount: noisySteps.length,
      firstNoisyStepIndex: firstNoisyIdx,
      noisyStepIndices: steps.filter(s => s.wasNoisy).map(s => s.qIndex),
      correctRank: diagnostic.correctRank,
      top1Confidence: diagnostic.top1Confidence,
      totalQuestions: questionCount,
      noisyRatio: questionCount > 0 ? noisySteps.length / questionCount : 0,
    };

    const result: SimulationResult = {
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
    };

    // 作品詳細情報を追加
    const workDetails = {
      workId: targetWork.workId,
      title: targetWork.title,
      authorName: targetWork.authorName,
      isAi: targetWork.isAi,
      popularityBase: targetWork.popularityBase,
      reviewCount: targetWork.reviewCount,
      reviewAverage: targetWork.reviewAverage,
      commentText: targetWork.commentText,
      tags: targetWorkTags,
    };

    const perfSummary = toPerfSummary(perfAcc);
    return NextResponse.json({
      ...result,
      workDetails,
      ...(perfSummary && { perfSummary }),
    });
  } catch (error) {
    console.error('Error in /api/admin/simulate:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * サンプル対象の workIds を取得（チャンク実行・進捗表示用）
 * GET /api/admin/simulate?sampleSize=10
 */
export async function GET(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    const sampleSize = Math.max(0, Number(request.nextUrl.searchParams.get('sampleSize') ?? 0));
    const works = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: { workId: true },
    });
    let workIds = works.map((w) => w.workId);
    if (sampleSize > 0 && sampleSize < workIds.length) {
      const shuffled = [...workIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      workIds = shuffled.slice(0, sampleSize);
    }
    return NextResponse.json({ workIds });
  } catch (error) {
    console.error('Error in /api/admin/simulate (GET):', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * バッチシミュレーション用エンドポイント
 */
export async function PUT(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    
    const body = await request.json();
    const {
      workIds,
      ambiguityLevel = 2,
      noiseRate = 0,
      noiseRates,
      aiGateChoice = 'BOTH',
      trialsPerWork = 1,
      sampleSize = 0,
      parallelCount = 20,
      includePerf = false,
      totalTrials: totalTrialsParam,
      doneOffset = 0,
    } = body;

    const level = ambiguityLevel != null ? Math.max(1, Math.min(10, Number(ambiguityLevel))) : 2;
    // Worker Thread 数（CPU コアの 80% を使用、最大 numCpus-2）
    const numCpus = cpus().length;
    const defaultParallel = Math.max(4, Math.min(numCpus - 2, Math.floor(numCpus * 0.8)));
    const parallel = Math.max(1, Math.min(numCpus, Number(parallelCount) || defaultParallel));

    const config = getMvpConfig();

    // 並列シミュレーション前に WorkTag 行列と Tag キャッシュをプリロード（初回の 3-7 秒遅延を防ぐ）
    getWorkTagMatrix();
    await ensureTagCacheLoaded();

    // 対象作品を取得（未指定時はゲーム登録済みのみ）
    let targetWorkIds: string[];
    if (workIds && workIds.length > 0) {
      targetWorkIds = workIds;
    } else {
      const works = await prisma.work.findMany({
        where: { gameRegistered: true, needsReview: false },
        select: { workId: true },
      });
      targetWorkIds = works.map(w => w.workId);
    }

    // バッチ用: allWorks を1回だけ取得し、全トライアルで共有（DB クエリ完全排除）
    const allWorks = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: {
        workId: true,
        isAi: true,
        popularityBase: true,
        popularityPlayBonus: true,
        title: true,
        authorName: true,
        titleReadingInitial: true,
        reviewCount: true,
        reviewAverage: true,
        commentText: true,
      },
    });
    const workTitleMap = new Map<string, string>(
      allWorks.map(w => [w.workId, w.title ?? '(不明)'])
    );
    const workDetailMap = new Map(allWorks.map(w => [w.workId, w]));

    // 行列 + タグキャッシュから workId→タグ配列を構築（DB 不要）
    const matrix = getWorkTagMatrix();
    const workTagMap = new Map<string, Array<{ tagKey: string; displayName: string; tagType: string; derivedConfidence: number | null }>>();
    if (matrix?.workTagMap) {
      const { getTagsByTagKeys: getTags, isTagCacheReady: cacheReady } = await import('@/server/game/tagCacheLoader');
      for (const [wId, entries] of Object.entries(matrix.workTagMap)) {
        if (cacheReady()) {
          const tagKeys = entries.map(e => e.tagKey);
          const tags = getTags(tagKeys);
          const tagMap = new Map(tags.map(t => [t.tagKey, t]));
          workTagMap.set(wId, entries.map(e => {
            const t = tagMap.get(e.tagKey);
            return {
              tagKey: e.tagKey,
              displayName: t?.displayName ?? e.tagKey,
              tagType: t?.tagType ?? 'DERIVED',
              derivedConfidence: e.derivedConfidence,
            };
          }));
        }
      }
    }

    const sharedContext: SharedBatchContext = { allWorks, workTitleMap, workDetailMap, workTagMap };

    // ランダムサンプリング
    if (sampleSize > 0 && sampleSize < targetWorkIds.length) {
      const shuffled = [...targetWorkIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      targetWorkIds = shuffled.slice(0, sampleSize);
    }

    const tasks: Array<{ targetWorkId: string; trial: number }> = [];
    for (const targetWorkId of targetWorkIds) {
      for (let trial = 0; trial < trialsPerWork; trial++) {
        tasks.push({ targetWorkId, trial });
      }
    }

    // simWorkDataMap を構築（engine.ts の DB クエリを完全排除）
    const simWorkDataEntries: [string, SimWorkData][] = allWorks.map(w => [
      w.workId,
      {
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        popularityBase: w.popularityBase,
        popularityPlayBonus: w.popularityPlayBonus,
        titleReadingInitial: w.titleReadingInitial,
      },
    ]);

    const startTime = Date.now();
    const totalTasks = tasks.length;
    const effectiveTotal = totalTrialsParam != null ? Number(totalTrialsParam) : totalTasks;
    const offset = Math.max(0, Number(doneOffset) || 0);

    // 進捗パネル用（bulk-job-status でポーリング取得）
    setSimProgress(offset, effectiveTotal, new Date().toISOString());

    // Worker Thread でシミュレーション実行（メインスレッドをブロックしない）
    let results: Awaited<ReturnType<typeof runSimulationInWorker>>['results'] = [];
    let totalWorksInDb = 0;
    try {
      const workerResult = await runSimulationInWorker({
        tasks,
        level,
        aiGateChoice,
        includePerf,
        parallel,
        sharedContext,
        workTagMatrixData: matrix,
        tagCacheData: getAllCachedTags(),
        simWorkDataEntries,
        onProgress: (done, total) => {
          console.log(`[Sim] ${done}/${total}`);
          setSimProgress(offset + done, effectiveTotal);
        },
      });
      results = workerResult.results;
      totalWorksInDb = workerResult.totalWorksInDb;
    } finally {
      clearSimProgress();
    }

    const successCount = results.filter(r => r.success).length;
    const totalTrials = results.length;
    const totalQuestions = results.reduce((s, r) => s + r.questionCount, 0);
    const successRate = totalTrials > 0 ? successCount / totalTrials : 0;
    const avgQuestions = totalTrials > 0 ? totalQuestions / totalTrials : 0;

    const failures = results.filter(r => !r.success);
    const failureSummary: Record<string, number> = {};
    for (const f of failures) {
      failureSummary[f.outcome] = (failureSummary[f.outcome] ?? 0) + 1;
    }

    const failureAnalysis = failures.length > 0 ? (() => {
      const withAnalysis = failures.filter(f => f.analysisData);
      const withDiag = failures.filter(f => f.diagnostic);
      return {
        failureCount: failures.length,
        avgWasNoisyCount: withAnalysis.length > 0
          ? Math.round((withAnalysis.reduce((s, f) => s + (f.analysisData!.wasNoisyCount), 0) / withAnalysis.length) * 100) / 100
          : null,
        avgCorrectRank: withDiag.length > 0
          ? Math.round((withDiag.reduce((s, f) => s + (f.diagnostic!.correctRank), 0) / withDiag.length) * 100) / 100
          : null,
        avgTop1Confidence: withDiag.length > 0
          ? Math.round((withDiag.reduce((s, f) => s + (f.diagnostic!.top1Confidence), 0) / withDiag.length) * 10000) / 10000
          : null,
      };
    })() : null;

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      totalTrials,
      successCount,
      successRate: Math.round(successRate * 100) / 100,
      avgQuestions: Math.round(avgQuestions * 10) / 10,
      results,
      failureSummary,
      failureAnalysis,
      metadata: {
        timestamp: new Date().toISOString(),
        totalWorksInDb,
        sampleSize: sampleSize > 0 ? sampleSize : totalWorksInDb,
        ambiguityLevel: level,
        aiGateChoice,
        trialsPerWork,
        parallelCount: parallel,
        durationSeconds,
      },
    });
  } catch (error) {
    console.error('Error in /api/admin/simulate (batch):', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * シミュレーション結果保存用エンドポイント
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { result } = body;

    if (!result) {
      return NextResponse.json({ error: 'No result provided' }, { status: 400 });
    }

    // 保存先ディレクトリ
    const fs = await import('fs/promises');
    const path = await import('path');
    const saveDir = path.join(process.cwd(), 'data', 'simulation-results');
    
    // ディレクトリ作成（存在しなければ）
    await fs.mkdir(saveDir, { recursive: true });

    // ファイル名生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `sim-${timestamp}.json`;
    const filePath = path.join(saveDir, fileName);

    // 結果を保存
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      fileName,
      filePath: `data/simulation-results/${fileName}`,
    });
  } catch (error) {
    console.error('Error saving simulation result:', error);
    return NextResponse.json(
      {
        error: 'Failed to save result',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Worker Thread でシミュレーションバッチを実行
 * メインスレッドをブロックしないため、UI や他の API が応答し続ける
 */
interface WorkerResultItem {
  workId: string;
  title: string;
  success: boolean;
  questionCount: number;
  outcome: string;
  steps?: SimulationStep[];
  workDetails?: WorkDetails;
  diagnostic?: SimulationDiagnostic;
  analysisData?: SimulationAnalysisData;
  errorMessage?: string;
  perfSummary?: Record<string, number>;
}

import { execSync } from 'child_process';

function ensureWorkerBundle(): void {
  const bundlePath = path.resolve(process.cwd(), 'dist/simulationWorker.js');
  const srcPath = path.resolve(process.cwd(), 'src/server/simulation/simulationWorker.ts');
  try {
    const srcStat = fs.statSync(srcPath);
    let needsBuild = !fs.existsSync(bundlePath);
    if (!needsBuild) {
      const bundleStat = fs.statSync(bundlePath);
      needsBuild = srcStat.mtimeMs > bundleStat.mtimeMs;
    }
    if (needsBuild) {
      const distDir = path.resolve(process.cwd(), 'dist');
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
      execSync(
        'npx esbuild src/server/simulation/simulationWorker.ts --bundle --platform=node --target=node18 --outfile=dist/simulationWorker.js --format=cjs --alias:@/server/db/client=./src/server/simulation/prismaStub.ts',
        { cwd: process.cwd(), stdio: 'pipe' }
      );
      console.log('[Sim] Worker bundle rebuilt');
    }
  } catch (e) {
    console.warn('[Sim] Failed to build worker bundle, falling back to tsx:', e);
  }
}

async function runSimulationInWorker(opts: {
  tasks: Array<{ targetWorkId: string; trial: number }>;
  level: number;
  aiGateChoice: string;
  includePerf: boolean;
  parallel: number;
  sharedContext: SharedBatchContext;
  workTagMatrixData: ReturnType<typeof getWorkTagMatrix>;
  tagCacheData: Array<{ tagKey: string; displayName: string; tagType: string | null; questionText: string | null }>;
  simWorkDataEntries: [string, SimWorkData][];
  onProgress?: (done: number, total: number) => void;
}): Promise<{ results: WorkerResultItem[]; totalWorksInDb: number }> {
  ensureWorkerBundle();
  const workerPathJs = path.resolve(process.cwd(), 'dist/simulationWorker.js');
  const workerPathTs = path.resolve(process.cwd(), 'src/server/simulation/simulationWorker.ts');
  const useBundle = fs.existsSync(workerPathJs);
  const workerPath = useBundle ? workerPathJs : workerPathTs;
  const workerCount = Math.min(opts.parallel, opts.tasks.length);
  if (workerCount === 0) return { results: [], totalWorksInDb: opts.sharedContext.allWorks.length };

  // 共有データを SharedArrayBuffer に格納（ファイル I/O ゼロ、全 Worker がゼロコピーで参照）
  const sharedPayload = JSON.stringify({
    sharedContextSerialized: {
      allWorks: opts.sharedContext.allWorks,
      workTitleEntries: Array.from(opts.sharedContext.workTitleMap.entries()),
      workDetailEntries: Array.from(opts.sharedContext.workDetailMap.entries()),
      workTagEntries: Array.from(opts.sharedContext.workTagMap.entries()),
    },
    workTagMatrixData: opts.workTagMatrixData,
    tagCacheData: opts.tagCacheData,
    simWorkDataEntries: opts.simWorkDataEntries,
  });
  const encoder = new TextEncoder();
  const bytes = encoder.encode(sharedPayload);
  const sharedBuffer = new SharedArrayBuffer(bytes.byteLength);
  new Uint8Array(sharedBuffer).set(bytes);
  console.log(`[Sim] Shared data in memory: ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB (SharedArrayBuffer)`);

  // 動的タスクキュー: Atomics で次タスクインデックスを共有（早く終わった Worker が次のタスクを取得）
  const taskIndexBuffer = new SharedArrayBuffer(4);
  new Int32Array(taskIndexBuffer)[0] = 0;

  let totalDone = 0;
  const totalTasks = opts.tasks.length;

  const sharedWorkerData = {
    tasks: opts.tasks,
    level: opts.level,
    aiGateChoice: opts.aiGateChoice,
    includePerf: opts.includePerf,
    sharedBuffer,
    taskIndexBuffer,
  };

  function spawnWorker(): Promise<WorkerResultItem[]> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        ...(useBundle ? {} : { execArgv: ['--require', 'tsx/cjs'] }),
        workerData: sharedWorkerData,
      });

      let workerResults: WorkerResultItem[] = [];

      worker.on('message', (msg: { type: string; results?: WorkerResultItem[]; totalWorksInDb?: number; done?: number; total?: number; message?: string }) => {
        if (msg.type === 'done') {
          workerResults = msg.results ?? [];
        } else if (msg.type === 'progress' && msg.done != null) {
          totalDone++;
          opts.onProgress?.(totalDone, totalTasks);
        } else if (msg.type === 'error') {
          reject(new Error(msg.message ?? 'Worker error'));
        }
      });

      worker.on('error', reject);

      worker.on('exit', (code) => {
        if (workerResults.length > 0 || code === 0) {
          resolve(workerResults);
        } else {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  console.log(`[Sim] Spawning ${workerCount} workers for ${totalTasks} tasks (dynamic queue, bundle=${useBundle})`);
  const workerPromises = Array.from({ length: workerCount }, () => spawnWorker());

  const allResults = await Promise.all(workerPromises);
  return { results: allResults.flat(), totalWorksInDb: opts.sharedContext.allWorks.length };
}

/**
 * シミュレーション実行（内部関数 - 単発POST用。バッチはWorker Threadで実行）
 * @param sharedContext バッチ時は全データを共有して DB クエリをゼロにする
 */
async function runSimulation(
  targetWorkId: string,
  ambiguityLevel: number,
  aiGateChoice: string,
  config: ReturnType<typeof getMvpConfig>,
  sharedContext?: SharedBatchContext,
  includePerf = false
): Promise<(SimulationResult & { perfSummary?: Record<string, number> }) | null> {
  try {
    // sharedContext がある場合は DB クエリなしで全て取得
    const targetWorkBase = sharedContext?.workDetailMap?.get(targetWorkId);
    const targetWorkTagsRaw = sharedContext?.workTagMap?.get(targetWorkId);

    let targetWork: {
      workId: string; title: string; authorName: string | null; isAi: string | null;
      popularityBase: number | null; popularityPlayBonus: number | null;
      titleReadingInitial: string | null; reviewCount: number | null;
      reviewAverage: number | null; commentText: string | null;
      workTags: Array<{ tagKey: string; derivedConfidence: number | null; tag: { displayName: string; tagType: string } }>;
    };

    if (targetWorkBase && targetWorkTagsRaw) {
      targetWork = {
        ...targetWorkBase,
        title: targetWorkBase.title ?? '(不明)',
        workTags: targetWorkTagsRaw.map(t => ({
          tagKey: t.tagKey,
          derivedConfidence: t.derivedConfidence,
          tag: { displayName: t.displayName, tagType: t.tagType },
        })),
      };
    } else {
      const fromDb = await prisma.work.findUnique({
        where: { workId: targetWorkId },
        select: {
          workId: true, title: true, authorName: true, isAi: true,
          popularityBase: true, popularityPlayBonus: true, titleReadingInitial: true,
          reviewCount: true, reviewAverage: true, commentText: true,
          workTags: { select: { tagKey: true, derivedConfidence: true, tag: { select: { displayName: true, tagType: true } } } },
        },
      });
      if (!fromDb) return null;
      targetWork = { ...fromDb, title: fromDb.title ?? '(不明)' };
    }

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

    const allWorks = sharedContext
      ? sharedContext.allWorks
      : await prisma.work.findMany({
          where: { gameRegistered: true, needsReview: false },
          select: { workId: true, isAi: true, popularityBase: true, popularityPlayBonus: true, title: true, authorName: true },
        });

    const workTitleMap = sharedContext?.workTitleMap ?? new Map<string, string>(
      allWorks.map(w => [w.workId, w.title ?? '(不明)'])
    );

    // HARD_CONFIRM 用の Work 情報マップ（DB クエリ省略）
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

    // workIdからWorkへのマップを作成
    const workMap = new Map(allWorks.map(w => [w.workId, w]));

    // filteredWorksはstring[]なのでworkIdそのもの
    let weights: WorkWeight[] = filteredWorks
      .filter(workId => workMap.has(workId))
      .map(workId => {
        const work = workMap.get(workId)!;
        return {
          workId,
          weight: (work.popularityBase ?? 1) + (work.popularityPlayBonus ?? 0),
        };
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
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
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
        config
      );

      if (!question) {
        endedBy = 'NO_MORE_QUESTIONS';
        const forceRevealWorkId = sorted[0]?.workId;
        if (forceRevealWorkId) {
          const revealWorkTitle = workTitleMap.get(forceRevealWorkId) ?? '(不明)';
          const isCorrect = forceRevealWorkId === targetWorkId;
          // REVEALは質問数に含めない
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
        question as { kind: string; tagKey?: string; hardConfirmType?: string; hardConfirmValue?: string; isSummaryQuestion?: boolean; summaryDisplayNames?: string[] },
        targetWork,
        targetTags,
        targetWorkTagsForAnswer
      );

      const baseAnswer = correctAnswer as 'YES' | 'NO';
      const actualAnswer =
        question.kind === 'HARD_CONFIRM'
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
        specialQuestionType: (question as { specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' | 'TITLE_SYLLABLE_2' | 'AUTHOR_CHAR_TYPE' }).specialQuestionType,
        seriesTagKeys: (question as { seriesTagKeys?: string[] }).seriesTagKeys,
        titleCharType: (question as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType,
        popularityThreshold: (question as { popularityThreshold?: number }).popularityThreshold,
        syllableChars: (question as { syllableChars?: string[] }).syllableChars,
        authorCharType: (question as { authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA' }).authorCharType,
      });

      // タグのp値（確率ベースカバレッジ）を計算（回答処理前のprobabilitiesで計算）
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
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
        return a.workId.localeCompare(b.workId);
      });
      const newConfidence = newSorted[0]?.probability ?? 0;

      steps.push({
        qIndex,
        question: {
          kind: question.kind,
          displayText: question.displayText,
          tagKey: question.tagKey,
          hardConfirmType: question.hardConfirmType,
          hardConfirmValue: question.hardConfirmValue,
          exploreTagKind: question.kind === 'EXPLORE_TAG' ? (question as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind : undefined,
          specialQuestionType: question.kind === 'SPECIAL_QUESTION' ? (question as { specialQuestionType?: string }).specialQuestionType : undefined,
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
      });

      const revealThreshold = getRevealThresholdForQuestion(questionCount - 1, config.confirm.revealThreshold);
      if (newConfidence >= revealThreshold) {
        const revealWorkId = newSorted.find(p => !revealedWrongWorkIds.has(p.workId))?.workId ?? null;
        if (revealWorkId) {
          const revealWorkTitle = workTitleMap.get(revealWorkId) ?? '(不明)';
          const isCorrect = revealWorkId === targetWorkId;
          // REVEALは質問数に含めない
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
            revealWorkId: revealWorkId,
            revealWorkTitle: revealWorkTitle,
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
    }

    perfEnd('runSimulation', simT);
    });

    // ループ正常終了（maxQuestions 到達）→ 強制 REVEAL（既出は候補から外す）
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
        // REVEALは質問数に含めない
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

    // 分析用データ（wasNoisy数・ノイズ発生ステップ等）
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
