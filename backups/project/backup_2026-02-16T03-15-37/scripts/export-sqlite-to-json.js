/**
 * SQLiteデータベースからJSONファイルにエクスポートするスクリプト
 * その後、importBatch.cjsを使用してSupabaseにインポート可能
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

// SQLite用のPrisma Client
// 注意: .envファイルのDATABASE_URLがSQLiteを指している必要がある
const sqliteClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
    },
  },
});

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

    // 3. JSON形式に変換
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
    const outputDir = path.join(__dirname, '..', 'data', 'import');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputPath = path.join(outputDir, `export_${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log(`\n✅ データをエクスポートしました: ${outputPath}`);
    console.log(`   Works: ${exportData.works.length}件`);
    console.log(`   Tags: ${exportData.tags.length}件`);
    console.log(`\n次のステップ:`);
    console.log(`1. .env.local を Supabase の DATABASE_URL に変更`);
    console.log(`2. node scripts/importBatch.cjs ${outputPath} を実行`);

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
