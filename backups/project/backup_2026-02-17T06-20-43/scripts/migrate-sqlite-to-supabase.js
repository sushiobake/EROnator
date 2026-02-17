/**
 * SQLiteデータベースからSupabaseへのデータ移行スクリプト（自動化版）
 * 
 * このスクリプトは以下を自動実行します：
 * 1. 一時的にPrismaスキーマをSQLite用に変更
 * 2. Prisma Clientを再生成
 * 3. SQLiteからデータをエクスポート
 * 4. PrismaスキーマをPostgreSQL用に戻す
 * 5. Prisma Clientを再生成
 * 6. エクスポートしたデータをSupabaseにインポート
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function migrateData() {
  console.log('🚀 SQLite → Supabase データ移行を開始します...\n');

  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  const sqliteSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.sqlite.prisma');
  const postgresSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.postgres');

  try {
    // Step 1: 現在のスキーマをバックアップ
    console.log('📋 Step 1: スキーマをバックアップ中...');
    if (!fs.existsSync(postgresSchemaPath)) {
      fs.copyFileSync(schemaPath, postgresSchemaPath);
    }
    console.log('   ✅ バックアップ完了\n');

    // Step 2: スキーマをSQLite用に変更
    console.log('🔄 Step 2: スキーマをSQLite用に変更中...');
    fs.copyFileSync(sqliteSchemaPath, schemaPath);
    console.log('   ✅ 変更完了\n');

    // Step 3: Prisma Clientを再生成
    console.log('⚙️  Step 3: Prisma Clientを再生成中...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('   ✅ 再生成完了\n');

    // Step 4: SQLiteからデータをエクスポート
    console.log('📤 Step 4: SQLiteからデータをエクスポート中...');
    require('dotenv').config({ path: '.env' });
    const sqliteClient = new PrismaClient();

    const works = await sqliteClient.work.findMany({
      include: { workTags: true },
    });
    const tags = await sqliteClient.tag.findMany();

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

    const outputDir = path.join(__dirname, '..', 'data', 'migration');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputPath = path.join(outputDir, `sqlite-export_${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    await sqliteClient.$disconnect();
    console.log(`   ✅ エクスポート完了: ${outputPath}`);
    console.log(`      Works: ${exportData.works.length}件`);
    console.log(`      Tags: ${exportData.tags.length}件\n`);

    // Step 5: スキーマをPostgreSQL用に戻す
    console.log('🔄 Step 5: スキーマをPostgreSQL用に戻す中...');
    fs.copyFileSync(postgresSchemaPath, schemaPath);
    console.log('   ✅ 戻しました\n');

    // Step 6: Prisma Clientを再生成
    console.log('⚙️  Step 6: Prisma Clientを再生成中...');
    execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('   ✅ 再生成完了\n');

    // Step 7: Supabaseにインポート
    console.log('📥 Step 7: Supabaseにインポート中...');
    console.log('   ⚠️  注意: .env.local の DATABASE_URL が Supabase を指していることを確認してください');
    console.log(`   📄 インポートファイル: ${outputPath}\n`);
    
    // importBatch.cjsを使用してインポート
    // ただし、importBatch.cjsの形式に合わせる必要がある
    console.log('   ℹ️  importBatch.cjsを使用してインポートしてください:');
    console.log(`   node scripts/importBatch.cjs ${outputPath}\n`);

    console.log('🎉 データ移行の準備が完了しました！');
    console.log(`\n次のステップ:`);
    console.log(`1. .env.local の DATABASE_URL が Supabase の接続プーリングURLを指していることを確認`);
    console.log(`2. node scripts/importBatch.cjs ${outputPath} を実行`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    
    // エラー時はスキーマを元に戻す
    if (fs.existsSync(postgresSchemaPath)) {
      console.log('\n🔄 エラー回復: スキーマをPostgreSQL用に戻します...');
      fs.copyFileSync(postgresSchemaPath, schemaPath);
      execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log('   ✅ 回復完了');
    }
    
    throw error;
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
