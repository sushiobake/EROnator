const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'prisma', 'dev.db'), { readonly: true });

const genreTags = db.prepare(`
  SELECT 
    t.tagKey,
    t.displayName,
    COUNT(wt.workId) as workCount
  FROM Tag t
  LEFT JOIN WorkTag wt ON t.tagKey = wt.tagKey
  WHERE t.tagType = 'OFFICIAL' AND t.category = 'ジャンル'
  GROUP BY t.tagKey
  ORDER BY t.displayName
`).all();

console.log('=== 残っている「ジャンル」カテゴリのタグ ===');
console.log('');
genreTags.forEach(t => {
  console.log(`${t.tagKey} | ${t.displayName} | works: ${t.workCount}`);
});

db.close();
