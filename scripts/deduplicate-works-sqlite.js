/**
 * 同一タイトル＋作者の作品を1本にまとめる（重複解消）
 * SQLite直接操作（Prisma非依存）
 *
 * 使い方:
 *   node scripts/deduplicate-works-sqlite.js        # ドライラン
 *   node scripts/deduplicate-works-sqlite.js --run  # 実行
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
if (!fs.existsSync(dbPath)) {
  console.error('prisma/dev.db が見つかりません');
  process.exit(1);
}

const run = process.argv.includes('--run');
const Database = require('better-sqlite3');
const db = new Database(dbPath, run ? undefined : { readonly: true });

function pickCanonical(works) {
  const withGame = works.find((w) => w.gameRegistered === 1);
  if (withGame) return withGame.workId;
  return works.map((w) => w.workId).sort()[0];
}

const all = db.prepare('SELECT workId, title, authorName, gameRegistered FROM Work').all();
const key = (w) => `${(w.title ?? '').trim()}\t${(w.authorName ?? '').trim()}`;
const groups = new Map();
for (const w of all) {
  const k = key(w);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(w);
}

const duplicateGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
if (duplicateGroups.length === 0) {
  console.log('重複グループはありません。');
  db.close();
  process.exit(0);
}

console.log(run ? '▶ 実行モード\n' : '🔍 ドライラン（--run を付けると実際に削除します）\n');
console.log(`重複グループ: ${duplicateGroups.length} 件\n`);

let deletedCount = 0;

function doMerge() {
  const insertTag = db.prepare(
    `INSERT OR IGNORE INTO WorkTag (id, workId, tagKey, derivedConfidence, derivedSource, createdAt)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  );
  const deleteWorkTag = db.prepare('DELETE FROM WorkTag WHERE workId = ?');
  const deleteWork = db.prepare('DELETE FROM Work WHERE workId = ?');

  for (const [titleAuthor, works] of duplicateGroups) {
    const [title] = titleAuthor.split('\t');
    const canonicalWorkId = pickCanonical(works);
    const duplicates = works.filter((w) => w.workId !== canonicalWorkId);

    console.log(`「${title.slice(0, 40)}${title.length > 40 ? '…' : ''}」`);
    console.log(`  代表: ${canonicalWorkId}`);
    for (const d of duplicates) {
      console.log(`  重複削除: ${d.workId}`);
      const tags = db.prepare('SELECT tagKey, derivedConfidence, derivedSource FROM WorkTag WHERE workId = ?').all(d.workId);
      for (const wt of tags) {
        const newId = crypto.randomBytes(12).toString('hex');
        insertTag.run(newId, canonicalWorkId, wt.tagKey, wt.derivedConfidence ?? null, wt.derivedSource ?? null);
      }
      deleteWorkTag.run(d.workId);
      deleteWork.run(d.workId);
      deletedCount++;
    }
  }
}

if (run) {
  db.transaction(doMerge)();
  console.log(`\n完了: ${deletedCount} 件の重複 Work を削除し、代表にタグを統合しました。`);
} else {
  for (const [titleAuthor, works] of duplicateGroups) {
    const [title] = titleAuthor.split('\t');
    const canonicalWorkId = pickCanonical(works);
    const duplicates = works.filter((w) => w.workId !== canonicalWorkId);
    console.log(`「${title.slice(0, 40)}${title.length > 40 ? '…' : ''}」`);
    console.log(`  代表: ${canonicalWorkId}`);
    duplicates.forEach((d) => console.log(`  重複: ${d.workId}`));
    deletedCount += duplicates.length;
  }
  console.log(`\nドライラン: ${duplicateGroups.length} グループ・${deletedCount} 件を代表にまとめると削除されます。実行するには --run を付けてください。`);
}

db.close();
