'use client';

/**
 * SNS 等への配布用トラッキング URL（?r= / &ct=）を組み立てる管理画面用パネル
 */

import { useMemo, useState, type CSSProperties } from 'react';

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

export function PromoTrackingLinkPanel() {
  const [channel, setChannel] = useState<ChannelId>('x');
  const [campaign, setCampaign] = useState('');
  const [baseOverride, setBaseOverride] = useState('');
  const [copied, setCopied] = useState(false);

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

  const fullUrl = useMemo(() => {
    if (!origin) return '';
    const q = new URLSearchParams();
    q.set('r', channel);
    const ct = campaign.trim();
    if (ct) q.set('ct', ct);
    return `${origin}/?${q.toString()}`;
  }, [origin, channel, campaign]);

  const handleCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
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
        {/* 左: 作業エリア（URL 生成） */}
        <div
          style={{
            flex: '1 1 300px',
            minWidth: 'min(100%, 280px)',
            maxWidth: '520px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <p style={{ color: '#666', margin: '0 0 0.25rem 0', fontSize: '0.9rem', lineHeight: 1.55 }}>
            SNS・掲示板・ブログなどに貼る URL を、次の各項目で組み立てます。プレイ開始後に<strong>本番プレイ履歴</strong>へ記録されます。
          </p>

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void handleCopy()}
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
              {copied ? 'コピーしました' : 'URLをコピー'}
            </button>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>コピーして投稿に貼り付け。</span>
          </div>
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
          <div
            style={{
              position: 'sticky',
              top: '0.75rem',
            }}
          >
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
                <li style={{ marginBottom: 0 }}>
                  <strong style={{ color: '#075985' }}>ct</strong>（任意）…「どの告知・キャンペーンか」を区別するタグです（例:{' '}
                  <code style={codeInline}>202604a</code>）。媒体（r）より細かい集計に使えます。
                </li>
              </ul>
              <p style={guideHeading}>使い方（手順）</p>
              <ol style={{ margin: '0 0 0.85rem 1.1rem', padding: 0 }}>
                <li style={{ marginBottom: '0.4rem' }}>
                  左の<strong>配布先</strong>で、投稿する場所に合う項目を選びます。X で告知ごとに分けたい場合は「キャンペーン枠1（x1）」「枠2（x2）」などを使い分けてください。
                </li>
                <li style={{ marginBottom: '0.4rem' }}>
                  <strong>キャンペーンタグ</strong>に、社内で通じる短い名前（英数字・ハイフン推奨）を入れると、同じ媒体でも投稿ごとに区別しやすくなります。不要なら空欄のままで構いません。
                </li>
                <li style={{ marginBottom: '0.4rem' }}>
                  左に表示された URL を<strong>そのまま</strong>投稿文に貼ります（短縮 URL サービスで別 URL に置き換えると、計測が追えなくなることがあります）。
                </li>
                <li style={{ marginBottom: '0.4rem' }}>
                  <strong>URLをコピー</strong>を押してクリップボードに入れ、SNS の投稿欄や固定ページに貼り付けます。
                </li>
                <li>
                  公開サイトのドメインがローカルと違うときだけ、左の<strong>サイトのオリジン</strong>に本番のトップ URL（例:{' '}
                  <code style={codeInline}>https://eronator.app</code>）を入れてください。空欄なら、今この管理画面を開いているサイトのオリジンが使われます。
                </li>
              </ol>
              <p style={guideHeading}>管理画面での確認</p>
              <ul style={{ margin: '0 0 0.85rem 1.1rem', padding: 0 }}>
                <li style={{ marginBottom: '0.35rem' }}>
                  <strong>本番プレイ履歴</strong>タブの一覧で、日時の下の<strong>参照元</strong>行に「計測（短縮）：…」のように表示され、<strong>★SNS</strong>列にはチャネル名（X ならセルは「X」、ホバーでバリアントや ct の詳細）が出ます。
                </li>
                <li style={{ marginBottom: 0 }}>
                  ユーザーがトップ以外のページを経由してからプレイを始めても、初回に付いた <code style={codeInline}>r</code> / <code style={codeInline}>ct</code> はセッション中に保持される想定です（サイト内でクエリが消えても記録されます）。
                </li>
              </ul>
              <p style={{ ...guideHeading, marginBottom: '0.35rem' }}>UTM パラメータとの関係</p>
              <p style={{ margin: 0 }}>
                リンクに <code style={codeInline}>utm_source</code> なども付けた場合、表示の優先は <strong>r が先</strong>です。既存の UTM 運用と併用できますが、主に SNS 短縮計測は <code style={codeInline}>r</code> / <code style={codeInline}>ct</code> を使う想定です。
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
