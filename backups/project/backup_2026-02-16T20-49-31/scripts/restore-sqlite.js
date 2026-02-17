/**
 * ローカル開発用に schema.prisma を SQLite に戻すスクリプト
 * 
 * 使い方:
 *   node scripts/restore-sqlite.js
 *   または
 *   npm run restore:sqlite
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA_FILE = path.join(SCHEMA_DIR, 'schema.prisma');
const SCHEMA_SQLITE = path.join(SCHEMA_DIR, 'schema.sqlite.prisma');

function main() {
  try {
    if (!fs.existsSync(SCHEMA_SQLITE)) {
      throw new Error('schema.sqlite.prisma が見つかりません');
    }
    
    console.log('📝 schema.prisma を SQLite に戻しています...');
    fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
    console.log('✅ SQLite スキーマに戻しました');
    console.log('✅ ローカル開発を続けられます');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
