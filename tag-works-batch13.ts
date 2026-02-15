import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('data/chatgpt-export/temp-legacy-ai-5-batch11-raw.json', 'utf-8'));
const allTags = rawData.allTags;
const worksRaw = rawData.works;

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

// Build tag sets from all-tags API
const sTagsSet = new Set(allTags.s || []);
const aTagsSet = new Set(allTags.a || []);
const bTagsSet = new Set(allTags.b || []);
const cTagsSet = new Set(allTags.c || []);
const allDerivedSet = new Set([...(allTags.a || []), ...(allTags.b || []), ...(allTags.c || [])]);

// Create sorted lists for longest match first
const sortedDerived = Array.from(allDerivedSet).sort((a, b) => b.length - a.length);
const sortedStar = Array.from(sTagsSet).sort((a, b) => b.length - a.length);

interface WorkData {
  workId: string;
  title: string;
  commentText: string;
}

const works: WorkData[] = worksRaw.map((w: any) => ({
  workId: w.workId,
  title: w.title,
  commentText: w.work?.commentText || '',
}));

console.log(`\n=== batch13 タグ付け（新指示書対応）===\n対象: ${works.length}件\n`);

const results: TaggingResult[] = [];

// Helper functions
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

// Main tagging logic
works.forEach((work, idx) => {
  console.log(`\n【${idx + 1}/${works.length}】 ${work.title}`);
  console.log('='.repeat(70));

  const fullText = `${work.title} ${work.commentText}`;
  const matchedTagsSet = new Set<string>();
  const sTagsSet_local = new Set<string>();
  
  const reasoning: Record<string, string[]> = {
    タイトルから: [],
    あらすじから: [],
    その他から: [],
  };

  // STEP 1: Title parsing
  const titleDerivedTags = findTagsInText(work.title, sortedDerived);
  const titleSTags = findTagsInText(work.title, sortedStar);
  
  titleDerivedTags.forEach(tag => {
    matchedTagsSet.add(tag);
    reasoning.タイトルから.push(tag);
  });
  
  titleSTags.forEach(tag => sTagsSet_local.add(tag));

  console.log(`📝 タイトル: DERIVED ${titleDerivedTags.length} | S ${titleSTags.length}`);

  // STEP 2: Parse sections from commentText
  const asynopsisMatch = work.commentText.match(/(?:◆\s*)?あらすじ[^◆★■□]*?(?=◆|★|■|□|$)/is);
  const playContentMatch = work.commentText.match(/(?:◆\s*)?(?:\*)?プレイ内容[^◆★■□]*?(?=◆|★|■|□|$)/is);
  const keywordMatch = work.commentText.match(/(?:◆\s*)?(?:キーワード|ワード)[^◆★■□]*?(?=◆|★|■|□|$)/is);
  const prefMatch = work.commentText.match(/(?:◆\s*)?(?:この作品の嗜好|嗜好)[^◆★■□]*?(?=◆|★|■|□|$)/is);

  const sections = [
    { text: asynopsisMatch ? asynopsisMatch[0] : '', name: 'あらすじ' },
    { text: playContentMatch ? playContentMatch[0] : '', name: 'プレイ内容' },
    { text: keywordMatch ? keywordMatch[0] : '', name: 'キーワード' },
    { text: prefMatch ? prefMatch[0] : '', name: '嗜好' }
  ];

  sections.forEach(section => {
    if (section.text.length < 20) return;

    const derived = findTagsInText(section.text, sortedDerived);
    const stags = findTagsInText(section.text, sortedStar);

    derived.forEach(tag => {
      matchedTagsSet.add(tag);
      if (section.name === 'あらすじ') {
        reasoning.あらすじから.push(tag);
      } else {
        reasoning.その他から.push(tag);
      }
    });

    stags.forEach(tag => sTagsSet_local.add(tag));

    if (derived.length > 0 || stags.length > 0) {
      console.log(`📖 ${section.name}: DERIVED ${derived.length} | S ${stags.length}`);
    }
  });

  // STEP 3: Character extraction
  let characterName: string | null = null;
  const charNames = extractCharacterNames(work.commentText);
  if (charNames.length > 0) {
    characterName = charNames[0];
    console.log(`👤 キャラ: ${characterName}`);
  }

  // STEP 4: Remove汎用/周辺タグ（指示書ルール適用）
  const toRemove = new Set([
    '学校', '友人', '友達', '動画配信', // 汎用的
    '性欲', '快楽', '興奮', '物語', // 過度に汎用的
    '単語', 'ニット', '脚', // 誤検出
  ]);

  // STEP 5: Create output
  const finalMatchedTags: Tag[] = Array.from(matchedTagsSet)
    .filter(tag => !toRemove.has(tag))
    .map(tag => ({ displayName: tag, category: 'その他' }));

  const finalSTags = Array.from(sTagsSet_local);

  // Build reasoning
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

  // Save result
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
  console.log(`   additionalSTags (${finalSTags.length}): ${finalSTags.join(', ') || 'なし'}`);
  console.log(`   characterName: ${characterName || 'なし'}`);
});

// Save batch JSON
fs.writeFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch13.json', JSON.stringify(results, null, 2));
console.log(`\n✨ 保存: data/chatgpt-export/cursor-analysis-legacy-ai-5-batch13.json`);
