/**
 * 特別質問 API
 * GET: 一覧取得
 * POST: 文言・パラメータの更新
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { invalidateSpecialQuestionsCache } from '@/server/config/specialQuestionsLoader';
import fs from 'fs/promises';
import path from 'path';

const SPECIAL_FILE = path.join(process.cwd(), 'config', 'specialQuestions.json');

export interface SpecialQuestionsConfig {
  description?: string;
  updatedAt?: string;
  SERIES?: { questionText?: string };
  TITLE_CHAR_TYPE?: {
    KANJI?: string;
    HIRAGANA_OR_KATAKANA?: string;
  };
  POPULARITY?: {
    questionText?: string;
    popularityThreshold?: number;
  };
  TITLE_SYLLABLE?: {
    ranges?: Array<{
      id: string;
      label: string;
      questionText: string;
      chars: string[];
    }>;
  };
}

/** 生JSONを正規化（specialQuestions ラッパー・TITLE_SYLLABLE 配列対応） */
function normalizeLoaded(raw: Record<string, unknown>): SpecialQuestionsConfig {
  const base = (raw.specialQuestions as Record<string, unknown>) ?? raw;
  const tsl = base.TITLE_SYLLABLE;
  const ranges = Array.isArray(tsl)
    ? tsl
    : (tsl && typeof tsl === 'object' && Array.isArray((tsl as { ranges?: unknown[] }).ranges))
      ? (tsl as { ranges: unknown[] }).ranges
      : [];
  return {
    description: raw.description as string | undefined,
    updatedAt: raw.updatedAt as string | undefined,
    SERIES: base.SERIES as SpecialQuestionsConfig['SERIES'],
    TITLE_CHAR_TYPE: base.TITLE_CHAR_TYPE as SpecialQuestionsConfig['TITLE_CHAR_TYPE'],
    POPULARITY: base.POPULARITY as SpecialQuestionsConfig['POPULARITY'],
    TITLE_SYLLABLE: { ranges: ranges as NonNullable<SpecialQuestionsConfig['TITLE_SYLLABLE']>['ranges'] },
  };
}

async function loadSpecial(): Promise<SpecialQuestionsConfig> {
  try {
    const content = await fs.readFile(SPECIAL_FILE, 'utf-8');
    const raw = JSON.parse(content) as Record<string, unknown>;
    return normalizeLoaded(raw);
  } catch {
    return {};
  }
}

async function saveSpecial(config: SpecialQuestionsConfig): Promise<void> {
  const content = JSON.stringify(
    {
      ...config,
      updatedAt: new Date().toISOString().slice(0, 10),
    },
    null,
    2
  );
  await fs.writeFile(SPECIAL_FILE, content, 'utf-8');
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const config = await loadSpecial();
    return NextResponse.json({ success: true, ...config });
  } catch (error) {
    console.error('[special-questions] GET', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Partial<SpecialQuestionsConfig> & {
      type?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE';
      key?: string;
      value?: unknown;
    };
    const config = await loadSpecial();

    // SERIES: questionText
    if (body.type === 'SERIES' && typeof body.value === 'string') {
      if (!config.SERIES) config.SERIES = { questionText: '' };
      config.SERIES.questionText = body.value.trim();
    }

    // TITLE_CHAR_TYPE: KANJI | HIRAGANA_OR_KATAKANA
    if (body.type === 'TITLE_CHAR_TYPE' && body.key && typeof body.value === 'string') {
      if (!config.TITLE_CHAR_TYPE) config.TITLE_CHAR_TYPE = {};
      (config.TITLE_CHAR_TYPE as Record<string, string>)[body.key] = body.value.trim();
    }

    // POPULARITY: questionText or popularityThreshold
    if (body.type === 'POPULARITY') {
      if (!config.POPULARITY) config.POPULARITY = { questionText: '', popularityThreshold: 40 };
      if (typeof body.value === 'string') config.POPULARITY.questionText = body.value.trim();
      if (body.key === 'popularityThreshold' && typeof body.value === 'number') {
        config.POPULARITY.popularityThreshold = body.value;
      }
    }

    // TITLE_SYLLABLE: ranges[].questionText or full replace
    if (body.type === 'TITLE_SYLLABLE') {
      if (!config.TITLE_SYLLABLE) config.TITLE_SYLLABLE = { ranges: [] };
      if (body.key === 'ranges' && Array.isArray(body.value)) {
        config.TITLE_SYLLABLE.ranges = body.value as NonNullable<SpecialQuestionsConfig['TITLE_SYLLABLE']>['ranges'];
      } else if (body.key && typeof body.value === 'string') {
        const range = config.TITLE_SYLLABLE.ranges?.find((r) => r.id === body.key);
        if (range) range.questionText = body.value.trim();
      }
    }

    await saveSpecial(config);
    invalidateSpecialQuestionsCache();
    return NextResponse.json({ success: true, ...config });
  } catch (error) {
    console.error('[special-questions] POST', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
