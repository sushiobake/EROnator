import { prisma } from '@/server/db/client';
import type { WorkWeight, AiGateChoice } from '@/server/algo/types';
import { randomUUID } from 'crypto';

/** 配列形式（JSON サイズ削減用）: { w: workIds[], v: values[] } */
type WeightsArrayFormat = { w: string[]; v: number[] };

function isArrayFormat(obj: unknown): obj is WeightsArrayFormat {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray((obj as WeightsArrayFormat).w) &&
    Array.isArray((obj as WeightsArrayFormat).v)
  );
}

/** 配列形式 → Record（ロード時） */
function weightsFromStored(raw: unknown): Record<string, number> {
  if (isArrayFormat(raw)) {
    const out: Record<string, number> = {};
    for (let i = 0; i < raw.w.length; i++) {
      out[raw.w[i]] = raw.v[i] ?? 0;
    }
    return out;
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, number>;
  }
  return {};
}

/** Record → 配列形式（保存時、JSON サイズ削減）。/api/start の一括 create 用に export */
export function weightsToStored(weights: Record<string, number>): WeightsArrayFormat {
  const w = Object.keys(weights);
  const v = w.map((k) => weights[k] ?? 0);
  return { w, v };
}

/**
 * セッション状態（内部）
 */
export interface SessionState {
  sessionId: string;
  version: number; // 楽観的ロック用
  aiGateChoice: AiGateChoice | null;
  questionCount: number;
  revealMissCount: number;
  revealRejectedWorkIds: string[];
  weights: Record<string, number>; // { workId: weight }
  weightsHistory: WeightsHistoryEntry[]; // 修正機能用
  questionHistory: QuestionHistoryEntry[];
  visitorId?: string | null;
}

/** 楽観的ロック競合時（他リクエストが先に更新済み） */
export class SessionConflictError extends Error {
  constructor() {
    super('SESSION_CONFLICT');
    this.name = 'SessionConflictError';
  }
}

export interface WeightsHistoryEntry {
  qIndex: number;
  weights: Record<string, number>; // { workId: weight }
}

export interface QuestionHistoryEntry {
  qIndex: number;
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM' | 'SPECIAL_QUESTION' | 'REVEAL';
  tagKey?: string;
  hardConfirmType?: 'TITLE_INITIAL' | 'AUTHOR' | 'CHARACTER';
  hardConfirmValue?: string;
  /** SPECIAL_QUESTION の種別 */
  specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' | 'TITLE_SYLLABLE_2' | 'AUTHOR_CHAR_TYPE';
  /** SPECIAL_QUESTION SERIES の判定用タグキー */
  seriesTagKeys?: string[];
  /** SPECIAL_QUESTION TITLE_CHAR_TYPE の聞く文字種 */
  titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA';
  /** SPECIAL_QUESTION POPULARITY の閾値 */
  popularityThreshold?: number;
  /** SPECIAL_QUESTION TITLE_SYLLABLE / TITLE_SYLLABLE_2 の対象文字 */
  syllableChars?: string[];
  /** SPECIAL_QUESTION AUTHOR_CHAR_TYPE の聞く文字種 */
  authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA';
  /** 表示用文言（修正するで戻ったときに同じ文言を出すため） */
  displayText?: string;
  /** まとめ質問のとき true。回答時の strength を ±0.6 に固定する */
  isSummaryQuestion?: boolean;
  /** まとめ質問の id（同じまとめを重複出題しないため） */
  summaryQuestionId?: string;
  /** まとめ質問の displayNames（回答時のグループ判定に使用） */
  summaryDisplayNames?: string[];
  /** 回答（YES / NO / PROBABLY_YES / PROBABLY_NO / UNKNOWN / DONT_CARE。表示・リプレイ用にそのまま保存） */
  answer?: string;
  /** この質問画面での滞在秒数（表示〜回答まで） */
  durationSeconds?: number;
  /** EXPLORE_TAG の出所（まとめ/エロ/抽象/通常）。表示は変えずタグ・バッジ用 */
  exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal';
  /** REVEAL 断定行（履歴・リプレイ用） */
  revealWorkId?: string;
  revealWorkTitle?: string;
  revealResult?: 'SUCCESS' | 'MISS' | string;
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
   * weightsHistory は別テーブル SessionWeightsSnapshot から取得（肥大化対策）。なければ従来の session.weightsHistory を参照（互換）
   */
  static async getSession(sessionId: string): Promise<SessionState | null> {
    const session = await prisma.session.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return null;
    }

    const snapshots = await prisma.sessionWeightsSnapshot.findMany({
      where: { sessionId },
      orderBy: { qIndex: 'asc' },
    });
    let weightsHistory: WeightsHistoryEntry[];
    if (snapshots.length > 0) {
      weightsHistory = snapshots.map((s) => ({
        qIndex: s.qIndex,
        weights: weightsFromStored(JSON.parse(s.weightsJson)),
      }));
    } else {
      const legacyRaw = JSON.parse((session as { weightsHistory?: string }).weightsHistory ?? '[]') as WeightsHistoryEntry[];
      weightsHistory = legacyRaw.map((e) => ({
        qIndex: e.qIndex,
        weights: weightsFromStored(e.weights),
      }));
    }

    return {
      sessionId: session.sessionId,
      version: (session as { version?: number }).version ?? 0,
      aiGateChoice: (session.aiGateChoice as AiGateChoice) || null,
      questionCount: session.questionCount,
      revealMissCount: session.revealMissCount,
      revealRejectedWorkIds: JSON.parse(session.revealRejectedWorkIds || '[]'),
      weights: weightsFromStored(JSON.parse(session.weights || '{}')),
      weightsHistory,
      questionHistory: JSON.parse(session.questionHistory || '[]'),
      visitorId: (session as { visitorId?: string | null }).visitorId ?? null,
    };
  }

  /**
   * セッション更新
   * パフォーマンス最適化: 部分更新をサポート（getSessionをスキップ可能）
   */
  static async updateSession(
    sessionId: string,
    updates: Partial<SessionState>,
    currentSession?: SessionState // オプション: 既に取得済みのセッションを渡すことでgetSessionをスキップ
  ): Promise<void> {
    const current = currentSession ?? await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated: SessionState = {
      ...current,
      ...updates,
    };

    if (updates.weightsHistory !== undefined) {
      await prisma.sessionWeightsSnapshot.deleteMany({ where: { sessionId } });
      if (updated.weightsHistory.length > 0) {
        // qIndex ごとに1件に絞る（同じ qIndex が複数あると unique 制約でエラーになる）
        const byQIndex = new Map<number, WeightsHistoryEntry>();
        for (const e of updated.weightsHistory) {
          byQIndex.set(e.qIndex, e);
        }
        const deduped = Array.from(byQIndex.entries()).sort((a, b) => a[0] - b[0]).map(([, e]) => e);
        await prisma.sessionWeightsSnapshot.createMany({
          data: deduped.map((e) => ({
            sessionId,
            qIndex: e.qIndex,
            weightsJson: JSON.stringify(weightsToStored(e.weights)),
          })),
        });
      }
    }

    const existing = await prisma.session.findUnique({
      where: { sessionId },
      select: { weightsHistory: true },
    });
    const weightsHistoryColumn =
      updates.weightsHistory !== undefined ? '[]' : (existing?.weightsHistory ?? '[]');

    const result = await prisma.session.updateMany({
      where: { sessionId, version: current.version },
      data: {
        version: current.version + 1,
        aiGateChoice: updated.aiGateChoice || null,
        questionCount: updated.questionCount,
        revealMissCount: updated.revealMissCount,
        revealRejectedWorkIds: JSON.stringify(updated.revealRejectedWorkIds),
        weights: JSON.stringify(weightsToStored(updated.weights)),
        weightsHistory: weightsHistoryColumn,
        questionHistory: JSON.stringify(updated.questionHistory),
      },
    });
    if (result.count === 0) {
      throw new SessionConflictError();
    }
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
   * 別テーブル SessionWeightsSnapshot に upsert（REVEAL→NO の二重クリック等で重複時は上書き）
   */
  static async saveWeightsSnapshot(
    sessionId: string,
    qIndex: number,
    weights: WorkWeight[]
  ): Promise<void> {
    const weightsMap: Record<string, number> = {};
    for (const w of weights) {
      weightsMap[w.workId] = w.weight;
    }
    const weightsJson = JSON.stringify(weightsToStored(weightsMap));
    await prisma.sessionWeightsSnapshot.upsert({
      where: { sessionId_qIndex: { sessionId, qIndex } },
      create: { sessionId, qIndex, weightsJson },
      update: { weightsJson },
    });
  }

  /**
   * 指定した質問番号までロールバック（修正機能用）
   * - 復元する重みは「その質問に回答する前」の状態（qIndex のスナップショット＝回答前）
   * - ロールバック後は weightsHistory からその qIndex を除く（再度回答したときに重複しないように）
   */
  static async rollbackToQuestion(
    sessionId: string,
    targetQIndex: number
  ): Promise<{ success: boolean; question?: QuestionHistoryEntry }> {
    const current = await this.getSession(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // 表示する質問履歴: 指定質問番号以下
    const filteredHistory = current.questionHistory.filter(q => q.qIndex <= targetQIndex);
    if (filteredHistory.length === 0) {
      console.error('[rollbackToQuestion] No question history found for qIndex <=', targetQIndex);
      return { success: false };
    }

    // 復元する重み: qIndex === targetQIndex のスナップショット（＝その質問に回答する前の状態）
    let targetSnapshot = current.weightsHistory.find(w => w.qIndex === targetQIndex);
    if (!targetSnapshot && targetQIndex > 0) {
      // フォールバック: targetQIndex 未満で最大のスナップショット（質問 N の直前＝N-1 の回答後）
      const below = current.weightsHistory.filter(w => w.qIndex < targetQIndex);
      if (below.length > 0) {
        targetSnapshot = below.reduce((a, b) => (a.qIndex > b.qIndex ? a : b));
      }
    }
    if (!targetSnapshot) {
      console.error('[rollbackToQuestion] No weights snapshot found for qIndex', targetQIndex);
      return { success: false };
    }

    // 戻す質問は必ず qIndex === targetQIndex の1件（同じ質問にならないケースを防ぐ）
    const targetQuestion = filteredHistory.find(q => q.qIndex === targetQIndex);
    if (!targetQuestion) {
      console.error('[rollbackToQuestion] No question entry for qIndex', targetQIndex);
      return { success: false };
    }

    // 別テーブルのスナップショットから qIndex >= targetQIndex を削除（戻る先より後を破棄）
    await prisma.sessionWeightsSnapshot.deleteMany({
      where: { sessionId, qIndex: { gte: targetQIndex } },
    });

    // questionCount は「回答数」（0始まり）。表示は questionCount+1 なので、targetQIndex 問目に戻すときは questionCount = targetQIndex - 1
    await this.updateSession(sessionId, {
      questionHistory: filteredHistory,
      weights: targetSnapshot.weights,
      questionCount: targetQIndex - 1,
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
