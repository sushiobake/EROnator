import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('data/chatgpt-export/temp-legacy-ai-5-batch11-raw.json', 'utf-8'));
const works = rawData.works;

// Display full commentText for each work
works.forEach((w: any, idx: number) => {
  const work = w.work || w;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`【${idx + 1}】 ${w.title}`);
  console.log(`${'='.repeat(80)}`);
  console.log('\nFull Comment Text:\n');
  console.log(work.commentText || '(empty)');
  console.log('\nExisting Tags:');
  const existing = [...(work.aTags || []), ...(work.bTags || []), ...(work.cTags || [])];
  console.log(existing.map((t: any) => t.displayName).join(', ') || 'none');
});
