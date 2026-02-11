/**
 * 取得禁止タグリスト（config/bannedTags.json）の読み込みと判定
 * DMMインポート・バッチなどで共通利用
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BannedTag {
  pattern: string;
  type: 'exact' | 'startsWith' | 'contains' | 'regex';
  reason: string;
  addedAt: string;
}

export interface BannedTagsConfig {
  version: string;
  description: string;
  bannedTags: BannedTag[];
}

const BANNED_TAGS_PATH = path.join(process.cwd(), 'config', 'bannedTags.json');

let cachedConfig: BannedTagsConfig | null = null;

export function loadBannedTagsConfig(): BannedTagsConfig {
  if (cachedConfig) return cachedConfig;
  try {
    const content = fs.readFileSync(BANNED_TAGS_PATH, 'utf-8');
    cachedConfig = JSON.parse(content) as BannedTagsConfig;
    return cachedConfig;
  } catch {
    cachedConfig = { version: '1.0', description: '取得禁止タグリスト', bannedTags: [] };
    return cachedConfig;
  }
}

export function isTagBanned(tagName: string, bannedTags?: BannedTag[]): boolean {
  const list = bannedTags ?? loadBannedTagsConfig().bannedTags;
  for (const banned of list) {
    switch (banned.type) {
      case 'exact':
        if (tagName === banned.pattern) return true;
        break;
      case 'startsWith':
        if (tagName.startsWith(banned.pattern)) return true;
        break;
      case 'contains':
        if (tagName.includes(banned.pattern)) return true;
        break;
      case 'regex':
        try {
          if (new RegExp(banned.pattern).test(tagName)) return true;
        } catch {
          // 無効な正規表現は無視
        }
        break;
    }
  }
  return false;
}
