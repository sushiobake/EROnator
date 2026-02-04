/**
 * まとめ質問 API
 * GET: 一覧取得
 * POST: 質問文の更新（id + questionText）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import fs from 'fs/promises';
import path from 'path';

const SUMMARY_FILE = path.join(process.cwd(), 'config', 'summaryQuestions.json');

export interface SummaryQuestion {
  id: string;
  label: string;
  questionText: string;
  displayNames: string[];
  /** true のまとめは6問目以降にのみ出題 */
  erotic?: boolean;
}

async function loadSummary(): Promise<{ summaryQuestions: SummaryQuestion[] }> {
  try {
    const content = await fs.readFile(SUMMARY_FILE, 'utf-8');
    const data = JSON.parse(content) as { summaryQuestions?: SummaryQuestion[] };
    return { summaryQuestions: data.summaryQuestions ?? [] };
  } catch {
    return { summaryQuestions: [] };
  }
}

async function saveSummary(summaryQuestions: SummaryQuestion[]): Promise<void> {
  const content = JSON.stringify(
    {
      description: 'まとめ質問。個別タグの質問は残しつつ、複数タグをORでまとめた質問を用意する。',
      updatedAt: new Date().toISOString().slice(0, 10),
      summaryQuestions,
    },
    null,
    2
  );
  await fs.writeFile(SUMMARY_FILE, content, 'utf-8');
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { summaryQuestions } = await loadSummary();
    return NextResponse.json({ success: true, summaryQuestions });
  } catch (error) {
    console.error('[summary-questions] GET', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { id, questionText, erotic } = body as { id?: string; questionText?: string; erotic?: boolean };
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const { summaryQuestions } = await loadSummary();
    const idx = summaryQuestions.findIndex((q) => q.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (typeof questionText === 'string') {
      summaryQuestions[idx] = { ...summaryQuestions[idx], questionText };
    }
    if (typeof erotic === 'boolean') {
      summaryQuestions[idx] = { ...summaryQuestions[idx], erotic };
    }
    await saveSummary(summaryQuestions);
    return NextResponse.json({ success: true, summaryQuestions });
  } catch (error) {
    console.error('[summary-questions] POST', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
