/**
 * エロ質問タグ API
 * GET: チェックされている displayName の一覧
 * POST: トグル（displayName を渡すと追加/削除）または一括設定（displayNames 配列）
 * エロ質問は7問目以降にのみ出題される。
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import fs from 'fs/promises';
import path from 'path';

const EROTIC_FILE = path.join(process.cwd(), 'config', 'eroticTags.json');

async function loadErotic(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(EROTIC_FILE, 'utf-8');
    const data = JSON.parse(content) as { displayNames?: string[] };
    return new Set(data.displayNames ?? []);
  } catch {
    return new Set();
  }
}

async function saveErotic(displayNames: string[]): Promise<void> {
  const content = JSON.stringify(
    {
      description: 'エロ質問タグ。7問目以降にのみ出題する。',
      updatedAt: new Date().toISOString().slice(0, 10),
      displayNames: displayNames.sort((a, b) => a.localeCompare(b)),
    },
    null,
    2
  );
  await fs.writeFile(EROTIC_FILE, content, 'utf-8');
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const set = await loadErotic();
    return NextResponse.json({ success: true, displayNames: [...set] });
  } catch (error) {
    console.error('[erotic-tags] GET', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const set = await loadErotic();

    if (Array.isArray(body.displayNames)) {
      set.clear();
      for (const d of body.displayNames) if (typeof d === 'string') set.add(d);
      await saveErotic([...set]);
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
    await saveErotic([...set]);
    return NextResponse.json({ success: true, displayNames: [...set] });
  } catch (error) {
    console.error('[erotic-tags] POST', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
