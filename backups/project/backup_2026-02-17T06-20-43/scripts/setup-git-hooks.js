/**
 * Gitフックセットアップスクリプト
 * pre-commitフックで自動バックアップを有効化
 * 
 * 使用方法:
 *   node scripts/setup-git-hooks.js
 */

const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '..', '.git', 'hooks');
const preCommitHook = path.join(hooksDir, 'pre-commit');

// Gitフックディレクトリが存在するか確認
if (!fs.existsSync(hooksDir)) {
  console.error('❌ .git/hooks ディレクトリが見つかりません。Gitリポジトリで実行してください。');
  process.exit(1);
}

// pre-commitフックの内容
const hookContent = `#!/bin/sh
# プロジェクトバックアップ（pre-commit）
# コミット前に自動的にバックアップを実行

node scripts/backup-project.js

# バックアップが失敗してもコミットは続行（警告のみ）
if [ $? -ne 0 ]; then
  echo "⚠️  バックアップに失敗しましたが、コミットは続行します。"
fi
`;

try {
  // 既存のフックをバックアップ（存在する場合）
  if (fs.existsSync(preCommitHook)) {
    const backupPath = `${preCommitHook}.backup.${Date.now()}`;
    fs.copyFileSync(preCommitHook, backupPath);
    console.log(`📋 既存のpre-commitフックをバックアップ: ${backupPath}`);
  }

  // 新しいフックを書き込み
  fs.writeFileSync(preCommitHook, hookContent);
  
  // 実行権限を付与（Unix系OSの場合）
  if (process.platform !== 'win32') {
    fs.chmodSync(preCommitHook, '755');
  }

  console.log('✅ Git pre-commitフックを設定しました。');
  console.log('   コミット前に自動的にバックアップが実行されます。');
  console.log('');
  console.log('⚠️  注意: バックアップが失敗してもコミットは続行されます。');
  console.log('   無効化する場合は .git/hooks/pre-commit を削除してください。');
} catch (error) {
  console.error('❌ フックの設定に失敗しました:', error);
  process.exit(1);
}
