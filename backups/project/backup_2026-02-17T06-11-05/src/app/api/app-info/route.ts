/**
 * アプリ情報（バージョン・更新履歴）取得API
 * 公開 - 認証不要
 */

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { APP_VERSION } from '@/config/app';

const APP_INFO_PATH = join(process.cwd(), 'config', 'appInfo.json');

interface ChangelogEntry {
  date: string;
  text: string;
}

interface AppInfo {
  version: string;
  changelog: ChangelogEntry[];
}

function loadAppInfo(): AppInfo {
  if (!existsSync(APP_INFO_PATH)) {
    return {
      version: APP_VERSION,
      changelog: [],
    };
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

export async function GET() {
  const info = loadAppInfo();
  return NextResponse.json(info);
}
