/**
 * WorkTagテーブルにderivedSourceカラムを追加するスクリプト
 * サーバーを止めてから実行してください
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');

console.log('DB Path:', dbPath);

try {
  const db = new Database(dbPath);
  
  // 現在のスキーマを確認
  const columns = db.prepare("PRAGMA table_info(WorkTag)").all();
  console.log('\n現在のWorkTagカラム:');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  // derivedSourceカラムが存在するか確認
  const hasDerivedSource = columns.some(col => col.name === 'derivedSource');
  
  if (hasDerivedSource) {
    console.log('\n✅ derivedSourceカラムは既に存在します');
  } else {
    console.log('\n⚠️ derivedSourceカラムが存在しません。追加します...');
    
    // カラムを追加
    db.exec('ALTER TABLE WorkTag ADD COLUMN derivedSource TEXT');
    
    console.log('✅ derivedSourceカラムを追加しました');
    
    // 確認
    const newColumns = db.prepare("PRAGMA table_info(WorkTag)").all();
    console.log('\n更新後のWorkTagカラム:');
    newColumns.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }
  
  db.close();
  console.log('\n完了！サーバーを再起動してください。');
} catch (error) {
  console.error('エラー:', error.message);
  if (error.message.includes('SQLITE_BUSY')) {
    console.error('\n⚠️ DBがロックされています。開発サーバーを止めてから再実行してください。');
  }
}
