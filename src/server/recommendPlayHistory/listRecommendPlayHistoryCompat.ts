/**
 * 管理画面用 RecommendPlayHistory 一覧。
 * Prisma の findMany はスキーマ上の全スカラーを読むため、DB に clickedFanzaWorkId が無いと本番で 500 になる。
 * ここでは常に $queryRaw で「存在が保証されている列だけ」読み、findMany は使わない。
 * 列を追加したあとは下の OPTIONAL_COL を足すと一覧に workId も出せる（任意）。
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { isSqlite } from '@/server/db/is-sqlite';

type AdminRow = {
  id: string;
  recommendSessionId: string;
  sessionStartedAt: Date | null;
  clickedFanza: boolean;
  clickedFanzaWorkId: string | null;
  detailJson: string;
  topWorkId: string | null;
  topWorkTitle: string | null;
  createdAt: Date;
};

function coerceDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function coerceBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  return false;
}

/** DB に列があるか（プロセス内キャッシュ）。一覧の SELECT 列を切り替える */
let cachedHasClickedFanzaWorkId: boolean | null = null;

async function hasClickedFanzaWorkIdColumn(): Promise<boolean> {
  if (cachedHasClickedFanzaWorkId !== null) return cachedHasClickedFanzaWorkId;
  try {
    if (isSqlite()) {
      const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        'PRAGMA table_info("RecommendPlayHistory")'
      );
      cachedHasClickedFanzaWorkId = rows.some((r) => r.name === 'clickedFanzaWorkId');
    } else {
      const r = await prisma.$queryRaw<Array<{ c: bigint | number }>>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS c
          FROM information_schema.columns
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND column_name = 'clickedFanzaWorkId'
            AND (
              table_name = 'RecommendPlayHistory'
              OR LOWER(table_name) = 'recommendplayhistory'
            )
        `
      );
      cachedHasClickedFanzaWorkId = Number(r[0]?.c ?? 0) > 0;
    }
  } catch {
    cachedHasClickedFanzaWorkId = false;
  }
  return cachedHasClickedFanzaWorkId;
}

export async function listRecommendPlayHistoryAdminPage(
  offset: number,
  limit: number
): Promise<AdminRow[]> {
  const hasWid = await hasClickedFanzaWorkIdColumn();

  if (hasWid) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        recommendSessionId: string;
        sessionStartedAt: unknown;
        clickedFanza: unknown;
        clickedFanzaWorkId: string | null;
        detailJson: string;
        topWorkId: string | null;
        topWorkTitle: string | null;
        createdAt: unknown;
      }>
    >(Prisma.sql`
      SELECT "id", "recommendSessionId", "sessionStartedAt", "clickedFanza", "clickedFanzaWorkId", "detailJson", "topWorkId", "topWorkTitle", "createdAt"
      FROM "RecommendPlayHistory"
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.map((row) => ({
      id: row.id,
      recommendSessionId: row.recommendSessionId,
      sessionStartedAt: coerceDate(row.sessionStartedAt),
      clickedFanza: coerceBool(row.clickedFanza),
      clickedFanzaWorkId: row.clickedFanzaWorkId ?? null,
      detailJson: row.detailJson ?? '{}',
      topWorkId: row.topWorkId,
      topWorkTitle: row.topWorkTitle,
      createdAt: coerceDate(row.createdAt) ?? new Date(0),
    }));
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      recommendSessionId: string;
      sessionStartedAt: unknown;
      clickedFanza: unknown;
      detailJson: string;
      topWorkId: string | null;
      topWorkTitle: string | null;
      createdAt: unknown;
    }>
  >(Prisma.sql`
    SELECT "id", "recommendSessionId", "sessionStartedAt", "clickedFanza", "detailJson", "topWorkId", "topWorkTitle", "createdAt"
    FROM "RecommendPlayHistory"
    ORDER BY "createdAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return rows.map((row) => ({
    id: row.id,
    recommendSessionId: row.recommendSessionId,
    sessionStartedAt: coerceDate(row.sessionStartedAt),
    clickedFanza: coerceBool(row.clickedFanza),
    clickedFanzaWorkId: null,
    detailJson: row.detailJson ?? '{}',
    topWorkId: row.topWorkId,
    topWorkTitle: row.topWorkTitle,
    createdAt: coerceDate(row.createdAt) ?? new Date(0),
  }));
}

export async function countRecommendPlayHistoryAdmin(): Promise<number> {
  const r = await prisma.$queryRaw<[{ n: bigint | number }]>(
    Prisma.sql`SELECT COUNT(*) AS n FROM "RecommendPlayHistory"`
  );
  const n = r[0]?.n;
  return typeof n === 'bigint' ? Number(n) : Number(n ?? 0);
}
