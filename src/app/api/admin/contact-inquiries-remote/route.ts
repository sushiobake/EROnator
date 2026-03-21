/**
 * /api/admin/contact-inquiries-remote: デプロイ先（本番・プレビュー）のお問い合わせを取得（ローカル管理画面用）
 * ローカルからリモートの GET /api/admin/contact-inquiries をプロキシする。本番ビルドでは無効。
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { isAllowedRemoteAdminTargetUrl } from '@/server/admin/isAllowedRemoteAdminTarget';
import {
  appendVercelProtectionBypassQuery,
  remoteAdminFetchHeaders,
} from '@/server/admin/remoteAdminFetchHeaders';

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl.trim() : '';
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!targetUrl || !token) {
      return NextResponse.json(
        { success: false, error: 'targetUrl と token が必要です' },
        { status: 400 }
      );
    }

    if (!isAllowedRemoteAdminTargetUrl(targetUrl)) {
      return NextResponse.json(
        {
          success: false,
          error:
            '許可されていないURLです。.env.local に ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP=1（プレビューURLが毎回変わるとき・ローカル開発のみ）または PRODUCTION_APP_URL を設定してください。',
        },
        { status: 400 }
      );
    }

    const base = targetUrl.replace(/\/$/, '');
    const page = Math.max(1, parseInt(String(body.page ?? 1), 10));
    const limit = Math.min(100, Math.max(10, parseInt(String(body.limit ?? 30), 10)));
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    const url = appendVercelProtectionBypassQuery(
      `${base}/api/admin/contact-inquiries?${params.toString()}`
    );
    const res = await fetch(url, {
      headers: remoteAdminFetchHeaders(token),
    });

    if (!res.ok) {
      const text = await res.text();
      const isHtml = /^\s*</.test(text);
      const error = isHtml
        ? `リモートがHTMLを返しました (HTTP ${res.status})。URLは https://ホスト名 だけにしてください。管理画面の「接続テスト」で切り分けできます。`
        : `リモートAPIエラー: ${res.status} ${text.slice(0, 200)}`;
      return NextResponse.json({ success: false, error }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('[contact-inquiries-remote]', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
