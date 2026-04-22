/**
 * 同期結果の検証スクリプト
 *
 * SQLite / Supabase / WorkTag行列 の gameRegistered 件数が一致するか確認する。
 * SQLite と workTagMatrix は必須で一致すること。Supabase は「SQLite と同数」または
 * 「SQLite より数件多いだけ」（Supabase にのみ残る古い登録）を許容する。
 * 不一致があると本番の精度に影響するため、デプロイ前に実行して確認すること。
 *
 * 実行:
 *   npm run verify:sync
 *   （sync:supabase の後、または deploy:preview の前に実行）
 *
 * 前提:
 *   - .env.supabase が存在し、DATABASE_URL が設定されていること
 *   - schema が Postgres の場合、Supabase に接続して件数を取得
 *   - schema が SQLite の場合、一時的に Postgres に切り替えて Supabase を取得
 */

const fs = require('fs');
const path = require('path');
const { ensureBetterSqlite3Abi, envWithNodeOnPath } = require('./_ensure-better-sqlite3');

const ROOT = path.join(__dirname, '..');
const SQLITE_DB = path.join(ROOT, 'prisma', 'dev.db');
const MATRIX_FILE = path.join(ROOT, 'data', 'workTagMatrix.json');
const ENV_SUPABASE = path.join(ROOT, '.env.supabase');
const SCHEMA_FILE = path.join(ROOT, 'prisma', 'schema.prisma');
const SCHEMA_SQLITE = path.join(ROOT, 'prisma', 'schema.sqlite.prisma');
const SCHEMA_POSTGRES = path.join(ROOT, 'prisma', 'schema.postgres.prisma');

function loadEnvSupabase() {
  if (!fs.existsSync(ENV_SUPABASE)) {
    return null;
  }
  let content = fs.readFileSync(ENV_SUPABASE, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const env = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1).replace(/\\n/g, '\n');
    env[key] = val;
  }
  return env;
}

function getSqliteCount() {
  if (!fs.existsSync(SQLITE_DB)) {
    return { ok: false, count: null, error: 'SQLite DB が見つかりません' };
  }
  try {
    const sqlite3 = require('better-sqlite3');
    const db = sqlite3(SQLITE_DB, { readonly: true });
    const row = db
      .prepare(
        `SELECT COUNT(*) as c FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)`
      )
      .get();
    db.close();
    return { ok: true, count: row?.c ?? 0 };
  } catch (e) {
    return { ok: false, count: null, error: e.message };
  }
}

function getMatrixCount() {
  if (!fs.existsSync(MATRIX_FILE)) {
    return { ok: false, count: null, error: 'workTagMatrix.json が見つかりません' };
  }
  try {
    const raw = fs.readFileSync(MATRIX_FILE, 'utf8');
    const data = JSON.parse(raw);
    const count = data.workCount ?? null;
    return { ok: count != null, count, error: count == null ? 'workCount がありません' : null };
  } catch (e) {
    return { ok: false, count: null, error: e.message };
  }
}

async function getSupabaseCount() {
  const supabaseEnv = loadEnvSupabase();
  if (!supabaseEnv?.DATABASE_URL) {
    return { ok: false, count: null, error: '.env.supabase または DATABASE_URL がありません' };
  }
  const dbUrl = supabaseEnv.DATABASE_URL;
  if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
    return { ok: false, count: null, error: 'DATABASE_URL が Postgres を指していません' };
  }

  const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const isPostgres = schemaContent.includes('postgresql');
  let switched = false;

  try {
    if (!isPostgres && fs.existsSync(SCHEMA_POSTGRES)) {
      fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);
      switched = true;
      const { spawnSync } = require('child_process');
      spawnSync('npx', ['prisma', 'generate'], { stdio: 'pipe', cwd: ROOT, shell: true, env: envWithNodeOnPath(process.env) });
    } else if (!isPostgres) {
      return {
        ok: false,
        count: null,
        error: 'schema.prisma が Postgres ではありません。schema.postgres.prisma を確認してください。',
      };
    }

    process.env.DATABASE_URL = dbUrl;
    if (supabaseEnv.DIRECT_URL) process.env.DIRECT_URL = supabaseEnv.DIRECT_URL;

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const count = await prisma.work.count({
      where: {
        gameRegistered: true,
        OR: [{ needsReview: false }, { needsReview: null }],
      },
    });
    await prisma.$disconnect();

    if (switched && fs.existsSync(SCHEMA_SQLITE)) {
      fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
      const { spawnSync } = require('child_process');
      spawnSync('npx', ['prisma', 'generate'], { stdio: 'pipe', cwd: ROOT, shell: true, env: envWithNodeOnPath(process.env) });
    }

    return { ok: true, count };
  } catch (e) {
    if (switched && fs.existsSync(SCHEMA_SQLITE)) {
      fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
      const { spawnSync } = require('child_process');
      spawnSync('npx', ['prisma', 'generate'], { stdio: 'pipe', cwd: ROOT, shell: true, env: envWithNodeOnPath(process.env) });
    }
    return { ok: false, count: null, error: e.message };
  }
}

async function main() {
  console.log('\n📋 同期結果の検証\n');

  try {
    ensureBetterSqlite3Abi();
  } catch (e) {
    console.error('❌ better-sqlite3 の準備に失敗しました:', (e && e.message) || e);
    process.exit(1);
  }

  const sqlite = getSqliteCount();
  const matrix = getMatrixCount();
  const supabase = await getSupabaseCount();

  console.log('  SQLite (gameRegistered):', sqlite.ok ? `${sqlite.count} 件` : `❌ ${sqlite.error}`);
  console.log('  Supabase (gameRegistered):', supabase.ok ? `${supabase.count} 件` : `❌ ${supabase.error}`);
  console.log('  workTagMatrix.json:', matrix.ok ? `workCount=${matrix.count}` : `❌ ${matrix.error}`);

  // SQLite と matrix は一致が必須（matrix は SQLite から生成される）
  const sqliteMatrixOk = sqlite.count != null && matrix.count != null && sqlite.count === matrix.count;

  // Supabase: 同数なら OK。または「SQLite より多いが差が許容範囲」なら OK（Supabase にだけ残る古い登録を許容）
  const TOLERANCE = 10;
  const supabaseOk =
    supabase.count != null &&
    sqlite.count != null &&
    (supabase.count === sqlite.count ||
      (supabase.count >= sqlite.count && supabase.count - sqlite.count <= TOLERANCE));

  if (!sqliteMatrixOk) {
    console.log('\n❌ SQLite と workTagMatrix.json の件数が一致しません。sync:supabase を実行し、workTagMatrix.json をコミットしてください。');
    process.exit(1);
  }

  if (supabase.ok && !supabaseOk) {
    console.log(
      `\n❌ Supabase の件数が SQLite と一致しません（差が ${TOLERANCE} 件を超えています）。本番デプロイ前に sync:supabase を実行してください。`
    );
    process.exit(1);
  }

  if (!sqlite.ok || !matrix.ok) {
    console.log('\n❌ SQLite または行列の取得に失敗しました。');
    process.exit(1);
  }

  if (!supabase.ok) {
    console.log('\n⚠️  Supabase の件数は確認できませんでしたが、SQLite と行列は一致しています。');
    console.log('   （.env.supabase を設定するか、sync:supabase の直後に verify を実行してください）');
    process.exit(0);
  }

  if (supabase.count !== sqlite.count) {
    console.log(`\n✅ 検証OK: SQLite と行列は一致（${sqlite.count} 件）。Supabase は ${supabase.count} 件（許容範囲内）。`);
  } else {
    console.log('\n✅ 検証OK: SQLite / Supabase / 行列 の件数が一致しています。');
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 検証中にエラー:', e.message);
  process.exit(1);
});
