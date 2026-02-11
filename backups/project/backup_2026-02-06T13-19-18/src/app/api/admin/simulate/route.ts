/**
 * /api/admin/simulate: シミュレーション実行API
 * 
 * 指定した作品を「正解」として、自動回答でゲームをシミュレーション
 * ノイズ率に応じて一定確率で間違った回答をする
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { getMvpConfig } from '@/server/config/loader';
import { selectNextQuestion, processAnswer, filterWorksByAiGate } from '@/server/game/engine';
import { normalizeWeights, calculateConfidence } from '@/server/algo/scoring';
import { normalizeTitleForInitial } from '@/server/utils/normalizeTitle';
import type { WorkWeight, AiGateChoice } from '@/server/algo/types';
import type { QuestionHistoryEntry } from '@/server/session/manager';

interface SimulationStep {
  qIndex: number;
  question: {
    kind: string;
    displayText: string;
    tagKey?: string;
    hardConfirmType?: string;
    hardConfirmValue?: string;
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
  workDetails?: WorkDetails;
  /** 実行時エラー時のみ */
  errorMessage?: string;
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
  },
  targetWork: { title: string | null; authorName: string | null },
  targetTags: Set<string>,
  targetWorkTags: { displayName: string }[]
): string {
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
    return (targetWork.authorName ?? '') === question.hardConfirmValue ? 'YES' : 'NO';
  }
  return 'DONT_CARE';
}

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    
    const body = await request.json();
    const { 
      targetWorkId, 
      noiseRate = 0, // 後方互換: 単一の値（0〜1）
      noiseRates, // 質問タイプ別: { explore, soft, hard }
      aiGateChoice = 'BOTH' // AI_ONLY, HAND_ONLY, BOTH
    } = body;
    
    // ノイズ率を質問タイプ別に設定（後方互換対応）
    const noiseExplore = noiseRates?.explore ?? noiseRate;
    const noiseSoft = noiseRates?.soft ?? noiseRate;
    const noiseHard = noiseRates?.hard ?? noiseRate;

    if (!targetWorkId) {
      return NextResponse.json(
        { error: 'targetWorkId is required' },
        { status: 400 }
      );
    }

    const config = getMvpConfig();

    // 正解作品を取得（タグの詳細情報も含む）
    const targetWork = await prisma.work.findUnique({
      where: { workId: targetWorkId },
      select: {
        workId: true,
        title: true,
        authorName: true,
        isAi: true,
        popularityBase: true,
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

    // ゲーム登録済みかつ要注意でない作品のみ取得
    const allWorks = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: {
        workId: true,
        title: true,
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

    while (questionCount < config.flow.maxQuestions) {
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
          questionCount++;
          steps.push({
            qIndex: questionCount,
            question: { kind: 'REVEAL', displayText: `(強制) この作品は「${revealWorkTitle}」ですか？` },
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

      // ノイズを適用（質問タイプ別の確率で逆回答）
      let noiseRateForQuestion = 0;
      if (question.kind === 'EXPLORE_TAG') {
        noiseRateForQuestion = noiseExplore;
      } else if (question.kind === 'SOFT_CONFIRM') {
        noiseRateForQuestion = noiseSoft;
      } else if (question.kind === 'HARD_CONFIRM') {
        noiseRateForQuestion = noiseHard;
      }
      const wasNoisy = Math.random() < noiseRateForQuestion;
      let actualAnswer = correctAnswer;
      if (wasNoisy) {
        actualAnswer = correctAnswer === 'YES' ? 'NO' : 'YES';
      }

      // 質問履歴に追加（まとめ質問のときは summaryQuestionId 等を保存し、同一まとめの重複出題を防ぐ。answer は連続NOで当たりを挟む判定に使用）
      questionHistory.push({
        qIndex,
        kind: question.kind,
        tagKey: question.tagKey,
        hardConfirmType: question.hardConfirmType,
        hardConfirmValue: question.hardConfirmValue,
        isSummaryQuestion: (question as { isSummaryQuestion?: boolean }).isSummaryQuestion,
        summaryQuestionId: (question as { summaryQuestionId?: string }).summaryQuestionId,
        summaryDisplayNames: (question as { summaryDisplayNames?: string[] }).summaryDisplayNames,
        answer: actualAnswer === 'YES' ? 'YES' : 'NO',
        exploreTagKind: (question as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
      });

      // 回答処理
      const updatedWeights = await processAnswer(
        weights,
        question,
        actualAnswer,
        config
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
      }

      // ステップを記録（EXPLORE_TAG のとき exploreTagKind を付与し、シミュで種別がわかるようにする）
      steps.push({
        qIndex,
        question: {
          kind: question.kind,
          displayText: question.displayText,
          tagKey: question.tagKey,
          hardConfirmType: question.hardConfirmType,
          hardConfirmValue: question.hardConfirmValue,
          exploreTagKind: question.kind === 'EXPLORE_TAG' ? (question as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind : undefined,
        },
        answer: actualAnswer,
        wasNoisy,
        confidenceBefore: confidence,
        confidenceAfter: newConfidence,
        top1WorkId: topWorkId,
        top1Probability: confidence,
        tagCoverage,
      });

      // REVEAL判定（既出＝一度不正解だった作品は候補から外す）
      if (newConfidence >= config.confirm.revealThreshold) {
        const revealWorkId = newSorted.find(p => !revealedWrongWorkIds.has(p.workId))?.workId ?? null;
        if (revealWorkId) {
          // REVEAL対象の作品タイトルを取得
          const revealWork = await prisma.work.findUnique({
            where: { workId: revealWorkId },
            select: { title: true },
          });
          const revealWorkTitle = revealWork?.title ?? '(不明)';
          const isCorrect = revealWorkId === targetWorkId;

          // REVEALステップを追加
          questionCount++;
          steps.push({
            qIndex: questionCount,
            question: {
              kind: 'REVEAL',
              displayText: `断定: この作品は「${revealWorkTitle}」ですか？`,
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
        questionCount++;
        steps.push({
          qIndex: questionCount,
          question: { kind: 'REVEAL', displayText: `(maxQuestions強制) この作品は「${revealWorkTitle}」ですか？` },
          answer: isCorrect ? 'CORRECT' : 'WRONG',
          wasNoisy: false,
          confidenceBefore: forceRevealConf,
          confidenceAfter: forceRevealConf,
          top1WorkId: forceRevealId,
          top1Probability: forceRevealConf,
          revealWorkId: forceRevealId,
          revealWorkTitle,
          revealResult: isCorrect ? 'SUCCESS' : 'MISS',
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
    if (outcome !== 'SUCCESS') {
      console.log(
        `[simulate] Task A diagnostic: endedBy=${diagnostic.endedBy} correctRank=${diagnostic.correctRank} correctStillInCandidates=${diagnostic.correctStillInCandidates} top1Confidence=${diagnostic.top1Confidence.toFixed(3)} candidatesCount=${diagnostic.candidatesCount} targetWorkId=${targetWorkId}`
      );
    }

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

    return NextResponse.json({ ...result, workDetails });
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
 * バッチシミュレーション用エンドポイント
 */
export async function PUT(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    
    const body = await request.json();
    const { 
      workIds, // 対象作品ID配列（空なら全作品）
      noiseRate = 0, // 後方互換
      noiseRates, // 質問タイプ別: { explore, soft, hard }
      aiGateChoice = 'BOTH',
      trialsPerWork = 1, // 作品あたりの試行回数
      sampleSize = 0, // ランダムサンプリング件数（0=全件）
    } = body;
    
    // ノイズ率を質問タイプ別に設定（後方互換対応）
    const noiseExplore = noiseRates?.explore ?? noiseRate;
    const noiseSoft = noiseRates?.soft ?? noiseRate;
    const noiseHard = noiseRates?.hard ?? noiseRate;

    const config = getMvpConfig();

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

    // ランダムサンプリング
    if (sampleSize > 0 && sampleSize < targetWorkIds.length) {
      // Fisher-Yates shuffle して先頭N件を取得
      const shuffled = [...targetWorkIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      targetWorkIds = shuffled.slice(0, sampleSize);
    }

    // バッチ結果（実行時エラーも 1 件として含め、outcome: 'ERROR' と errorMessage で記録）
    const results: Array<{
      workId: string;
      title: string;
      success: boolean;
      questionCount: number;
      outcome: string;
      steps?: SimulationStep[];
      workDetails?: WorkDetails;
      errorMessage?: string;
    }> = [];

    let successCount = 0;
    let totalQuestions = 0;

    for (const targetWorkId of targetWorkIds) {
      for (let trial = 0; trial < trialsPerWork; trial++) {
        const simResult = await runSimulation(
          targetWorkId,
          { explore: noiseExplore, soft: noiseSoft, hard: noiseHard },
          aiGateChoice,
          config
        );

        if (simResult) {
          results.push({
            workId: simResult.targetWorkId,
            title: simResult.targetWorkTitle,
            success: simResult.success,
            questionCount: simResult.questionCount,
            outcome: simResult.outcome,
            steps: simResult.steps,
            workDetails: simResult.workDetails,
            errorMessage: simResult.errorMessage,
          });
          if (simResult.success) {
            successCount++;
          }
          totalQuestions += simResult.questionCount;
        }
      }
    }

    const totalTrials = results.length;
    const successRate = totalTrials > 0 ? successCount / totalTrials : 0;
    const avgQuestions = totalTrials > 0 ? totalQuestions / totalTrials : 0;

    // 作品総数を取得（DB内の全作品数）
    const totalWorksInDb = await prisma.work.count();

    return NextResponse.json({
      totalTrials,
      successCount,
      successRate: Math.round(successRate * 100) / 100,
      avgQuestions: Math.round(avgQuestions * 10) / 10,
      results,
      // 追加情報（保存・共有用）
      metadata: {
        timestamp: new Date().toISOString(),
        totalWorksInDb,
        sampleSize: sampleSize > 0 ? sampleSize : totalWorksInDb,
        noiseRates: {
          explore: noiseExplore,
          soft: noiseSoft,
          hard: noiseHard,
        },
        aiGateChoice,
        trialsPerWork,
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
 * シミュレーション実行（内部関数）
 */
async function runSimulation(
  targetWorkId: string,
  noiseRates: { explore: number; soft: number; hard: number },
  aiGateChoice: string,
  config: ReturnType<typeof getMvpConfig>
): Promise<SimulationResult | null> {
  try {
    // 正解作品を取得（タグの詳細情報も含む）
    const targetWork = await prisma.work.findUnique({
      where: { workId: targetWorkId },
      select: {
        workId: true,
        title: true,
        authorName: true,
        isAi: true,
        popularityBase: true,
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

    if (!targetWork) return null;

    const targetTags = new Set(targetWork.workTags.map(wt => wt.tagKey));
    const targetWorkTagsForAnswer = targetWork.workTags.map(wt => ({ displayName: wt.tag.displayName }));
    
    // 作品詳細を整形
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

    // ゲーム登録済みかつ要注意でない作品のみ取得
    const allWorks = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: {
        workId: true,
        isAi: true,
        popularityBase: true,
        popularityPlayBonus: true,
      },
    });

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

    while (questionCount < config.flow.maxQuestions) {
      const probabilities = normalizeWeights(weights);
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
        return a.workId.localeCompare(b.workId);
      });
      const confidence = sorted[0]?.probability ?? 0;
      const topWorkId = sorted[0]?.workId ?? '';

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
          const revealWork = await prisma.work.findUnique({
            where: { workId: forceRevealWorkId },
            select: { title: true },
          });
          const revealWorkTitle = revealWork?.title ?? '(不明)';
          const isCorrect = forceRevealWorkId === targetWorkId;
          questionCount++;
          steps.push({
            qIndex: questionCount,
            question: { kind: 'REVEAL', displayText: `(強制) この作品は「${revealWorkTitle}」ですか？` },
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

      // 自動回答（共通ヘルパーでまとめ・頭文字正規化対応）
      const correctAnswer = getCorrectAnswer(
        question as { kind: string; tagKey?: string; hardConfirmType?: string; hardConfirmValue?: string; isSummaryQuestion?: boolean; summaryDisplayNames?: string[] },
        targetWork,
        targetTags,
        targetWorkTagsForAnswer
      );

      // ノイズを適用（質問タイプ別の確率で逆回答）
      let noiseRateForQuestion = 0;
      if (question.kind === 'EXPLORE_TAG') {
        noiseRateForQuestion = noiseRates.explore;
      } else if (question.kind === 'SOFT_CONFIRM') {
        noiseRateForQuestion = noiseRates.soft;
      } else if (question.kind === 'HARD_CONFIRM') {
        noiseRateForQuestion = noiseRates.hard;
      }
      const wasNoisy = Math.random() < noiseRateForQuestion;
      const actualAnswer = wasNoisy 
        ? (correctAnswer === 'YES' ? 'NO' : 'YES')
        : correctAnswer;

      questionHistory.push({
        qIndex,
        kind: question.kind,
        tagKey: question.tagKey,
        hardConfirmType: question.hardConfirmType,
        hardConfirmValue: question.hardConfirmValue,
        isSummaryQuestion: (question as { isSummaryQuestion?: boolean }).isSummaryQuestion,
        summaryQuestionId: (question as { summaryQuestionId?: string }).summaryQuestionId,
        summaryDisplayNames: (question as { summaryDisplayNames?: string[] }).summaryDisplayNames,
        answer: actualAnswer === 'YES' ? 'YES' : actualAnswer === 'NO' ? 'NO' : undefined,
      });

      // タグのp値（確率ベースカバレッジ）を計算（回答処理前のprobabilitiesで計算）
      let tagCoverage: number | undefined;
      if (question.tagKey) {
        const workIdsWithTag = await prisma.workTag.findMany({
          where: {
            tagKey: question.tagKey,
            workId: { in: weights.map(w => w.workId) },
          },
          select: { workId: true },
        });
        const tagWorkIds = new Set(workIdsWithTag.map(wt => wt.workId));
        tagCoverage = probabilities
          .filter(p => tagWorkIds.has(p.workId))
          .reduce((sum, p) => sum + p.probability, 0);
      }

      weights = await processAnswer(weights, question, actualAnswer, config);

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
        },
        answer: actualAnswer,
        wasNoisy,
        confidenceBefore: confidence,
        confidenceAfter: newConfidence,
        top1WorkId: topWorkId,
        top1Probability: confidence,
        tagCoverage,
      });

      if (newConfidence >= config.confirm.revealThreshold) {
        const revealWorkId = newSorted.find(p => !revealedWrongWorkIds.has(p.workId))?.workId ?? null;
        if (revealWorkId) {
          const revealWork = await prisma.work.findUnique({
            where: { workId: revealWorkId },
            select: { title: true },
          });
          const revealWorkTitle = revealWork?.title ?? '(不明)';
          const isCorrect = revealWorkId === targetWorkId;
          questionCount++;
          steps.push({
            qIndex: questionCount,
            question: {
              kind: 'REVEAL',
              displayText: `断定: この作品は「${revealWorkTitle}」ですか？`,
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
        questionCount++;
        steps.push({
          qIndex: questionCount,
          question: { kind: 'REVEAL', displayText: `(maxQuestions強制) この作品は「${revealWorkTitle}」ですか？` },
          answer: isCorrect ? 'CORRECT' : 'WRONG',
          wasNoisy: false,
          confidenceBefore: forceRevealConf,
          confidenceAfter: forceRevealConf,
          top1WorkId: forceRevealId,
          top1Probability: forceRevealConf,
          revealWorkId: forceRevealId,
          revealWorkTitle,
          revealResult: isCorrect ? 'SUCCESS' : 'MISS',
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
      const fw = await prisma.work.findUnique({
        where: { workId: finalWorkId },
        select: { title: true },
      });
      finalWorkTitle = fw?.title ?? null;
    }

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
      workDetails,
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
