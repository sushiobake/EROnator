/**
 * 本番 Postgres に必要な列が不足していれば自動で追加するスクリプト
 * Supabase ダッシュボード不要・migrate 不要
 *
 * 使い方:
 *   npm run db:ensure:prod
 *   または npm run deploy:prod の中で自動実行
 *
 * 接続先 (優先順):
 *   1. .env.local の PROD_DATABASE_URL
 *   2. .env.supabase の DATABASE_URL
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    out[key] = val;
  }
  return out;
}

const envLocal = loadEnvFile(path.join(root, '.env.local'));
const envSupabase = loadEnvFile(path.join(root, '.env.supabase'));

const rawUrl = envLocal.PROD_DATABASE_URL || envSupabase.DATABASE_URL || '';
// pgbouncer パラメータを除去（DDL には不要）
const url = rawUrl
  .replace(/[?&]pgbouncer=true/g, '')
  .replace(/[?&]connection_limit=\d+/g, '')
  .replace(/[?&]$/, '');

if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
  console.error('ERROR: Postgres URL が見つかりません。');
  console.error('.env.local に PROD_DATABASE_URL="postgresql://..." を設定してください。');
  process.exit(1);
}

// 適用したい列定義（追加があればここに足すだけ）
const COLUMNS_TO_ENSURE = [
  {
    table: 'RecommendPlayHistory',
    column: 'clickedFanzaWorkId',
    type: 'TEXT',
  },
  {
    table: 'PlayHistory',
    column: 'failListContextJson',
    type: 'TEXT',
  },
  {
    table: 'Session',
    column: 'visitorId',
    type: 'TEXT',
  },
  {
    table: 'PlayHistory',
    column: 'visitorId',
    type: 'TEXT',
  },
  {
    table: 'RecommendPlayHistory',
    column: 'visitorId',
    type: 'TEXT',
  },
  {
    table: 'Session',
    column: 'trafficAttributionJson',
    type: 'TEXT',
  },
  {
    table: 'PlayHistory',
    column: 'trafficAttributionJson',
    type: 'TEXT',
  },
];

async function connect() {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 20000,
  });
  await client.connect();
  return client;
}

async function killBlockingSessions(client, tableName) {
  const locks = await client.query(`
    SELECT pid FROM pg_stat_activity
    WHERE query ILIKE $1
      AND state != 'idle'
      AND pid != pg_backend_pid()
  `, [`%${tableName}%`]);
  if (locks.rows.length > 0) {
    console.log(`  ロック中のセッション ${locks.rows.length} 件を解消中...`);
    for (const { pid } of locks.rows) {
      await client.query('SELECT pg_terminate_backend($1)', [pid]);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function main() {
  const masked = url.replace(/:\/\/[^@]+@/, '://***:***@');
  console.log(`本番 DB: ${masked}\n`);

  const client = await connect();

  for (const { table, column, type } of COLUMNS_TO_ENSURE) {
    const res = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = $1
         AND column_name  = $2`,
      [table, column]
    );
    if (res.rowCount > 0) {
      console.log(`✅ ${table}.${column} は既に存在します。`);
      continue;
    }

    // ロックを解消してから ALTER TABLE
    await killBlockingSessions(client, table);

    console.log(`列を追加中: ${table}.${column} (${type})...`);
    await client.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
    console.log(`✅ ${table}.${column} を追加しました。`);
  }

  await client.end();
  console.log('\n完了。');
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
