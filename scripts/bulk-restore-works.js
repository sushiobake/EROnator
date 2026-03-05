require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath);

const workIds = [
  'd_091605','d_092103','d_093911','d_099653','d_099732','d_100710','d_100951','d_102207','d_103212','d_103347',
  'd_109359','d_110548','d_111566','d_111618','d_116801','d_117234','d_117678','d_119054','d_126782','d_129630',
  'd_131626','d_134854','d_152726','d_158685','d_159784','d_162321','d_163834','d_171303','d_174920','d_188412',
  'd_188422','d_196506','d_201046','d_210652','d_214606','d_215779','d_218656','d_219279','d_224129','d_228685',
  'd_231037','d_246448','d_250637','d_270837','d_281834','d_286085','d_324781','d_327663','d_381994','d_396627',
  'd_425379','d_469919','d_473512','d_494830','d_505729','d_530875','d_626040','d_645777','d_663444','d_663516',
  'd_666487','d_685980','d_696502','d_702267','d_704606','d_709443','d_710229','d_712784','d_715757','d_717931',
  'd_721311','d_721531','d_721620','d_726416','d_726511','d_727985','d_728097','d_728833','d_728996','d_730669',
  'd_730674','d_731059','d_731531','d_731761','d_731800','d_731867','d_732044','d_732811','d_733262','d_733581',
];

console.log('対象:', workIds.length, '件');

// 変更前
const before = db.prepare('SELECT workId, manualTaggingFolder, gameRegistered, needsReview FROM Work WHERE workId = ?');
console.log('\n--- 変更前（先頭3件）---');
for (const id of workIds.slice(0, 3)) {
  const row = before.get(id);
  console.log(`  ${id}: folder=${row?.manualTaggingFolder} game=${row?.gameRegistered} review=${row?.needsReview}`);
}

// 一括更新（トランザクション）
const taggedAt = new Date().toISOString();
const update = db.prepare('UPDATE Work SET manualTaggingFolder = ?, taggedAt = ?, gameRegistered = 1, needsReview = 0 WHERE workId = ?');

const bulkUpdate = db.transaction(() => {
  let count = 0;
  for (const id of workIds) {
    const info = update.run('tagged', taggedAt, id);
    if (info.changes > 0) count++;
  }
  return count;
});

const updated = bulkUpdate();
console.log('\n更新完了:', updated, '件');

// 変更後
console.log('\n--- 変更後（先頭3件）---');
for (const id of workIds.slice(0, 3)) {
  const row = before.get(id);
  console.log(`  ${id}: folder=${row?.manualTaggingFolder} game=${row?.gameRegistered} review=${row?.needsReview}`);
}

// needs_review 残り件数
const remaining = db.prepare('SELECT COUNT(*) as cnt FROM Work WHERE needsReview = 1').get();
console.log('\nneedsReview=1 残り:', remaining.cnt, '件');

db.close();
console.log('完了');
