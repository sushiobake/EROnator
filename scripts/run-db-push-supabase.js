/**
 * Supabase (Postgres) に Prisma スキーマを適用する。
 * 不足しているカラムを追加する。.env.supabase の DATABASE_URL / DIRECT_URL を使用。
 *
 * 使い方: npm run db:push:supabase
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
    process.exit(1);
  }
  let content = fs.readFileSync(ENV_SUPABASE, 'utf8');
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

function main() {
  console.log('📦 Supabase にスキーマを適用（prisma db push）\n');

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

  const envForPush = { ...process.env, ...supabaseEnv };

  try {
    console.log('1/4 スキーマを Postgres に切り替え...');
    fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);

    console.log('2/4 prisma db push 実行...');
    const push = spawnSync('npx', ['prisma', 'db', 'push'], {
      stdio: 'inherit',
      cwd: ROOT,
      shell: true,
      env: envForPush,
    });
    if (push.status !== 0) {
      fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
      process.exit(push.status ?? 1);
    }

    console.log('3/4 スキーマを SQLite に戻す...');
    fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);

    console.log('4/4 Prisma クライアント再生成...');
    spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', cwd: ROOT, shell: true });

    console.log('\n✅ Supabase へのスキーマ適用が完了しました。');
  } catch (e) {
    console.error(e);
    if (fs.existsSync(SCHEMA_SQLITE)) fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
    process.exit(1);
  }
}

main();
