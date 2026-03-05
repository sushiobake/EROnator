/**
 * Session テーブルに version カラムを追加（既存ならスキップ）
 * prisma db push が sync と判断して追加しない場合のフォールバック
 */
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const db = new Database(dbPath);

try {
  const tableInfo = db.prepare("PRAGMA table_info(Session)").all();
  const hasVersion = tableInfo.some((col) => col.name === 'version');
  if (hasVersion) {
    console.log('Session.version は既に存在します');
    process.exit(0);
  }
  db.prepare('ALTER TABLE Session ADD COLUMN version INTEGER NOT NULL DEFAULT 0').run();
  console.log('Session.version を追加しました');
} finally {
  db.close();
}
