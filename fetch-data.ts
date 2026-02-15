import https from 'https';
import http from 'http';
import fs from 'fs';

function fetchFromApi(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('\n=== Getting all-tags ===');
    const allTags = await fetchFromApi('http://localhost:3000/api/admin/manual-tagging/all-tags');
    console.log('all-tags retrieved. S tags:', allTags.s?.length || 0, 'A tags:', allTags.a?.length || 0);
    
    console.log('\n=== Getting legacy_ai works (5 items) ===');
    const worksResponse = await fetchFromApi('http://localhost:3000/api/admin/manual-tagging/works?filter=legacy_ai&limit=5&offset=0');
    console.log('API Response type:', typeof worksResponse, 'Keys:', Object.keys(worksResponse));
    const works = Array.isArray(worksResponse) ? worksResponse : (worksResponse.works || []);
    console.log('Works count:', works.length);
    works.forEach((w: any, i: number) => console.log(`  ${i+1}. [${w.workId}] ${w.title}`));
    
    console.log('\n=== Getting details for each work ===');
    const details = [];
    for (const work of works) {
      const detail = await fetchFromApi(`http://localhost:3000/api/admin/manual-tagging/works/${work.workId}`);
      console.log(`  [${work.workId}] Retrieved (commentText length: ${detail.commentText?.length || 0})`);
      details.push({ ...work, ...detail });
    }
    
    const output = {
      allTags,
      works: details
    };
    console.log('\n=== Saving to temp file ===');
    fs.writeFileSync('data/chatgpt-export/temp-legacy-ai-5-batch11-raw.json', JSON.stringify(output, null, 2));
    console.log('Saved: data/chatgpt-export/temp-legacy-ai-5-batch11-raw.json');
  } catch (e: any) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
