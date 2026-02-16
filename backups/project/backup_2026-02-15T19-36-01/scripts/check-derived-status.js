const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// DB確認
const db = new Database(path.join(__dirname, '../prisma/dev.db'), { readonly: true });
const dbTags = db.prepare(`SELECT tagKey, displayName, category FROM Tag WHERE tagType = 'DERIVED'`).all();
console.log('=== DB DERIVED tags ===');
console.log(`Count: ${dbTags.length}`);
dbTags.forEach(t => console.log(`  - ${t.displayName} (${t.category})`));
db.close();

// バックアップ確認
const backupPath = path.join(__dirname, '../data/derived-tags-backup.json');
if (fs.existsSync(backupPath)) {
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  console.log('\n=== Backup DERIVED tags ===');
  console.log(`Total count: ${backup.totalCount}`);
  console.log('All tags:', backup.allTags ? backup.allTags.length : 'N/A');
}

// tagRanks確認
const ranksPath = path.join(__dirname, '../config/tagRanks.json');
if (fs.existsSync(ranksPath)) {
  const ranksConfig = JSON.parse(fs.readFileSync(ranksPath, 'utf-8'));
  const ranks = ranksConfig.ranks;
  const total = Object.keys(ranks).length;
  const A = Object.values(ranks).filter(r => r === 'A').length;
  const B = Object.values(ranks).filter(r => r === 'B').length;
  const C = Object.values(ranks).filter(r => r === 'C').length;
  console.log('\n=== tagRanks.json ===');
  console.log(`Total: ${total}, A: ${A}, B: ${B}, C: ${C}`);
}
