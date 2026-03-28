/**
 * ローカル管理画面用: 取得先URLへ管理APIを1回だけ叩き、HTTPコードと本文冒頭を返す。
 * probe で対象を切り替え（お問い合わせ / 推薦プレイ履歴）。curl 不要で切り分け用。
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { isAllowedRemoteAdminTargetUrl } from '@/server/admin/isAllowedRemoteAdminTarget';
import {
  appendVercelProtectionBypassQuery,
  getVercelProtectionBypassSecret,
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
            '許可されていないURLです。.env.local に ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP=1 または PRODUCTION_APP_URL を設定してください。',
        },
        { status: 400 }
      );
    }

    const base = targetUrl.replace(/\/$/, '');
    const probeRaw = typeof body.probe === 'string' ? body.probe.trim().toLowerCase() : 'contact';
    const probe = probeRaw === 'recommendplayhistory' || probeRaw === 'recommend_play_history' ? 'recommendPlayHistory' : 'contact';

    const path =
      probe === 'recommendPlayHistory'
        ? '/api/admin/recommend-play-history?page=1&limit=10'
        : '/api/admin/contact-inquiries?page=1&limit=1';
    const requestUrl = appendVercelProtectionBypassQuery(`${base}${path}`);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(requestUrl, {
        headers: remoteAdminFetchHeaders(token),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(t);
    }

    const text = await res.text();
    const isHtml = /^\s*</.test(text);

    let hint = '';
    if (res.status === 200) {
      hint =
        probe === 'recommendPlayHistory'
          ? '接続OK（推薦プレイ履歴API）。管理画面の「推薦プレイ履歴」でリモート取得を再実行してください。'
          : '接続OK（お問い合わせAPI）。「お問い合わせ」タブで再読み込みしてください。';
    } else if (res.status === 403) {
      hint =
        probe === 'recommendPlayHistory'
          ? '403 Forbidden → リモート先の ERONATOR_ADMIN_TOKEN と「本番用管理トークン」（未入力なら上の管理トークン）が一致しているか確認。Vercel 本番の環境変数を開き直す。'
          : '403 Forbidden → Vercel の ERONATOR_ADMIN_TOKEN がローカルと同じか、Preview にも変数があるか確認。';
    } else if (res.status === 404 && isHtml) {
      hint = getVercelProtectionBypassSecret()
        ? '404+HTML（バイパス設定済みでも失敗）。Vercel のシークレットを再確認するか、Preview の Deployment Protection を一時オフ。'
        : '404+HTML は多くが Vercel の Deployment Protection。Vercel → Settings → Protection Bypass for Automation を有効にし、発行した値を .env.local に ERONATOR_VERCEL_PROTECTION_BYPASS=... と書いて dev 再起動。';
    } else if (isHtml) {
      hint = getVercelProtectionBypassSecret()
        ? 'HTML応答（バイパス済み）。保護設定またはデプロイを確認。'
        : 'JSON ではなくHTML。.env.local に ERONATOR_VERCEL_PROTECTION_BYPASS（Vercel の Automation バイパス）を追加して dev 再起動。';
    } else {
      hint = `HTTP ${res.status}。本文の先頭を確認してください。`;
    }

    return NextResponse.json({
      success: true,
      probe,
      httpStatus: res.status,
      isHtml,
      hint,
      requestUrl,
      bodySnippet: text.slice(0, 400),
      vercelBypassConfigured: Boolean(getVercelProtectionBypassSecret()),
    });
  } catch (e) {
    console.error('[remote-admin-ping]', e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        hint: 'タイムアウトまたはネットワークエラー。URLが開けるかブラウザで確認してください。',
      },
      { status: 500 }
    );
  }
}
