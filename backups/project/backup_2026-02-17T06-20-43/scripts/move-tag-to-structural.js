const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../prisma/dev.db'));
const result = db.prepare(`UPDATE Tag SET tagType = 'STRUCTURAL' WHERE displayName = '男性向け'`).run();
console.log('Updated:', result.changes);
db.close();
