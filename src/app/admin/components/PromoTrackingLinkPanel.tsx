'use client';

/**
 * 配布用トラッキング URL の組み立てと、配布先マスタの編集（このブラウザのローカルストレージに保存）。
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  getPostTemplatesForChannel,
  getPromoUtm,
  type PromoChannelDef,
} from '@/lib/promoChannelRegistry';
import { usePromoChannels } from '../context/PromoChannelsContext';

const HISTORY_KEY = 'eronator_promo_url_history_v1';
const HISTORY_MAX = 10;

interface HistoryEntry {
  id: string;
  url: string;
  channel: string;
  ct: string;
  utm: boolean;
  savedAt: string;
}

function safeLoadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is HistoryEntry => {
        if (!v || typeof v !== 'object') return false;
        const o = v as Record<string, unknown>;
        return typeof o.url === 'string' && typeof o.channel === 'string' && typeof o.savedAt === 'string';
      })
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function safeSaveHistory(list: HistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    /* ignore quota */
  }
}

const guideBox: CSSProperties = {
  margin: 0,
  padding: '1rem 1.1rem',
  background: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: 8,
  fontSize: '0.88rem',
  lineHeight: 1.65,
  color: '#0c4a6e',
};

const guideHeading: CSSProperties = {
  margin: '0 0 0.5rem 0',
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#075985',
};

const codeInline: CSSProperties = {
  background: '#e0f2fe',
  padding: '0.08rem 0.35rem',
  borderRadius: 4,
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.84em',
};

const sectionCard: CSSProperties = {
  padding: '0.75rem 0.9rem',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
};

const smallBtn: CSSProperties = {
  padding: '0.3rem 0.65rem',
  fontSize: '0.78rem',
  background: '#fff',
  border: '1px solid #94a3b8',
  borderRadius: 6,
  cursor: 'pointer',
};

const labelCol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontSize: '0.82rem',
};

const inputBase: CSSProperties = {
  padding: '0.4rem 0.5rem',
  fontSize: '0.86rem',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  width: '100%',
  boxSizing: 'border-box',
};

function PromoChannelMasterBlock(props: {
  channels: PromoChannelDef[];
  upsertChannel: (ch: PromoChannelDef) => void;
  removeChannel: (id: string) => void;
  resetToDefaults: () => void;
}) {
  const { channels, upsertChannel, removeChannel, resetToDefaults } = props;
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fid, setFid] = useState('');
  const [flabel, setFlabel] = useState('');
  const [fhint, setFhint] = useState('');
  const [fsns, setFsns] = useState('');
  const [futmS, setFutms] = useState('');
  const [futmM, setFutmm] = useState('');
  const [finherit, setFinherit] = useState('');
  const [fbody, setFbody] = useState('');
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setEditingId(null);
    setFid('');
    setFlabel('');
    setFhint('');
    setFsns('');
    setFutms('eronator');
    setFutmm('promo');
    setFinherit('');
    setFbody('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (ch: PromoChannelDef) => {
    setEditingId(ch.id);
    setFid(ch.id);
    setFlabel(ch.label);
    setFhint(ch.hint ?? '');
    setFsns(ch.snsName);
    setFutms(ch.utm.source);
    setFutmm(ch.utm.medium);
    setFinherit(ch.inheritTemplatesFrom ?? '');
    setFbody(ch.postTemplates?.[0]?.body ?? '');
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormError('');
  };

  const handleSave = () => {
    setFormError('');
    const idNorm = fid.trim().toLowerCase();
    if (!idNorm || idNorm.length > 32 || !/^[a-z0-9_-]+$/.test(idNorm)) {
      setFormError('識別子は 32 文字以内の英小文字・数字・ハイフン・アンダースコアのみにしてください。');
      return;
    }
    if (editingId == null && channels.some((c) => c.id.toLowerCase() === idNorm)) {
      setFormError('同じ識別子の配布先がすでにあります。');
      return;
    }
    if (editingId != null && editingId !== idNorm) {
      setFormError('識別子は編集では変更できません。');
      return;
    }
    const labelT = flabel.trim();
    const snsT = fsns.trim();
    if (!labelT || !snsT) {
      setFormError('表示名と流入用の短い名前は必須です。');
      return;
    }
    const us = futmS.trim();
    const um = futmM.trim();
    if (!us || !um) {
      setFormError('ＵＴＭの source / medium は必須です。');
      return;
    }
    const inh = finherit.trim().toLowerCase();
    const inheritOk =
      inh !== '' &&
      inh !== idNorm &&
      channels.some((c) => c.id.toLowerCase() === inh);

    const next: PromoChannelDef = {
      id: idNorm,
      label: labelT,
      snsName: snsT,
      utm: { source: us, medium: um },
      ...(fhint.trim() ? { hint: fhint.trim() } : {}),
      ...(inheritOk ? { inheritTemplatesFrom: inh } : {}),
    };
    if (!inheritOk && fbody.trim()) {
      next.postTemplates = [{ id: `${idNorm}-tpl`, label: 'カスタム', body: fbody.trim() }];
    }
    upsertChannel(next);
    closeForm();
  };

  const handleReset = () => {
    if (!confirm('配布先マスタをアプリ同梱の既定一覧に戻します。このブラウザに保存した上書きは消えます。よろしいですか？')) return;
    resetToDefaults();
    closeForm();
  };

  const inheritOptions = channels.filter((c) => c.id.toLowerCase() !== fid.trim().toLowerCase());

  return (
    <div style={{ ...sectionCard, marginBottom: '1rem', maxWidth: '1120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>配布先マスタの編集</strong>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={openCreate} style={{ ...smallBtn, fontWeight: 600, borderColor: '#0369a1', color: '#0369a1' }}>
            新規追加
          </button>
          <button type="button" onClick={handleReset} style={{ ...smallBtn, color: '#b45309', borderColor: '#fdba74', background: '#fffbeb' }}>
            既定に戻す
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.55 }}>
        ここで保存した一覧は<strong>このブラウザだけ</strong>に残ります。本番プレイ履歴の「流入」列の表示名とも共通です。別の端末では同じ内容にしたい場合は、手動で同じ設定を入れてください。
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>識別子（ｒ＝）</th>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>表示名</th>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>流入短名</th>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.4rem' }}>テンプレ流用</th>
              <th style={{ textAlign: 'right', padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.35rem 0.4rem', fontFamily: 'ui-monospace, monospace' }}>{ch.id}</td>
                <td style={{ padding: '0.35rem 0.4rem' }}>{ch.label}</td>
                <td style={{ padding: '0.35rem 0.4rem' }}>{ch.snsName}</td>
                <td style={{ padding: '0.35rem 0.4rem', color: ch.inheritTemplatesFrom ? '#0369a1' : '#94a3b8' }}>
                  {ch.inheritTemplatesFrom ?? '—'}
                </td>
                <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" onClick={() => openEdit(ch)} style={{ ...smallBtn, marginRight: '0.25rem' }}>
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (channels.length <= 1) {
                        alert('配布先は最低 1 件必要です。');
                        return;
                      }
                      if (!confirm(`「${ch.label}」（r=${ch.id}）を削除しますか？`)) return;
                      removeChannel(ch.id);
                      if (formOpen && editingId === ch.id) closeForm();
                    }}
                    style={{ ...smallBtn, color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.85rem',
            background: '#fff',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            display: 'grid',
            gap: '0.65rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          <div style={{ gridColumn: '1 / -1', fontWeight: 700, fontSize: '0.88rem', color: '#0c4a6e' }}>
            {editingId == null ? '新しい配布先' : `編集: ${editingId}`}
          </div>
          <label style={labelCol}>
            <span>識別子（ＵＲＬの ｒ＝ 。英小文字・数字・- と _ のみ）</span>
            <input
              style={inputBase}
              value={fid}
              onChange={(e) => setFid(e.target.value)}
              disabled={editingId != null}
              maxLength={32}
              placeholder="例: mysns"
            />
          </label>
          <label style={labelCol}>
            <span>セレクト用の表示名</span>
            <input style={inputBase} value={flabel} onChange={(e) => setFlabel(e.target.value)} placeholder="例: 私の掲示板" />
          </label>
          <label style={labelCol}>
            <span>ヒント（任意・セレクトの括弧内）</span>
            <input style={inputBase} value={fhint} onChange={(e) => setFhint(e.target.value)} placeholder="空なら r=識別子 と表示" />
          </label>
          <label style={labelCol}>
            <span>流入列の短い名前</span>
            <input style={inputBase} value={fsns} onChange={(e) => setFsns(e.target.value)} placeholder="例: 掲示板" />
          </label>
          <label style={labelCol}>
            <span>ＵＴＭ source</span>
            <input style={inputBase} value={futmS} onChange={(e) => setFutms(e.target.value)} />
          </label>
          <label style={labelCol}>
            <span>ＵＴＭ medium</span>
            <input style={inputBase} value={futmM} onChange={(e) => setFutmm(e.target.value)} />
          </label>
          <label style={{ ...labelCol, gridColumn: '1 / -1' }}>
            <span>投稿テンプレを別の配布先から流用（空なら流用なし）</span>
            <select style={inputBase} value={finherit} onChange={(e) => setFinherit(e.target.value)}>
              <option value="">（流用しない）</option>
              {inheritOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}（r={c.id}）
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...labelCol, gridColumn: '1 / -1' }}>
            <span>独自の投稿テンプレ本文（任意。流用を選んでいるときは無視されます。{'{url}'} を含めてください）</span>
            <textarea
              style={{ ...inputBase, minHeight: '88px', fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
              value={fbody}
              onChange={(e) => setFbody(e.target.value)}
              placeholder="空なら汎用の 1 行テンプレになります。"
            />
          </label>
          {formError ? (
            <div style={{ gridColumn: '1 / -1', color: '#b91c1c', fontSize: '0.8rem' }}>{formError}</div>
          ) : null}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                background: '#0369a1',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              保存
            </button>
            <button type="button" onClick={closeForm} style={{ ...smallBtn, padding: '0.45rem 0.85rem' }}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PromoTrackingLinkPanel() {
  const { channels, upsertChannel, removeChannel, resetToDefaults } = usePromoChannels();

  const defaultChannelId = useMemo(
    () => channels.find((c) => c.id === 'x')?.id ?? channels[0]?.id ?? 'x',
    [channels]
  );

  const [channel, setChannel] = useState<string>('x');
  const [campaign, setCampaign] = useState('');
  const [baseOverride, setBaseOverride] = useState('');
  const [includeUtm, setIncludeUtm] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'url' | 'template' | null>(null);
  const [templateId, setTemplateId] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setChannel((prev) => (channels.some((c) => c.id === prev) ? prev : defaultChannelId));
  }, [channels, defaultChannelId]);

  useEffect(() => {
    setHistory(safeLoadHistory());
  }, []);

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const raw = baseOverride.trim();
    if (!raw) return window.location.origin;
    try {
      const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
      return u.origin;
    } catch {
      return window.location.origin;
    }
  }, [baseOverride]);

  const templates = useMemo(() => getPostTemplatesForChannel(channel, channels), [channel, channels]);

  useEffect(() => {
    setTemplateId(templates[0]?.id ?? '');
  }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullUrl = useMemo(() => {
    if (!origin) return '';
    const q = new URLSearchParams();
    q.set('r', channel);
    const ct = campaign.trim();
    if (ct) q.set('ct', ct);
    if (includeUtm) {
      const u = getPromoUtm(channel, channels);
      q.set('utm_source', u.source);
      q.set('utm_medium', u.medium);
      if (ct) q.set('utm_campaign', ct);
    }
    return `${origin}/?${q.toString()}`;
  }, [origin, channel, campaign, includeUtm, channels]);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;
  const renderedTemplate = selectedTemplate
    ? selectedTemplate.body.replace(/\{url\}/g, fullUrl)
    : '';

  const ctSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of history) {
      const c = h.ct?.trim();
      if (!c) continue;
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      if (out.length >= 6) break;
    }
    return out;
  }, [history]);

  const qrImgUrl = fullUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(fullUrl)}`
    : '';

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const deduped = prev.filter((p) => p.url !== entry.url);
      const next = [entry, ...deduped].slice(0, HISTORY_MAX);
      safeSaveHistory(next);
      return next;
    });
  }, []);

  const markRecentEntry = () => {
    if (!fullUrl) return;
    pushHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: fullUrl,
      channel,
      ct: campaign.trim(),
      utm: includeUtm,
      savedAt: new Date().toISOString(),
    });
  };

  const handleCopyUrl = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedKind('url');
      window.setTimeout(() => setCopiedKind(null), 2000);
      markRecentEntry();
    } catch {
      /* ignore */
    }
  };

  const handleCopyTemplate = async () => {
    if (!renderedTemplate) return;
    try {
      await navigator.clipboard.writeText(renderedTemplate);
      setCopiedKind('template');
      window.setTimeout(() => setCopiedKind(null), 2000);
      markRecentEntry();
    } catch {
      /* ignore */
    }
  };

  const handleClearHistory = () => {
    if (!confirm('履歴をすべて削除しますか？（ブラウザのローカルストレージから消します）')) return;
    setHistory([]);
    safeSaveHistory([]);
  };

  const handleRestore = (entry: HistoryEntry) => {
    setChannel(entry.channel);
    setCampaign(entry.ct ?? '');
    setIncludeUtm(!!entry.utm);
  };

  const handleDeleteEntry = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((p) => p.id !== id);
      safeSaveHistory(next);
      return next;
    });
  };

  return (
    <section style={{ marginTop: '1rem', maxWidth: '1120px' }}>
      <h2 style={{ marginBottom: '0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>配布用トラッキングURL</h2>

      <PromoChannelMasterBlock
        channels={channels}
        upsertChannel={upsertChannel}
        removeChannel={removeChannel}
        resetToDefaults={resetToDefaults}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '1.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            flex: '1 1 340px',
            minWidth: 'min(100%, 300px)',
            maxWidth: '560px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <p style={{ color: '#666', margin: '0 0 0.25rem 0', fontSize: '0.9rem', lineHeight: 1.55 }}>
            SNS・掲示板・ブログなどに貼る URL を組み立てます。プレイ開始後、<strong>本番プレイ履歴</strong>の「流入」列に記録されます。
          </p>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem' }}>
            <span style={{ fontWeight: 600 }}>配布先</span>
            <select
              value={channels.some((c) => c.id === channel) ? channel : defaultChannelId}
              onChange={(e) => setChannel(e.target.value)}
              style={{ padding: '0.45rem 0.5rem', fontSize: '0.9rem', borderRadius: 6, border: '1px solid #ccc', width: '100%', maxWidth: '400px' }}
            >
              {!channels.some((c) => c.id === channel) && (
                <option value={channel}>r={channel}（マスタ未登録）</option>
              )}
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.label}（{ch.hint ?? `r=${ch.id}`}）
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem' }}>
            <span style={{ fontWeight: 600 }}>キャンペーンタグ（任意）</span>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>
              半角英数字・ハイフン・アンダースコアなどが扱いやすいです。空欄なら <code style={codeInline}>r</code> のみの URL になります。
            </span>
            <input
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="例: 202604a（空なら r のみ）"
              maxLength={128}
              style={{ padding: '0.45rem 0.5rem', fontSize: '0.9rem', borderRadius: 6, border: '1px solid #ccc', width: '100%' }}
            />
            {ctSuggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.1rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>過去の ct:</span>
                {ctSuggestions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCampaign(c)}
                    style={{ ...smallBtn, padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: '#334155' }}>
            <input
              type="checkbox"
              checked={includeUtm}
              onChange={(e) => setIncludeUtm(e.target.checked)}
            />
            <span>
              <strong>UTM も併記</strong>
              <span style={{ color: '#64748b', marginLeft: '0.35rem', fontSize: '0.78rem' }}>
                （utm_source/medium を自動。GA など外部計測を使う場合に ON）
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem' }}>
            <span style={{ fontWeight: 600 }}>サイトのオリジン（上級・任意）</span>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>
              空欄のときはこの画面のオリジン（{typeof window !== 'undefined' ? window.location.origin : '…'}）。本番用 URL を作るときは本番ドメインを入力。
            </span>
            <input
              type="text"
              value={baseOverride}
              onChange={(e) => setBaseOverride(e.target.value)}
              placeholder="https://eronator.app など"
              style={{ padding: '0.45rem 0.5rem', fontSize: '0.9rem', borderRadius: 6, border: '1px solid #ccc', width: '100%' }}
            />
          </label>

          <div
            style={{
              padding: '0.85rem 1rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              wordBreak: 'break-all',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.82rem',
              lineHeight: 1.45,
            }}
          >
            {fullUrl || '—'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void handleCopyUrl()}
              disabled={!fullUrl}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.9rem',
                backgroundColor: !fullUrl ? '#ccc' : '#0369a1',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: !fullUrl ? 'not-allowed' : 'pointer',
              }}
            >
              {copiedKind === 'url' ? 'コピーしました' : 'URLをコピー'}
            </button>
            {fullUrl && (
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...smallBtn,
                  textDecoration: 'none',
                  color: '#0369a1',
                  background: '#e0f2fe',
                  borderColor: '#7dd3fc',
                  fontWeight: 600,
                }}
              >
                新しいタブで開く
              </a>
            )}
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>コピーや新タブを押すと履歴に保存されます。</span>
          </div>

          <div style={{ ...sectionCard, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>投稿テンプレート</strong>
              <select
                value={selectedTemplate?.id ?? ''}
                onChange={(e) => setTemplateId(e.target.value)}
                style={{ padding: '0.25rem 0.45rem', fontSize: '0.82rem', borderRadius: 6, border: '1px solid #cbd5f5' }}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <textarea
              value={renderedTemplate}
              readOnly
              rows={Math.max(4, Math.min(9, renderedTemplate.split(/\r?\n/).length))}
              style={{
                width: '100%',
                padding: '0.55rem 0.7rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.82rem',
                lineHeight: 1.55,
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                background: '#fff',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void handleCopyTemplate()}
                disabled={!renderedTemplate}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.82rem',
                  backgroundColor: !renderedTemplate ? '#ccc' : '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: !renderedTemplate ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {copiedKind === 'template' ? 'コピーしました' : 'テンプレをコピー'}
              </button>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                X の 140 字前提に合わせた短め文面になっています。{'{url}'} は上の生成URLに置換済。
              </span>
            </div>
          </div>

          {qrImgUrl && (
            <div style={{ ...sectionCard, display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <img
                src={qrImgUrl}
                alt="生成 URL の QR コード"
                width={180}
                height={180}
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}
              />
              <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.55 }}>
                <strong style={{ color: '#0f172a' }}>QR コード</strong>
                <p style={{ margin: '0.25rem 0 0 0' }}>
                  イベントのチラシや配布カード、印刷物にそのまま貼れます。画像は <code style={codeInline}>api.qrserver.com</code> から都度生成されるので、保存したい場合は画像を右クリックでどうぞ。
                </p>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ ...sectionCard, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                  さいきん作った URL（{history.length}件・このブラウザのみ）
                </strong>
                <button type="button" onClick={handleClearHistory} style={{ ...smallBtn, padding: '0.2rem 0.55rem', fontSize: '0.72rem', color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2' }}>
                  すべて削除
                </button>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {history.map((h) => {
                  const chLabel = channels.find((c) => c.id === h.channel)?.label ?? h.channel;
                  const savedLabel = (() => {
                    try {
                      return new Date(h.savedAt).toLocaleString('ja-JP');
                    } catch {
                      return h.savedAt;
                    }
                  })();
                  return (
                    <li
                      key={h.id}
                      style={{
                        padding: '0.4rem 0.55rem',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.1rem 0.4rem',
                          borderRadius: 999,
                          background: '#e0f2fe',
                          color: '#075985',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                        }}
                      >
                        {chLabel}
                      </span>
                      {h.ct && (
                        <span style={{ color: '#475569' }}>ct=<code style={codeInline}>{h.ct}</code></span>
                      )}
                      {h.utm && (
                        <span style={{ color: '#0891b2', fontSize: '0.7rem' }}>+utm</span>
                      )}
                      <span
                        style={{
                          flex: '1 1 180px',
                          minWidth: '180px',
                          color: '#334155',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'ui-monospace, monospace',
                        }}
                        title={h.url}
                      >
                        {h.url}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{savedLabel}</span>
                      <button
                        type="button"
                        onClick={() => handleRestore(h)}
                        style={{ ...smallBtn, padding: '0.18rem 0.5rem', fontSize: '0.72rem' }}
                      >
                        この設定を呼び出す
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(h.id)}
                        style={{ ...smallBtn, padding: '0.18rem 0.45rem', fontSize: '0.72rem', color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2' }}
                        title="この履歴を削除"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <aside
          style={{
            flex: '1 1 320px',
            minWidth: 'min(100%, 280px)',
            maxWidth: '520px',
            position: 'relative',
          }}
        >
          <div style={{ position: 'sticky', top: '0.75rem' }}>
            <p
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.02em',
              }}
            >
              使い方・説明
            </p>
            <div style={guideBox}>
              <p style={guideHeading}>パラメータの意味（短く）</p>
              <ul style={{ margin: '0 0 0.85rem 1.1rem', padding: 0 }}>
                <li style={{ marginBottom: '0.35rem' }}>
                  <strong style={{ color: '#075985' }}>r</strong>（必須に相当）…「どの媒体・枠から来たか」の識別子です（例: X 一般は{' '}
                  <code style={codeInline}>r=x</code>、ci-en は <code style={codeInline}>r=c</code>）。
                </li>
                <li style={{ marginBottom: '0.35rem' }}>
                  <strong style={{ color: '#075985' }}>ct</strong>（任意）…「どの告知・キャンペーンか」を区別するタグです（例:{' '}
                  <code style={codeInline}>202604a</code>）。媒体（r）より細かい集計に使えます。
                </li>
                <li style={{ marginBottom: 0 }}>
                  <strong style={{ color: '#075985' }}>UTM 併記</strong>…GA など外部計測とも揃えたいときに ON。<code style={codeInline}>utm_source</code>/<code style={codeInline}>utm_medium</code> が自動で付きます（X→twitter、ci-en→ci-en、note→note 等）。
                </li>
              </ul>
              <p style={guideHeading}>配布先マスタについて</p>
              <ul style={{ margin: '0 0 0.85rem 1.1rem', padding: 0 }}>
                <li style={{ marginBottom: '0.35rem' }}>
                  画面上部の<strong>配布先マスタの編集</strong>で、識別子・表示名・流入用の短い名前・ＵＴＭなどを追加・変更できます。保存先はこのブラウザのローカルストレージです。
                </li>
                <li>
                  <strong>既定に戻す</strong>でアプリ同梱の初期一覧に戻せます。
                </li>
              </ul>
              <p style={guideHeading}>投稿テンプレートの使い方</p>
              <ul style={{ margin: '0 0 0.85rem 1.1rem', padding: 0 }}>
                <li style={{ marginBottom: '0.35rem' }}>
                  配布先を選ぶと、その媒体に合わせた<strong>下書きテンプレ</strong>が下に出ます。URL 部分は生成URLに置換済みなので、そのままコピペで投稿できます。
                </li>
                <li>
                  複数テンプレがある媒体（X）は右側のプルダウンで切り替え。A/B 検証用に「ct」を違うタグにして投稿文パターンを比べると、本番プレイ履歴の「流入」列で刺さった方が見えます。
                </li>
              </ul>
              <p style={guideHeading}>履歴と QR</p>
              <ul style={{ margin: '0 0 0.85rem 1.1rem', padding: 0 }}>
                <li style={{ marginBottom: '0.35rem' }}>
                  URL コピー／テンプレコピー／新タブ時に自動で<strong>この端末の履歴</strong>に入ります。直近 10 件までローカル保存。
                </li>
                <li>
                  QR は <code style={codeInline}>api.qrserver.com</code> から取得。イベント配布や印刷に使えます。
                </li>
              </ul>
              <p style={guideHeading}>管理画面での確認</p>
              <ul style={{ margin: '0 0 0 1.1rem', padding: 0 }}>
                <li>
                  <strong>本番プレイ履歴</strong>タブの「流入」列は、ここで編集したマスタと同じ名前で <code style={codeInline}>媒体名（r=…）</code> 形式になります。セルをホバーすると詳細が出ます。
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
