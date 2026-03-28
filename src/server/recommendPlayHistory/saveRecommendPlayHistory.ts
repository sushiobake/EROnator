/**
 * 推薦モードプレイ履歴の保存（1完了プレイ＝1レコード）
 */

import { prisma } from '@/server/db/client';

const MAX_DETAIL_JSON_BYTES = 512 * 1024;

export async function createRecommendPlayHistory(input: {
  recommendSessionId: string;
  sessionStartedAt: Date | null;
  detailJson: string;
  topWorkId: string | null;
  topWorkTitle: string | null;
}): Promise<void> {
  const len = new TextEncoder().encode(input.detailJson).length;
  if (len > MAX_DETAIL_JSON_BYTES) {
    throw new Error('detailJson too large');
  }
  await prisma.recommendPlayHistory.create({
    data: {
      recommendSessionId: input.recommendSessionId,
      sessionStartedAt: input.sessionStartedAt,
      detailJson: input.detailJson,
      topWorkId: input.topWorkId,
      topWorkTitle: input.topWorkTitle,
    },
  });
}

function isMissingClickedFanzaWorkIdColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /clickedFanzaWorkId/.test(msg) && /does not exist/i.test(msg);
}

export async function updateRecommendPlayHistoryClickedFanza(
  recommendSessionId: string,
  fanzaWorkId?: string | null
): Promise<void> {
  const wid =
    typeof fanzaWorkId === 'string' && fanzaWorkId.length > 0 ? fanzaWorkId.slice(0, 128) : null;
  try {
    await prisma.recommendPlayHistory.updateMany({
      where: { recommendSessionId },
      data: {
        clickedFanza: true,
        ...(wid ? { clickedFanzaWorkId: wid } : {}),
      },
    });
  } catch (e) {
    if (!isMissingClickedFanzaWorkIdColumnError(e)) throw e;
    await prisma.recommendPlayHistory.updateMany({
      where: { recommendSessionId },
      data: { clickedFanza: true },
    });
  }
}
