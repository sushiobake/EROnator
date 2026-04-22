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
 *   - 新しいマイグレーションがある場合は自動で本番DBに適用します（PROD_DATABASE_URL 要設定）
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

/**
 * better-sqlite3 のネイティブモジュールが現在の Node.js ABI と一致するかをチェックし、
 * 不一致なら自動で npm rebuild better-sqlite3 を実行する。
 * （Node のバージョンが違うターミナルで deploy:prod を実行した事故の再発防止）
 */
function ensureBetterSqlite3Abi() {
  const root = path.join(__dirname, '..');
  const probe = `try { require('better-sqlite3'); process.exit(0); } catch (e) { process.stderr.write(String(e && e.message || e)); process.exit(1); }`;
  let needRebuild = false;
  try {
    execSync(`node -e "${probe.replace(/"/g, '\"')}"`, { cwd: root, stdio: 'pipe' });
  } catch (e) {
    const msg = (e.stderr && e.stderr.toString()) || (e.stdout && e.stdout.toString()) || String(e.message || e);
    if (/NODE_MODULE_VERSION/i.test(msg) || /ERR_DLOPEN_FAILED/i.test(msg)) {
      needRebuild = true;
    } else {
      console.error('❌ better-sqlite3 の事前チェックで想定外のエラー:', msg);
      throw e;
    }
  }
  if (needRebuild) {
    console.log('⚠️  better-sqlite3 の ABI が現在の Node.js と不一致。npm rebuild better-sqlite3 を実行します...');
    execSync('npm rebuild better-sqlite3', { cwd: root, stdio: 'inherit' });
    console.log('✅ better-sqlite3 を再ビルドしました');
  }
}

/**
 * コミットメッセージを検証する。
 * 空、y/n/yes/no（大文字小文字無視）は拒否（過去の「yes」コミット事故再発防止）。
 */
function isValidCommitMessage(raw) {
  const s = (raw || '').trim();
  if (!s) return false;
  if (/^(y|n|yes|no)$/i.test(s)) return false;
  if (s.length < 3) return false;
  return true;
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
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ デプロイをキャンセルしました。');
        rl.close();
        process.exit(1);
      }
      let message = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        message = (await question('コミットメッセージを入力してください (y/n/yes/no は不可、3文字以上): ')).trim();
        if (isValidCommitMessage(message)) break;
        console.log('⚠️  コミットメッセージが不正です。もう一度入力してください。');
        message = '';
      }
      if (!isValidCommitMessage(message)) {
        console.log('❌ コミットメッセージが確定できません。デプロイをキャンセルしました。');
        rl.close();
        process.exit(1);
      }
      execSync('git add -u', { stdio: 'inherit' });
      execSync('git commit -m ' + JSON.stringify(message), { stdio: 'inherit' });
      execSync('git push origin develop', { stdio: 'inherit' });
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

  // ── better-sqlite3 ABI チェック（Node バージョン不一致対策） ──
  try {
    ensureBetterSqlite3Abi();
  } catch (e) {
    console.error('❌ better-sqlite3 の準備に失敗しました:', e.message || e);
    rl.close();
    process.exit(1);
  }

  // ── 本番 DB の列を自動補完 ──
  // PROD_DATABASE_URL が設定されていれば、不足している列を自動で追加する
  console.log('\n本番DBの列を確認・補完中...');
  try {
    execSync('node scripts/ensure-prod-columns.js', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env,
    });
  } catch {
    console.log('\n⚠️  本番DB列の確認に失敗しました。PROD_DATABASE_URL が未設定の可能性があります。');
    const skipAns = await question('列確認なしでデプロイを続行しますか？ (yes/no): ');
    if (skipAns.toLowerCase() !== 'yes') {
      console.log('デプロイをキャンセルしました。');
      rl.close();
      process.exit(0);
    }
  }

  // ── タグ質問文の差分同期（ローカル SQLite → 本番 Postgres） ──
  // 管理画面で編集した Tag.questionText を本番へ反映する
  console.log('\n本番DBへタグ質問文を差分同期中...');
  try {
    execSync('node scripts/sync-tag-question-texts-prod.js', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env,
    });
  } catch (error) {
    console.error('\n❌ タグ質問文の同期に失敗しました。デプロイを中止します。');
    rl.close();
    process.exit(1);
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

  rl.close();
}

main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  rl.close();
  process.exit(1);
});
