/**
 * 自動バックアップスクリプト（方法2）
 * src/app/admin/tags/page.tsx を自動バックアップ
 * 
 * 使用方法:
 * 1. package.jsonにスクリプトを追加: "backup:admin-tags": "node scripts/auto-backup-admin-tags.js"
 * 2. 手動実行: npm run backup:admin-tags
 * 3. または、pre-commitフックで自動実行（.git/hooks/pre-commitに追加）
 */

const fs = require('fs');
const path = require('path');

const targetFile = 'src/app/admin/tags/page.tsx';
const backupDir = 'backups/admin-tags';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = path.join(backupDir, `page.tsx.${timestamp}`);

// バックアップディレクトリ作成
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// ファイルが存在するか確認
if (!fs.existsSync(targetFile)) {
  console.error(`Error: ${targetFile} not found`);
  process.exit(1);
}

// ファイルコピー
try {
  fs.copyFileSync(targetFile, backupPath);
  console.log(`✅ Backup created: ${backupPath}`);
  
  // 古いバックアップを削除（30日以上前）
  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const thirtyDaysAgo = 30 * 24 * 60 * 60 * 1000;
  
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > thirtyDaysAgo) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted old backup: ${file}`);
    }
  }
} catch (error) {
  console.error(`Error creating backup:`, error);
  process.exit(1);
}
