/** Usage: node scripts/list-sqlite-tables-one.cjs <path-to.db> */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'prisma', 'dev.db'));
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(dbPath);
console.log(rows.map((r) => r.name).join('\n'));
db.close();
