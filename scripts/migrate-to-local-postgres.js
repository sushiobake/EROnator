/**
 * SQLite のデータをローカル PostgreSQL に初回移行するスクリプト
 *
 * 前提:
 *   1. Docker で Postgres が起動している (npm run db:up)
 *   2. prisma/dev.db にデータがある
 *
 * 使い方: npm run migrate:local-postgres
 *
 * 実行後: .env.local に DATABASE_URL=postgresql://postgres:localdev@localhost:5432/eronator を設定
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRISMA_DIR = path.join(ROOT, 'prisma');
const SCHEMA_FILE = path.join(PRISMA_DIR, 'schema.prisma');
const SCHEMA_POSTGRES = path.join(PRISMA_DIR, 'schema.postgres.prisma');
const SQLITE_DB = path.join(PRISMA_DIR, 'dev.db');

const LOCAL_POSTGRES_URL = 'postgresql://postgres:localdev@localhost:5432/eronator';

function run(cmd, args, opts = {}) {
  const c = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: true,
    env: { ...process.env, DATABASE_URL: LOCAL_POSTGRES_URL, DIRECT_URL: LOCAL_POSTGRES_URL },
    ...opts,
  });
  if (c.status !== 0) process.exit(c.status ?? 1);
}

function main() {
  console.log('📦 SQLite → ローカル PostgreSQL 初回移行\n');

  if (!fs.existsSync(SQLITE_DB)) {
    console.error('❌ prisma/dev.db が見つかりません。先に SQLite でデータを用意してください。');
    process.exit(1);
  }

  if (!fs.existsSync(SCHEMA_POSTGRES)) {
    console.error('❌ schema.postgres.prisma が見つかりません。');
    process.exit(1);
  }

  try {
    console.log('1/4 スキーマを Postgres に切り替え...');
    fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);

    console.log('2/4 Prisma クライアント生成...');
    run('npx', ['prisma', 'generate']);

    console.log('3/4 ローカル Postgres にテーブル作成 (db push)...');
    run('npx', ['prisma', 'db', 'push']);

    console.log('4/4 SQLite からデータを同期...');
    run('npx', ['tsx', 'scripts/sync-sqlite-to-supabase.ts', '--full'], {
      env: { ...process.env, DATABASE_URL: LOCAL_POSTGRES_URL, DIRECT_URL: LOCAL_POSTGRES_URL },
    });

    console.log('\n✅ 移行完了。');
    console.log('\n次のステップ:');
    console.log('  1. .env.local に以下を設定:');
    console.log('     DATABASE_URL=' + LOCAL_POSTGRES_URL);
    console.log('     DIRECT_URL=' + LOCAL_POSTGRES_URL);
    console.log('  2. npm run generate:worktag-matrix を実行（行列は SQLite から生成されます）');
    console.log('  3. npm run dev で起動');
    console.log('\n元に戻す場合: npm run restore:pre-postgres');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
