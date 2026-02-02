const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
console.log('DB Path:', dbPath);

const db = sqlite3(dbPath, { readonly: true });

// テーブル一覧を取得
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log('Tables:', tables.map(t => t.name));

// Workテーブルの件数を確認
const workCount = db.prepare('SELECT COUNT(*) as count FROM Work').get();
console.log('Work count:', workCount.count);

// 最初の1件を取得
const firstWork = db.prepare('SELECT workId, title FROM Work LIMIT 1').get();
console.log('First work:', firstWork);

db.close();
