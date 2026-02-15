import fs from 'fs';

// Load raw data
const rawData = JSON.parse(fs.readFileSync('data/chatgpt-export/temp-legacy-ai-5-batch11-raw.json', 'utf-8'));
const allTags = rawData.allTags;
const worksRaw = rawData.works;

interface WorkData {
  workId: string;
  title: string;
  authorName: string;
  commentText: string;
  aTags: Array<{ displayName: string }>;
  bTags: Array<{ displayName: string }>;
  cTags: Array<{ displayName: string }>;
}

interface TaggingResult {
  workId: string;
  title: string;
  matchedTags: Array<{ displayName: string; category?: string }>;
  suggestedTags: Array<{ displayName: string; category?: string }>;
  additionalSTags: string[];
  characterName: string | null;
  tagReasoning: Record<string, string>;
}

// Extract S, A, B, C tags for reference
const sTagsSet = new Set(allTags.s);
const aTagsSet = new Set(allTags.a);
const bTagsSet = new Set(allTags.b);
const cTagsSet = new Set(allTags.c);

// Prepare works
const works: WorkData[] = worksRaw.map((w: any) => ({
  workId: w.workId,
  title: w.title,
  authorName: w.authorName,
  commentText: w.work?.commentText || '',
  aTags: w.work?.aTags || [],
  bTags: w.work?.bTags || [],
  cTags: w.work?.cTags || [],
}));

console.log(`\n=== Tagging Process Started ===\nProcessing ${works.length} works\n`);

const taggingResults: TaggingResult[] = [];

// Process each work
works.forEach((work, idx) => {
  console.log(`\n【${idx + 1}/${works.length}】 ${work.title}`);
  console.log('='.repeat(60));
  
  // Parse commentText into sections
  const fullText = `${work.title}\n${work.commentText}`;
  
  // Extract key information from commentText
  const titleWords = work.title.split(/[〜・・〜（）「」『』【】、，。！？ ]+/).filter(w => w.length > 0);
  const sections = work.commentText.split(/(?:◆|★|■|□|・|・|▼|▲|\n\n+)/);
  const asynopses = sections
    .filter(s => s.toLowerCase().includes('あらすじ') || s.toLowerCase().includes('あ'))
    .join('\n');
  const playContent = sections
    .filter(s => s.toLowerCase().includes('プレイ') || s.toLowerCase().includes('ます'))
    .join('\n');
  const keywords = sections
    .filter(s => s.toLowerCase().includes('キーワード') || s.toLowerCase().includes('ワード'))
    .join('\n');
  const preferences = sections
    .filter(s => s.toLowerCase().includes('嗜好') || s.toLowerCase().includes('好み'))
    .join('\n');

  console.log('Title:', work.title);
  console.log('Author:', work.authorName);
  console.log('Existing tags (A/B/C):', [...work.aTags, ...work.bTags, ...work.cTags].map(t => t.displayName).join(', '));
  
  const matchedTags: Array<{ displayName: string; category?: string }> = [];
  const suggestedTags: Array<{ displayName: string; category?: string }> = [];
  const additionalSTags: string[] = [];
  let characterName: string | null = null;
  const tagReasoning: Record<string, string> = {};

  // Tag collection logic
  const collected: Record<string, string> = {}; // tag -> source

  // 1. From title
  const titleCandidates: string[] = [];
  titleWords.forEach(word => {
    if (word.length < 2) return;
    if (aTagsSet.has(word) || bTagsSet.has(word) || cTagsSet.has(word)) {
      titleCandidates.push(word);
      collected[word] = 'タイトル';
    } else if (sTagsSet.has(word)) {
      titleCandidates.push(word);
      collected[word] = 'タイトル（S）';
    }
  });
  if (titleCandidates.length > 0) {
    tagReasoning['タイトルから'] = titleCandidates.join('、');
  }

  // 2-5. Character detection from title
  // Look for character names (common patterns)
  const charMatches = work.title.match(/([ぁ-んァ-ヴー一-龯]+[\s・]*)+/g);
  if (charMatches && charMatches.length > 0 && !work.title.includes('総集編')) {
    // Heuristic: first notable name-like sequence might be character
    const candidate = charMatches[0].replace(/[・・〜（）「」『』【】、，。！？ ]+/g, '').slice(0, 20);
    if (candidate.length > 1 && candidate.length < 15) {
      characterName = candidate;
    }
  }

  // Create result
  taggingResults.push({
    workId: work.workId,
    title: work.title,
    matchedTags: Object.entries(collected)
      .filter(([tag, src]) => !sTagsSet.has(tag))
      .map(([tag]) => ({ displayName: tag, category: 'その他' })),
    suggestedTags,
    additionalSTags: Object.entries(collected)
      .filter(([tag]) => sTagsSet.has(tag))
      .map(([tag]) => tag),
    characterName,
    tagReasoning,
  });

  console.log('Tags collected:', Object.keys(collected).length);
  console.log('MatchedTags:', taggingResults[taggingResults.length - 1].matchedTags.map(t => t.displayName).join(', ') || 'none');
  console.log('AdditionalSTags:', taggingResults[taggingResults.length - 1].additionalSTags.join(', ') || 'none');
  console.log('Character:', characterName || 'none');
});

// Save results
const output = taggingResults;
fs.writeFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch11.json', JSON.stringify(output, null, 2));
console.log(`\n✓ Saved to data/chatgpt-export/cursor-analysis-legacy-ai-5-batch11.json`);
