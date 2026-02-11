/**
 * 外部リンクコンポーネント（PR表記付き）
 * Compliance/NFR: 外部リンクには必ずPR表記を表示
 */

'use client';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  linkText?: string; // 固定テンプレート（自動生成しない）
}

export function ExternalLink({ href, children, linkText }: ExternalLinkProps) {
  // AFFILIATE_IDは環境変数で分離（本番のみ本番ID）
  const affiliateId = process.env.NEXT_PUBLIC_AFFILIATE_ID || '';
  
  // アフィリエイトIDがある場合はURLに付与
  const url = affiliateId ? `${href}${href.includes('?') ? '&' : '?'}af_id=${affiliateId}` : href;

  return (
    <div style={{ margin: '0.5rem 0' }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#0066cc', textDecoration: 'underline' }}
      >
        {linkText || children}
      </a>
      <span style={{ marginLeft: '0.5rem', fontSize: '0.8em', color: '#666' }}>
        (PR)
      </span>
    </div>
  );
}
