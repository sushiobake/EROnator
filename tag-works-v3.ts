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

// Build tag sets
const sTagsSet = new Set(allTags.s || []);
const aTagsSet = new Set(allTags.a || []);
const bTagsSet = new Set(allTags.b || []);
const cTagsSet = new Set(allTags.c || []);
const derivedTagsSet = new Set([...(allTags.a || []), ...(allTags.b || []), ...(allTags.c || [])]);

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

console.log(`\n=== タグ付け実行開始 ===\n対象: ${works.length}件\n`);

const results: TaggingResult[] = [];

// Smarter text tokenization that preserves larger phrases
function findTagsInText(text: string, sortedTagList: string[]): string[] {
  const found: string[] = [];
  
  // Sort by length descending to match longer tags first (longest match wins)
  const sortedTags = [...sortedTagList].sort((a, b) => b.length - a.length);
  
  for (const tag of sortedTags) {
    if (text.includes(tag) && !found.includes(tag)) {
      found.push(tag);
    }
  }
  
  return found;
}

// Main tagging logic
works.forEach((work, idx) => {
  console.log(`\n【${idx + 1}/${works.length}】 ${work.title}`);
  console.log('='.repeat(70));

  const fullText = `${work.title} ${work.commentText}`;
  
  const reasons: Record<string, string[]> = {
    タイトルから: [],
    あらすじから: [],
    その他から: [],
  };

  const collectedTags: Map<string, { sources: string[]; isS: boolean }> = new Map();

  // ===== STEP 1: Title parsing =====
  console.log('📝 タイトル解析中...');
  const titleTags = findTagsInText(work.title, Array.from(derivedTagsSet));
  titleTags.forEach(tag => {
    if (!collectedTags.has(tag)) {
      collectedTags.set(tag, { sources: [], isS: sTagsSet.has(tag) });
    }
    collectedTags.get(tag)!.sources.push('タイトル');
    if (!reasons.タイトルから.includes(tag)) {
      reasons.タイトルから.push(tag);
    }
  });

  console.log(`  → Found: ${titleTags.length} tags - ${titleTags.slice(0, 3).join(', ')}${titleTags.length > 3 ? '...' : ''}`);

  // ===== STEP 2: Summarize をcomment text から取得 =====
  // あらすじセクションを抽出
  const asynopsisMatch = work.commentText.match(/(?:◆\s*)?あらすじ[^◆★■□]*?(?=◆|★|■|□|$)/is);
  const asynopsisText = asynopsisMatch ? asynopsisMatch[0] : '';

  if (asynopsisText.length > 20) {
    console.log('📖 あらすじ解析中...');
    const synopsisTags = findTagsInText(asynopsisText, Array.from(derivedTagsSet));
    synopsisTags.forEach(tag => {
      if (!collectedTags.has(tag)) {
        collectedTags.set(tag, { sources: [], isS: sTagsSet.has(tag) });
      }
      if (!collectedTags.get(tag)!.sources.includes('あらすじ')) {
        collectedTags.get(tag)!.sources.push('あらすじ');
      }
      if (!reasons.あらすじから.includes(tag)) {
        reasons.あらすじから.push(tag);
      }
    });
    console.log(`  → Found: ${synopsisTags.length} tags - ${synopsisTags.slice(0, 3).join(', ')}${synopsisTags.length > 3 ? '...' : ''}`);
  }

  // ===== STEP 3: Full comment text =====
  console.log('📄 本文全体解析中...');
  const allCommentTags = findTagsInText(work.commentText, Array.from(derivedTagsSet));
  allCommentTags.forEach(tag => {
    if (!collectedTags.has(tag)) {
      collectedTags.set(tag, { sources: [], isS: sTagsSet.has(tag) });
    }
    if (!collectedTags.get(tag)!.sources.includes('本文')) {
      collectedTags.get(tag)!.sources.push('本文');
    }
  });
  console.log(`  → Total found: ${collectedTags.size} unique tags`);

  // ===== STEP 4: Character detection =====
  let characterName: string | null = null;
  
  // Extract character names from story/character sections if available
  const charSectionMatch = work.commentText.match(/(?:【)?(?:登場人物|キャラクター)[\s\S]*?(?:◆|★|■|□|$)/i);
  if (charSectionMatch) {
    // Extract first character name after ・
    const charNames = charSectionMatch[0].match(/・[^・◆★■□]*?(?:[\n\r]+)/g);
    if (charNames && charNames.length > 0) {
      const firstChar = charNames[0].replace(/・|[\n\r]+/g, '').trim().split(/\s|…|。/)[0];
      if (firstChar.length > 1 && firstChar.length <= 20) {
        characterName = firstChar;
      }
    }
  }
  
  // Fallback: if no character section, extract from title (with better heuristics)
  if (!characterName) {
    const titleWithoutCommonWords = work.title
      .replace(/【.*?】/g, '') // Remove brackets
      .replace(/〜.*$/g, ''); // Remove suffix from 〜 onward
    
    const charMatches = titleWithoutCommonWords.match(/[ぁ-ん一-龯]+(?:[\s・]*[ぁ-ん一-龯ァ-ヴー]+)*/g) || [];
    const excludeWords = new Set(['総集編', 'シリーズ', 'スペシャル', 'イッキ', '贅沢', 'パート', 'Part', 'ラブ', '話']);
    
    for (const match of charMatches) {
      if (!excludeWords.has(match) && match.length >= 2 && match.length <= 15) {
        characterName = match;
        break;
      }
    }
  }

  // ===== STEP 5: Organize =====
  const matchedTags: Tag[] = [];
  const additionalSTags: string[] = [];

  collectedTags.forEach((info, tag) => {
    if (info.isS) {
      additionalSTags.push(tag);
    } else {
      matchedTags.push({ displayName: tag, category: 'その他' });
    }
  });

  // ===== STEP 6: Build reasoning =====
  const tagReasoning: Record<string, string> = {};
  if (reasons.タイトルから.length > 0) {
    tagReasoning['タイトルから'] = reasons.タイトルから.map(t => `『${t}』`).join('、');
  }
  if (reasons.あらすじから.length > 0) {
    tagReasoning['あらすじから'] = reasons.あらすじから.map(t => `『${t}』`).join('、');
  }

  // ===== Save result =====
  const result: TaggingResult = {
    workId: work.workId,
    title: work.title,
    matchedTags,
    suggestedTags: [],
    additionalSTags,
    characterName,
    tagReasoning,
  };

  results.push(result);

  console.log(`✅ 完了`);
  console.log(`   matchedTags (${matchedTags.length}): ${matchedTags.map(t => t.displayName).join(', ') || 'なし'}`);
  console.log(`   additionalSTags (${additionalSTags.length}): ${additionalSTags.join(', ') || 'なし'}`);
  console.log(`   characterName: ${characterName || 'なし'}`);
});

// Save batch JSON
fs.writeFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch11.json', JSON.stringify(results, null, 2));
console.log(`\n✨ 保存完了: data/chatgpt-export/cursor-analysis-legacy-ai-5-batch11.json`);
