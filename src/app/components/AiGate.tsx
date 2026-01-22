/**
 * AI_GATEコンポーネント
 * AI作品フィルタ選択（3択）
 */

'use client';

interface AiGateProps {
  onSelect: (choice: 'YES' | 'NO' | 'DONT_CARE') => void;
}

export function AiGate({ onSelect }: AiGateProps) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>それはAI作品？</h1>
      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={() => onSelect('YES')}
          style={{
            display: 'block',
            width: '200px',
            margin: '0.5rem auto',
            padding: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          はい
        </button>
        <button
          onClick={() => onSelect('NO')}
          style={{
            display: 'block',
            width: '200px',
            margin: '0.5rem auto',
            padding: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          いいえ
        </button>
        <button
          onClick={() => onSelect('DONT_CARE')}
          style={{
            display: 'block',
            width: '200px',
            margin: '0.5rem auto',
            padding: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          気にしない
        </button>
      </div>
    </div>
  );
}
