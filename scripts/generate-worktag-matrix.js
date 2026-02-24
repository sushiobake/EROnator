/**
 * WorkTag 行列を生成し data/workTagMatrix.json に出力する。
 * ゲームのパフォーマンス最適化のため、オフラインで事前計算する。
 *
 * 前提: gameRegistered=true, needsReview=false の Work とその WorkTag を対象とする。
 * 実行: npm run generate:worktag-matrix
 * 運用: npm run sync:supabase 実行時に自動で再生成される。手動実行も可能。
 */

const fs = require('fs');
const path = require('path');

const sqlite3 = require('better-sqlite3');
const PRISMA_DIR = path.join(__dirname, '..', 'prisma');
const DB_PATH = path.join(PRISMA_DIR, 'dev.db');
const OUT_PATH = path.join(__dirname, '..', 'data', 'workTagMatrix.json');

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ SQLite DB が見つかりません:', DB_PATH);
    process.exit(1);
  }

  console.log('📖 SQLite から WorkTag を読み込み中...');
  const db = sqlite3(DB_PATH, { readonly: true });

  const workIds = db
    .prepare(
      `SELECT workId FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)`
    )
    .all()
    .map((r) => r.workId);

  if (workIds.length === 0) {
    console.error('❌ ゲーム登録済み作品が 0 件です。');
    db.close();
    process.exit(1);
  }

  const placeholders = workIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT workId, tagKey, derivedConfidence
       FROM WorkTag
       WHERE workId IN (${placeholders})`
    )
    .all(...workIds);

  db.close();

  const workTagMap = {};
  for (const w of workIds) {
    workTagMap[w] = [];
  }
  for (const r of rows) {
    workTagMap[r.workId].push({
      tagKey: r.tagKey,
      derivedConfidence: r.derivedConfidence,
    });
  }

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    workCount: workIds.length,
    totalWorkTags: rows.length,
    workTagMap,
  };

  const dataDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 0), 'utf-8');
  console.log(`✅ ${OUT_PATH} に出力しました (${workIds.length} works, ${rows.length} workTags)`);
}

main();
