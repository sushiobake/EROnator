/**
 * REVEAL分析構築
 * 断定（結果表示）時の確度・タグ整合度を計算
 */

import { prisma } from '@/server/db/client';
import type { SessionState } from '@/server/session/manager';
import type { WorkProbability } from '@/server/algo/types';

export interface RevealAnalysis {
  confidence: number; // 確度（既存）
  tagAlignment: {
    matchedTags: string[]; // 一致したタグ（質問でYES/たぶんそうと答えたタグが作品に存在）
    unmatchedTags: string[]; // 不一致のタグ（質問でYES/たぶんそうと答えたタグが作品に存在しない）
    alignmentScore: number; // 0-1の整合度スコア
  };
  questionSummary: {
    totalQuestions: number;
    exploreTagCount: number;
    confirmCount: number;
    keyTags: Array<{
      tagKey: string;
      displayName: string;
      answered: 'YES' | 'PROBABLY_YES' | 'NO' | 'PROBABLY_NO' | 'UNKNOWN' | 'DONT_CARE';
    }>;
  };
}

/**
 * REVEAL分析を構築
 * @param session セッション状態
 * @param topWorkId トップ作品ID
 * @param probabilities 確率配列（confidence計算用）
 */
export async function buildRevealAnalysis(
  session: SessionState,
  topWorkId: string,
  probabilities: WorkProbability[]
): Promise<RevealAnalysis> {
  // 確度計算
  const sorted = [...probabilities].sort((a, b) => {
    if (a.probability !== b.probability) {
      return b.probability - a.probability;
    }
    return a.workId.localeCompare(b.workId);
  });
  const confidence = sorted[0]?.probability ?? 0;

  // トップ作品のタグを取得
  const topWork = await prisma.work.findUnique({
    where: { workId: topWorkId },
    include: {
      workTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  const workTagKeys = new Set(
    topWork?.workTags.map(wt => wt.tagKey) ?? []
  );

  // 質問履歴からタグ整合度を計算
  // 注意: 質問履歴には回答が含まれていないため、実際の回答を推測できない
  // ここでは質問されたタグが作品に存在するかどうかをチェック
  const questionHistory = session.questionHistory;
  const exploreTagQuestions = questionHistory.filter(q => q.kind === 'EXPLORE_TAG' && q.tagKey);
  const softConfirmQuestions = questionHistory.filter(q => q.kind === 'SOFT_CONFIRM' && q.tagKey);

  const allQuestionedTagKeys = new Set<string>();
  exploreTagQuestions.forEach(q => {
    if (q.tagKey) allQuestionedTagKeys.add(q.tagKey);
  });
  softConfirmQuestions.forEach(q => {
    if (q.tagKey) allQuestionedTagKeys.add(q.tagKey);
  });

  // 一致・不一致タグを分類
  const matchedTags: string[] = [];
  const unmatchedTags: string[] = [];

  for (const tagKey of allQuestionedTagKeys) {
    if (workTagKeys.has(tagKey)) {
      matchedTags.push(tagKey);
    } else {
      unmatchedTags.push(tagKey);
    }
  }

  // 整合度スコア計算（一致タグ数 / 質問されたタグ数）
  const alignmentScore = allQuestionedTagKeys.size > 0
    ? matchedTags.length / allQuestionedTagKeys.size
    : 0;

  // タグの表示名を取得
  const tagMap = new Map<string, string>();
  if (allQuestionedTagKeys.size > 0) {
    const tags = await prisma.tag.findMany({
      where: {
        tagKey: { in: Array.from(allQuestionedTagKeys) },
      },
      select: {
        tagKey: true,
        displayName: true,
      },
    });
    tags.forEach(tag => {
      tagMap.set(tag.tagKey, tag.displayName);
    });
  }

  // 質問要約
  const exploreTagCount = exploreTagQuestions.length;
  const confirmCount = questionHistory.filter(q => 
    q.kind === 'SOFT_CONFIRM' || q.kind === 'HARD_CONFIRM'
  ).length;

  // キータグ（質問されたタグ）を取得
  // 注意: 実際の回答は履歴に保存されていないため、タグが質問されたことのみを記録
  const keyTags = Array.from(allQuestionedTagKeys).map(tagKey => ({
    tagKey,
    displayName: tagMap.get(tagKey) ?? tagKey,
    answered: 'UNKNOWN' as const, // 回答情報がないためUNKNOWN
  }));

  return {
    confidence,
    tagAlignment: {
      matchedTags: matchedTags.map(tagKey => tagMap.get(tagKey) ?? tagKey),
      unmatchedTags: unmatchedTags.map(tagKey => tagMap.get(tagKey) ?? tagKey),
      alignmentScore,
    },
    questionSummary: {
      totalQuestions: questionHistory.length,
      exploreTagCount,
      confirmCount,
      keyTags,
    },
  };
}
