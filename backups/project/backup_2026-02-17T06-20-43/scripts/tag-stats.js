const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'prisma', 'dev.db'), { readonly: true });

const stats = db.prepare('SELECT tagType, COUNT(*) as cnt FROM Tag GROUP BY tagType ORDER BY tagType').all();
console.log('=== タグ統計 ===');
stats.forEach(s => console.log(`${s.tagType}: ${s.cnt}`));

const categories = db.prepare(`SELECT category, COUNT(*) as cnt FROM Tag WHERE tagType = 'OFFICIAL' GROUP BY category ORDER BY cnt DESC`).all();
console.log('');
console.log('=== OFFICIALタグのカテゴリ分布 ===');
categories.forEach(c => console.log(`${c.category || '(なし)'}: ${c.cnt}`));

// ジャンルタグがないことを確認
const genreCount = db.prepare(`SELECT COUNT(*) as cnt FROM Tag WHERE tagType = 'OFFICIAL' AND category = 'ジャンル'`).get();
console.log('');
console.log(`=== ジャンルタグ: ${genreCount.cnt}件 ===`);

db.close();
