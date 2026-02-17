/**
 * SQLiteデータベースからSupabaseへの直接移行スクリプト
 * better-sqlite3を使用してSQLiteを直接読み取り、Supabaseに移行
 */

const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const sqlitePath = path.join(__dirname, '..', 'prisma', 'dev.db');
const sqliteDb = new Database(sqlitePath);
const postgresClient = new PrismaClient();

async function migrateData() {
  console.log('🚀 SQLite → Supabase 直接移行を開始します...\n');

  try {
    // 1. Worksの移行
    console.log('📦 Worksを移行中...');
    const works = sqliteDb.prepare('SELECT * FROM Work').all();
    console.log(`   ${works.length}件のWorksが見つかりました`);

    for (const work of works) {
      await postgresClient.work.upsert({
        where: { workId: work.workId },
        update: {
          title: work.title,
          authorName: work.authorName,
          isAi: work.isAi,
          popularityBase: work.popularityBase,
          popularityPlayBonus: work.popularityPlayBonus,
          reviewCount: work.reviewCount,
          reviewAverage: work.reviewAverage,
          productUrl: work.productUrl,
          thumbnailUrl: work.thumbnailUrl,
          sourcePayload: work.sourcePayload || '{}',
        },
        create: {
          workId: work.workId,
          title: work.title,
          authorName: work.authorName,
          isAi: work.isAi,
          popularityBase: work.popularityBase,
          popularityPlayBonus: work.popularityPlayBonus,
          reviewCount: work.reviewCount,
          reviewAverage: work.reviewAverage,
          productUrl: work.productUrl,
          thumbnailUrl: work.thumbnailUrl,
          sourcePayload: work.sourcePayload || '{}',
        },
      });
    }
    console.log(`   ✅ ${works.length}件のWorksを移行しました\n`);

    // 2. Tagsの移行
    console.log('🏷️  Tagsを移行中...');
    const tags = sqliteDb.prepare('SELECT * FROM Tag').all();
    console.log(`   ${tags.length}件のTagsが見つかりました`);

    for (const tag of tags) {
      await postgresClient.tag.upsert({
        where: { tagKey: tag.tagKey },
        update: {
          displayName: tag.displayName,
          tagType: tag.tagType,
          category: tag.category,
        },
        create: {
          tagKey: tag.tagKey,
          displayName: tag.displayName,
          tagType: tag.tagType,
          category: tag.category,
        },
      });
    }
    console.log(`   ✅ ${tags.length}件のTagsを移行しました\n`);

    // 3. WorkTagsの移行
    console.log('🔗 WorkTagsを移行中...');
    const workTags = sqliteDb.prepare('SELECT * FROM WorkTag').all();
    console.log(`   ${workTags.length}件のWorkTagsが見つかりました`);

    for (const workTag of workTags) {
      await postgresClient.workTag.upsert({
        where: {
          workId_tagKey: {
            workId: workTag.workId,
            tagKey: workTag.tagKey,
          },
        },
        update: {
          derivedConfidence: workTag.derivedConfidence,
        },
        create: {
          workId: workTag.workId,
          tagKey: workTag.tagKey,
          derivedConfidence: workTag.derivedConfidence,
        },
      });
    }
    console.log(`   ✅ ${workTags.length}件のWorkTagsを移行しました\n`);

    console.log('🎉 データ移行が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    sqliteDb.close();
    await postgresClient.$disconnect();
  }
}

// 実行
migrateData()
  .then(() => {
    console.log('\n✅ 移行スクリプトが正常に完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 移行スクリプトが失敗しました:', error);
    process.exit(1);
  });
