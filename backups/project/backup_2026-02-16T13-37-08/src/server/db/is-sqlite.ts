/**
 * DATABASE_URL が SQLite (file:) かどうかだけ判定する。
 * Vercel（Postgres）ではここだけ import し、sqlite-direct は動的 import で読まない。
 */

export function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL ?? '';
  return dbUrl.startsWith('file:') || dbUrl.startsWith('file://');
}
