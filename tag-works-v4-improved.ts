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

// Create sorted list for matching (longest first)
const sortedAllTags = Array.from(derivedTagsSet).sort((a, b) => b.length - a.length);
const sortedSTags = Array.from(sTagsSet).sort((a, b) => b.length - a.length);

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

console.log(`\n=== 改善版タグ付け実行開始 ===\n対象: ${works.length}件\n`);

const results: TaggingResult[] = [];

// Helper: Find tags in text (longest match first)
function findTagsInText(text: string, sortedTagList: string[]): string[] {
  const found: string[] = [];
  
  for (const tag of sortedTagList) {
    if (text.includes(tag) && !found.includes(tag)) {
      found.push(tag);
    }
  }
  
  return found;
}

// Helper: Extract character names from "登場人物" section
function extractCharacterNames(commentText: string): string[] {
  const charMatch = commentText.match(/(?:【)?(?:登場人物|キャラクター)[\s\S]*?(?:◆|★|■|□|【|$)/i);
  if (!charMatch) return [];
  
  const charSection = charMatch[0];
  // Extract lines starting with ・
  const lines = charSection.split(/\n/);
  const names: string[] = [];
  
  for (const line of lines) {
    const match = line.match(/・\s*([^\s。…]+)(?:\s|。|…|$)/);
    if (match && match[1]) {
      const name = match[1].replace(/[（(].*/, '').trim();
      if (name.length >= 2 && name.length <= 20) {
        names.push(name);
      }
    }
  }
  
  return names;
}

// Main tagging logic
works.forEach((work, idx) => {
  console.log(`\n【${idx + 1}/${works.length}】 ${work.title}`);
  console.log('='.repeat(70));

  const fullText = `${work.title} ${work.commentText}`;
  
  const reasons: Record<string, string[]> = {
    タイトルから: [],
    あらすじから: [],
    プレイ内容から: [],
    その他から: [],
    公式タグから: [],
  };

  const collectedTags: Map<string, string[]> = new Map(); // tag -> sources
  const collectedSTags: Set<string> = new Set();

  // ===== STEP 1: Title parsing =====
  console.log('📝 Step 1: タイトル解析...');
  const titleTags = findTagsInText(work.title, sortedAllTags);
  titleTags.forEach(tag => {
    if (!collectedTags.has(tag)) {
      collectedTags.set(tag, []);
    }
    collectedTags.get(tag)!.push('タイトル');
    if (!reasons.タイトルから.includes(tag)) {
      reasons.タイトルから.push(tag);
    }
  });
  
  // Check S tags in title
  const titleSTags = findTagsInText(work.title, sortedSTags);
  titleSTags.forEach(tag => {
    collectedSTags.add(tag);
    reasons.公式タグから.push(`${tag}(タイトル)`);
  });

  console.log(`  → DERIVED: ${titleTags.length} | S: ${titleSTags.length}`);

  // ===== STEP 2: Parse sections =====
  // Extract あらすじ section
  const asynopsisMatch = work.commentText.match(/(?:◆\s*)?あらすじ[^◆★■□]*?(?=◆|★|■|□|$)/is);
  const asynopsisText = asynopsisMatch ? asynopsisMatch[0] : '';

  if (asynopsisText.length > 20) {
    console.log('📖 Step 2: あらすじ解析...');
    const synopsisTags = findTagsInText(asynopsisText, sortedAllTags);
    synopsisTags.forEach(tag => {
      if (!collectedTags.has(tag)) {
        collectedTags.set(tag, []);
      }
      if (!collectedTags.get(tag)!.includes('あらすじ')) {
        collectedTags.get(tag)!.push('あらすじ');
      }
      if (!reasons.あらすじから.includes(tag)) {
        reasons.あらすじから.push(tag);
      }
    });

    // Check S tags in synopsis
    const synopsisSТags = findTagsInText(asynopsisText, sortedSTags);
    synopsisSТags.forEach(tag => {
      collectedSTags.add(tag);
      if (!reasons.公式タグから.includes(`${tag}(あらすじ)`)) {
        reasons.公式タグから.push(`${tag}(あらすじ)`);
      }
    });

    console.log(`  → DERIVED: ${synopsisTags.length} | S: ${synopsisSТags.length}`);
  }

  // ===== STEP 3: All derived tags from full text =====
  console.log('📄 Step 3: 本文全体解析...');
  const allDerivedTags = findTagsInText(work.commentText, sortedAllTags);
  allDerivedTags.forEach(tag => {
    if (!collectedTags.has(tag)) {
      collectedTags.set(tag, []);
    }
  });

  // All S tags from full text
  const allSTags = findTagsInText(work.commentText, sortedSTags);
  allSTags.forEach(tag => collectedSTags.add(tag));

  console.log(`  → Total DERIVED: ${collectedTags.size} | Total S: ${collectedSTags.size}`);

  // ===== STEP 4: Character extraction =====
  console.log('👤 Step 4: キャラクター抽出...');
  let characterName: string | null = null;
  
  const charNames = extractCharacterNames(work.commentText);
  if (charNames.length > 0) {
    characterName = charNames[0];
    console.log(`  → ${characterName}`);
  } else {
    console.log(`  → なし`);
  }

  // ===== STEP 5: Pre-check before finalization =====
  console.log('✓ Step 5: 提出前チェック...');

  // Remove汎用・周辺タグ
  const toRemove = new Set([
    '学校', '友人', '友達', 'ゲーム', '動画配信', '物語', // 汎用的
    'スーパー', 'レストラン', '駅', // 単なる舞台
    '性欲', '快楽', '興奮', // 過度に汎用的
  ]);

  // Check for characterName being タイトル文字列
  if (characterName && (
    characterName === work.title ||
    work.title.includes(characterName) && characterName.length > 15
  )) {
    console.log(`  ⚠ characterName がタイトル文字列になっている: "${characterName}" → null に`);
    characterName = null;
  }

  // ===== STEP 6: Organize into output =====
  const matchedTags: Tag[] = [];
  const suggestedTags: Tag[] = [];
  const additionalSTags: string[] = Array.from(collectedSTags);

  collectedTags.forEach((sources, tag) => {
    if (toRemove.has(tag)) {
      console.log(`  削除: ${tag} (汎用/周辺的)`);
      return;
    }
    matchedTags.push({ displayName: tag, category: 'その他' });
  });

  // ===== Build reasoning =====
  const tagReasoning: Record<string, string> = {};
  if (reasons.タイトルから.length > 0) {
    tagReasoning['タイトルから'] = reasons.タイトルから.map(t => `『${t}』`).join('、');
  }
  if (reasons.あらすじから.length > 0) {
    tagReasoning['あらすじから'] = reasons.あらすじから.map(t => `『${t}』`).join('、');
  }
  if (reasons.公式タグから.length > 0) {
    tagReasoning['公式タグから'] = reasons.公式タグから.join('、');
  }

  // ===== Save result =====
  const result: TaggingResult = {
    workId: work.workId,
    title: work.title,
    matchedTags,
    suggestedTags,
    additionalSTags,
    characterName,
    tagReasoning,
  };

  results.push(result);

  console.log(`✅ 完了`);
  console.log(`   matchedTags (${matchedTags.length}): ${matchedTags.map(t => t.displayName).slice(0, 5).join(', ')}${matchedTags.length > 5 ? '...' : ''}`);
  console.log(`   additionalSTags (${additionalSTags.length}): ${additionalSTags.join(', ') || 'なし'}`);
  console.log(`   characterName: ${characterName || 'なし'}`);
});

// Save batch JSON
fs.writeFileSync('data/chatgpt-export/cursor-analysis-legacy-ai-5-batch12.json', JSON.stringify(results, null, 2));
console.log(`\n✨ 保存完了: data/chatgpt-export/cursor-analysis-legacy-ai-5-batch12.json`);
