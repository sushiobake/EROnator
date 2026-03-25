/**
 * GET/POST config/recommendFamousTags.json（推薦・有名タグ 40×3）
 * ローカル開発または管理トークン。保存時は .bak を作成。
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { prisma } from '@/server/db/client';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import {
  validateRecommendFamousConfig,
  type RecommendFamousTagsFile,
  getFamousTagsGroupedForApi,
  RECOMMEND_CATEGORIES,
  FAMOUS_PER_CATEGORY,
} from '@/server/recommend/famousTagsEngine';

const CONFIG_PATH = () => join(process.cwd(), 'config', 'recommendFamousTags.json');
const BAK_PATH = () => join(process.cwd(), 'config', 'recommendFamousTags.json.bak');

function parseBody(data: unknown): RecommendFamousTagsFile | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (typeof o.version !== 'number') return null;
  if (typeof o.useConfigSlots !== 'boolean') return null;
  if (!o.slots || typeof o.slots !== 'object') return null;
  const slots = o.slots as Record<string, unknown>;
  for (const c of RECOMMEND_CATEGORIES) {
    if (!Array.isArray(slots[c])) return null;
  }
  return data as RecommendFamousTagsFile;
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const p = CONFIG_PATH();
    const raw = existsSync(p) ? readFileSync(p, 'utf-8') : '{}';
    let file: RecommendFamousTagsFile | null = null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      file = parseBody(parsed);
    } catch {
      file = null;
    }

    const validation = file ? await validateRecommendFamousConfig(prisma, file) : null;
    const preview = await getFamousTagsGroupedForApi(prisma);

    return NextResponse.json({
      success: true,
      path: 'config/recommendFamousTags.json',
      file,
      validation,
      preview,
      expectedSlotsPerCategory: FAMOUS_PER_CATEGORY,
    });
  } catch (e) {
    console.error('[admin/recommend-famous-tags GET]', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = parseBody(body.file ?? body);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'Invalid body: expected RecommendFamousTagsFile shape' },
        { status: 400 }
      );
    }

    const val = await validateRecommendFamousConfig(prisma, parsed);
    if (val.errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', validation: val },
        { status: 400 }
      );
    }

    const p = CONFIG_PATH();
    const bak = BAK_PATH();
    if (existsSync(p)) {
      copyFileSync(p, bak);
    }

    writeFileSync(p, JSON.stringify(parsed, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Saved. Backup: config/recommendFamousTags.json.bak',
      validation: val,
    });
  } catch (e) {
    console.error('[admin/recommend-famous-tags POST]', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
