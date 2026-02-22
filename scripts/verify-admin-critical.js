/**
 * 管理画面必須機能の検証スクリプト
 * 必須のキー文字列がソースに含まれているか確認する。
 * 
 * 使用方法:
 *   npm run verify:admin
 *   または
 *   node scripts/verify-admin-critical.js
 * 
 * バックアップ後やコミット前に実行して、必須機能の欠落を検出する。
 */

const fs = require('fs');
const path = require('path');

// 検証対象: { ファイルパス: [ 必須で含む文字列, ... ] }
const CHECKS = {
  'src/app/admin/components/ManualTagging.tsx': [
    'Phase1+2連続',
    'groq-check-batch',
    'groq-check-phase1',
    'groq-check-phase2',
    'groq-tag-batch',
    'has_issues',
    'showBatchResults',
    'batchProgress',
    'useAdminProgress',
    'setProgress',
  ],
  'src/app/admin/tags/page.tsx': [
    'ProgressPanel',
    'AdminProgressProvider',
  ],
  'src/app/api/admin/manual-tagging/works/route.ts': [
    "has_issues",
  ],
  'src/app/api/admin/manual-tagging/works/counts/route.ts': [
    "has_issues",
  ],
  'src/app/api/admin/manual-tagging/works/[workId]/route.ts': [
    "has_issues",
  ],
  'src/server/db/sqlite-direct.ts': [
    "has_issues",
  ],
};

function verify() {
  const baseDir = path.resolve(__dirname, '..');
  let hasError = false;

  console.log('🔍 管理画面必須機能の検証...\n');

  for (const [filePath, requiredStrings] of Object.entries(CHECKS)) {
    const fullPath = path.join(baseDir, filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ ${filePath}`);
      console.log(`   ファイルが存在しません`);
      hasError = true;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const missing = requiredStrings.filter((s) => !content.includes(s));
    if (missing.length > 0) {
      console.log(`❌ ${filePath}`);
      console.log(`   不足: ${missing.join(', ')}`);
      hasError = true;
    } else {
      console.log(`✅ ${filePath}`);
    }
  }

  console.log('');
  if (hasError) {
    console.log('⚠️  必須機能が欠落しています。docs/admin-critical-features.md を参照してください。');
    process.exit(1);
  } else {
    console.log('✅ 必須機能はすべて存在しています。');
    process.exit(0);
  }
}

verify();
