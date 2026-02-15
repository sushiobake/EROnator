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

// Build tag sets for quick lookup
const sTagsSet = new Set(allTags.s || []);
const aTagsSet = new Set(allTags.a || []);
const bTagsSet = new Set(allTags.b || []);
const cTagsSet = new Set(allTags.c || []);

// Merge A/B/C for convenience
const derivedTagsSet = new Set([...(allTags.a || []), ...(allTags.b || []), ...(allTags.c || [])]);

interface WorkData {
  workId: string;
  title: string;
  commentText: string;
}

// Extract and normalize works
const works: WorkData[] = worksRaw.map((w: any) => ({
  workId: w.workId,
  title: w.title,
  commentText: w.work?.commentText || '',
}));

console.log(`\n=== タグ付け実行開始 ===\n対象: ${works.length}件\n`);

const results: TaggingResult[] = [];

// Helper: Split text into words/phrases
function tokenize(text: string): string[] {
  // Remove various separators and punctuation
  return text
    .split(/[〜・・，、。！？（）「」『』【】\s《》〔〕｛｝「」『』・ 　]+/)
    .filter(w => w.length >= 2 && w.length <= 20);
}

// Helper: Find tags in text
function findTagsInText(text: string, tagSet: Set<string>, limit = 10): string[] {
  const found: string[] = [];
  const tokens = tokenize(text);
  
  for (const token of tokens) {
    if (tagSet.has(token) && !found.includes(token)) {
      found.push(token);
      if (found.length >= limit) break;
    }
  }
  
  return found;
}

// Main tagging logic for each work
works.forEach((work, idx) => {
  console.log(`\n【${idx + 1}/${works.length}】 ${work.title}`);
  console.log('='.repeat(70));

  const fullText = `${work.title} ${work.commentText}`;
  
  // Reasoning tracker
  const reasons: Record<string, string[]> = {
    タイトルから: [],
    あらすじから: [],
    ストーリー等から: [],
    総集編判定: [],
    その他: [],
  };

  // Collect tags by source
  const collectedTags: Map<string, { sources: string[]; isS: boolean }> = new Map();

  // ===== Step 1: Parse commentText sections =====
  const sections = work.commentText.split(/(?:◆|★|■|□|▼|▲|【|】|\n\n+)/);
  
  let titleSection = work.title;
  let asynopsisSection = '';
  let storySection = '';
  let otherSection = work.commentText;

  for (const section of sections) {
    const lower = section.toLowerCase();
    if (lower.includes('あらすじ')) {
      asynopsisSection += ' ' + section;
    } else if (lower.includes('ストーリー')) {
      storySection += ' ' + section;
    }
  }

  // ===== Step 2: Collect tags from title (HIGHEST PRIORITY) =====
  console.log('タイトル解析中...');
  const titleTags = findTagsInText(titleSection, derivedTagsSet, 10);
  titleTags.forEach(tag => {
    if (!collectedTags.has(tag)) {
      collectedTags.set(tag, { sources: [], isS: sTagsSet.has(tag) });
    }
    collectedTags.get(tag)!.sources.push('タイトル');
    reasons.タイトルから.push(tag);
  });

  // Check for 総集編 in title
  if (titleSection.includes('総集編')) {
    if (!collectedTags.has('総集編')) {
      collectedTags.set('総集編', { sources: ['タイトル (総集編keyword)'], isS: sTagsSet.has('総集編') });
      reasons.総集編判定.push('総集編 (タイトル)');
    }
  }

  // ===== Step 3: Collect tags from あらすじ =====
  if (asynopsisSection.length > 20) {
    console.log('あらすじ解析中...');
    const synopsisTags = findTagsInText(asynopsisSection, derivedTagsSet, 8);
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
  }

  // ===== Step 4: Collect tags from story section =====
  if (storySection.length > 20) {
    console.log('ストーリー解析中...');
    const storyTags = findTagsInText(storySection, derivedTagsSet, 5);
    storyTags.forEach(tag => {
      if (!collectedTags.has(tag)) {
        collectedTags.set(tag, { sources: [], isS: sTagsSet.has(tag) });
      }
      if (!collectedTags.get(tag)!.sources.includes('ストーリー等')) {
        collectedTags.get(tag)!.sources.push('ストーリー等');
      }
    });
  }

  // ===== Step 5: Character detection =====
  let characterName: string | null = null;
  const charPattern = /[ぁ-んァ-ヴー一-龯]+(?:[\s・]*[ぁ-んァ-ヴー一-龯]+)?/g;
  const matches = work.title.match(charPattern) || [];
  
  // Filter out common non-character words
  const commonWords = new Set(['総集編', 'シリーズ', 'スペシャル', 'イッキ読み', 'キスで', 'メタドール']);
  for (const match of matches) {
    if (match.length >= 2 && match.length <= 20 && !commonWords.has(match)) {
      characterName = match.replace(/[・・〜（）「」『』【】、，。！？ ]+/g, '');
      break;
    }
  }

  // ===== Step 6: Organize into matchedTags / additionalSTags =====
  const matchedTags: Tag[] = [];
  const additionalSTags: string[] = [];

  collectedTags.forEach((info, tag) => {
    if (info.isS) {
      additionalSTags.push(tag);
    } else {
      matchedTags.push({ displayName: tag, category: 'その他' });
    }
  });

  // ===== Step 7: Build tagReasoning =====
  const tagReasoning: Record<string, string> = {};
  if (reasons.タイトルから.length > 0) {
    tagReasoning['タイトルから'] = reasons.タイトルから.map(t => `『${t}』`).join('、');
  }
  if (reasons.あらすじから.length > 0) {
    tagReasoning['あらすじから'] = reasons.あらすじから.map(t => `『${t}』`).join('、');
  }
  if (reasons.総集編判定.length > 0) {
    tagReasoning['総集編判定'] = reasons.総集編判定.join('、');
  }

  // ===== Step 8: Create result =====
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

  console.log(`✓ matchedTags: ${matchedTags.map(t => t.displayName).join(', ') || 'none'}`);
  console.log(`✓ additionalSTags: ${additionalSTags.join(', ') || 'none'}`);
  console.log(`✓ characterName: ${characterName || 'none'}`);
});

// ===== Save batch JSON =====
fs.writeFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch11.json', JSON.stringify(results, null, 2));
console.log(`\n✅ 完了: data/chatgpt-export/cursor-analysis-legacy-ai-5-batch11.json に保存`);
