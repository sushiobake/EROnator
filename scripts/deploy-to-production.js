/**
 * 本番環境へのデプロイスクリプト
 * ローカルで開発・テストした後、このスクリプトを実行すると本番環境に反映されます
 * 
 * 使い方:
 *   npm run deploy:prod
 * 
 * 注意:
 *   - このスクリプトは develop ブランチの変更を main ブランチにマージします
 *   - 本番環境（https://eronator.vercel.app）に変更が反映されます
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🚀 本番環境へのデプロイを開始します...\n');

  // 現在のブランチを確認
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  console.log(`現在のブランチ: ${currentBranch}\n`);

  // developブランチにいることを確認
  if (currentBranch !== 'develop') {
    console.log('⚠️  警告: developブランチにいません。');
    const answer = await question('developブランチに切り替えますか？ (y/n): ');
    if (answer.toLowerCase() === 'y') {
      console.log('developブランチに切り替え中...');
      execSync('git checkout develop', { stdio: 'inherit' });
    } else {
      console.log('❌ デプロイをキャンセルしました。');
      rl.close();
      process.exit(1);
    }
  }

  // 追跡済みファイルの未コミット変更があるか確認（未追跡＝backups等は無視。prismaの一時ファイルも除外）
  try {
    const filter = (names) => names.filter((n) => !/^prisma\/.*\.db-(shm|wal)$/.test(n));
    const diffWork = filter((execSync('git diff --name-only', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean)));
    const diffCached = filter((execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean)));
    if (diffWork.length > 0 || diffCached.length > 0) {
      console.log('⚠️  追跡済みファイルに未コミットの変更があります:');
      if (diffWork.length) diffWork.forEach((l) => console.log('  M ' + l));
      if (diffCached.length) diffCached.forEach((l) => console.log('  S ' + l));
      const answer = await question('\n変更をコミットしますか？ (y/n): ');
      if (answer.toLowerCase() === 'y') {
        const message = await question('コミットメッセージを入力してください: ');
        execSync('git add .', { stdio: 'inherit' });
        execSync(`git commit -m "${message}"`, { stdio: 'inherit' });
        execSync('git push origin develop', { stdio: 'inherit' });
      } else {
        console.log('❌ デプロイをキャンセルしました。');
        rl.close();
        process.exit(1);
      }
    }
  } catch (error) {
    // エラーは無視
  }

  // developブランチの最新を取得
  console.log('\n📥 developブランチの最新を取得中...');
  execSync('git pull origin develop', { stdio: 'inherit' });

  // 最終確認
  console.log('\n⚠️  最終確認:');
  console.log('この操作により、本番環境（https://eronator.vercel.app）に変更が反映されます。');
  const confirm = await question('本当に本番環境にデプロイしますか？ (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ デプロイをキャンセルしました。');
    rl.close();
    process.exit(0);
  }

  // schema.prisma を PostgreSQL に切り替え（本番環境用）
  try {
    switchToPostgres();
  } catch (error) {
    console.error('❌ スキーマの切り替えに失敗しました:', error.message);
    rl.close();
    process.exit(1);
  }

  // スキーマ変更をコミット（一時的）
  try {
    execSync('git add prisma/schema.prisma', { stdio: 'inherit' });
    execSync('git commit -m "chore: switch to PostgreSQL schema for production"', { stdio: 'inherit' });
  } catch (error) {
    // コミットに失敗しても続行（既にコミット済みの場合）
    console.log('⚠️  スキーマ変更のコミットをスキップしました（既にコミット済みの可能性があります）');
  }

  // mainブランチに切り替え
  console.log('\n📦 mainブランチに切り替え中...');
  execSync('git checkout main', { stdio: 'inherit' });

  // mainブランチの最新を取得
  console.log('📥 mainブランチの最新を取得中...');
  execSync('git pull origin main', { stdio: 'inherit' });

  // developブランチをマージ（--no-edit でエディタを開かずマージメッセージを使用）
  console.log('🔄 developブランチをマージ中...');
  execSync('git merge develop --no-edit', { stdio: 'inherit' });

  // mainブランチにプッシュ
  console.log('🚀 本番環境にデプロイ中...');
  execSync('git push origin main', { stdio: 'inherit' });

  // developブランチに戻る
  console.log('↩️  developブランチに戻ります...');
  execSync('git checkout develop', { stdio: 'inherit' });

  // schema.prisma を SQLite に戻す（ローカル開発用）
  try {
    switchToSqlite();
  } catch (error) {
    console.error('⚠️  スキーマを SQLite に戻すのに失敗しました:', error.message);
    console.log('⚠️  手動で schema.sqlite.prisma を schema.prisma にコピーしてください');
  }

  console.log('\n✅ デプロイが完了しました！');
  console.log('本番環境: https://eronator.vercel.app');
  console.log('Vercelでデプロイの進行状況を確認できます。\n');
  console.log('ℹ️  本番ビルド時に prisma migrate deploy が自動実行されます（Postgres の DATABASE_URL がビルドに渡る前提）。');
  console.log('   詳細: docs/DEPLOY-DB.md\n');

  rl.close();
}

main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  rl.close();
  process.exit(1);
});
