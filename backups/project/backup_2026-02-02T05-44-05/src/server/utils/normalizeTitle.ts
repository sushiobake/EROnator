/**
 * HardConfirm用タイトル正規化 (Spec §12.3)
 * normalizeTitleForInitial(title)
 */

/**
 * タイトルから先頭1文字を抽出（正規化後）
 */
export function normalizeTitleForInitial(title: string): string {
  if (title == null || typeof title !== 'string') return '?';
  // 1. NFKC正規化
  let normalized = title.normalize('NFKC');
  
  // 2-3. 括弧prefix除去（最大3回）
  const bracketPatterns = [
    /^【[^】]*】/,
    /^\([^)]*\)/,
    /^\[[^\]]*\]/,
    /^\{[^}]*\}/,
    /^＜[^＞]*＞/,
    /^<[^>]*>/,
    /^「[^」]*」/,
    /^『[^』]*』/,
    /^（[^）]*）/,
    /^［[^］]*］/,
    /^｛[^｝]*｝/,
  ];
  
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const pattern of bracketPatterns) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '');
        changed = true;
        break;
      }
    }
    if (!changed) break;
    
    // 2. 先頭空白除去
    normalized = normalized.replace(/^[\s\u3000\t]+/, '');
  }
  
  // 4. 記号除去（最大10回）
  const symbolPatterns = [
    // ASCII記号
    /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/,
    // 全角記号
    /^[！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/,
    // その他代表記号
    /^[★☆◆◇■□・…〜ー—–]/,
  ];
  
  for (let i = 0; i < 10; i++) {
    let changed = false;
    for (const pattern of symbolPatterns) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '');
        changed = true;
        break;
      }
    }
    if (!changed) break;
    
    // 先頭空白除去
    normalized = normalized.replace(/^[\s\u3000\t]+/, '');
  }
  
  // 5. 先頭1文字を返す（空なら'?'）
  const firstChar = normalized.trim()[0];
  return firstChar || '?';
}
