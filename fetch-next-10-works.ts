import http from 'http';
import fs from 'fs';

function fetch(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? require('https') : http;
    protocol.get(url, (res: any) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('取得開始: all-tags と legacy_ai 10件...\n');
    
    const allTags = await fetch('http://localhost:3000/api/admin/manual-tagging/all-tags');
    const worksResponse = await fetch('http://localhost:3000/api/admin/manual-tagging/works?filter=legacy_ai&limit=10&offset=0');
    const works = worksResponse.works || [];
    
    console.log(`all-tags: S=${allTags.s?.length || 0}, A=${allTags.a?.length || 0}`);
    console.log(`works: ${works.length}件\n`);

    const details = [];
    for (let i = 0; i < works.length; i++) {
      const work = works[i];
      const detail = await fetch(`http://localhost:3000/api/admin/manual-tagging/works/${work.workId}`);
      details.push({ ...work, ...detail });
      console.log(`  [${i + 1}] ${work.workId}: ${work.title.substring(0, 40)}...`);
    }
    
    // Save all 10 for reference
    fs.writeFileSync('data/chatgpt-export/temp-legacy-ai-10-raw.json', JSON.stringify({ allTags, works: details }, null, 2));
    
    console.log(`\n✓ 保存: data/chatgpt-export/temp-legacy-ai-10-raw.json`);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

main();
