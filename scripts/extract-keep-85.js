const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', '..', 'sim-2026-03-04T02-44-27.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const keep = new Map(); // workId -> { workId, title, category }

for (const r of data.results || []) {
  if (r.outcome === 'SUCCESS') continue;
  if (r.outcome === 'MAX_QUESTIONS') {
    const steps = r.steps || [];
    const last = steps[steps.length - 1];
    const conf = last && typeof last.confidenceAfter === 'number' ? last.confidenceAfter : 0;
    if (conf >= 0.10) keep.set(r.workId, { workId: r.workId, title: (r.title || '').trim(), category: 'MAX_QUESTIONS(conf≥10%)', conf });
  }
  if (r.outcome === 'FAIL_LIST') {
    const hasSeriesYes = (r.steps || []).some(s => s.question?.specialQuestionType === 'SERIES' && s.answer === 'YES');
    if (hasSeriesYes) keep.set(r.workId, { workId: r.workId, title: (r.title || '').trim(), category: 'FAIL_LIST(シリーズ系)' });
  }
}

const list = Array.from(keep.values()).sort((a, b) => a.workId.localeCompare(b.workId, 'ja'));

console.log('# 残す作品リスト（MAX_QUESTIONS conf≥10% + FAIL_LIST シリーズ系）');
console.log('# 発売日はシミュJSONに含まれていないため workId 順');
console.log('# 件数: ' + list.length);
console.log('');
console.log('workId\ttitle\tcategory');
for (const row of list) {
  const title = (row.title || '').replace(/\t/g, ' ');
  console.log(row.workId + '\t' + title + '\t' + row.category);
}
