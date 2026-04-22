'use client';

/**
 * SNS 等への配布用トラッキング URL（?r= / &ct= / 任意 UTM）を組み立てる管理画面用パネル。
 * - 投稿テンプレート自動生成（X / ci-en / note / 汎用）
 * - 直近で作った URL の履歴（localStorage）＋ ct プリセット
 * - QR コード生成（外部 API を <img> で読むだけ）
 * - 新しいタブで開くボタン
 * - UTM 併記モード（twitter/ci-en/note/pommu/5ch へマッピング）
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type ChannelId = 'c' | 'p' | 'x' | 'x1' | 'x2' | 'n' | '5ch';

const CHANNELS: Array<{ id: ChannelId; label: string; hint?: string }> = [
  { id: 'c', label: 'ci-en', hint: 'r=c' },
  { id: 'p', label: 'pommu', hint: 'r=p' },
  { id: 'x', label: 'X（一般）', hint: 'r=x' },
  { id: 'x1', label: 'X（キャンペーン枠1）', hint: 'r=x1' },
  { id: 'x2', label: 'X（キャンペーン枠2）', hint: 'r=x2' },
  { id: 'n', label: 'note', hint: 'r=n' },
  { id: '5ch', label: '5ch', hint: 'r=5ch' },
];

// r コード → UTM source/medium のマッピング
const UTM_MAP: Record<ChannelId, { source: string; medium: string }> = {
  c:  { source: 'ci-en',  medium: 'blog' },
  p:  { source: 'pommu',  medium: 'community' },
  x:  { source: 'twitter', medium: 'sns' },
  x1: { source: 'twitter', medium: 'sns' },
  x2: { source: 'twitter', medium: 'sns' },
  n:  { source: 'note',   medium: 'blog' },
  '5ch': { source: '5ch', medium: 'forum' },
};

// 投稿テンプレート。{url} を生成 URL に置換する
interface PostTemplate {
  id: string;
  label: string;
  body: string;
}

const POST_TEMPLATES: Record<ChannelId | 'generic', PostTemplate[]> = {
  x: [
    {
      id: 'x-standard',
      label: '標準フック（140字前後）',
      body: '【同人誌クイズ】あなたが頭に思い浮かべた同人誌、エロネイターが30問以内に当ててみせる🔮\n#エロネイター #同人誌\n{url}',
    },
    {
      id: 'x-challenge',
      label: '挑戦状タイプ',
      body: 'エロネイターを困らせろ選手権。外せば君の勝ち。\n30問までに同人誌を当てます。\n#エロネイター\n{url}',
    },
    {
      id: 'x-result',
      label: '結果シェア想定',
      body: '妄想した同人誌、AI にバレた…\nあなたも試してみる？\n#エロネイター\n{url}',
    },
  ],
  x1: [],
  x2: [],
  c: [
    {
      id: 'cien-intro',
      label: '記事用（挨拶あり）',
      body: 'こんにちは、エロネイターです🔮\n\nあなたが頭に思い浮かべた同人誌を、30問以内に当ててみせます。\n遊んでみた感想や「これも当ててほしい！」というお題を、ぜひコメントで教えてください。\n\n▼ プレイはこちら\n{url}',
    },
    {
      id: 'cien-short',
      label: '短文・お知らせ用',
      body: '【更新情報】エロネイター、今週も質問チューニング中です。\n30問以内でどれだけ当てられるか試してもらえると嬉しいです。\n\n{url}',
    },
  ],
  p: [
    {
      id: 'pommu-generic',
      label: '一般告知用',
      body: 'エロネイターで「妄想した同人誌」を当ててもらうゲーム、公開しています。\n30問以内に当てる／外すの二択、気軽に一度遊んでみてください。\n\n{url}',
    },
  ],
  n: [
    {
      id: 'note-lead',
      label: 'note 記事リード用',
      body: 'あなたが頭に浮かべた同人誌、AI が 30 問で当てます\n— エロネイター\n\n▼ 遊べる場所\n{url}\n',
    },
  ],
  '5ch': [
    {
      id: '5ch-minimal',
      label: '最小文体（慎重に）',
      body: '同人誌当てるAIみたいなのがあったので貼っとく\n30問以内で当てるってやつ\n{url}',
    },
  ],
  generic: [
    {
      id: 'generic-plain',
      label: '汎用 1 行',
      body: '同人誌当てAI「エロネイター」: {url}',
    },
  ],
};

const HISTORY_KEY = 'eronator_promo_url_history_v1';
const HISTORY_MAX = 10;

interface HistoryEntry {
  id: string;
  url: string;
  channel: ChannelId;
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

export function PromoTrackingLinkPanel() {
  const [channel, setChannel] = useState<ChannelId>('x');
  const [campaign, setCampaign] = useState('');
  const [baseOverride, setBaseOverride] = useState('');
  const [includeUtm, setIncludeUtm] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'url' | 'template' | null>(null);
  const [templateId, setTemplateId] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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

  // X の x1/x2 は x と同じテンプレ一覧を流用する
  const effectiveTemplatesKey: ChannelId | 'generic' = (() => {
    if (channel === 'x1' || channel === 'x2') return 'x';
    return channel;
  })();
  const channelTemplates = POST_TEMPLATES[effectiveTemplatesKey] ?? [];
  const templates = channelTemplates.length > 0 ? channelTemplates : POST_TEMPLATES.generic;

  // チャネル変更時はテンプレを先頭にリセット
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
      const u = UTM_MAP[channel];
      q.set('utm_source', u.source);
      q.set('utm_medium', u.medium);
      if (ct) q.set('utm_campaign', ct);
    }
    return `${origin}/?${q.toString()}`;
  }, [origin, channel, campaign, includeUtm]);

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

  const pushHistory = (entry: HistoryEntry) => {
    setHistory((prev) => {
      const deduped = prev.filter((p) => p.url !== entry.url);
      const next = [entry, ...deduped].slice(0, HISTORY_MAX);
      safeSaveHistory(next);
      return next;
    });
  };

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

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '1.75rem',
          flexWrap: 'wrap',
        }}
      >
        {/* 左: 作業エリア */}
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

          {/* 基本設定 */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem' }}>
            <span style={{ fontWeight: 600 }}>配布先</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelId)}
              style={{ padding: '0.45rem 0.5rem', fontSize: '0.9rem', borderRadius: 6, border: '1px solid #ccc', width: '100%', maxWidth: '400px' }}
            >
              {CHANNELS.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.label}（{ch.hint}）
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

          {/* 生成URL 表示＆コピー／新タブ */}
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

          {/* 投稿テンプレート */}
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

          {/* QR コード */}
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

          {/* 過去の生成履歴 */}
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
                  const chLabel = CHANNELS.find((c) => c.id === h.channel)?.label ?? h.channel;
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

        {/* 右: 使い方・説明 */}
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
                  <strong>本番プレイ履歴</strong>タブの「流入」列に、r= や UTM から解決した媒体名が入ります。セルをホバーすると詳細が出ます。
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
