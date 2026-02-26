/**
 * Postgres 導入前のバックアップから復元するスクリプト
 * 問題が起きた場合に確実に元に戻すために使用
 *
 * 使い方: node scripts/restore-postgres-backup.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'backups', 'pre-postgres-20260224-205328');

const FILES_TO_RESTORE = [
  ['package.json', 'package.json'],
  ['prisma/schema.prisma', 'prisma/schema.prisma'],
  ['prisma/schema.sqlite.prisma', 'prisma/schema.sqlite.prisma'],
  ['prisma/schema.postgres.prisma', 'prisma/schema.postgres.prisma'],
  ['scripts/sync-sqlite-to-supabase.ts', 'scripts/sync-sqlite-to-supabase.ts'],
  ['scripts/run-sync-to-supabase.js', 'scripts/run-sync-to-supabase.js'],
  ['scripts/generate-worktag-matrix.js', 'scripts/generate-worktag-matrix.js'],
  ['scripts/restore-sqlite.js', 'scripts/restore-sqlite.js'],
  ['scripts/prepare-push.js', 'scripts/prepare-push.js'],
  ['scripts/auto-switch-schema.js', 'scripts/auto-switch-schema.js'],
  ['scripts/dev-with-lock.js', 'scripts/dev-with-lock.js'],
];

function main() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error('❌ バックアップフォルダが見つかりません:', BACKUP_DIR);
    process.exit(1);
  }

  console.log('📦 Postgres 導入前の状態に復元します...\n');

  for (const [backupPath, targetPath] of FILES_TO_RESTORE) {
    const src = path.join(BACKUP_DIR, backupPath);
    const dest = path.join(ROOT, targetPath);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log('  ✓', targetPath);
    } else {
      console.warn('  ⚠ スキップ（存在しない）:', backupPath);
    }
  }

  console.log('\n📝 Prisma を SQLite 用に再生成...');
  const gen = spawnSync('npx', ['prisma', 'generate'], {
    stdio: 'inherit',
    cwd: ROOT,
    shell: true,
    env: { ...process.env, DATABASE_URL: 'file:./prisma/dev.db' },
  });

  if (gen.status !== 0) {
    console.error('\n❌ Prisma 生成に失敗しました。手動で npx prisma generate を実行してください。');
    process.exit(1);
  }

  console.log('\n✅ 復元完了。');
  console.log('\n.env と .env.local の DATABASE_URL を SQLite に戻してください:');
  console.log('  DATABASE_URL=file:./prisma/dev.db');
  console.log('\nDocker Postgres を止める場合: docker compose down');
}

main();
