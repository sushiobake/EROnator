'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>エラーが発生しました</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', maxWidth: 400 }}>
        しばらくしてから再度お試しください。
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          再試行
        </button>
        <a
          href="/"
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          トップへ
        </a>
      </div>
    </div>
  );
}
