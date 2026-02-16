import * as fs from 'fs';
import * as path from 'path';

const testFile = path.join(process.cwd(), 'data', 'chatgpt-export', 'test-10works.json');
const outputFile = 'c:/tool/eronator_tags_output.json';

const test = JSON.parse(fs.readFileSync(testFile, 'utf-8'));
const output = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));

console.log('test-10works.json:', test.length, '件');
console.log('eronator_tags_output.json:', output.length, '件');

console.log('\nworkId比較:');
const testIds = test.map((w: any) => w.workId).sort();
const outputIds = output.map((w: any) => w.workId).sort();

console.log('test:', testIds.join(', '));
console.log('output:', outputIds.join(', '));

console.log('\n一致:', JSON.stringify(testIds) === JSON.stringify(outputIds));

// 不足しているworkIdを確認
const missing = testIds.filter((id: string) => !outputIds.includes(id));
const extra = outputIds.filter((id: string) => !testIds.includes(id));

if (missing.length > 0) {
  console.log('\n⚠️ 不足しているworkId:', missing.join(', '));
}
if (extra.length > 0) {
  console.log('\n⚠️ 余分なworkId:', extra.join(', '));
}
