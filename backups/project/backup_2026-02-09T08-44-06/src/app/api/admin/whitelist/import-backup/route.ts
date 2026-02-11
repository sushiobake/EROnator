/**
 * バックアップからDERIVEDタグをインポート
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_JSON_PATH = path.join(process.cwd(), 'data', 'derived-tags-backup.json');
const WHITELIST_PATH = path.join(process.cwd(), 'config', 'derivedTagWhitelist.json');

// 除外パターン（インポートしないタグ）
const EXCLUDED_PATTERNS = [
  /^実写版$/,
  /^サークル$/,
  /^バージョン$/,
  /フルカラー/i,
  /^同梱$/,
  /^セックス$/,
  /^エロ$/,
  /^オリジナル$/,
  /^Boys$/i,
  /^Girls$/i,
  /^SNS$/i,
  /^カード$/,
  /^カラミ$/,
];

// カテゴリ正規化マップ
const CATEGORY_MAP: Record<string, string> = {
  'エロ': 'シチュエーション',
  '学園': 'シチュエーション',
  '属性': '属性',
  'Category': '関係性',
  'シチュエーション': 'シチュエーション',
  'Plot': 'シチュエーション',
  '職業/関係性': '関係性',
  '職業': '関係性',
  '学園・恋愛': 'シチュエーション',
  '暴力': 'シチュエーション',
  '関係性': '関係性',
  '場所': '場所',
  'Setting': '場所',
  'Relationship': '関係性',
  'Romance': '関係性',
  'Theme': 'シチュエーション',
  'Genre': 'シチュエーション',
  'Situation': 'シチュエーション',
};

export async function POST() {
  try {
    // バックアップJSONを読み込み
    const backupContent = await fs.readFile(BACKUP_JSON_PATH, 'utf-8');
    const backupData = JSON.parse(backupContent);

    // ホワイトリストを読み込み
    let whitelist;
    try {
      const wlContent = await fs.readFile(WHITELIST_PATH, 'utf-8');
      whitelist = JSON.parse(wlContent);
    } catch {
      whitelist = {
        version: '1.0',
        description: '',
        lastUpdated: new Date().toISOString().split('T')[0],
        categories: ['シチュエーション', '関係性', '属性', '場所', 'その他'],
        whitelist: [],
        pending: [],
        rejected: [],
      };
    }

    // 既存のタグ名を収集
    const existingNames = new Set([
      ...whitelist.whitelist.map((t: any) => t.displayName),
      ...whitelist.pending.map((t: any) => t.displayName),
      ...whitelist.rejected.map((t: any) => t.displayName),
    ]);

    let imported = 0;

    for (const tag of backupData.allTags) {
      // 既に存在する場合はスキップ
      if (existingNames.has(tag.displayName)) continue;

      // 除外パターンに一致する場合はスキップ
      if (EXCLUDED_PATTERNS.some(p => p.test(tag.displayName))) {
        whitelist.rejected.push({
          displayName: tag.displayName,
          reason: '自動除外（パターン一致）'
        });
        continue;
      }

      // 1文字のタグはスキップ
      if ([...tag.displayName].length < 2) {
        whitelist.rejected.push({
          displayName: tag.displayName,
          reason: '1文字'
        });
        continue;
      }

      // カテゴリを正規化
      const normalizedCategory = CATEGORY_MAP[tag.category] || 'その他';

      // workCountが2以上なら承認候補、それ以外は保留
      if (tag.workCount >= 2) {
        whitelist.pending.push({
          displayName: tag.displayName,
          category: normalizedCategory,
          status: 'pending'
        });
      } else {
        whitelist.pending.push({
          displayName: tag.displayName,
          category: normalizedCategory,
          status: 'pending'
        });
      }

      imported++;
    }

    // 保存
    whitelist.lastUpdated = new Date().toISOString().split('T')[0];
    await fs.writeFile(WHITELIST_PATH, JSON.stringify(whitelist, null, 2), 'utf-8');

    return NextResponse.json({ 
      success: true, 
      imported,
      total: backupData.allTags.length,
      pending: whitelist.pending.length,
      rejected: whitelist.rejected.length
    });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
