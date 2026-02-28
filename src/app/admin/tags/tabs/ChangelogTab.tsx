/**
 * 更新履歴編集タブ
 */

'use client';

import { useState, useEffect } from 'react';

interface Props {
  adminToken: string;
}

export default function ChangelogTab({ adminToken }: Props) {
  const [appInfoVersion, setAppInfoVersion] = useState('');
  const [appInfoChangelog, setAppInfoChangelog] = useState<Array<{ date: string; text: string }>>([]);
  const [appInfoLoading, setAppInfoLoading] = useState(false);
  const [appInfoSaving, setAppInfoSaving] = useState(false);
  const [appInfoMessage, setAppInfoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    setAppInfoLoading(true);
    setAppInfoMessage(null);
    fetch('/api/admin/app-info', { headers: { 'x-eronator-admin-token': adminToken } })
      .then((res) => res.json())
      .then((data) => {
        setAppInfoVersion(data.version ?? '');
        setAppInfoChangelog(data.changelog ?? []);
      })
      .catch(() => setAppInfoMessage({ type: 'error', text: '取得に失敗しました' }))
      .finally(() => setAppInfoLoading(false));
  }, [adminToken]);

  return (
    <section style={{ marginTop: '1rem' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>更新履歴編集</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        トップ画面に表示するバージョン情報と更新履歴を編集できます。保存すると config/appInfo.json に反映されます。
      </p>
      {appInfoMessage && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: appInfoMessage.type === 'success' ? '#d4edda' : '#f8d7da',
            color: appInfoMessage.type === 'success' ? '#155724' : '#721c24',
            borderRadius: '4px',
          }}
        >
          {appInfoMessage.text}
        </div>
      )}
      {appInfoLoading ? (
        <p>読み込み中...</p>
      ) : (
        <div style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              バージョン表示
            </label>
            <input
              type="text"
              value={appInfoVersion}
              onChange={(e) => setAppInfoVersion(e.target.value)}
              placeholder="ERONATOR β (v0.91)"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              更新履歴（日付・本文。新しいほど上に表示。追加は最上位に挿入）
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {appInfoChangelog.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <input
                    type="text"
                    value={entry.date}
                    onChange={(e) => {
                      const next = [...appInfoChangelog];
                      next[i] = { ...next[i], date: e.target.value };
                      setAppInfoChangelog(next);
                    }}
                    placeholder="2026-02-19"
                    style={{
                      width: 120,
                      flexShrink: 0,
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.9rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                    }}
                  />
                  <textarea
                    value={entry.text}
                    onChange={(e) => {
                      const next = [...appInfoChangelog];
                      next[i] = { ...next[i], text: e.target.value };
                      setAppInfoChangelog(next);
                    }}
                    placeholder="更新内容（複数行可）"
                    rows={2}
                    style={{
                      flex: 1,
                      minHeight: 52,
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.9rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      resize: 'vertical',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setAppInfoChangelog(appInfoChangelog.filter((_, j) => j !== i))}
                    style={{
                      padding: '0.4rem 0.6rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAppInfoChangelog([{ date: new Date().toISOString().split('T')[0], text: '' }, ...appInfoChangelog])}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  alignSelf: 'flex-start',
                }}
              >
                + 行を追加
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!adminToken) return;
              setAppInfoSaving(true);
              setAppInfoMessage(null);
              try {
                const res = await fetch('/api/admin/app-info', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-eronator-admin-token': adminToken,
                  },
                  body: JSON.stringify({
                    version: appInfoVersion,
                    changelog: appInfoChangelog.filter((e) => e.date.trim() || e.text.trim()),
                  }),
                });
                const data = await res.json();
                if (res.ok && data.success) {
                  setAppInfoMessage({ type: 'success', text: '保存しました' });
                } else {
                  setAppInfoMessage({ type: 'error', text: data.error || '保存に失敗しました' });
                }
              } catch {
                setAppInfoMessage({ type: 'error', text: '保存に失敗しました' });
              } finally {
                setAppInfoSaving(false);
              }
            }}
            disabled={appInfoSaving}
            style={{
              padding: '0.6rem 1.5rem',
              backgroundColor: appInfoSaving ? '#ccc' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: appInfoSaving ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {appInfoSaving ? '保存中...' : '保存'}
          </button>
        </div>
      )}
    </section>
  );
}
