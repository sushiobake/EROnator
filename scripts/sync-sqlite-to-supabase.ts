/**
 * ローカル SQLite (prisma/dev.db) の「ゲーム登録済み」作品を Supabase (Postgres) に投入する。
 *
 * 実行前:
 * 1. schema.prisma を PostgreSQL 用に切り替える (schema.postgres.prisma を schema.prisma にコピー)
 * 2. DATABASE_URL と DIRECT_URL を Supabase の接続文字列に設定
 * 3. npx prisma generate
 *
 * 実行: tsx scripts/sync-sqlite-to-supabase.ts
 *
 * 実行後: npm run restore:sqlite で手元を SQLite に戻す
 */

import * as path from 'path';
import * as fs from 'fs';

const sqlite3 = require('better-sqlite3');

const PRISMA_DIR = path.join(process.cwd(), 'prisma');
const SQLITE_DB = path.join(PRISMA_DIR, 'dev.db');

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

async function main() {
  if (!fs.existsSync(SQLITE_DB)) {
    console.error('❌ SQLite DB が見つかりません:', SQLITE_DB);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.error('❌ DATABASE_URL が Postgres を指していません。Supabase の接続文字列を設定してください。');
    process.exit(1);
  }

  console.log('📖 SQLite からゲーム登録済み作品を読み込み中...');
  const db = sqlite3(SQLITE_DB, { readonly: true });

  const workRows = db
    .prepare(
      `SELECT * FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)`
    )
    .all() as Record<string, unknown>[];

  if (workRows.length === 0) {
    console.log('⚠️  ゲーム登録済みの作品が 0 件です。終了します。');
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
  console.log(`   Works: ${workRows.length} 件, Tags: ${tagRows.length} 件, WorkTags: ${workTagRows.length} 件`);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    console.log('📥 Supabase に投入中...');

    for (const row of tagRows) {
      await prisma.tag.upsert({
        where: { tagKey: row.tagKey as string },
        create: {
          tagKey: row.tagKey as string,
          displayName: row.displayName as string,
          tagType: row.tagType as string,
          category: rowToStr(row.category),
          questionTemplate: rowToStr(row.questionTemplate),
        },
        update: {
          displayName: row.displayName as string,
          tagType: row.tagType as string,
          category: rowToStr(row.category),
          questionTemplate: rowToStr(row.questionTemplate),
        },
      });
    }
    console.log(`   ✅ Tag: ${tagRows.length} 件`);

    for (const row of workRows) {
      await prisma.work.upsert({
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
      });
    }
    console.log(`   ✅ Work: ${workRows.length} 件`);

    for (const row of workTagRows) {
      await prisma.workTag.upsert({
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
      });
    }
    console.log(`   ✅ WorkTag: ${workTagRows.length} 件`);

    console.log('\n🎉 Supabase への投入が完了しました。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
