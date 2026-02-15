import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('data/chatgpt-export/temp-legacy-ai-10-raw.json', 'utf-8'));
const allTags = rawData.allTags;

// Fetch next 10 works (we already have 10, need to get 20 total)
// For now, use the 10 we have and fetch next 10
const allWorks = rawData.works;

console.log(`\n📊 既存データから10件を処理します\n`);

interface Tag {
  displayName: string;
  category?: string;
}

interface TaggingResult {
  workId: string;
  title: string;
  matchedTags: Tag[];
  suggestedTags: Tag[];
  additionalSTags: string[];
  characterName: string | null;
  tagReasoning: Record<string, string>;
}

// Build tag sets
const sTagsSet = new Set(allTags.s || []);
const allDerivedSet = new Set([...(allTags.a || []), ...(allTags.b || []), ...(allTags.c || [])]);

const sortedDerived = Array.from(allDerivedSet).sort((a, b) => b.length - a.length);
const sortedStar = Array.from(sTagsSet).sort((a, b) => b.length - a.length);

console.log(`\n=== batch15 タグ付け（10件：1-10番目を再処理） ===\n`);

const results: TaggingResult[] = [];

function findTagsInText(text: string, sortedList: string[]): string[] {
  const found: string[] = [];
  for (const tag of sortedList) {
    if (text.includes(tag) && !found.includes(tag)) {
      found.push(tag);
    }
  }
  return found;
}

function extractCharacterNames(text: string): string[] {
  const match = text.match(/(?:【)?(?:登場人物|キャラクター)[\s\S]*?(?:◆|★|■|□|$)/i);
  if (!match) return [];
  
  const lines = match[0].split(/\n/);
  const names: string[] = [];
  
  for (const line of lines) {
    const m = line.match(/・\s*([^\s（(）)。…]+)/);
    if (m && m[1] && m[1].length >= 2 && m[1].length <= 20) {
      names.push(m[1]);
    }
  }
  
  return names;
}

const toRemove = new Set([
  '学校', '友人', '友達', '動画配信', '大学生', '高校',
  '性欲', '快楽', '興奮', '物語', '複数話',
  '後編', '前編', 'Part', '続編', 'II', 'III', '総集編', '収録作品',
  'ヒロイン', '脚', '女性', 'アイドル', '女学生', '学生',
]);

allWorks.forEach((w: any, idx: number) => {
  const work = {
    workId: w.workId,
    title: w.title,
    commentText: w.work?.commentText || '',
  };

  console.log(`\n【${idx + 1}/${allWorks.length}】 ${work.title}`);
  console.log('='.repeat(70));

  const matchedTagsSet = new Set<string>();
  const sTagsSet_local = new Set<string>();
  
  const reasoning: Record<string, string[]> = {
    タイトルから: [],
    あらすじから: [],
    その他から: [],
  };

  // Title
  const titleDerivedTags = findTagsInText(work.title, sortedDerived);
  const titleSTags = findTagsInText(work.title, sortedStar);
  
  titleDerivedTags.forEach(tag => {
    matchedTagsSet.add(tag);
    reasoning.タイトルから.push(tag);
  });
  titleSTags.forEach(tag => sTagsSet_local.add(tag));

  console.log(`📝 タイトル: DERIVED ${titleDerivedTags.length} | S ${titleSTags.length}`);

  // Sections
  const sections = [
    { pattern: /(?:◆\s*)?(?:\*)?プレイ内容[^◆★■□]*?(?=◆|★|■|□|$)/is, name: 'プレイ内容' },
    { pattern: /(?:◆\s*)?あらすじ[^◆★■□]*?(?=◆|★|■|□|$)/is, name: 'あらすじ' },
    { pattern: /(?:◆\s*)?(?:キーワード|ワード)[^◆★■□]*?(?=◆|★|■|□|$)/is, name: 'キーワード' },
    { pattern: /(?:◆\s*)?(?:この作品の嗜好|嗜好)[^◆★■□]*?(?=◆|★|■|□|$)/is, name: '嗜好' },
  ];

  sections.forEach(sec => {
    const match = work.commentText.match(sec.pattern);
    const text = match ? match[0] : '';
    if (text.length < 20) return;

    const derived = findTagsInText(text, sortedDerived);
    const stags = findTagsInText(text, sortedStar);

    derived.forEach(tag => {
      matchedTagsSet.add(tag);
      if (sec.name === 'あらすじ') {
        reasoning.あらすじから.push(tag);
      } else {
        reasoning.その他から.push(tag);
      }
    });

    stags.forEach(tag => sTagsSet_local.add(tag));

    if (derived.length > 0 || stags.length > 0) {
      console.log(`📖 ${sec.name}: DERIVED ${derived.length} | S ${stags.length}`);
    }
  });

  // Character
  let characterName: string | null = null;
  const charNames = extractCharacterNames(work.commentText);
  if (charNames.length > 0) {
    characterName = charNames[0];
    console.log(`👤 キャラ: ${characterName}`);
  }

  // Remove unwanted
  const finalMatchedTags: Tag[] = Array.from(matchedTagsSet)
    .filter(tag => !toRemove.has(tag))
    .map(tag => ({ displayName: tag, category: 'その他' }));

  const finalSTags = Array.from(sTagsSet_local);

  // Reasoning
  const tagReasoning: Record<string, string> = {};
  if (reasoning.タイトルから.length > 0) {
    tagReasoning['タイトルから'] = reasoning.タイトルから.map(t => `『${t}』`).join('、');
  }
  if (reasoning.あらすじから.length > 0) {
    tagReasoning['あらすじから'] = reasoning.あらすじから.map(t => `『${t}』`).join('、');
  }
  if (reasoning.その他から.length > 0) {
    tagReasoning['その他から'] = reasoning.その他から.map(t => `『${t}』`).join('、');
  }

  const result: TaggingResult = {
    workId: work.workId,
    title: work.title,
    matchedTags: finalMatchedTags,
    suggestedTags: [],
    additionalSTags: finalSTags,
    characterName,
    tagReasoning,
  };

  results.push(result);

  console.log(`✅ 完了`);
  console.log(`   matchedTags (${finalMatchedTags.length}): ${finalMatchedTags.map(t => t.displayName).slice(0, 3).join(', ')}${finalMatchedTags.length > 3 ? '...' : ''}`);
  console.log(`   additionalSTags (${finalSTags.length}): ${finalSTags.slice(0, 2).join(', ')}${finalSTags.length > 2 ? '...' : ''}`);
  console.log(`   characterName: ${characterName || 'なし'}`);
});

fs.writeFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch15.json', JSON.stringify(results, null, 2));
console.log(`\n✨ 保存: data/chatgpt-export/cursor-analysis-legacy-ai-5-batch15.json`);
