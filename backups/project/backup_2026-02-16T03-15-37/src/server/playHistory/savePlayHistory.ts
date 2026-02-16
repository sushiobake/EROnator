/**
 * プレイ履歴の保存（1プレイ＝1レコード）
 * 質問列・回答列・結果・時刻を保存する。
 */

import { prisma } from '@/server/db/client';
import type { SessionState } from '@/server/session/manager';

export type PlayOutcome = 'SUCCESS' | 'FAIL_LIST' | 'ALMOST_SUCCESS' | 'NOT_IN_LIST';

/**
 * プレイ終了時に1レコード作成（SUCCESS または FAIL_LIST）
 */
export async function createPlayHistory(
  session: SessionState,
  outcome: 'SUCCESS' | 'FAIL_LIST',
  resultWorkId?: string | null
): Promise<void> {
  await prisma.playHistory.create({
    data: {
      sessionId: session.sessionId,
      outcome,
      questionCount: session.questionCount,
      questionHistory: JSON.stringify(session.questionHistory ?? []),
      aiGateChoice: session.aiGateChoice ?? null,
      resultWorkId: resultWorkId ?? null,
      submittedTitleText: null,
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
  resultWorkId: string
): Promise<void> {
  await prisma.playHistory.update({
    where: { sessionId },
    data: {
      outcome: 'ALMOST_SUCCESS',
      resultWorkId,
    },
  });
}
