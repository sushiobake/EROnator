import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/chatgpt-export/temp-legacy-ai-5-batch11-raw.json', 'utf-8'));

console.log('\n=== Works Detail Structure ===');
data.works.forEach((w: any, i: number) => {
  const work = w.work || w;
  console.log(`\n${i + 1}. ${w.title}`);
  console.log(`   WorkId: ${w.workId}`);
  console.log(`   work object keys: ${Object.keys(work).slice(0, 10).join(', ')}`);
  console.log(`   commentText: ${work.commentText?.substring(0, 100) || 'N/A'}`);
  console.log(`   aTags: ${work.aTags?.length || 0} items`);
  console.log(`   bTags: ${work.bTags?.length || 0} items`);
  console.log(`   cTags: ${work.cTags?.length || 0} items`);
});
