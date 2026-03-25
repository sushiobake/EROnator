/**
 * 推薦モード「有名タグ」40×3 コンフィグ編集（config/recommendFamousTags.json）
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

type ValidationPayload = {
  ok?: boolean;
  errors?: string[];
  warnings?: string[];
  lengths?: Record<string, number>;
  missingInDb?: Record<string, number>;
};

export default function RecommendFamousTagsTab({ adminToken }: { adminToken: string }) {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [previewLen, setPreviewLen] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    if (!adminToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/recommend-famous-tags', {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const d = await r.json();
      if (!d.success) {
        setMsg({ type: 'err', text: d.error || 'load failed' });
        return;
      }
      setValidation(d.validation ?? null);
      const file = d.file ?? {
        version: 1,
        useConfigSlots: true,
        slots: { ストーリー: [], プレイ: [], キャラクター: [] },
      };
      setRaw(JSON.stringify(file, null, 2));
      const prev = d.preview?.tags as Record<string, unknown[] | unknown> | undefined;
      if (prev && typeof prev === 'object') {
        const lens: Record<string, number> = {};
        for (const k of Object.keys(prev)) {
          const v = prev[k];
          lens[k] = Array.isArray(v) ? v.length : 0;
        }
        setPreviewLen(lens);
      } else {
        setPreviewLen(null);
      }
    } catch (e) {
      setMsg({ type: 'err', text: String(e) });
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!adminToken) return;
    setSaving(true);
    setMsg(null);
    try {
      const file = JSON.parse(raw) as unknown;
      const r = await fetch('/api/admin/recommend-famous-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ file }),
      });
      const d = await r.json();
      if (!d.success) {
        setMsg({
          type: 'err',
          text: (d.error || 'save failed') + (d.validation ? ` ${JSON.stringify(d.validation)}` : ''),
        });
        return;
      }
      setMsg({ type: 'ok', text: d.message || 'Saved' });
      setValidation(d.validation ?? null);
    } catch (e) {
      setMsg({ type: 'err', text: String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (!adminToken) {
    return (
      <section style={{ marginBottom: '2rem' }}>
        <p style={{ color: '#856404' }}>管理トークンを入力してください。</p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: '2rem', fontSize: '1rem', lineHeight: 1.6 }}>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>推薦・有名タグ（40×3）</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        <code>config/recommendFamousTags.json</code> を編集します。保存時に <code>.bak</code> を作成します。
        各カテゴリは必ず 40 件。空行は不可。DB に無い表示名は警告のみ（GET ではスキップされます）。
      </p>
      {msg && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: msg.type === 'ok' ? '#d4edda' : '#f8d7da',
            color: msg.type === 'ok' ? '#155724' : '#721c24',
            borderRadius: '4px',
          }}
        >
          {msg.text}
        </div>
      )}
      {validation && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          {validation.errors && validation.errors.length > 0 && (
            <div style={{ color: '#b71c1c' }}>
              <strong>errors</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem' }}>
                {validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {validation.warnings && validation.warnings.length > 0 && (
            <div style={{ color: '#856404', marginTop: '0.5rem' }}>
              <strong>warnings</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem' }}>
                {validation.warnings.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {validation.lengths && (
            <div style={{ marginTop: '0.5rem', color: '#333' }}>
              lengths: {JSON.stringify(validation.lengths)} / missingInDb:{' '}
              {JSON.stringify(validation.missingInDb)}
            </div>
          )}
        </div>
      )}
      {previewLen && (
        <p style={{ fontSize: '0.9rem', color: '#333', marginBottom: '0.5rem' }}>
          GET preview tag counts: {JSON.stringify(previewLen)}
        </p>
      )}
      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: '420px',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.85rem',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #ccc',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void load()}
              disabled={saving}
              style={{ padding: '0.5rem 1rem', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              再読み込み
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              style={{
                padding: '0.5rem 1.25rem',
                fontWeight: 600,
                backgroundColor: saving ? '#ccc' : '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
