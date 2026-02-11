/**
 * ふわっとタグ API
 * GET: チェックされている displayName の一覧
 * POST: トグル（displayName を渡すと追加/削除）または一括設定（displayNames 配列）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import fs from 'fs/promises';
import path from 'path';

const VAGUE_FILE = path.join(process.cwd(), 'config', 'vagueTags.json');

async function loadVague(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(VAGUE_FILE, 'utf-8');
    const data = JSON.parse(content) as { displayNames?: string[] };
    return new Set(data.displayNames ?? []);
  } catch {
    return new Set();
  }
}

async function saveVague(displayNames: string[]): Promise<void> {
  const content = JSON.stringify(
    {
      description: 'ふわっとタグ。質問としての優先度を下げる候補。チェックされたタグの displayName を列挙。',
      updatedAt: new Date().toISOString().slice(0, 10),
      displayNames: displayNames.sort((a, b) => a.localeCompare(b)),
    },
    null,
    2
  );
  await fs.writeFile(VAGUE_FILE, content, 'utf-8');
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const set = await loadVague();
    return NextResponse.json({ success: true, displayNames: [...set] });
  } catch (error) {
    console.error('[vague-tags] GET', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const set = await loadVague();

    if (Array.isArray(body.displayNames)) {
      set.clear();
      for (const d of body.displayNames) if (typeof d === 'string') set.add(d);
      await saveVague([...set]);
      return NextResponse.json({ success: true, displayNames: [...set] });
    }

    const displayName = body.displayName as string;
    if (typeof displayName !== 'string') {
      return NextResponse.json({ error: 'displayName or displayNames required' }, { status: 400 });
    }
    if (set.has(displayName)) {
      set.delete(displayName);
    } else {
      set.add(displayName);
    }
    await saveVague([...set]);
    return NextResponse.json({ success: true, displayNames: [...set] });
  } catch (error) {
    console.error('[vague-tags] POST', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
