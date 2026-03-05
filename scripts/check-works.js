require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

// Prisma の file:./prisma/dev.db を解決
const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
console.log('DB path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  const count = db.prepare('SELECT COUNT(*) as cnt FROM Work').get();
  console.log('全作品数:', count.cnt);

  const testIds = ['d_091605', 'd_188422', 'd_733581'];
  for (const id of testIds) {
    const row = db.prepare('SELECT workId, title, manualTaggingFolder, gameRegistered, needsReview FROM Work WHERE workId = ?').get(id);
    console.log(id, ':', row ? `folder=${row.manualTaggingFolder} game=${row.gameRegistered} review=${row.needsReview} | ${row.title}` : 'NOT FOUND');
  }

  const reviewCount = db.prepare('SELECT COUNT(*) as cnt FROM Work WHERE needsReview = 1').get();
  console.log('\nneedsReview=1:', reviewCount.cnt, '件');

  db.close();
} catch (e) {
  console.error('Error:', e.message);
  console.log('better-sqlite3 not installed? Trying sqlite3...');
}
