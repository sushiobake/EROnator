/**
 * works_A.txt / works_C.txt のパーサー
 * 2つの形式に対応:
 * 1. @@BEGIN cid:xxx と @@END cid:xxx で区切られた形式 (works_A.txt)
 * 2. === CREATED cid:xxx === で区切られた形式 (works_C.txt)
 */

export interface ParsedWork {
  workId: string;
  cid: string;
  title: string;
  circleName: string;
  productUrl: string;
  thumbnailUrl: string | null;
  reviewAverage: number | null;
  reviewCount: number | null;
  isAi: 'AI' | 'HAND' | 'UNKNOWN';
  scrapedAt: string;
  officialTags: string[];
  metaText: string;
  commentText: string;
}

/**
 * ファイル内容をパース
 */
export function parseWorksFile(content: string): ParsedWork[] {
  const works: ParsedWork[] = [];
  const lines = content.split('\n');
  
  let currentBlock: string[] = [];
  let inBlock = false;
  let currentWorkId: string | null = null;
  let format: 'beginEnd' | 'created' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // @@BEGIN でブロック開始 (works_A.txt形式)
    const beginMatch = line.match(/^@@BEGIN\s+cid:([^\s]+)/);
    if (beginMatch) {
      // 前のブロックが未完了の場合は処理
      if (inBlock && currentWorkId && format === 'beginEnd') {
        const work = parseWorkBlock(currentBlock, currentWorkId);
        if (work) {
          works.push(work);
        }
      }
      inBlock = true;
      format = 'beginEnd';
      currentBlock = [];
      currentWorkId = beginMatch[1];
      continue;
    }

    // @@END でブロック終了 (works_A.txt形式)
    const endMatch = line.match(/^@@END\s+cid:([^\s]+)/);
    if (endMatch && inBlock && format === 'beginEnd' && endMatch[1] === currentWorkId) {
      const work = parseWorkBlock(currentBlock, currentWorkId!);
      if (work) {
        works.push(work);
      }
      inBlock = false;
      currentBlock = [];
      currentWorkId = null;
      format = null;
      continue;
    }

    // === CREATED === でブロック開始/終了 (works_C.txt形式)
    const createdMatch = line.match(/^===\s+[^\s]+\s+CREATED\s+cid:([^\s]+)\s+===$/);
    if (createdMatch) {
      // 前のブロックが未完了の場合は処理
      if (inBlock && currentWorkId && format === 'created') {
        const work = parseWorkBlock(currentBlock, currentWorkId);
        if (work) {
          works.push(work);
        }
      }
      // 新しいブロック開始
      inBlock = true;
      format = 'created';
      currentBlock = [];
      currentWorkId = createdMatch[1];
      continue;
    }

    // ブロック内の行を収集
    if (inBlock) {
      currentBlock.push(line);
    }
  }

  // ファイル終端で未完了のブロックを処理 (works_C.txt形式の場合)
  if (inBlock && currentWorkId && format === 'created') {
    const work = parseWorkBlock(currentBlock, currentWorkId);
    if (work) {
      works.push(work);
    }
  }

  return works;
}

/**
 * 1つの作品ブロックをパース
 */
function parseWorkBlock(block: string[], workId: string): ParsedWork | null {
  const work: Partial<ParsedWork> = {
    workId: `cid:${workId}`,
    cid: workId,
    officialTags: [],
    metaText: '',
    commentText: '',
  };

  let currentSection: 'main' | 'metaText' | 'commentText' = 'main';
  let metaTextLines: string[] = [];
  let commentTextLines: string[] = [];

  for (const line of block) {
    // セクション切り替え
    if (line.trim() === '# metaText') {
      currentSection = 'metaText';
      continue;
    }
    if (line.trim() === '# commentText') {
      currentSection = 'commentText';
      continue;
    }

    // メインセクションのパース
    if (currentSection === 'main') {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      switch (key) {
        case 'workId':
          work.workId = value;
          break;
        case 'cid':
          work.cid = value;
          break;
        case 'title':
          work.title = value;
          break;
        case 'circleName':
          work.circleName = value;
          break;
        case 'productUrl':
          work.productUrl = value;
          break;
        case 'thumbnailUrl':
          work.thumbnailUrl = value || null;
          break;
        case 'reviewAverage':
          work.reviewAverage = value ? parseFloat(value) : null;
          break;
        case 'reviewCount':
          work.reviewCount = value ? parseInt(value, 10) : null;
          break;
        case 'isAi':
          if (value === 'AI' || value === 'HAND' || value === 'UNKNOWN') {
            work.isAi = value;
          }
          break;
        case 'scrapedAt':
          work.scrapedAt = value;
          break;
        case 'officialTags':
          work.officialTags = value.split(',').map(t => t.trim()).filter(Boolean);
          break;
      }
    } else if (currentSection === 'metaText') {
      metaTextLines.push(line);
    } else if (currentSection === 'commentText') {
      commentTextLines.push(line);
    }
  }

  work.metaText = metaTextLines.join('\n').trim();
  work.commentText = commentTextLines.join('\n').trim();

  // 必須フィールドのチェック
  if (!work.workId || !work.title || !work.circleName || !work.productUrl || !work.isAi || !work.scrapedAt) {
    return null;
  }

  return work as ParsedWork;
}
