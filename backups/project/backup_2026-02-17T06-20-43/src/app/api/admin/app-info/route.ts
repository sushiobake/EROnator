/**
 * アプリ情報（バージョン・更新履歴）管理API
 * 管理画面用 - 認証必須
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { APP_VERSION } from '@/config/app';

const APP_INFO_PATH = join(process.cwd(), 'config', 'appInfo.json');
const APP_INFO_BAK = join(process.cwd(), 'config', 'appInfo.json.bak');

interface ChangelogEntry {
  date: string;
  text: string;
}

interface AppInfo {
  version: string;
  changelog: ChangelogEntry[];
}

function isAdmin(request: NextRequest): boolean {
  const isDev = process.env.NODE_ENV === 'development';
  return !!(isDev || (
    process.env.ERONATOR_ADMIN === '1' &&
    (process.env.NODE_ENV !== 'production' || process.env.ERONATOR_ADMIN_PRODUCTION === '1') &&
    request.headers.get('x-eronator-admin-token') === process.env.ERONATOR_ADMIN_TOKEN
  ));
}

function loadAppInfo(): AppInfo {
  if (!existsSync(APP_INFO_PATH)) {
    return { version: APP_VERSION, changelog: [] };
  }
  try {
    const content = readFileSync(APP_INFO_PATH, 'utf-8');
    const parsed = JSON.parse(content) as AppInfo;
    return {
      version: parsed.version ?? APP_VERSION,
      changelog: Array.isArray(parsed.changelog) ? parsed.changelog : [],
    };
  } catch {
    return { version: APP_VERSION, changelog: [] };
  }
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const info = loadAppInfo();
  return NextResponse.json(info);
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json() as { version?: string; changelog?: ChangelogEntry[] };
    const version = typeof body.version === 'string' ? body.version : APP_VERSION;
    const changelog = Array.isArray(body.changelog) ? body.changelog : [];

    // バックアップ
    if (existsSync(APP_INFO_PATH)) {
      copyFileSync(APP_INFO_PATH, APP_INFO_BAK);
    }

    const info: AppInfo = { version, changelog };
    writeFileSync(APP_INFO_PATH, JSON.stringify(info, null, 2), 'utf-8');

    return NextResponse.json({ success: true, ...info });
  } catch (error) {
    console.error('[admin/app-info] Save failed:', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
