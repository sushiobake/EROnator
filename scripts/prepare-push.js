/**
 * develop ブランチへのプッシュ準備スクリプト
 * schema.prisma を PostgreSQL に切り替えてからプッシュします
 * 
 * 使い方:
 *   node scripts/prepare-push.js
 *   または
 *   npm run prepare:push
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA_FILE = path.join(SCHEMA_DIR, 'schema.prisma');
const SCHEMA_SQLITE = path.join(SCHEMA_DIR, 'schema.sqlite.prisma');
const SCHEMA_POSTGRES = path.join(SCHEMA_DIR, 'schema.postgres.prisma');

/**
 * schema.prisma を PostgreSQL に切り替え
 */
function switchToPostgres() {
  if (!fs.existsSync(SCHEMA_POSTGRES)) {
    throw new Error('schema.postgres.prisma が見つかりません');
  }
  console.log('📝 schema.prisma を PostgreSQL に切り替え中...');
  fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);
  console.log('✅ PostgreSQL スキーマに切り替えました');
}

/**
 * schema.prisma を SQLite に戻す
 */
function switchToSqlite() {
  if (!fs.existsSync(SCHEMA_SQLITE)) {
    throw new Error('schema.sqlite.prisma が見つかりません');
  }
  console.log('📝 schema.prisma を SQLite に戻しています...');
  fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
  console.log('✅ SQLite スキーマに戻しました');
}

function main() {
  try {
    // 現在のブランチを確認
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    
    if (currentBranch !== 'develop') {
      console.log(`⚠️  現在のブランチは "${currentBranch}" です。`);
      console.log('⚠️  このスクリプトは develop ブランチでのみ使用してください。');
      process.exit(1);
    }

    // schema.prisma を PostgreSQL に切り替え
    switchToPostgres();

    // スキーマ変更をコミット
    try {
      execSync('git add prisma/schema.prisma', { stdio: 'inherit' });
      execSync('git commit -m "chore: switch to PostgreSQL schema for preview"', { stdio: 'inherit' });
      console.log('\n✅ スキーマ変更をコミットしました');
    } catch (error) {
      // コミットに失敗しても続行（既にコミット済みの場合）
      console.log('⚠️  スキーマ変更のコミットをスキップしました（既にコミット済みの可能性があります）');
    }

    console.log('\n📤 これで git push origin develop を実行できます');
    console.log('⚠️  プッシュ後、ローカル開発用に schema.prisma を SQLite に戻すことをお忘れなく！');
    console.log('   手動で戻す場合: node scripts/restore-sqlite.js');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
