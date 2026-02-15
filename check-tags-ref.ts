import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('data/chatgpt-export/temp-legacy-ai-5-batch11-raw.json', 'utf-8'));
const allTags = rawData.allTags;

console.log('=== All Tags Reference ===\n');
console.log('S Tags (Sample 20):');
console.log((allTags.s || []).slice(0, 20).map((t: string) => `"${t}"`).join(', '));

console.log('\n\nA Tags (All):');
console.log((allTags.a || []).map((t: string) => `"${t}"`).join(', '));

console.log('\n\nB Tags (Sample 20):');
console.log((allTags.b || []).slice(0, 20).map((t: string) => `"${t}"`).join(', '));

console.log('\n\nC Tags (Sample 20):');
console.log((allTags.c || []).slice(0, 20).map((t: string) => `"${t}"`).join(', '));

// Test matching for known terms
const testTerms = ['人妻', '幼馴染', '総集編', '催眠', 'ラブホテル', '合宿', 'おじさん', 'セクサロイド', 'TSF'];

console.log('\n\n=== Test Term Matching ===\n');
testTerms.forEach(term => {
  const inS = (allTags.s || []).includes(term);
  const inA = (allTags.a || []).includes(term);
  const inB = (allTags.b || []).includes(term);
  const inC = (allTags.c || []).includes(term);
  console.log(`${term}: S=${inS}, A=${inA}, B=${inB}, C=${inC}`);
});
