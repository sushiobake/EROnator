/**
 * タグランク管理API
 * GET: ランク一覧取得
 * POST: ランク更新
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const RANKS_FILE = path.join(process.cwd(), 'config', 'tagRanks.json');

interface TagRanksConfig {
  description: string;
  updatedAt: string;
  ranks: Record<string, 'A' | 'B' | 'C'>;
}

async function loadRanks(): Promise<TagRanksConfig> {
  try {
    const content = await fs.readFile(RANKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      description: 'DERIVEDタグのランク管理。A=採用, B=検討中, C=不採用',
      updatedAt: '',
      ranks: {}
    };
  }
}

async function saveRanks(config: TagRanksConfig): Promise<void> {
  config.updatedAt = new Date().toISOString();
  await fs.writeFile(RANKS_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const config = await loadRanks();
    return NextResponse.json({
      success: true,
      ranks: config.ranks,
      updatedAt: config.updatedAt
    });
  } catch (error) {
    console.error('Error loading ranks:', error);
    return NextResponse.json({ error: 'Failed to load ranks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, tagKey, rank, tagKeys, ranks: bulkRanks } = body;

    const config = await loadRanks();

    if (action === 'set' && tagKey && rank) {
      // 単一タグのランク設定
      if (rank === null || rank === '') {
        delete config.ranks[tagKey];
      } else {
        config.ranks[tagKey] = rank;
      }
    } else if (action === 'bulk' && tagKeys && bulkRanks) {
      // 一括ランク設定
      for (const key of tagKeys) {
        if (bulkRanks === null || bulkRanks === '') {
          delete config.ranks[key];
        } else {
          config.ranks[key] = bulkRanks;
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    await saveRanks(config);

    return NextResponse.json({
      success: true,
      ranks: config.ranks
    });
  } catch (error) {
    console.error('Error saving ranks:', error);
    return NextResponse.json({ error: 'Failed to save ranks' }, { status: 500 });
  }
}
