/**
 * プレイ履歴の保存（1プレイ＝1レコード）
 * 質問列・回答列・結果・時刻を保存する。
 */

import { prisma } from '@/server/db/client';
import type { FailListContextSnapshot } from '@/server/playHistory/buildFailListContext';
import { SessionManager, type SessionState } from '@/server/session/manager';

export type PlayOutcome = 'SUCCESS' | 'FAIL_LIST' | 'ALMOST_SUCCESS' | 'NOT_IN_LIST' | 'ABANDONED';

/**
 * プレイ終了時に1レコード作成（SUCCESS または FAIL_LIST）
 * @param failListContext FAIL_LIST のときのみ: 候補スナップショット（失敗時は null で保存）
 */
export async function createPlayHistory(
  session: SessionState,
  outcome: 'SUCCESS' | 'FAIL_LIST',
  resultWorkId?: string | null,
  failListContext?: FailListContextSnapshot | null
): Promise<void> {
  const sessionRow = await prisma.session.findUnique({
    where: { sessionId: session.sessionId },
    select: { createdAt: true },
  });
  const sessionStartedAt = sessionRow?.createdAt ?? null;

  let failListContextJson: string | null = null;
  if (outcome === 'FAIL_LIST' && failListContext) {
    try {
      failListContextJson = JSON.stringify(failListContext);
    } catch {
      failListContextJson = null;
    }
  }

  await prisma.playHistory.create({
    data: {
      sessionId: session.sessionId,
      outcome,
      questionCount: session.questionCount,
      questionHistory: JSON.stringify(session.questionHistory ?? []),
      aiGateChoice: session.aiGateChoice ?? null,
      resultWorkId: resultWorkId ?? null,
      submittedTitleText: null,
      sessionStartedAt,
      failListContextJson,
      visitorId: session.visitorId ?? null,
      trafficAttributionJson: session.trafficAttributionJson ?? null,
    },
  });
}

/**
 * FAIL_LIST のあと「リスト外」を送信したときに更新
 */
export async function updatePlayHistoryNotInList(
  sessionId: string,
  submittedTitleText: string
): Promise<void> {
  await prisma.playHistory.update({
    where: { sessionId },
    data: {
      outcome: 'NOT_IN_LIST',
      submittedTitleText,
    },
  });
}

/**
 * FAIL_LIST のあと候補から作品を選んだときに更新
 */
export async function updatePlayHistoryAlmostSuccess(
  sessionId: string,
  resultWorkId: string,
  meta?: { selectedFrom?: 'topCandidates' | 'search'; searchQuery?: string }
): Promise<void> {
  const current = await prisma.playHistory.findUnique({
    where: { sessionId },
    select: { failListContextJson: true },
  });
  let context: Record<string, unknown> = {};
  try {
    context = current?.failListContextJson ? JSON.parse(current.failListContextJson) : {};
  } catch {
    context = {};
  }
  const nextContext = {
    ...context,
    selectedFrom: meta?.selectedFrom ?? 'topCandidates',
    searchQuery: meta?.searchQuery ?? null,
    selectedAt: new Date().toISOString(),
  };
  await prisma.playHistory.update({
    where: { sessionId },
    data: {
      outcome: 'ALMOST_SUCCESS',
      resultWorkId,
      failListContextJson: JSON.stringify(nextContext),
    },
  });
}

/**
 * FANZAで見るリンクをクリックしたときに更新
 */
export async function updatePlayHistoryClickedFanza(sessionId: string): Promise<void> {
  await prisma.playHistory.update({
    where: { sessionId },
    data: { clickedFanza: true },
  });
}

/**
 * 途中離脱（pagehide 等）: まだ PlayHistory が無いセッションのみ 1 件作成。既に終了済みなら no-op。
 */
export async function recordAbandonedPlayHistory(
  sessionId: string
): Promise<{ recorded: boolean; reason?: string }> {
  const existing = await prisma.playHistory.findUnique({
    where: { sessionId },
    select: { id: true },
  });
  if (existing) {
    return { recorded: false, reason: 'play_history_exists' };
  }

  const session = await SessionManager.getSession(sessionId);
  if (!session) {
    return { recorded: false, reason: 'session_not_found' };
  }

  const sessionRow = await prisma.session.findUnique({
    where: { sessionId },
    select: { createdAt: true },
  });
  const sessionStartedAt = sessionRow?.createdAt ?? null;

  await prisma.playHistory.create({
    data: {
      sessionId,
      outcome: 'ABANDONED',
      questionCount: session.questionCount,
      questionHistory: JSON.stringify(session.questionHistory ?? []),
      aiGateChoice: session.aiGateChoice ?? null,
      resultWorkId: null,
      submittedTitleText: null,
      sessionStartedAt,
      failListContextJson: null,
      visitorId: session.visitorId ?? null,
      trafficAttributionJson: session.trafficAttributionJson ?? null,
    },
  });

  return { recorded: true };
}
