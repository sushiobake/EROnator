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

/** Supabase の gameRegistered=true のうち、SQLite の「現在ゲーム登録」セットに無いものを false に更新 */
async function unregisterExcluded(
  prisma: InstanceType<Awaited<typeof import('@prisma/client')>['PrismaClient']>,
  sqliteGameRegisteredIds: Set<string>,
  batchSize: number
): Promise<void> {
  const supabaseRegistered = await prisma.work
    .findMany({
      where: { gameRegistered: true },
      select: { workId: true },
    })
    .then((rows) => rows.map((r) => r.workId));
  const toUnregister = supabaseRegistered.filter((id) => !sqliteGameRegisteredIds.has(id));
  if (toUnregister.length === 0) return;
  console.log(`   📤 ゲーム使用から除外反映: ${toUnregister.length} 件`);
  for (let i = 0; i < toUnregister.length; i += batchSize) {
    const batch = toUnregister.slice(i, i + batchSize);
    await prisma.work.updateMany({
      where: { workId: { in: batch } },
      data: { gameRegistered: false },
    });
  }
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

  // 毎回: SQLite の「現在ゲーム登録すべき」workId 一覧（除外反映で使う）
  const sqliteGameRegisteredRows = db
    .prepare(
      `SELECT workId FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)`
    )
    .all() as { workId: string }[];
  const sqliteGameRegisteredIds = new Set(sqliteGameRegisteredRows.map((r) => r.workId));

  const workQuery =
    lastSyncAt == null
      ? `SELECT * FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)`
      : `SELECT * FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL) AND datetime(updatedAt) > datetime(?)`;

  const workRows = (lastSyncAt == null
    ? db.prepare(workQuery).all()
    : db.prepare(workQuery).all(lastSyncAt)) as Record<string, unknown>[];

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const WORK_BATCH_SIZE = 100;

  // 差分同期で 0 件: 除外反映のあと、Supabase に不足している分だけ SQLite から投入
  if (workRows.length === 0) {
    db.close();
    try {
      if (isIncremental) {
        console.log('📖 同期対象の変更なし。除外反映と不足分の投入を実行します。');
      } else {
        console.log('⚠️  ゲーム登録済みの作品が 0 件です。除外反映のみ実行します。');
      }
      await unregisterExcluded(prisma, sqliteGameRegisteredIds, WORK_BATCH_SIZE);

      // SQLite にはあるが Supabase で gameRegistered=true でない workId を検出し、投入
      const supabaseRegisteredSet = await prisma.work
        .findMany({
          where: { gameRegistered: true },
          select: { workId: true },
        })
        .then((rows) => new Set(rows.map((r) => r.workId)));
      const toBackfill = [...sqliteGameRegisteredIds].filter((id) => !supabaseRegisteredSet.has(id));

      if (toBackfill.length > 0) {
        console.log(`   📥 Supabase に不足している作品を投入: ${toBackfill.length} 件`);
        const db2 = sqlite3(SQLITE_DB, { readonly: true });
        const workRowsBackfill = db2
          .prepare(
            `SELECT * FROM Work WHERE workId IN (${toBackfill.map(() => '?').join(',')})`
          )
          .all(...toBackfill) as Record<string, unknown>[];
        const workTagRowsBackfill = db2
          .prepare(
            `SELECT * FROM WorkTag WHERE workId IN (${toBackfill.map(() => '?').join(',')})`
          )
          .all(...toBackfill) as Record<string, unknown>[];
        const tagKeysBackfill = [...new Set(workTagRowsBackfill.map((r) => r.tagKey as string))];
        let tagRowsBackfill: Record<string, unknown>[] = [];
        if (tagKeysBackfill.length > 0) {
          tagRowsBackfill = db2
            .prepare(
              `SELECT * FROM Tag WHERE tagKey IN (${tagKeysBackfill.map(() => '?').join(',')})`
            )
            .all(...tagKeysBackfill) as Record<string, unknown>[];
        }
        db2.close();

        const TAG_BATCH_SIZE = 100;
        const WORKTAG_BATCH_SIZE = 1000;
        for (let i = 0; i < tagRowsBackfill.length; i += TAG_BATCH_SIZE) {
          const batch = tagRowsBackfill.slice(i, i + TAG_BATCH_SIZE);
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
        }
        for (let i = 0; i < workRowsBackfill.length; i += WORK_BATCH_SIZE) {
          const batch = workRowsBackfill.slice(i, i + WORK_BATCH_SIZE);
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
                  titleReadingInitial: rowToStr(row.titleReadingInitial),
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
                  titleReadingInitial: rowToStr(row.titleReadingInitial),
                },
              })
            )
          );
        }
        for (let i = 0; i < workTagRowsBackfill.length; i += WORKTAG_BATCH_SIZE) {
          const batch = workTagRowsBackfill.slice(i, i + WORKTAG_BATCH_SIZE);
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
        }
        console.log(`   ✅ 不足分の投入: Work ${workRowsBackfill.length} 件, WorkTag ${workTagRowsBackfill.length} 件`);
      }

      saveLastSyncAt();
      console.log('\n🎉 完了しました。');
    } finally {
      await prisma.$disconnect();
    }
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

  const TAG_BATCH_SIZE = 100;
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
              titleReadingInitial: rowToStr(row.titleReadingInitial),
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
              titleReadingInitial: rowToStr(row.titleReadingInitial),
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

    // 毎回: SQLite で「ゲーム使用から除外」された作品を Supabase でも gameRegistered=false に反映
    await unregisterExcluded(prisma, sqliteGameRegisteredIds, WORK_BATCH_SIZE);

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
