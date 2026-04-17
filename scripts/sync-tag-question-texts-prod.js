/**
 * ローカルSQLiteの Tag.questionText を本番Postgresへ差分同期する。
 *
 * 目的:
 * - 管理画面で更新したタグ質問文を、軽量に本番へ反映する
 * - Work/WorkTag の全量同期は行わない
 *
 * 接続先 (優先順):
 * 1. .env.local の PROD_DATABASE_URL
 * 2. .env.supabase の DATABASE_URL
 *
 * 使い方:
 * - node scripts/sync-tag-question-texts-prod.js
 * - node scripts/sync-tag-question-texts-prod.js --dry-run
 */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('better-sqlite3');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const sqlitePath = path.join(root, 'prisma', 'dev.db');
const backupsRoot = path.join(root, 'backups');
const dryRun = process.argv.includes('--dry-run');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const out = {};
  for (const line of content.split('\n')) {
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

function normalizeQuestionText(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

function makeTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchProdTagQuestionMap(client, tagKeys) {
  const result = new Map();
  if (tagKeys.length === 0) return result;

  for (const keys of chunk(tagKeys, 1000)) {
    const params = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `SELECT "tagKey", "questionText" FROM "Tag" WHERE "tagKey" IN (${params})`;
    const res = await client.query(sql, keys);
    for (const row of res.rows) {
      result.set(row.tagKey, normalizeQuestionText(row.questionText));
    }
  }
  return result;
}

async function main() {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite DB が見つかりません: ${sqlitePath}`);
  }

  const envLocal = loadEnvFile(path.join(root, '.env.local'));
  const envSupabase = loadEnvFile(path.join(root, '.env.supabase'));
  const rawUrl = envLocal.PROD_DATABASE_URL || envSupabase.DATABASE_URL || '';
  const prodUrl = rawUrl
    .replace(/[?&]pgbouncer=true/g, '')
    .replace(/[?&]connection_limit=\d+/g, '')
    .replace(/[?&]$/, '');

  if (!prodUrl.startsWith('postgresql://') && !prodUrl.startsWith('postgres://')) {
    throw new Error('Postgres URL が見つかりません。.env.local の PROD_DATABASE_URL か .env.supabase の DATABASE_URL を設定してください。');
  }

  const masked = prodUrl.replace(/:\/\/[^@]+@/, '://***:***@');
  console.log(`[sync-tag-question] target: ${masked}`);
  console.log(`[sync-tag-question] mode: ${dryRun ? 'dry-run' : 'apply'}`);

  const sqlite = sqlite3(sqlitePath, { readonly: true });
  const localRows = sqlite
    .prepare('SELECT tagKey, displayName, questionText FROM Tag ORDER BY tagKey')
    .all()
    .map((row) => ({
      tagKey: String(row.tagKey),
      displayName: String(row.displayName),
      questionText: normalizeQuestionText(row.questionText),
    }));
  sqlite.close();

  const localMap = new Map(localRows.map((r) => [r.tagKey, r]));
  const localTagKeys = localRows.map((r) => r.tagKey);

  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
  await client.connect();

  try {
    const prodMap = await fetchProdTagQuestionMap(client, localTagKeys);

    const updates = [];
    const missingInProd = [];
    for (const tagKey of localTagKeys) {
      const local = localMap.get(tagKey);
      if (!prodMap.has(tagKey)) {
        missingInProd.push(tagKey);
        continue;
      }
      const prodQ = prodMap.get(tagKey);
      if (local.questionText !== prodQ) {
        updates.push({
          tagKey,
          displayName: local.displayName,
          before: prodQ,
          after: local.questionText,
        });
      }
    }

    const backupDir = path.join(backupsRoot, `prod-tag-question-sync-${makeTimestamp()}`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(
      path.join(backupDir, 'changes.json'),
      JSON.stringify(updates, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(backupDir, 'missing-in-prod.json'),
      JSON.stringify(missingInProd, null, 2),
      'utf8'
    );

    if (!dryRun && updates.length > 0) {
      await client.query('BEGIN');
      try {
        for (const u of updates) {
          await client.query(
            'UPDATE "Tag" SET "questionText" = $1 WHERE "tagKey" = $2',
            [u.after, u.tagKey]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    const summary = {
      createdAt: new Date().toISOString(),
      dryRun,
      sqliteTags: localRows.length,
      prodTagsMatchedByKey: localTagKeys.length - missingInProd.length,
      updateCount: updates.length,
      missingInProdCount: missingInProd.length,
      backupDir,
    };
    fs.writeFileSync(
      path.join(backupDir, 'summary.json'),
      JSON.stringify(summary, null, 2),
      'utf8'
    );

    console.log(`[sync-tag-question] updates: ${updates.length}`);
    console.log(`[sync-tag-question] missing_in_prod: ${missingInProd.length}`);
    console.log(`[sync-tag-question] backup: ${backupDir}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[sync-tag-question] failed:', e.message);
  process.exit(1);
});
