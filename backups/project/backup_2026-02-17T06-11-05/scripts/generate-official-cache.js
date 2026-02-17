/**
 * OFFICIALタグのキャッシュファイルを生成
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const cachePath = path.join(__dirname, '../config/officialTagsCache.json');

const db = new Database(dbPath, { readonly: true });

const tags = db.prepare(`SELECT displayName FROM Tag WHERE tagType = 'OFFICIAL' ORDER BY displayName`).all();
const tagNames = tags.map(t => t.displayName);

console.log(`Found ${tagNames.length} OFFICIAL tags`);

const cache = {
  generatedAt: new Date().toISOString(),
  count: tagNames.length,
  tags: tagNames
};

fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
console.log(`Cache saved to ${cachePath}`);

db.close();
