const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'prisma', 'dev.db'));
db.prepare('DELETE FROM Tag WHERE tagKey = ?').run('お姫様');
console.log('削除完了: お姫様');
db.close();
