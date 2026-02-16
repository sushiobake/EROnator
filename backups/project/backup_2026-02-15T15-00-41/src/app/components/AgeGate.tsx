/**
 * AGE_GATEコンポーネント
 * 年齢確認（最小限のUI）
 */

'use client';

interface AgeGateProps {
  onConfirm: () => void;
}

export function AgeGate({ onConfirm }: AgeGateProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem', fontWeight: 'bold' }}>
        成人向け同人誌の質問式レコメンド
      </h1>
      <div style={{ marginBottom: '2rem', fontSize: '0.9rem', color: '#666' }}>
        <a href="/contact" style={{ color: '#0070f3', textDecoration: 'underline' }}>
          お問い合わせ
        </a>
      </div>
      <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>年齢確認</h2>
      <p>このコンテンツは18歳以上の方を対象としています。</p>
      <p>あなたは18歳以上ですか？</p>
      <button
        onClick={onConfirm}
        style={{
          padding: '0.5rem 2rem',
          fontSize: '1rem',
          marginTop: '1rem',
          cursor: 'pointer',
        }}
      >
        はい（18歳以上）
      </button>
    </div>
  );
}
