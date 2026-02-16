const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath, { readonly: true });

const tags = db.prepare(`
  SELECT 
    t.tagKey,
    t.displayName,
    t.category,
    COUNT(wt.workId) as workCount
  FROM Tag t
  LEFT JOIN WorkTag wt ON t.tagKey = wt.tagKey
  WHERE t.tagType = 'OFFICIAL'
  GROUP BY t.tagKey
  ORDER BY t.displayName
`).all();

const grouped = new Map();
for (const tag of tags) {
  if (!grouped.has(tag.displayName)) grouped.set(tag.displayName, []);
  grouped.get(tag.displayName).push(tag);
}

for (const [name, tagList] of grouped) {
  if (tagList.length >= 2) {
    console.log('【' + name + '】');
    for (const t of tagList) {
      console.log('  ' + t.tagKey + ' | ' + (t.category || 'なし') + ' | works: ' + t.workCount);
    }
  }
}
db.close();
