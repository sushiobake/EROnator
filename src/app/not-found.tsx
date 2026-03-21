import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>ページが見つかりません</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>URL をご確認ください。</p>
      <Link
        href="/"
        style={{
          color: '#fff',
          backgroundColor: 'var(--color-primary)',
          padding: '10px 20px',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        トップへ
      </Link>
    </div>
  );
}
