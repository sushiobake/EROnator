/**
 * フルスナップショット（「完璧に近い」バックアップ）
 *
 * - コード一式（src, config, scripts, prisma, docs, .cursor/rules など）
 * - SQLite: dev.db + -wal + -shm（存在すれば。WAL モードの整合用）
 * - package-lock.json / ルート設定ファイル
 * - git bundle（全 ref。ロールバック用）
 * - メタ情報 JSON（コミット SHA 等）
 *
 * 含めないもの: node_modules, .next, .env.local（秘密情報）
 *
 * 使い方: npm run backup:snapshot
 *
 * 出力: backups/snapshots/snapshot_<ISO日時>/
 * 注意: 古いスナップショットは自動削除しません。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const baseDir = path.join(root, 'backups', 'snapshots');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const snapDir = path.join(baseDir, `snapshot_${stamp}`);

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  skip (なし): ${path.relative(root, src)}`);
    return false;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === 'dist') continue;
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
  return true;
}

function copyFileRel(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.warn(`  skip (なし): ${rel}`);
    return false;
  }
  const dest = path.join(snapDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function main() {
  console.log('📸 Full snapshot を作成します...\n');
  fs.mkdirSync(snapDir, { recursive: true });

  const dirs = [
    'src',
    'config',
    'docs',
    'scripts',
    'data',
    'public',
    'prisma/migrations',
    '.cursor/rules',
  ];

  for (const rel of dirs) {
    const src = path.join(root, rel);
    const dest = path.join(snapDir, rel);
    console.log(`📁 ${rel}`);
    copyDir(src, dest);
  }

  const files = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'next.config.js',
    'next.config.mjs',
    'postcss.config.js',
    'postcss.config.mjs',
    'tailwind.config.js',
    'tailwind.config.ts',
    'jest.config.js',
    'jest.config.ts',
    'README.md',
    'prisma/schema.prisma',
    'prisma/schema.sqlite.prisma',
    'prisma/schema.postgres.prisma',
    'prisma/schema.prisma.postgres',
    'prisma/seed.ts',
    '.env.example',
    '.env.supabase.example',
    '.gitignore',
  ];

  for (const rel of files) {
    if (fs.existsSync(path.join(root, rel))) {
      console.log(`📄 ${rel}`);
      copyFileRel(rel);
    }
  }

  // SQLite 本体 + WAL（開発 DB の完全コピー）
  const dbBase = path.join(root, 'prisma', 'dev.db');
  const sqliteBits = ['dev.db', 'dev.db-wal', 'dev.db-shm'];
  for (const name of sqliteBits) {
    const p = path.join(root, 'prisma', name);
    if (fs.existsSync(p)) {
      const destDir = path.join(snapDir, 'prisma');
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(p, path.join(destDir, name));
      console.log(`💾 prisma/${name}`);
    }
  }

  let gitHead = null;
  let gitBranch = null;
  try {
    gitHead = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
    gitBranch = execSync('git branch --show-current', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    console.warn('⚠️  git メタ取得スキップ');
  }

  const bundlePath = path.join(snapDir, 'git-repo.bundle');
  try {
    console.log('📦 git bundle を作成中...');
    execSync(`git bundle create "${bundlePath}" --all`, { cwd: root, stdio: 'inherit' });
  } catch (e) {
    console.warn('⚠️  git bundle 作成失敗（リポジトリでない、または git 未設定）:', e.message);
  }

  const meta = {
    createdAt: new Date().toISOString(),
    purpose: 'Full snapshot after DB/prod tooling stabilization',
    snapshotDir: path.relative(root, snapDir),
    gitHead,
    gitBranch,
    excludedSecrets: ['.env.local', '.env', '.env.supabase'],
    restoreHints: {
      code: 'ファイルをプロジェクトルートに上書きコピーするか、git clone 後にこのフォルダから必要なパスだけ戻す',
      git: 'git clone git-repo.bundle restored-repo   （bundle が作成されている場合）',
      sqlite: 'prisma/dev.db と -wal -shm を prisma/ に戻し、dev サーバー停止中に行う',
      prodDb: '本番は Supabase。列追加は scripts/ensure-prod-columns.js を参照（.cursor/rules/database-prod-migrations.mdc）',
    },
  };
  fs.writeFileSync(path.join(snapDir, 'SNAPSHOT-META.json'), JSON.stringify(meta, null, 2), 'utf8');

  const restoreMd = `# スナップショットの戻し方

作成日時: ${meta.createdAt}
Git HEAD: ${gitHead || '(不明)'}
ブランチ: ${gitBranch || '(不明)'}

## コード

- このフォルダ内の \`src\` / \`config\` / \`scripts\` / \`prisma\`（マイグレーション等）を、プロジェクトルートの同名に上書きコピーしてください。
- または \`git-repo.bundle\` がある場合: \`git clone git-repo.bundle my-restore\` で当時のコミット履歴ごと復元できます。

## ローカル SQLite（dev.db）

- **npm run dev を止めてから** \`prisma/dev.db\`（および \`-wal\` \`-shm\` があれば同じく）をプロジェクトの \`prisma/\` にコピー。

## 秘密情報

- \`.env.local\` / \`.env.supabase\` はバックアップに含めていません。手元の別バックアップか Vercel / Supabase ダッシュボードから再設定してください。

## 本番 DB

- 本番はこの ZIP に含まれません。Supabase のバックアップはホスト側の機能を利用してください。
- 列の不足対策: \`npm run db:ensure:prod\`（詳細は \`.cursor/rules/database-prod-migrations.mdc\`）
`;

  fs.writeFileSync(path.join(snapDir, 'HOW_TO_RESTORE.md'), restoreMd, 'utf8');

  console.log('\n' + '='.repeat(50));
  console.log('✅ スナップショット完了');
  console.log(`   ${snapDir}`);
  console.log('='.repeat(50));
}

main();
