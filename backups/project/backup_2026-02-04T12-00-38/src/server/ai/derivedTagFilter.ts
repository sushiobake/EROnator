/**
 * DERIVEDタグの後処理フィルタ
 * AIが抽出したタグをルールベースでフィルタリングする
 */

import fs from 'fs';
import path from 'path';

export interface DerivedTag {
  displayName: string;
  confidence: number;
  category: string | null;
  source?: 'matched' | 'suggested'; // matched=リストから選んだ, suggested=新規提案
}

// OFFICIALタグキャッシュ（遅延読み込み）
let _officialTagsCache: Set<string> | null = null;

function getOfficialTagsSet(): Set<string> {
  if (_officialTagsCache) return _officialTagsCache;
  
  try {
    const cachePath = path.join(process.cwd(), 'config', 'officialTagsCache.json');
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const data = JSON.parse(content);
      // 小文字化してセットに格納（大文字小文字を無視して比較するため）
      _officialTagsCache = new Set(
        (data.tags || []).map((t: string) => t.toLowerCase())
      );
      return _officialTagsCache;
    }
  } catch (e) {
    console.warn('[Filter] Failed to load official tags cache:', e);
  }
  
  _officialTagsCache = new Set();
  return _officialTagsCache;
}

/**
 * フィルタ結果
 */
export interface FilterResult {
  passed: DerivedTag[];
  rejected: Array<{
    tag: DerivedTag;
    reason: string;
  }>;
}

/**
 * 禁止パターン（正規表現）
 */
const BANNED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // 数字のみ
  { pattern: /^\d+$/, reason: '数字のみ' },
  // 1文字
  { pattern: /^.$/u, reason: '1文字' },
  // ページ数・形式
  { pattern: /ページ|p$/i, reason: 'ページ数' },
  { pattern: /フルカラー|モノクロ|PDF|電子版|DL版/i, reason: '形式' },
  // イベント
  { pattern: /^コミケ|^C\d+|^同人誌即売会/i, reason: 'イベント' },
  // 価格・販売
  { pattern: /円$|¥|価格|販売|セール/i, reason: '価格・販売情報' },
  // サークル関連
  { pattern: /サークル|^circle/i, reason: 'サークル名' },
  // 一般的すぎる語
  { pattern: /^エロ$|^セックス$|^漫画$|^コミック$|^同人$|^中出し$/i, reason: '一般的すぎる' },
  // 禁止パターン: ○○プレイ、○○責め
  { pattern: /プレイ$/i, reason: '○○プレイ形式は禁止' },
  { pattern: /責め$/i, reason: '○○責め形式は禁止' },
  // バージョン・シリーズ番号
  { pattern: /^ver\.|^version|^第\d+|^\d+巻$/i, reason: 'バージョン情報' },
  // 英語の一般語
  { pattern: /^the$|^and$|^or$|^of$|^to$/i, reason: '英語の一般語' },
];

/**
 * 禁止ワード（完全一致）
 */
const BANNED_WORDS: Set<string> = new Set([
  // メタ情報
  '実写版', 'バージョン', '同梱', 'おまけ', '特典', 'ボーナス',
  '電子版', 'DL版', '通常版', '限定版', '完全版',
  // 一般的すぎる
  'エロ', 'セックス', '漫画', 'コミック', '同人', 'オリジナル', '中出し',
  'イラスト', 'CG', '作品', '本編', '続編',
  // 形式
  'フルカラー', 'モノクロ', 'カラー',
]);

/**
 * 許可されたカテゴリ
 */
const ALLOWED_CATEGORIES: Set<string> = new Set([
  'シチュエーション',
  '関係性',
  '属性',
  '場所',
  'その他',
]);

/**
 * DERIVEDタグをフィルタリングする
 * @param tags AIが抽出したタグ
 * @param maxCount 最大件数（デフォルト5）
 * @returns フィルタ結果
 */
export function filterDerivedTags(tags: DerivedTag[], maxCount: number = 5): FilterResult {
  const passed: DerivedTag[] = [];
  const rejected: FilterResult['rejected'] = [];

  for (const tag of tags) {
    const rejectReason = checkTag(tag);
    if (rejectReason) {
      rejected.push({ tag, reason: rejectReason });
    } else {
      passed.push(tag);
    }
  }

  // confidence順にソートして上位maxCount件を取得
  passed.sort((a, b) => b.confidence - a.confidence);
  const finalPassed = passed.slice(0, maxCount);

  // maxCountを超えた分はrejectedに追加
  for (let i = maxCount; i < passed.length; i++) {
    rejected.push({ tag: passed[i], reason: `上位${maxCount}件に入らなかった` });
  }

  return {
    passed: finalPassed,
    rejected,
  };
}

/**
 * タグをチェックして、除外理由を返す（問題なければnull）
 */
function checkTag(tag: DerivedTag): string | null {
  const name = tag.displayName.trim();

  // 空文字チェック
  if (!name) {
    return '空文字';
  }

  // 2文字未満チェック
  if ([...name].length < 2) {
    return '2文字未満';
  }

  // 禁止ワード（完全一致）
  if (BANNED_WORDS.has(name)) {
    return `禁止ワード: ${name}`;
  }

  // 禁止パターン（正規表現）
  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(name)) {
      return `禁止パターン: ${reason}`;
    }
  }

  // suggestedタグのみ: OFFICIALタグとの重複チェック
  if (tag.source === 'suggested') {
    const officialTags = getOfficialTagsSet();
    if (officialTags.has(name.toLowerCase())) {
      return `OFFICIALタグと重複: ${name}`;
    }
  }

  // confidence範囲チェック
  if (tag.confidence < 0 || tag.confidence > 1) {
    return `confidence範囲外: ${tag.confidence}`;
  }

  // 低すぎるconfidenceは除外
  if (tag.confidence < 0.3) {
    return `confidence低すぎ: ${tag.confidence}`;
  }

  // カテゴリチェック（許可リストにない場合はnullに正規化）
  if (tag.category && !ALLOWED_CATEGORIES.has(tag.category)) {
    // カテゴリを正規化（nullにする）
    tag.category = null;
  }

  return null;
}

/**
 * 厳選：上位N件を取得（quality gateを通過したもののみ）
 * @param tags フィルタ済みタグ
 * @param count 取得件数
 * @returns 厳選されたタグ
 */
export function selectTopTags(tags: DerivedTag[], count: number = 2): DerivedTag[] {
  return tags
    .filter(t => t.confidence >= 0.5) // confidence 50%以上のみ
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, count);
}
