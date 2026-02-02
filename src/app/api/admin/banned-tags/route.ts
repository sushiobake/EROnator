import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fsSync from 'fs';

/** プロジェクトルートの config/bannedTags.json を探す（cwd に依存しない） */
function getBannedTagsPath(): string {
  const candidates: string[] = [
    path.resolve(process.cwd(), 'config', 'bannedTags.json'),
  ];
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.resolve(__dirname, '../../../../../../config/bannedTags.json'));
    candidates.push(path.resolve(__dirname, '../../../../../config/bannedTags.json'));
    candidates.push(path.resolve(__dirname, '../../../../../../../../config/bannedTags.json'));
  } catch {
    // ignore
  }
  for (const p of candidates) {
    try {
      fsSync.accessSync(p);
      return p;
    } catch {
      continue;
    }
  }
  return candidates[0];
}

interface BannedTag {
  pattern: string;
  type: 'exact' | 'startsWith' | 'contains' | 'regex';
  reason: string;
  addedAt: string;
}

interface BannedTagsConfig {
  version: string;
  description: string;
  bannedTags: BannedTag[];
}

// 禁止タグリストを読み込む
async function loadBannedTags(): Promise<BannedTagsConfig> {
  const filePath = getBannedTagsPath();
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as BannedTagsConfig;
  } catch (err) {
    console.error('[banned-tags] 読み込み失敗:', filePath, err);
    return {
      version: '1.0',
      description: '取得禁止タグリスト',
      bannedTags: [],
    };
  }
}

// 禁止タグリストを保存する
async function saveBannedTags(config: BannedTagsConfig): Promise<void> {
  await fs.writeFile(getBannedTagsPath(), JSON.stringify(config, null, 2), 'utf-8');
}

// タグ名が禁止リストにマッチするかチェック（ルート内でのみ使用、他からは @/server/admin/bannedTags を利用）
function isTagBanned(tagName: string, bannedTags: BannedTag[]): boolean {
  for (const banned of bannedTags) {
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

// GET: 禁止タグリストを取得
export async function GET() {
  try {
    const config = await loadBannedTags();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to load banned tags:', error);
    return NextResponse.json({ error: 'Failed to load banned tags' }, { status: 500 });
  }
}

// POST: 禁止タグを追加
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      pattern: string;
      type: BannedTag['type'];
      reason: string;
    };
    
    if (!body.pattern || !body.type) {
      return NextResponse.json({ error: 'pattern and type are required' }, { status: 400 });
    }
    
    const config = await loadBannedTags();
    
    // 重複チェック
    const exists = config.bannedTags.some(
      t => t.pattern === body.pattern && t.type === body.type
    );
    if (exists) {
      return NextResponse.json({ error: 'Tag already exists' }, { status: 400 });
    }
    
    const newTag: BannedTag = {
      pattern: body.pattern,
      type: body.type,
      reason: body.reason || '',
      addedAt: new Date().toISOString().split('T')[0],
    };
    
    config.bannedTags.push(newTag);
    await saveBannedTags(config);
    
    return NextResponse.json({ success: true, tag: newTag });
  } catch (error) {
    console.error('Failed to add banned tag:', error);
    return NextResponse.json({ error: 'Failed to add banned tag' }, { status: 500 });
  }
}

// DELETE: 禁止タグを削除
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pattern = searchParams.get('pattern');
    const type = searchParams.get('type');
    
    if (!pattern || !type) {
      return NextResponse.json({ error: 'pattern and type are required' }, { status: 400 });
    }
    
    const config = await loadBannedTags();
    const initialLength = config.bannedTags.length;
    
    config.bannedTags = config.bannedTags.filter(
      t => !(t.pattern === pattern && t.type === type)
    );
    
    if (config.bannedTags.length === initialLength) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }
    
    await saveBannedTags(config);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete banned tag:', error);
    return NextResponse.json({ error: 'Failed to delete banned tag' }, { status: 500 });
  }
}
