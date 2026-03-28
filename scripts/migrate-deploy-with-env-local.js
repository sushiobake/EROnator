/**
 * .env / .env.local を読み込み、auto-switch-schema 後に prisma migrate deploy を実行する。
 * アプリ（npm run dev）と同じ DATABASE_URL を使う。SQLite は絶対パスに直す（db-push と同じ）。
 *
 * 使い方: node scripts/migrate-deploy-with-env-local.js
 * npm:    npm run db:migrate:deploy
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
require('dotenv').config({ path: path.join(root, '.env.local'), override: true });

function resolveSqliteDatabaseUrlForPrismaCli() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('file:')) return;
  const withoutFile = dbUrl.slice(5);
  const queryStart = withoutFile.indexOf('?');
  const pathPart = queryStart >= 0 ? withoutFile.slice(0, queryStart) : withoutFile;
  const queryPart = queryStart >= 0 ? withoutFile.slice(queryStart) : '';
  if (!pathPart.startsWith('./') && !pathPart.startsWith('.\\')) return;
  const absolutePath = path.resolve(root, pathPart);
  const normalized = absolutePath.replace(/\\/g, '/');
  process.env.DATABASE_URL = 'file:' + normalized + queryPart;
}

function sqliteDbFilesToBackup(dbUrl) {
  if (!dbUrl || !dbUrl.startsWith('file:')) return [];
  const withoutFile = dbUrl.slice(5);
  const queryStart = withoutFile.indexOf('?');
  let pathPart = queryStart >= 0 ? withoutFile.slice(0, queryStart) : withoutFile;
  if (pathPart.startsWith('//')) pathPart = pathPart.slice(2);
  const abs = path.isAbsolute(pathPart) ? pathPart : path.resolve(root, pathPart);
  const norm = path.normalize(abs);
  const list = [norm];
  const wal = norm + '-wal';
  const shm = norm + '-shm';
  if (fs.existsSync(wal)) list.push(wal);
  if (fs.existsSync(shm)) list.push(shm);
  return list.filter((p) => fs.existsSync(p));
}

function runBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(root, 'backups', 'project', `backup_${ts}_pre_migrate_deploy`);
  fs.mkdirSync(backupDir, { recursive: true });
  const dbUrl = process.env.DATABASE_URL || '';
  const meta = {
    createdAt: ts,
    purpose: 'Before prisma migrate deploy (RecommendPlayHistory.clickedFanzaWorkId etc.)',
    databaseUrlKind: dbUrl.startsWith('file:') ? 'sqlite' : dbUrl.startsWith('postgres') ? 'postgres' : 'other',
  };

  if (dbUrl.startsWith('file:')) {
    const files = sqliteDbFilesToBackup(dbUrl);
    const destDb = path.join(backupDir, 'sqlite');
    fs.mkdirSync(destDb, { recursive: true });
    for (const f of files) {
      const name = path.basename(f);
      fs.copyFileSync(f, path.join(destDb, name));
    }
    meta.sqliteFilesCopied = files.map((f) => path.basename(f));
  } else {
    meta.note =
      'DATABASE_URL は Postgres 等です。DB ファイルのコピーは行っていません。ホスティングのスナップショットで戻せます。';
  }

  fs.writeFileSync(path.join(backupDir, 'backup-info.json'), JSON.stringify(meta, null, 2), 'utf8');
  const restoreMd = `# 復元手順

## SQLite（このバックアップに sqlite/ がある場合）

1. dev サーバーを止める。
2. 次をプロジェクトルートで実行（パスは環境の dev.db に合わせる）:
   - \`sqlite/dev.db\` フォルダ内のファイルを \`prisma/dev.db\`（および -wal -shm）へ上書きコピー。

## Postgres

- マイグレーション適用前のスナップショットがあればリストア。
- または手動で列を削除する場合は DBA 判断（通常は不要）。

## マイグレーション記録だけ戻したい場合

- 複雑なため、SQLite は DB ファイル復元が最も確実です。
`;
  fs.writeFileSync(path.join(backupDir, 'HOW_TO_RESTORE.md'), restoreMd, 'utf8');
  console.log('[migrate:backup] Created:', backupDir);
  return backupDir;
}

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'not set');
resolveSqliteDatabaseUrlForPrismaCli();
if ((process.env.DATABASE_URL || '').startsWith('file:')) {
  console.log('[migrate:deploy] SQLite (resolved):', process.env.DATABASE_URL);
}

runBackup();

try {
  require('./auto-switch-schema.js');
} catch (e) {
  console.warn('[migrate:deploy] auto-switch-schema:', e.message);
}

console.log('[migrate:deploy] Running npx prisma migrate deploy ...');
console.log(
  '[migrate:deploy] ヒント: SQLite で database is locked となる場合は npm run dev を止めてから再実行してください。'
);
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: root, env: process.env });
} catch (e) {
  console.error(
    '\n[migrate:deploy] 失敗しました。SQLite の場合は dev サーバー（npm run dev / dev:clean）を停止して `npm run db:migrate:deploy` を再実行してください。\n'
  );
  process.exit(e.status ?? 1);
}
console.log('[migrate:deploy] Done.');

try {
  execSync('npx prisma generate', { stdio: 'inherit', cwd: root, env: process.env });
  console.log('[migrate:deploy] prisma generate OK.');
} catch (e) {
  console.warn('[migrate:deploy] prisma generate failed (dev サーバーが DB を掴んでいる可能性):', e.message);
}
