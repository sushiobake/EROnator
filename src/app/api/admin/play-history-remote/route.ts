/**
 * /api/admin/play-history-remote: 本番のサービスプレイ履歴を取得（ローカル管理画面用）
 * ローカルから本番APIを呼び、結果を返す。本番環境では無効。
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

    if (!isAllowedRemoteAdminTargetUrl(targetUrl)) {
      return NextResponse.json(
        {
          success: false,
          error:
            '許可されていないURLです。.env.local に ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP=1（Vercelの *.vercel.app 一括許可・ローカル開発のみ）または PRODUCTION_APP_URL を設定してください。',
        },
        { status: 400 }
      );
    }

    const base = targetUrl.replace(/\/$/, '');

    if (action === 'delete') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
      if (ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'ids は空でない配列を指定してください' },
          { status: 400 }
        );
      }
      const delUrl = appendVercelProtectionBypassQuery(`${base}/api/admin/play-history/delete`);
      const res = await fetch(delUrl, {
        method: 'POST',
        headers: {
          ...(remoteAdminFetchHeaders(token) as Record<string, string>),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const text = await res.text();
        const isHtml = /^\s*</.test(text);
        const error = isHtml
          ? `リモートがHTMLを返しました (HTTP ${res.status})。URLは https://ホスト名 だけにしてください。`
          : `本番削除APIエラー: ${res.status} ${text.slice(0, 200)}`;
        return NextResponse.json({ success: false, error }, { status: 502 });
      }
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === 'embedCorrect') {
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const workId = typeof body.workId === 'string' ? body.workId.trim() : '';
      const searchQuery =
        typeof body.searchQuery === 'string'
          ? body.searchQuery
          : body.searchQuery == null
            ? undefined
            : String(body.searchQuery);
      if (!sessionId || !workId) {
        return NextResponse.json(
          { success: false, error: 'sessionId と workId が必要です' },
          { status: 400 }
        );
      }
      const embedUrl = appendVercelProtectionBypassQuery(`${base}/api/admin/play-history/embed-correct`);
      const res = await fetch(embedUrl, {
        method: 'POST',
        headers: {
          ...(remoteAdminFetchHeaders(token) as Record<string, string>),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, workId, searchQuery }),
      });
      if (!res.ok) {
        const text = await res.text();
        const isHtml = /^\s*</.test(text);
        const error = isHtml
          ? `リモートがHTMLを返しました (HTTP ${res.status})。URLは https://ホスト名 だけにしてください。`
          : `本番埋め込みAPIエラー: ${res.status} ${text.slice(0, 200)}`;
        return NextResponse.json({ success: false, error }, { status: 502 });
      }
      const data = await res.json();
      return NextResponse.json(data);
    }

    const page = Math.max(1, parseInt(String(body.page ?? 1), 10));
    const limit = Math.min(100, Math.max(10, parseInt(String(body.limit ?? 50), 10)));
    const outcome = typeof body.outcome === 'string' ? body.outcome : undefined;
    const createdAtFrom = typeof body.createdAtFrom === 'string' && body.createdAtFrom.trim()
      ? body.createdAtFrom.trim()
      : undefined;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (outcome) params.set('outcome', outcome);
    if (createdAtFrom) params.set('createdAtFrom', createdAtFrom);
    const listUrl = appendVercelProtectionBypassQuery(
      `${base}/api/admin/play-history?${params.toString()}`
    );
    const res = await fetch(listUrl, {
      headers: remoteAdminFetchHeaders(token),
    });

    if (!res.ok) {
      const text = await res.text();
      const isHtml = /^\s*</.test(text);
      const error = isHtml
        ? `リモートがHTMLを返しました (HTTP ${res.status})。URLは https://ホスト名 だけにしてください。管理画面の「接続テスト」で切り分けできます。`
        : `本番APIエラー: ${res.status} ${text.slice(0, 200)}`;
      return NextResponse.json({ success: false, error }, { status: 502 });
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
