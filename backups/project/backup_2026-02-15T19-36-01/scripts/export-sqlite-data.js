/**
 * SQLiteデータベースからデータをエクスポートしてSupabaseに移行するスクリプト
 * 
 * 使用方法:
 * 1. 一時的に schema.prisma を SQLite 用に変更
 * 2. prisma generate を実行
 * 3. このスクリプトを実行してデータをエクスポート
 * 4. schema.prisma を PostgreSQL 用に戻す
 * 5. prisma generate を実行
 * 6. エクスポートしたデータをSupabaseにインポート
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

const sqliteClient = new PrismaClient();

async function exportData() {
  console.log('🚀 SQLiteデータのエクスポートを開始します...\n');

  try {
    // 1. Worksのエクスポート
    console.log('📦 Worksをエクスポート中...');
    const works = await sqliteClient.work.findMany({
      include: {
        workTags: true,
      },
    });
    console.log(`   ${works.length}件のWorksが見つかりました`);

    // 2. Tagsのエクスポート
    console.log('🏷️  Tagsをエクスポート中...');
    const tags = await sqliteClient.tag.findMany();
    console.log(`   ${tags.length}件のTagsが見つかりました`);

    // 3. データをJSON形式で保存（Supabase移行用）
    const exportData = {
      works: works.map(work => ({
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
        tags: work.workTags.map(wt => ({
          tagKey: wt.tagKey,
          derivedConfidence: wt.derivedConfidence,
        })),
      })),
      tags: tags.map(tag => ({
        tagKey: tag.tagKey,
        displayName: tag.displayName,
        tagType: tag.tagType,
        category: tag.category,
      })),
    };

    // 4. JSONファイルに保存
    const outputDir = path.join(__dirname, '..', 'data', 'migration');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputPath = path.join(outputDir, `sqlite-export_${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log(`\n✅ データをエクスポートしました: ${outputPath}`);
    console.log(`   Works: ${exportData.works.length}件`);
    console.log(`   Tags: ${exportData.tags.length}件`);
    console.log(`\n次のステップ:`);
    console.log(`1. schema.prisma を PostgreSQL 用に戻す`);
    console.log(`2. prisma generate を実行`);
    console.log(`3. .env.local の DATABASE_URL を Supabase に設定`);
    console.log(`4. エクスポートしたJSONファイルをSupabaseにインポート`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    await sqliteClient.$disconnect();
  }
}

// 実行
exportData()
  .then(() => {
    console.log('\n✅ エクスポートスクリプトが正常に完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ エクスポートスクリプトが失敗しました:', error);
    process.exit(1);
  });
