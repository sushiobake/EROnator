/**
 * DATABASE_URL が file: のとき、Prisma を経由せず SQLite を直接読む。
 * 人力タグ付けの一覧・件数で「フォルダにデータが入っているのに 0 件」を防ぐ。
 */

import path from 'path';
import fs from 'fs';

const FOLDERS = ['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const;

function getSqlitePath(): string | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || (!dbUrl.startsWith('file:') && !dbUrl.startsWith('file://'))) return null;
  const withoutFile = dbUrl.replace(/^file:\/\//, '').replace(/^file:/, '');
  const queryStart = withoutFile.indexOf('?');
  const pathPart = queryStart >= 0 ? withoutFile.slice(0, queryStart) : withoutFile;
  const resolved = pathPart.startsWith('./') || pathPart.startsWith('.\\')
    ? path.resolve(process.cwd(), pathPart)
    : pathPart;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

export function isSqlite(): boolean {
  return getSqlitePath() != null;
}

function openDb() {
  const dbPath = getSqlitePath();
  if (!dbPath) throw new Error('SQLite path not available');
  const Database = require('better-sqlite3');
  return new Database(dbPath, { readonly: true });
}

export type ManualTaggingWork = {
  workId: string;
  title: string;
  authorName: string;
  taggedAt?: string | null;
};

export function getWorksFromSqlite(
  filter: (typeof FOLDERS)[number],
  limit: number,
  offset: number
): { total: number; works: ManualTaggingWork[] } {
  const db = openDb();
  try {
    const countRow = db
      .prepare('SELECT COUNT(*) as count FROM Work WHERE commentText IS NOT NULL AND manualTaggingFolder = ?')
      .get(filter) as { count: number } | undefined;
    const total = countRow?.count ?? 0;

    let rows: ManualTaggingWork[];
    if (filter === 'pending') {
      rows = db
        .prepare(
          `SELECT workId, title, authorName FROM Work
           WHERE commentText IS NOT NULL AND manualTaggingFolder = 'pending'
           ORDER BY checkQueueAt DESC, updatedAt DESC
           LIMIT ? OFFSET ?`
        )
        .all(limit, offset) as ManualTaggingWork[];
    } else if (filter === 'tagged') {
      rows = db
        .prepare(
          `SELECT workId, title, authorName, taggedAt FROM Work
           WHERE commentText IS NOT NULL AND manualTaggingFolder = 'tagged'
           ORDER BY COALESCE(taggedAt, updatedAt) DESC LIMIT ? OFFSET ?`
        )
        .all(limit, offset) as ManualTaggingWork[];
    } else {
      rows = db
        .prepare(
          'SELECT workId, title, authorName FROM Work WHERE commentText IS NOT NULL AND manualTaggingFolder = ? ORDER BY updatedAt DESC LIMIT ? OFFSET ?'
        )
        .all(filter, limit, offset) as ManualTaggingWork[];
    }
    return { total, works: rows };
  } finally {
    db.close();
  }
}

export function getCountsFromSqlite(): Record<string, number> {
  const db = openDb();
  try {
    const result: Record<string, number> = {};
    for (const folder of FOLDERS) {
      const row = db
        .prepare(
          'SELECT COUNT(*) as count FROM Work WHERE commentText IS NOT NULL AND manualTaggingFolder = ?'
        )
        .get(folder) as { count: number } | undefined;
      result[folder] = row?.count ?? 0;
    }
    return result;
  } finally {
    db.close();
  }
}
