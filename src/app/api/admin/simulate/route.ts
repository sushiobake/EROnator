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

interface SimulationResult {
  success: boolean;
  targetWorkId: string;
  targetWorkTitle: string;
  finalWorkId: string | null;
  finalWorkTitle: string | null;
  questionCount: number;
  steps: SimulationStep[];
  outcome: 'SUCCESS' | 'WRONG_REVEAL' | 'FAIL_LIST' | 'MAX_QUESTIONS' | 'ERROR';
  workDetails?: WorkDetails;
  /** 実行時エラー時のみ */
  errorMessage?: string;
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
        outcome = 'FAIL_LIST';
        break;
      }

      questionCount++;
      const qIndex = questionCount;

      // 自動回答を決定
      let correctAnswer: string;
      
      if (question.kind === 'EXPLORE_TAG' || question.kind === 'SOFT_CONFIRM') {
        // タグ質問: 正解作品がそのタグを持っているかで判定
        const hasTag = targetTags.has(question.tagKey!);
        correctAnswer = hasTag ? 'YES' : 'NO';
      } else if (question.kind === 'HARD_CONFIRM') {
        // HARD_CONFIRM: タイトル頭文字または作者名
        if (question.hardConfirmType === 'TITLE_INITIAL') {
          const targetInitial = targetWork.title.charAt(0).toUpperCase();
          const questionInitial = question.hardConfirmValue?.toUpperCase() ?? '';
          correctAnswer = targetInitial === questionInitial ? 'YES' : 'NO';
        } else {
          // AUTHOR
          correctAnswer = targetWork.authorName === question.hardConfirmValue ? 'YES' : 'NO';
        }
      } else {
        correctAnswer = 'DONT_CARE';
      }

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

      // 質問履歴に追加（まとめ質問のときは summaryQuestionId 等を保存し、同一まとめの重複出題を防ぐ）
      questionHistory.push({
        qIndex,
        kind: question.kind,
        tagKey: question.tagKey,
        hardConfirmType: question.hardConfirmType,
        hardConfirmValue: question.hardConfirmValue,
        isSummaryQuestion: (question as { isSummaryQuestion?: boolean }).isSummaryQuestion,
        summaryQuestionId: (question as { summaryQuestionId?: string }).summaryQuestionId,
        summaryDisplayNames: (question as { summaryDisplayNames?: string[] }).summaryDisplayNames,
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

      // ステップを記録
      steps.push({
        qIndex,
        question: {
          kind: question.kind,
          displayText: question.displayText,
          tagKey: question.tagKey,
          hardConfirmType: question.hardConfirmType,
          hardConfirmValue: question.hardConfirmValue,
        },
        answer: actualAnswer,
        wasNoisy,
        confidenceBefore: confidence,
        confidenceAfter: newConfidence,
        top1WorkId: topWorkId,
        top1Probability: confidence,
        tagCoverage,
      });

      // REVEAL判定
      if (newConfidence >= config.confirm.revealThreshold) {
        const revealWorkId = newSorted[0]?.workId;
        
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
          top1WorkId: revealWorkId ?? '',
          top1Probability: newConfidence,
          revealWorkId: revealWorkId,
          revealWorkTitle: revealWorkTitle,
          revealResult: isCorrect ? 'SUCCESS' : 'MISS',
        });
        
        if (isCorrect) {
          // 正解！
          outcome = 'SUCCESS';
          finalWorkId = revealWorkId;
          break;
        } else {
          // 不正解 → ペナルティを適用して続行
          revealMissCount++;
          
          if (revealMissCount >= config.flow.maxRevealMisses) {
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

    const result: SimulationResult = {
      success: outcome === 'SUCCESS',
      targetWorkId,
      targetWorkTitle: targetWork.title,
      finalWorkId,
      finalWorkTitle,
      questionCount,
      steps,
      outcome,
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
        outcome = 'FAIL_LIST';
        break;
      }

      questionCount++;
      const qIndex = questionCount;

      // 自動回答
      let correctAnswer: string;
      if (question.kind === 'EXPLORE_TAG' || question.kind === 'SOFT_CONFIRM') {
        correctAnswer = targetTags.has(question.tagKey!) ? 'YES' : 'NO';
      } else if (question.kind === 'HARD_CONFIRM') {
        if (question.hardConfirmType === 'TITLE_INITIAL') {
          const targetTitle = targetWork.title ?? '';
          const targetInitial = targetTitle.charAt(0).toUpperCase();
          correctAnswer = targetInitial === question.hardConfirmValue?.toUpperCase() ? 'YES' : 'NO';
        } else {
          correctAnswer = (targetWork.authorName ?? '') === question.hardConfirmValue ? 'YES' : 'NO';
        }
      } else {
        correctAnswer = 'DONT_CARE';
      }

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
        const revealWorkId = newSorted[0]?.workId;
        
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
          top1WorkId: revealWorkId ?? '',
          top1Probability: newConfidence,
          revealWorkId: revealWorkId,
          revealWorkTitle: revealWorkTitle,
          revealResult: isCorrect ? 'SUCCESS' : 'MISS',
        });
        
        if (isCorrect) {
          outcome = 'SUCCESS';
          finalWorkId = revealWorkId;
          break;
        } else {
          revealMissCount++;
          if (revealMissCount >= config.flow.maxRevealMisses) {
            outcome = 'FAIL_LIST';
            finalWorkId = revealWorkId;
            break;
          }
          weights = weights.map(w => ({
            workId: w.workId,
            weight: w.workId === revealWorkId 
              ? w.weight * config.algo.revealPenalty 
              : w.weight,
          }));
        }
      }
    }

    return {
      success: outcome === 'SUCCESS',
      targetWorkId,
      targetWorkTitle: targetWork.title,
      finalWorkId,
      finalWorkTitle: null,
      questionCount,
      steps,
      outcome,
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
