const d = JSON.parse(require('fs').readFileSync('data/chatgpt-export/temp-legacy-ai-10-raw.json', 'utf-8'));

for (let i = 5; i < 10; i++) {
  const w = d.works[i];
  console.log(`\n${'='.repeat(70)}`);
  console.log(`【${i+1}】 ${w.title}`);
  console.log(`${'='.repeat(70)}`);
  console.log(w.work.commentText.substring(0, 1000));
}
