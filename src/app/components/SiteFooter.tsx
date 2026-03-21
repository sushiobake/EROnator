import type { CSSProperties } from 'react';
import Link from 'next/link';

/** 全ページ下部の共通フッター（法務・連絡） */
export function SiteFooter() {
  const linkStyle: CSSProperties = {
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    fontSize: 13,
    whiteSpace: 'nowrap',
  };
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '12px 16px 20px',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px 16px',
      }}
    >
      <Link href="/privacy" style={linkStyle}>
        プライバシー
      </Link>
      <Link href="/terms" style={linkStyle}>
        利用規約
      </Link>
      <Link href="/affiliate" style={linkStyle}>
        アフィリエイトについて
      </Link>
      <Link href="/contact" style={linkStyle}>
        お問い合わせ
      </Link>
    </footer>
  );
}
