require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath);

// FAIL_LIST 70件 + MAX_QUESTIONS(conf>=10%) 116件（重複除く）
const workIds = [
  'd_714644','d_626040','d_721894','d_111618','d_720840','d_152726','d_171030','d_193006','d_164596','d_651428',
  'd_134418','d_713210','d_156291','d_622355','d_118000','d_445116','d_191665','d_121936','d_099222','d_732236',
  'd_270837','d_163834','d_434650','d_126780','d_656067','d_219921','d_701687','d_225345','d_505729','d_730669',
  'd_167251','d_446052','d_469919','d_729608','d_472140','d_451672','d_216806','d_531616','d_116801','d_724997',
  'd_705935','d_128888','d_286085','d_494830','d_306276','d_215779','d_731479','d_396627','d_413211','d_133046',
  'd_199538','d_657963','d_461002','d_252507','d_732570','d_111566','d_091089','d_338455','d_645777','d_219279',
  'd_107933','d_590115','d_495272','d_154040','d_228685','d_149853','d_160933','d_585658','d_727855','d_151449',
  'd_437949','d_727067','d_705993','d_731726','d_725088','d_597667','d_099653','d_147163','d_105183','d_102488',
  'd_135378','d_246448','d_109178','d_645081','d_097202','d_731259','d_118570','d_702267','d_732650','d_456885',
  'd_732984','d_730382','d_723348','d_121505','d_099575','d_215776','d_717128','d_734209','d_728483','d_716699',
  'd_666487','d_696502','d_099395','d_107732','d_439443','d_732191','d_730211','d_137890','d_733481','d_174600',
  'd_103545','d_735408','d_105596','d_123823','d_689656','d_731119','d_726247','d_188422','d_733952','d_727532',
  'd_723078','d_670607','d_104940','d_192244','d_733262','d_731800','d_129630','d_098933','d_090538','d_091605',
  'd_442491','d_092103','d_728399','d_235219','d_123530','d_732056','d_096505','d_327663','d_099881','d_721015',
  'd_726416','d_101620','d_729757','d_092838','d_675776','d_724238','d_241974','d_708581','d_732204','d_191904',
  'd_732092','d_721311','d_119844','d_712370','d_122682','d_733009','d_723931','d_155180','d_204703','d_179312',
  'd_732044','d_096948','d_137432','d_733710','d_685980','d_158685','d_196205','d_101361','d_726723','d_154545',
  'd_681564','d_114078','d_732292','d_714729','d_159784','d_722821','d_731759','d_159834','d_174920','d_732811',
  'd_728085','d_732531','d_347830','d_481713','d_152589','d_730180',
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
