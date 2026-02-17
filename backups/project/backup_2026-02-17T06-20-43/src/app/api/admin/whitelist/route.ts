/**
 * ホワイトリスト管理API
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WHITELIST_PATH = path.join(process.cwd(), 'config', 'derivedTagWhitelist.json');

interface WhitelistTag {
  displayName: string;
  category: string;
  status: 'approved' | 'pending';
}

interface RejectedTag {
  displayName: string;
  reason: string;
}

interface WhitelistConfig {
  version: string;
  description: string;
  lastUpdated: string;
  categories: string[];
  whitelist: WhitelistTag[];
  pending: WhitelistTag[];
  rejected: RejectedTag[];
}

async function loadWhitelist(): Promise<WhitelistConfig> {
  try {
    const content = await fs.readFile(WHITELIST_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      version: '1.0',
      description: '',
      lastUpdated: new Date().toISOString().split('T')[0],
      categories: ['シチュエーション', '関係性', '属性', '場所', 'その他'],
      whitelist: [],
      pending: [],
      rejected: [],
    };
  }
}

async function saveWhitelist(config: WhitelistConfig): Promise<void> {
  config.lastUpdated = new Date().toISOString().split('T')[0];
  await fs.writeFile(WHITELIST_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// GET: ホワイトリストを取得
export async function GET() {
  try {
    const config = await loadWhitelist();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error loading whitelist:', error);
    return NextResponse.json({ error: 'Failed to load whitelist' }, { status: 500 });
  }
}

// POST: ホワイトリストを更新
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, tag, category, reason, fromList, toList } = body;

    const config = await loadWhitelist();

    switch (action) {
      case 'add': {
        // 新しいタグを追加
        if (!tag || !category) {
          return NextResponse.json({ error: 'tag and category required' }, { status: 400 });
        }
        // 重複チェック
        const exists = config.whitelist.some(t => t.displayName === tag) ||
                       config.pending.some(t => t.displayName === tag);
        if (exists) {
          return NextResponse.json({ error: 'Tag already exists' }, { status: 400 });
        }
        config.whitelist.push({ displayName: tag, category, status: 'approved' });
        break;
      }

      case 'approve': {
        // pendingからwhitelistに移動
        const idx = config.pending.findIndex(t => t.displayName === tag);
        if (idx >= 0) {
          const [moved] = config.pending.splice(idx, 1);
          moved.status = 'approved';
          if (category) moved.category = category;
          config.whitelist.push(moved);
        }
        break;
      }

      case 'reject': {
        // whitelistまたはpendingからrejectedに移動
        let found = false;
        const wIdx = config.whitelist.findIndex(t => t.displayName === tag);
        if (wIdx >= 0) {
          config.whitelist.splice(wIdx, 1);
          found = true;
        }
        const pIdx = config.pending.findIndex(t => t.displayName === tag);
        if (pIdx >= 0) {
          config.pending.splice(pIdx, 1);
          found = true;
        }
        if (found) {
          config.rejected.push({ displayName: tag, reason: reason || '不要' });
        }
        break;
      }

      case 'restore': {
        // rejectedからpendingに戻す
        const rIdx = config.rejected.findIndex(t => t.displayName === tag);
        if (rIdx >= 0) {
          config.rejected.splice(rIdx, 1);
          config.pending.push({ displayName: tag, category: category || 'その他', status: 'pending' });
        }
        break;
      }

      case 'update': {
        // カテゴリを更新
        const wTag = config.whitelist.find(t => t.displayName === tag);
        if (wTag && category) {
          wTag.category = category;
        }
        break;
      }

      case 'delete': {
        // 完全削除
        config.whitelist = config.whitelist.filter(t => t.displayName !== tag);
        config.pending = config.pending.filter(t => t.displayName !== tag);
        config.rejected = config.rejected.filter(t => t.displayName !== tag);
        break;
      }

      case 'bulk_import': {
        // バックアップからの一括インポート
        const { tags } = body;
        if (!Array.isArray(tags)) {
          return NextResponse.json({ error: 'tags array required' }, { status: 400 });
        }
        for (const t of tags) {
          const exists = config.whitelist.some(w => w.displayName === t.displayName) ||
                         config.pending.some(w => w.displayName === t.displayName) ||
                         config.rejected.some(w => w.displayName === t.displayName);
          if (!exists) {
            config.pending.push({
              displayName: t.displayName,
              category: t.category || 'その他',
              status: 'pending'
            });
          }
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    await saveWhitelist(config);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Error updating whitelist:', error);
    return NextResponse.json({ error: 'Failed to update whitelist' }, { status: 500 });
  }
}
