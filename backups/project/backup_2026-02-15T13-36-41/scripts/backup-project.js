/**
 * プロジェクト全体のバックアップスクリプト
 * 重要なファイルとディレクトリをバックアップ
 * 
 * 使用方法:
 *   npm run backup:project
 *   または
 *   node scripts/backup-project.js
 */

const fs = require('fs');
const path = require('path');

// バックアップ設定
const backupBaseDir = 'backups/project';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = path.join(backupBaseDir, `backup_${timestamp}`);

// バックアップ対象（相対パス）
const backupTargets = [
  {
    source: 'src/app/components',
    dest: 'src/app/components',
    type: 'directory'
  },
  {
    source: 'src/app/api',
    dest: 'src/app/api',
    type: 'directory'
  },
  {
    source: 'src/server',
    dest: 'src/server',
    type: 'directory'
  },
  {
    source: 'config',
    dest: 'config',
    type: 'directory'
  },
  {
    source: 'docs',
    dest: 'docs',
    type: 'directory'
  },
  {
    source: 'scripts',
    dest: 'scripts',
    type: 'directory'
  },
  {
    source: 'prisma/schema.prisma',
    dest: 'prisma/schema.prisma',
    type: 'file'
  },
  {
    source: 'package.json',
    dest: 'package.json',
    type: 'file'
  },
  {
    source: 'tsconfig.json',
    dest: 'tsconfig.json',
    type: 'file'
  },
  {
    source: 'next.config.js',
    dest: 'next.config.js',
    type: 'file'
  }
];

/**
 * ディレクトリを再帰的にコピー
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Source not found: ${src}`);
    return false;
  }

  // ディレクトリ作成
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  let success = true;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    try {
      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (error) {
      console.error(`❌ Error copying ${srcPath}:`, error.message);
      success = false;
    }
  }

  return success;
}

/**
 * ファイルをコピー
 */
function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Source not found: ${src}`);
    return false;
  }

  try {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    return true;
  } catch (error) {
    console.error(`❌ Error copying ${src}:`, error.message);
    return false;
  }
}

/**
 * メイン処理
 */
function main() {
  console.log('📦 Starting project backup...\n');

  // バックアップディレクトリ作成
  if (!fs.existsSync(backupBaseDir)) {
    fs.mkdirSync(backupBaseDir, { recursive: true });
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;

  // バックアップ実行
  for (const target of backupTargets) {
    const srcPath = path.resolve(target.source);
    const destPath = path.join(backupDir, target.dest);

    console.log(`📋 Backing up: ${target.source}...`);

    let success = false;
    if (target.type === 'directory') {
      success = copyDirectory(srcPath, destPath);
    } else {
      success = copyFile(srcPath, destPath);
    }

    if (success) {
      console.log(`   ✅ Success: ${target.source}`);
      successCount++;
    } else {
      console.log(`   ❌ Failed: ${target.source}`);
      failCount++;
    }
  }

  // prisma/dev.db があればコピー（総合バックアップ用）
  const devDbPath = path.resolve('prisma/dev.db');
  if (fs.existsSync(devDbPath)) {
    const destDbDir = path.join(backupDir, 'prisma');
    if (!fs.existsSync(destDbDir)) fs.mkdirSync(destDbDir, { recursive: true });
    const destDb = path.join(destDbDir, 'dev.db');
    try {
      fs.copyFileSync(devDbPath, destDb);
      console.log('   ✅ Success: prisma/dev.db');
      successCount++;
    } catch (err) {
      console.error('   ❌ Failed: prisma/dev.db', err.message);
      failCount++;
    }
  }

  // バックアップ情報を保存
  const backupInfo = {
    timestamp: new Date().toISOString(),
    backupDir: backupDir,
    targets: backupTargets.map(t => t.source),
    successCount,
    failCount
  };

  const infoPath = path.join(backupDir, 'backup-info.json');
  fs.writeFileSync(infoPath, JSON.stringify(backupInfo, null, 2));

  // 古いバックアップを削除（30日以上前）
  console.log('\n🧹 Cleaning old backups...');
  if (fs.existsSync(backupBaseDir)) {
    const entries = fs.readdirSync(backupBaseDir);
    const now = Date.now();
    const thirtyDaysAgo = 30 * 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      const entryPath = path.join(backupBaseDir, entry);
      const stats = fs.statSync(entryPath);
      if (stats.isDirectory() && now - stats.mtimeMs > thirtyDaysAgo) {
        try {
          fs.rmSync(entryPath, { recursive: true, force: true });
          console.log(`   🗑️  Deleted old backup: ${entry}`);
        } catch (error) {
          console.warn(`   ⚠️  Could not delete ${entry}:`, error.message);
        }
      }
    }
  }

  // 結果表示
  console.log('\n' + '='.repeat(50));
  console.log('📊 Backup Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Location: ${backupDir}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    console.log('\n⚠️  Some files failed to backup. Please check the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ Backup completed successfully!');
  }
}

// 実行
main();
