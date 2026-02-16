/**
 * SQLiteからPostgreSQL（Supabase）へのデータ移行スクリプト
 * 
 * 使用方法:
 * 1. .env.local に Supabase の DATABASE_URL を設定
 * 2. 既存の SQLite データベース（prisma/dev.db）が存在することを確認
 * 3. node scripts/migrate-to-postgres.js を実行
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// SQLite用のPrisma Client（一時的）
// 注意: このスクリプトはSQLiteからPostgreSQLへの移行用
// 通常のDATABASE_URLがPostgreSQLを指している場合、SQLite用のURLを明示的に指定
const sqliteDbPath = process.env.DATABASE_URL_SQLITE || 'file:./prisma/dev.db';
const sqliteClient = new PrismaClient({
  datasources: {
    db: {
      url: sqliteDbPath,
    },
  },
});

// PostgreSQL用のPrisma Client
const postgresClient = new PrismaClient();

async function migrateData() {
  console.log('🚀 データ移行を開始します...\n');

  try {
    // 1. Worksの移行
    console.log('📦 Worksを移行中...');
    const works = await sqliteClient.work.findMany();
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
          sourcePayload: work.sourcePayload,
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
          sourcePayload: work.sourcePayload,
        },
      });
    }
    console.log(`   ✅ ${works.length}件のWorksを移行しました\n`);

    // 2. Tagsの移行
    console.log('🏷️  Tagsを移行中...');
    const tags = await sqliteClient.tag.findMany();
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
    const workTags = await sqliteClient.workTag.findMany();
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

    // 4. Sessionsの移行（オプション、必要に応じて）
    console.log('💾 Sessionsを移行中...');
    const sessions = await sqliteClient.session.findMany();
    console.log(`   ${sessions.length}件のSessionsが見つかりました`);

    if (sessions.length > 0) {
      for (const session of sessions) {
        await postgresClient.session.upsert({
          where: { sessionId: session.sessionId },
          update: {
            aiGateChoice: session.aiGateChoice,
            questionCount: session.questionCount,
            revealMissCount: session.revealMissCount,
            revealRejectedWorkIds: session.revealRejectedWorkIds,
            weights: session.weights,
            weightsHistory: session.weightsHistory || '[]',
            questionHistory: session.questionHistory,
          },
          create: {
            sessionId: session.sessionId,
            aiGateChoice: session.aiGateChoice,
            questionCount: session.questionCount,
            revealMissCount: session.revealMissCount,
            revealRejectedWorkIds: session.revealRejectedWorkIds,
            weights: session.weights,
            weightsHistory: session.weightsHistory || '[]',
            questionHistory: session.questionHistory,
          },
        });
      }
      console.log(`   ✅ ${sessions.length}件のSessionsを移行しました\n`);
    } else {
      console.log('   ℹ️  Sessionsはありませんでした\n');
    }

    // 5. Logsの移行（オプション、必要に応じて）
    console.log('📝 Logsを移行中...');
    const logs = await sqliteClient.log.findMany();
    console.log(`   ${logs.length}件のLogsが見つかりました`);

    if (logs.length > 0) {
      for (const log of logs) {
        await postgresClient.log.create({
          data: {
            submittedTitleText: log.submittedTitleText,
            aiGateChoice: log.aiGateChoice,
            topCandidates: log.topCandidates,
            timestamp: log.timestamp,
          },
        });
      }
      console.log(`   ✅ ${logs.length}件のLogsを移行しました\n`);
    } else {
      console.log('   ℹ️  Logsはありませんでした\n');
    }

    console.log('🎉 データ移行が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    await sqliteClient.$disconnect();
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
