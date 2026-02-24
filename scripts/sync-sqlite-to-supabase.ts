/**
 * ローカル SQLite (prisma/dev.db) の「ゲーム登録済み」作品を Supabase (Postgres) に投入する。
 *
 * 実行前:
 * 1. schema.prisma を PostgreSQL 用に切り替える (schema.postgres.prisma を schema.prisma にコピー)
 * 2. DATABASE_URL と DIRECT_URL を Supabase の接続文字列に設定
 * 3. npx prisma generate
 *
 * 実行: tsx scripts/sync-sqlite-to-supabase.ts
 * 差分同期: 2回目以降は updatedAt で前回以降の変更のみ同期（data/last-sync.json に時刻保存）
 * 全件同期: tsx scripts/sync-sqlite-to-supabase.ts --full
 *
 * 実行後: npm run restore:sqlite で手元を SQLite に戻す
 */

import * as path from 'path';
import * as fs from 'fs';

const sqlite3 = require('better-sqlite3');

const PRISMA_DIR = path.join(process.cwd(), 'prisma');
const SQLITE_DB = path.join(PRISMA_DIR, 'dev.db');
const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync.json');

function rowToBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return null;
}

function rowToNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function rowToStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function loadLastSyncAt(): string | null {
  try {
    if (fs.existsSync(LAST_SYNC_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_SYNC_FILE, 'utf-8'));
      return data.lastSyncAt ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveLastSyncAt(): void {
  const dataDir = path.dirname(LAST_SYNC_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({ lastSyncAt: ts }, null, 2), 'utf-8');
}

async function main() {
  const forceFull = process.argv.includes('--full');

  if (!fs.existsSync(SQLITE_DB)) {
    console.error('❌ SQLite DB が見つかりません:', SQLITE_DB);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.error('❌ DATABASE_URL が Postgres を指していません。Supabase の接続文字列を設定してください。');
    process.exit(1);
  }

  const lastSyncAt = forceFull ? null : loadLastSyncAt();
  const isIncremental = lastSyncAt != null;
  if (isIncremental) {
    console.log(`📖 差分同期（前回: ${lastSyncAt}）`);
  } else {
    console.log('📖 全件同期');
  }

  const db = sqlite3(SQLITE_DB, { readonly: true });

  const workQuery =
    lastSyncAt == null
      ? `SELECT * FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)`
      : `SELECT * FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL) AND datetime(updatedAt) > datetime(?)`;

  const workRows = (lastSyncAt == null
    ? db.prepare(workQuery).all()
    : db.prepare(workQuery).all(lastSyncAt)) as Record<string, unknown>[];

  if (workRows.length === 0) {
    if (isIncremental) {
      console.log('✅ 変更なし。スキップします。');
      saveLastSyncAt();
    } else {
      console.log('⚠️  ゲーム登録済みの作品が 0 件です。終了します。');
    }
    db.close();
    process.exit(0);
  }

  const workIds = workRows.map((r) => r.workId as string);
  const workTagRows = db
    .prepare(
      `SELECT * FROM WorkTag WHERE workId IN (${workIds.map(() => '?').join(',')})`
    )
    .all(...workIds) as Record<string, unknown>[];

  const tagKeys = [...new Set(workTagRows.map((r) => r.tagKey as string))];
  let tagRows: Record<string, unknown>[] = [];
  if (tagKeys.length > 0) {
    tagRows = db
      .prepare(
        `SELECT * FROM Tag WHERE tagKey IN (${tagKeys.map(() => '?').join(',')})`
      )
      .all(...tagKeys) as Record<string, unknown>[];
  }

  db.close();
  console.log(`   Works: ${workRows.length} 件, Tags: ${tagRows.length} 件, WorkTags: ${workTagRows.length} 件${isIncremental ? '（差分）' : ''}`);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const TAG_BATCH_SIZE = 100;
  const WORK_BATCH_SIZE = 100;
  const WORKTAG_BATCH_SIZE = 1000;

  try {
    console.log('📥 Supabase に投入中...');

    for (let i = 0; i < tagRows.length; i += TAG_BATCH_SIZE) {
      const batch = tagRows.slice(i, i + TAG_BATCH_SIZE);
      await prisma.$transaction(
        batch.map((row) =>
          prisma.tag.upsert({
            where: { tagKey: row.tagKey as string },
            create: {
              tagKey: row.tagKey as string,
              displayName: row.displayName as string,
              tagType: row.tagType as string,
              category: rowToStr(row.category),
              questionText: rowToStr(row.questionText ?? row.questionTemplate),
            },
            update: {
              displayName: row.displayName as string,
              tagType: row.tagType as string,
              category: rowToStr(row.category),
              questionText: rowToStr(row.questionText ?? row.questionTemplate),
            },
          })
        )
      );
      const done = Math.min(i + TAG_BATCH_SIZE, tagRows.length);
      if (tagRows.length > TAG_BATCH_SIZE) {
        console.log(`   Tag: ${done} / ${tagRows.length} 件`);
      }
    }
    console.log(`   ✅ Tag: ${tagRows.length} 件`);

    for (let i = 0; i < workRows.length; i += WORK_BATCH_SIZE) {
      const batch = workRows.slice(i, i + WORK_BATCH_SIZE);
      await prisma.$transaction(
        batch.map((row) =>
          prisma.work.upsert({
            where: { workId: row.workId as string },
            create: {
              workId: row.workId as string,
              title: row.title as string,
              authorName: row.authorName as string,
              isAi: row.isAi as string,
              popularityBase: Number(row.popularityBase ?? 0),
              popularityPlayBonus: Number(row.popularityPlayBonus ?? 0),
              reviewCount: rowToNum(row.reviewCount),
              reviewAverage: rowToNum(row.reviewAverage) ?? null,
              productUrl: row.productUrl as string,
              affiliateUrl: rowToStr(row.affiliateUrl),
              thumbnailUrl: rowToStr(row.thumbnailUrl),
              sourcePayload: rowToStr(row.sourcePayload) ?? '{}',
              contentId: rowToStr(row.contentId),
              releaseDate: rowToStr(row.releaseDate),
              pageCount: rowToStr(row.pageCount),
              seriesInfo: rowToStr(row.seriesInfo),
              commentText: rowToStr(row.commentText),
              gameRegistered: rowToBool(row.gameRegistered) ?? true,
              needsReview: rowToBool(row.needsReview) ?? false,
              tagSource: rowToStr(row.tagSource),
              aiAnalyzed: rowToBool(row.aiAnalyzed),
              humanChecked: rowToBool(row.humanChecked),
            },
            update: {
              title: row.title as string,
              authorName: row.authorName as string,
              isAi: row.isAi as string,
              popularityBase: Number(row.popularityBase ?? 0),
              popularityPlayBonus: Number(row.popularityPlayBonus ?? 0),
              reviewCount: rowToNum(row.reviewCount),
              reviewAverage: rowToNum(row.reviewAverage) ?? null,
              productUrl: row.productUrl as string,
              affiliateUrl: rowToStr(row.affiliateUrl),
              thumbnailUrl: rowToStr(row.thumbnailUrl),
              sourcePayload: rowToStr(row.sourcePayload) ?? '{}',
              contentId: rowToStr(row.contentId),
              releaseDate: rowToStr(row.releaseDate),
              pageCount: rowToStr(row.pageCount),
              seriesInfo: rowToStr(row.seriesInfo),
              commentText: rowToStr(row.commentText),
              gameRegistered: rowToBool(row.gameRegistered) ?? true,
              needsReview: rowToBool(row.needsReview) ?? false,
              tagSource: rowToStr(row.tagSource),
              aiAnalyzed: rowToBool(row.aiAnalyzed),
              humanChecked: rowToBool(row.humanChecked),
            },
          })
        )
      );
      const done = Math.min(i + WORK_BATCH_SIZE, workRows.length);
      if (workRows.length > WORK_BATCH_SIZE) {
        console.log(`   Work: ${done} / ${workRows.length} 件`);
      }
    }
    console.log(`   ✅ Work: ${workRows.length} 件`);

    // WorkTag はバッチで投入（1件ずつだと13450件で10分以上かかるため）
    for (let i = 0; i < workTagRows.length; i += WORKTAG_BATCH_SIZE) {
      const batch = workTagRows.slice(i, i + WORKTAG_BATCH_SIZE);
      await prisma.$transaction(
        batch.map((row) =>
          prisma.workTag.upsert({
            where: {
              workId_tagKey: {
                workId: row.workId as string,
                tagKey: row.tagKey as string,
              },
            },
            create: {
              workId: row.workId as string,
              tagKey: row.tagKey as string,
              derivedSource: rowToStr(row.derivedSource),
              derivedConfidence: rowToNum(row.derivedConfidence) ?? null,
            },
            update: {
              derivedSource: rowToStr(row.derivedSource),
              derivedConfidence: rowToNum(row.derivedConfidence) ?? null,
            },
          })
        )
      );
      const done = Math.min(i + WORKTAG_BATCH_SIZE, workTagRows.length);
      console.log(`   WorkTag: ${done} / ${workTagRows.length} 件`);
    }
    console.log(`   ✅ WorkTag: ${workTagRows.length} 件`);

    // 全件同期時: SQLite に存在しない Work を Supabase から削除（差分同期では削除しない）
    if (forceFull) {
      const supabaseWorkIds = await prisma.work
        .findMany({
          where: { gameRegistered: true },
          select: { workId: true },
        })
        .then((rows) => rows.map((r) => r.workId));
      const sqliteIdSet = new Set(workIds);
      const toDelete = supabaseWorkIds.filter((id) => !sqliteIdSet.has(id));
      if (toDelete.length > 0) {
        console.log(`   🗑️  Supabase から削除: ${toDelete.length} 件（SQLite に存在しない Work）`);
        for (let i = 0; i < toDelete.length; i += WORK_BATCH_SIZE) {
          const batch = toDelete.slice(i, i + WORK_BATCH_SIZE);
          await prisma.workTag.deleteMany({ where: { workId: { in: batch } } });
          await prisma.work.deleteMany({ where: { workId: { in: batch } } });
        }
      }
    }

    saveLastSyncAt();
    console.log('\n🎉 Supabase への投入が完了しました。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
