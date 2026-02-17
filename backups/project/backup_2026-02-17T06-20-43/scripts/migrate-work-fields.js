/**
 * Workテーブルに新フィールドを追加するマイグレーションスクリプト
 */

const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found: ${dbPath}`);
  process.exit(1);
}

console.log(`Opening database: ${dbPath}`);
const db = sqlite3(dbPath);

try {
  // 現在のテーブル構造を確認
  console.log('\nChecking current table structure...');
  const tableInfo = db.prepare("PRAGMA table_info(Work)").all();
  const existingColumns = tableInfo.map(col => col.name);
  console.log('Existing columns:', existingColumns.join(', '));

  // 追加する必要があるカラム
  const columnsToAdd = [
    { name: 'affiliateUrl', type: 'TEXT', nullable: true },
    { name: 'contentId', type: 'TEXT', nullable: true },
    { name: 'releaseDate', type: 'TEXT', nullable: true },
    { name: 'pageCount', type: 'TEXT', nullable: true },
    { name: 'seriesInfo', type: 'TEXT', nullable: true },
    { name: 'commentText', type: 'TEXT', nullable: true },
  ];

  // 各カラムを追加
  for (const col of columnsToAdd) {
    if (existingColumns.includes(col.name)) {
      console.log(`✓ Column ${col.name} already exists`);
    } else {
      console.log(`Adding column ${col.name}...`);
      const sql = `ALTER TABLE Work ADD COLUMN ${col.name} ${col.type}`;
      db.prepare(sql).run();
      console.log(`✓ Added column ${col.name}`);
    }
  }

  // 最終的なテーブル構造を確認
  console.log('\nFinal table structure:');
  const finalTableInfo = db.prepare("PRAGMA table_info(Work)").all();
  finalTableInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'NULL'}`);
  });

  console.log('\n✓ Migration completed successfully!');
} catch (error) {
  console.error('Error during migration:', error);
  process.exit(1);
} finally {
  db.close();
}
