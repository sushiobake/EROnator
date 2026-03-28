/**
 * 外部リンクコンポーネント（PR表記付き）
 * Compliance/NFR: 外部リンクには必ずPR表記を表示
 */

'use client';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  linkText?: string; // 固定テンプレート（自動生成しない）
  compact?: boolean; // 余白を小さく（カード内用）
  /** FANZAで見るリンク用：指定時はクリックを記録してから遷移 */
  sessionId?: string | null;
  /** 推薦モード用（PlayHistory とは別レコード） */
  recommendSessionId?: string | null;
  /** 推薦モードで「どの作品のFANZAか」を履歴に残す */
  recommendFanzaWorkId?: string | null;
}

export function ExternalLink({
  href,
  children,
  linkText,
  compact,
  sessionId,
  recommendSessionId,
  recommendFanzaWorkId,
}: ExternalLinkProps) {
  // AFFILIATE_IDは環境変数で分離（本番のみ本番ID）
  const affiliateId = process.env.NEXT_PUBLIC_AFFILIATE_ID || '';
  
  // アフィリエイトIDがある場合はURLに付与
  const url = affiliateId ? `${href}${href.includes('?') ? '&' : '?'}af_id=${affiliateId}` : href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (recommendSessionId) {
      e.preventDefault();
      fetch('/api/track-fanza-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendSessionId,
          ...(recommendFanzaWorkId ? { fanzaWorkId: recommendFanzaWorkId } : {}),
        }),
      }).catch(() => {});
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (sessionId) {
      e.preventDefault();
      fetch('/api/track-fanza-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const tracked = Boolean(recommendSessionId || sessionId);

  return (
    <div style={{ margin: compact ? '0' : '8px 0' }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={tracked ? handleClick : undefined}
        style={{ color: '#0066cc', textDecoration: 'underline', fontSize: compact ? 'inherit' : undefined }}
      >
        {linkText || children}
      </a>
      <span style={{ marginLeft: compact ? 4 : 8, fontSize: compact ? '0.75em' : '0.8em', color: '#666' }}>
        (PR)
      </span>
    </div>
  );
}
