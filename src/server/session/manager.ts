import { prisma } from '@/server/db/client';
import type { WorkWeight, AiGateChoice } from '@/server/algo/types';
import { randomUUID } from 'crypto';

/**
 * セッション状態（内部）
 */
export interface SessionState {
  sessionId: string;
  aiGateChoice: AiGateChoice | null;
  questionCount: number;
  revealMissCount: number;
  revealRejectedWorkIds: string[];
  weights: Record<string, number>; // { workId: weight }
  weightsHistory: WeightsHistoryEntry[]; // 修正機能用
  questionHistory: QuestionHistoryEntry[];
}

export interface WeightsHistoryEntry {
  qIndex: number;
  weights: Record<string, number>; // { workId: weight }
}

export interface QuestionHistoryEntry {
  qIndex: number;
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';
  tagKey?: string;
  hardConfirmType?: 'TITLE_INITIAL' | 'AUTHOR';
  hardConfirmValue?: string;
}

/**
 * セッション管理
 */
export class SessionManager {
  /**
   * 新規セッション作成
   */
  static async createSession(): Promise<string> {
    const sessionId = randomUUID();
    await prisma.session.create({
      data: {
        sessionId,
        aiGateChoice: null,
        questionCount: 0,
        revealMissCount: 0,
        revealRejectedWorkIds: JSON.stringify([]),
        weights: JSON.stringify({}),
        weightsHistory: JSON.stringify([]),
        questionHistory: JSON.stringify([]),
      },
    });
    return sessionId;
  }

  /**
   * セッション取得
   */
  static async getSession(sessionId: string): Promise<SessionState | null> {
    const session = await prisma.session.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      aiGateChoice: (session.aiGateChoice as AiGateChoice) || null,
      questionCount: session.questionCount,
      revealMissCount: session.revealMissCount,
      revealRejectedWorkIds: JSON.parse(session.revealRejectedWorkIds || '[]'),
      weights: JSON.parse(session.weights || '{}'),
      weightsHistory: JSON.parse((session as any).weightsHistory ?? '[]'),
      questionHistory: JSON.parse(session.questionHistory || '[]'),
    };
  }

  /**
   * セッション更新
   */
  static async updateSession(
    sessionId: string,
    updates: Partial<SessionState>
  ): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated: SessionState = {
      ...current,
      ...updates,
    };

    await prisma.session.update({
      where: { sessionId },
      data: {
        aiGateChoice: updated.aiGateChoice || null,
        questionCount: updated.questionCount,
        revealMissCount: updated.revealMissCount,
        revealRejectedWorkIds: JSON.stringify(updated.revealRejectedWorkIds),
        weights: JSON.stringify(updated.weights),
        weightsHistory: JSON.stringify(updated.weightsHistory),
        questionHistory: JSON.stringify(updated.questionHistory),
      } as any, // 一時的な回避策: Prisma Client再生成前の型エラー回避
    });
  }

  /**
   * AI_GATE選択を保存
   */
  static async setAiGateChoice(
    sessionId: string,
    choice: AiGateChoice
  ): Promise<void> {
    await this.updateSession(sessionId, { aiGateChoice: choice });
  }

  /**
   * 重みを更新
   */
  static async updateWeights(
    sessionId: string,
    weights: WorkWeight[]
  ): Promise<void> {
    const weightsMap: Record<string, number> = {};
    for (const w of weights) {
      weightsMap[w.workId] = w.weight;
    }
    await this.updateSession(sessionId, { weights: weightsMap });
  }

  /**
   * 質問履歴に追加
   */
  static async addQuestionHistory(
    sessionId: string,
    entry: QuestionHistoryEntry
  ): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newHistory = [...current.questionHistory, entry];
    await this.updateSession(sessionId, { questionHistory: newHistory });
  }

  /**
   * REVEAL拒否WorkIdを追加
   */
  static async addRejectedWorkId(
    sessionId: string,
    workId: string
  ): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newRejected = [...current.revealRejectedWorkIds];
    if (!newRejected.includes(workId)) {
      newRejected.push(workId);
    }

    await this.updateSession(sessionId, {
      revealRejectedWorkIds: newRejected,
    });
  }

  /**
   * 質問カウントをインクリメント
   */
  static async incrementQuestionCount(sessionId: string): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.updateSession(sessionId, {
      questionCount: current.questionCount + 1,
    });
  }

  /**
   * 重みのスナップショットを保存（修正機能用）
   */
  static async saveWeightsSnapshot(
    sessionId: string,
    qIndex: number,
    weights: WorkWeight[]
  ): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const weightsMap: Record<string, number> = {};
    for (const w of weights) {
      weightsMap[w.workId] = w.weight;
    }

    const newHistory = [...current.weightsHistory, { qIndex, weights: weightsMap }];
    await this.updateSession(sessionId, { weightsHistory: newHistory });
  }

  /**
   * 指定した質問番号までロールバック（修正機能用）
   */
  static async rollbackToQuestion(
    sessionId: string,
    targetQIndex: number
  ): Promise<{ success: boolean; question?: QuestionHistoryEntry }> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // 指定した質問番号より後の履歴を削除
    const filteredHistory = current.questionHistory.filter(q => q.qIndex <= targetQIndex);
    const filteredWeightsHistory = current.weightsHistory.filter(w => w.qIndex <= targetQIndex);

    // 指定した質問番号の重みを復元
    const targetSnapshot = filteredWeightsHistory.find(w => w.qIndex === targetQIndex);
    if (!targetSnapshot) {
      return { success: false };
    }

    // 指定した質問番号の質問を取得
    const targetQuestion = filteredHistory.find(q => q.qIndex === targetQIndex);
    if (!targetQuestion) {
      return { success: false };
    }

    // セッションを更新
    await this.updateSession(sessionId, {
      questionHistory: filteredHistory,
      weightsHistory: filteredWeightsHistory,
      weights: targetSnapshot.weights,
      questionCount: targetQIndex,
    });

    return { success: true, question: targetQuestion };
  }

  /**
   * REVEAL missカウントをインクリメント
   */
  static async incrementRevealMissCount(sessionId: string): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.updateSession(sessionId, {
      revealMissCount: current.revealMissCount + 1,
    });
  }
}
