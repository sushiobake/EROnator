/**
 * /api/admin/play-history-remote: 本番のサービスプレイ履歴を取得（ローカル管理画面用）
 * ローカルから本番APIを呼び、結果を返す。本番環境では無効。
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';

const ALLOWED_ORIGINS = (process.env.PRODUCTION_APP_URL || process.env.NEXT_PUBLIC_PRODUCTION_APP_URL || '')
  .split(',')
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

function isAllowedTargetUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`.toLowerCase();
    return ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 本番ではこのエンドポイントを無効化（SSRF防止）
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl.trim() : '';
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const action = typeof body.action === 'string' ? body.action : 'list';

    if (!targetUrl || !token) {
      return NextResponse.json(
        { success: false, error: 'targetUrl と token が必要です' },
        { status: 400 }
      );
    }

    if (!isAllowedTargetUrl(targetUrl)) {
      return NextResponse.json(
        {
          success: false,
          error:
            '許可されていないURLです。.env.local に PRODUCTION_APP_URL または NEXT_PUBLIC_PRODUCTION_APP_URL を設定してください。',
        },
        { status: 400 }
      );
    }

    const base = targetUrl.replace(/\/$/, '');

    if (action === 'delete') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
      if (ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'ids は空でない配列を指定してください' },
          { status: 400 }
        );
      }
      const res = await fetch(`${base}/api/admin/play-history/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': token },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { success: false, error: `本番削除APIエラー: ${res.status} ${text.slice(0, 200)}` },
          { status: 502 }
        );
      }
      const data = await res.json();
      return NextResponse.json(data);
    }

    const page = Math.max(1, parseInt(String(body.page ?? 1), 10));
    const limit = Math.min(100, Math.max(10, parseInt(String(body.limit ?? 50), 10)));
    const outcome = typeof body.outcome === 'string' ? body.outcome : undefined;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (outcome) params.set('outcome', outcome);
    const res = await fetch(`${base}/api/admin/play-history?${params.toString()}`, {
      headers: { 'x-eronator-admin-token': token },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { success: false, error: `本番APIエラー: ${res.status} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('[play-history-remote]', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
