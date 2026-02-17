/**
 * displayName で既存タグ（OFFICIAL / DERIVED）を解決する
 * タグ作成前に「同名がすでにS/Aにある場合は新規作成せずその tagKey を使う」ために使用
 */

import type { PrismaClient } from '@prisma/client';

/** PrismaClient および $transaction の tx の両方を受け付ける型 */
type PrismaLike = Pick<PrismaClient, 'tag'>;

function norm(s: string): string {
  return (s || '').trim().normalize('NFC');
}

/**
 * 同一 displayName の OFFICIAL または DERIVED タグが既にあればその tagKey を返す。
 * なければ null。カテゴリは問わず「名前」で一意にしたいため。
 */
export async function resolveTagKeyForDisplayName(
  prisma: PrismaLike,
  displayName: string
): Promise<string | null> {
  const name = norm(displayName);
  if (!name) return null;

  const existing = await prisma.tag.findFirst({
    where: {
      displayName: name,
      tagType: { in: ['OFFICIAL', 'DERIVED'] },
    },
    select: { tagKey: true },
  });
  return existing?.tagKey ?? null;
}

/**
 * OFFICIALタグのみを displayName で解決する。
 * - 同名の OFFICIAL が複数ある場合は「ジャンル」でない方を優先する（Sタグ重複防止）。
 * - 存在しなければ null（Sタグは新規作成しない方針のため、呼び出し元でスキップする）。
 */
export async function resolveOfficialTagKeyByDisplayName(
  prisma: PrismaLike,
  displayName: string
): Promise<string | null> {
  const name = norm(displayName);
  if (!name) return null;

  const candidates = await prisma.tag.findMany({
    where: {
      displayName: name,
      tagType: 'OFFICIAL',
    },
    select: { tagKey: true, category: true },
  });

  if (candidates.length === 0) return null;
  const nonGenre = candidates.find((t) => t.category !== 'ジャンル');
  return (nonGenre ?? candidates[0]).tagKey;
}
