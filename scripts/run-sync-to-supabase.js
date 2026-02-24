/**
 * SQLite → Supabase 同期を一括実行するラッパー。
 * .env.supabase の DATABASE_URL / DIRECT_URL を使い、スキーマ切り替え・同期・復元まで自動で行う。
 * 普段の .env は触らない。
 *
 * 使い方:
 *   1. .env.supabase を用意（.env.supabase.example をコピーして値を入れる）
 *   2. npm run sync:supabase
 *   3. 2回目以降は差分同期（変更分のみ）。全件同期: npm run sync:supabase -- --full
 *
 * 初回だけ実行すればよい。2回目以降のデプロイテストでは不要。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRISMA_DIR = path.join(ROOT, 'prisma');
const SCHEMA_FILE = path.join(PRISMA_DIR, 'schema.prisma');
const SCHEMA_SQLITE = path.join(PRISMA_DIR, 'schema.sqlite.prisma');
const SCHEMA_POSTGRES = path.join(PRISMA_DIR, 'schema.postgres.prisma');
const ENV_SUPABASE = path.join(ROOT, '.env.supabase');

function loadEnvSupabase() {
  if (!fs.existsSync(ENV_SUPABASE)) {
    console.error('❌ .env.supabase が見つかりません。');
    console.error('   .env.supabase.example をコピーして .env.supabase を作り、DATABASE_URL と DIRECT_URL を設定してください。');
    process.exit(1);
  }
  let content = fs.readFileSync(ENV_SUPABASE, 'utf8');
  // BOM を除去（UTF-8 with BOM で保存されていても読めるようにする）
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const env = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().replace(/^\uFEFF/, '');
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1).replace(/\\n/g, '\n');
    env[key] = val;
  }
  return env;
}

function run(cmd, args, opts = {}) {
  const c = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts });
  if (c.status !== 0) process.exit(c.status ?? 1);
}

function main() {
  console.log('📦 SQLite → Supabase 同期（自動）\n');

  const supabaseEnv = loadEnvSupabase();
  const dbUrl = supabaseEnv.DATABASE_URL || '';
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    console.error('❌ .env.supabase の DATABASE_URL が Postgres を指していません。');
    process.exit(1);
  }

  if (!fs.existsSync(SCHEMA_POSTGRES)) {
    console.error('❌ prisma/schema.postgres.prisma が見つかりません。');
    process.exit(1);
  }
  if (!fs.existsSync(SCHEMA_SQLITE)) {
    console.error('❌ prisma/schema.sqlite.prisma が見つかりません。');
    process.exit(1);
  }

  const envForSync = { ...process.env, ...supabaseEnv };

  try {
    console.log('1/6 スキーマを Postgres に切り替え...');
    fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);

    console.log('2/6 Prisma クライアント生成...');
    run('npx', ['prisma', 'generate']);

    console.log('3/6 Supabase へ同期実行...');
    const syncArgs = ['tsx', 'scripts/sync-sqlite-to-supabase.ts', ...process.argv.slice(2)];
    const sync = spawnSync('npx', syncArgs, {
      stdio: 'inherit',
      cwd: ROOT,
      shell: true,
      env: envForSync,
    });
    if (sync.status !== 0) {
      console.error('\n⚠️ 同期に失敗しました。スキーマを SQLite に戻します...');
      fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
      spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', cwd: ROOT, shell: true });
      process.exit(sync.status ?? 1);
    }

    console.log('4/6 WorkTag 行列を再生成...');
    run('npm', ['run', 'generate:worktag-matrix']);

    console.log('5/6 同期結果を検証...');
    const verify = spawnSync('node', ['scripts/verify-sync-result.js'], {
      stdio: 'inherit',
      cwd: ROOT,
      shell: true,
      env: { ...process.env, ...supabaseEnv },
    });
    if (verify.status !== 0) {
      console.error('\n⚠️ 検証に失敗しました。workTagMatrix.json を確認し、必要なら sync:supabase を再実行してください。');
      fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
      spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', cwd: ROOT, shell: true });
      process.exit(1);
    }

    console.log('6/6 スキーマを SQLite に戻して Prisma 再生成...');
    fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
    run('npx', ['prisma', 'generate']);

    console.log('\n✅ 同期完了。手元は SQLite のままです。');
  } catch (e) {
    console.error(e);
    if (fs.existsSync(SCHEMA_SQLITE)) {
      fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
      spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', cwd: ROOT, shell: true });
    }
    process.exit(1);
  }
}

main();
