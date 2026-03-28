'use client';

import { useCallback, useState } from 'react';

type PingProbe = 'contact' | 'recommendPlayHistory';

type PingPayload = {
  success?: boolean;
  error?: string;
  hint?: string;
  probe?: string;
  httpStatus?: number;
  isHtml?: boolean;
  requestUrl?: string;
  bodySnippet?: string;
  vercelBypassConfigured?: boolean;
};

function formatResult(d: PingPayload, probe: PingProbe): string {
  const lines = [
    `probe: ${probe}`,
    `success: ${d.success ?? false}`,
    d.error ? `error: ${d.error}` : null,
    d.hint ? `hint: ${d.hint}` : null,
    `httpStatus: ${d.httpStatus ?? '?'}`,
    `isHtml: ${d.isHtml ? 'yes' : 'no'}`,
    `vercelBypassConfigured: ${d.vercelBypassConfigured ? 'yes' : 'no'}`,
    d.requestUrl ? `requestUrl: ${d.requestUrl}` : null,
    '',
    '--- body (first 400 chars) ---',
    d.bodySnippet ?? '(none)',
  ];
  return lines.filter(Boolean).join('\n');
}

export default function RemoteAdminDiagnosticPanel({
  adminToken,
  remoteDeploymentUrl,
  tokenForRemote,
}: {
  adminToken: string;
  remoteDeploymentUrl: string;
  /** リモート先に送る x-eronator-admin-token（本番用が空なら管理トークンと同じ） */
  tokenForRemote: string;
}) {
  const [loading, setLoading] = useState<PingProbe | null>(null);
  const [text, setText] = useState('（下のボタンで診断。ここに全文が出ます。コピー可）');

  const run = useCallback(
    async (probe: PingProbe) => {
      if (!adminToken.trim()) {
        setText('エラー: 上の「管理トークン」を入力してください。');
        return;
      }
      if (!remoteDeploymentUrl.trim()) {
        setText('エラー: 本番URL または プレビューURL を入力してください。');
        return;
      }
      if (!tokenForRemote.trim()) {
        setText('エラー: リモート用トークンがありません。管理トークンを入力してください。');
        return;
      }
      setLoading(probe);
      setText('実行中…');
      try {
        const r = await fetch('/api/admin/remote-admin-ping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-eronator-admin-token': adminToken,
          },
          body: JSON.stringify({
            targetUrl: remoteDeploymentUrl.trim(),
            token: tokenForRemote.trim(),
            probe,
          }),
        });
        const d = (await r.json()) as PingPayload;
        if (!r.ok) {
          setText(
            formatResult(
              { success: false, error: d.error ?? `HTTP ${r.status}`, hint: d.hint, ...d },
              probe
            )
          );
          return;
        }
        if (!d.success && d.error) {
          setText(formatResult({ ...d, success: false }, probe));
          return;
        }
        setText(formatResult(d, probe));
      } catch (e) {
        setText(`例外: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(null);
      }
    },
    [adminToken, remoteDeploymentUrl, tokenForRemote]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const disabled = !adminToken.trim() || !remoteDeploymentUrl.trim() || loading !== null;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void run('contact')}
          disabled={disabled}
          style={{
            padding: '0.45rem 0.9rem',
            fontSize: '0.9rem',
            backgroundColor: disabled ? '#ccc' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loading === 'contact' ? '確認中…' : '診断: お問い合わせAPI'}
        </button>
        <button
          type="button"
          onClick={() => void run('recommendPlayHistory')}
          disabled={disabled}
          style={{
            padding: '0.45rem 0.9rem',
            fontSize: '0.9rem',
            backgroundColor: disabled ? '#ccc' : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {loading === 'recommendPlayHistory' ? '確認中…' : '診断: 推薦プレイ履歴API'}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          style={{
            padding: '0.45rem 0.9rem',
            fontSize: '0.9rem',
            backgroundColor: '#0f766e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          結果をコピー
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.5rem 0 0.35rem' }}>
        ダイアログは使いません。下の枠をそのままコピーできます。本番は{' '}
        <code>https://eronator.vercel.app</code> のようにホストだけ（末尾の /api は付けない）。
      </p>
      <textarea
        readOnly
        value={text}
        spellCheck={false}
        style={{
          width: '100%',
          minHeight: '200px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.8rem',
          padding: '0.6rem',
          boxSizing: 'border-box',
          borderRadius: '6px',
          border: '1px solid #ccc',
          marginTop: '0.25rem',
        }}
      />
    </div>
  );
}
