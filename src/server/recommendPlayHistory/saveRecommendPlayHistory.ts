/**
 * 推薦モードプレイ履歴の保存（1完了プレイ＝1レコード）
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/server/db/client';

const MAX_DETAIL_JSON_BYTES = 512 * 1024;

/** Prisma create が「存在しない列」を INSERT に含めて失敗する DB 向け（clickedFanzaWorkId 未マイグレーション等） */
function isMissingColumnCreateError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /does not exist/i.test(msg) && (/column/i.test(msg) || /clickedFanzaWorkId/i.test(msg));
}

async function insertRecommendPlayHistoryWithoutOptionalColumns(input: {
  recommendSessionId: string;
  sessionStartedAt: Date | null;
  detailJson: string;
  topWorkId: string | null;
  topWorkTitle: string | null;
}): Promise<void> {
  const id = randomUUID();
  const createdAt = new Date();
  await prisma.$executeRaw`
    INSERT INTO "RecommendPlayHistory" ("id", "recommendSessionId", "sessionStartedAt", "clickedFanza", "detailJson", "topWorkId", "topWorkTitle", "createdAt")
    VALUES (${id}, ${input.recommendSessionId}, ${input.sessionStartedAt}, false, ${input.detailJson}, ${input.topWorkId}, ${input.topWorkTitle}, ${createdAt})
  `;
}

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
  try {
    await prisma.recommendPlayHistory.create({
      data: {
        recommendSessionId: input.recommendSessionId,
        sessionStartedAt: input.sessionStartedAt,
        detailJson: input.detailJson,
        topWorkId: input.topWorkId,
        topWorkTitle: input.topWorkTitle,
      },
    });
  } catch (e) {
    if (!isMissingColumnCreateError(e)) throw e;
    await insertRecommendPlayHistoryWithoutOptionalColumns(input);
  }
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
