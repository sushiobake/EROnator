/**
 * Prismaが正しいDBファイルを参照するように修正するスクリプト
 * prisma/prisma/dev.dbが存在する場合、削除または正しいDBファイルに統一
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const correctDbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const wrongDbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');

console.log('Checking Prisma database configuration...');
console.log('Correct DB path:', correctDbPath);
console.log('Wrong DB path:', wrongDbPath);

// 正しいDBファイルの存在確認
if (!fs.existsSync(correctDbPath)) {
  console.error('Error: Correct DB file does not exist:', correctDbPath);
  process.exit(1);
}

// 間違ったDBファイルの存在確認
if (fs.existsSync(wrongDbPath)) {
  console.log('Found wrong DB file:', wrongDbPath);
  console.log('Removing wrong DB file...');
  try {
    fs.unlinkSync(wrongDbPath);
    console.log('Successfully removed wrong DB file');
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM') {
      console.error('Error: Could not remove wrong DB file (file may be in use)');
      console.error('Please stop the development server and try again');
      process.exit(1);
    } else {
      console.error('Error removing wrong DB file:', error.message);
      process.exit(1);
    }
  }
}

// Prisma Clientを再生成
console.log('Regenerating Prisma Client...');
try {
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('Prisma Client regenerated successfully');
} catch (error) {
  console.error('Error regenerating Prisma Client:', error.message);
  process.exit(1);
}

// データベースの状態を確認
console.log('Verifying database connection...');
try {
  const sqlite3 = require('better-sqlite3');
  const db = sqlite3(correctDbPath, { readonly: true });
  const workCount = db.prepare('SELECT COUNT(*) as count FROM Work').get();
  const tagCount = db.prepare('SELECT COUNT(*) as count FROM Tag').get();
  db.close();
  
  console.log('Database verification:');
  console.log(`  Works: ${workCount.count}`);
  console.log(`  Tags: ${tagCount.count}`);
  
  if (workCount.count === 0 || tagCount.count === 0) {
    console.warn('Warning: Database appears to be empty or Prisma may not be reading it correctly');
  }
} catch (error) {
  console.error('Error verifying database:', error.message);
  process.exit(1);
}

console.log('Done!');
