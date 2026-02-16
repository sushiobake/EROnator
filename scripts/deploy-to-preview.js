/**
 * プレビュー環境（develop ブランチ）へのデプロイスクリプト
 *
 * 【重要】ローカルデータ保護の原則
 * - このスクリプトは git reset --hard, git checkout -- ., git clean を一切実行しません
 * - schema.prisma の切り替えは一時的で、終了時に必ず SQLite に復元します
 * - src/app/components などソースコードは一切上書きしません
 *
 * 使い方:
 *   npm run deploy:preview
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA_FILE = path.join(SCHEMA_DIR, 'schema.prisma');
const SCHEMA_SQLITE = path.join(SCHEMA_DIR, 'schema.sqlite.prisma');
const SCHEMA_POSTGRES = path.join(SCHEMA_DIR, 'schema.postgres.prisma');

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function switchToPostgres() {
  if (!fs.existsSync(SCHEMA_POSTGRES)) {
    throw new Error('schema.postgres.prisma が見つかりません');
  }
  log('schema.prisma を PostgreSQL に切り替え');
  fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);
}

function switchToSqlite() {
  if (!fs.existsSync(SCHEMA_SQLITE)) {
    throw new Error('schema.sqlite.prisma が見つかりません');
  }
  log('schema.prisma を SQLite に復元（ローカル保護）');
  fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
}

function main() {
  log('=== プレビューデプロイ開始（ローカルデータ保護モード） ===');

  try {
    const cwd = path.join(__dirname, '..');

    const branch = execSync('git branch --show-current', { encoding: 'utf-8', cwd }).trim();
    if (branch !== 'develop') {
      console.error('❌ develop ブランチで実行してください。現在: ' + branch);
      process.exit(1);
    }

    const diffWork = execSync('git diff --name-only', { encoding: 'utf-8', cwd })
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((n) => !/^prisma\/.*\.db-(shm|wal)$/.test(n));
    const diffCached = execSync('git diff --cached --name-only', { encoding: 'utf-8', cwd })
      .trim()
      .split('\n')
      .filter(Boolean);

    if (diffWork.length > 0 || diffCached.length > 0) {
      console.error('❌ 未コミットの変更があります。デプロイ前にコミットしてください。');
      console.error('   変更ファイル:');
      [...new Set([...diffWork, ...diffCached])].slice(0, 10).forEach((f) => console.error('   - ' + f));
      console.error('\n   ※ このスクリプトはローカルを保護するため、未コミットのまま進めません。');
      process.exit(1);
    }

    log('PostgreSQL スキーマに切り替え');
    switchToPostgres();

    try {
      execSync('git add prisma/schema.prisma', { stdio: 'inherit', cwd });
      execSync('git commit -m "chore: switch to PostgreSQL schema for preview"', { stdio: 'inherit', cwd });
      log('スキーマ変更をコミット');
    } catch (e) {
      log('スキーマ変更のコミットをスキップ（既にコミット済みの可能性）');
    }

    log('git push origin develop');
    execSync('git push origin develop', { stdio: 'inherit', cwd });

    log('ローカルを SQLite に復元');
    switchToSqlite();

    log('=== プレビューデプロイ完了 ===');
    log('Vercel の develop 用 URL で確認してください。');
  } catch (error) {
    log('エラー発生。可能な限りローカルを復元します。');
    try {
      switchToSqlite();
    } catch (e) {
      /* noop */
    }
    console.error('❌', error.message);
    process.exit(1);
  }
}

main();
