/**
 * 再利用可能な「もう１度妄想する」ボタンコンポーネント
 * どの結果画面でも使える
 */

'use client';

interface RestartButtonProps {
  onRestart: () => void;
  label?: string;
}

export function RestartButton({ onRestart, label = 'もう１度妄想する' }: RestartButtonProps) {
  return (
    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
      <button
        onClick={onRestart}
        style={{
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          cursor: 'pointer',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#0051cc';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#0070f3';
        }}
      >
        {label}
      </button>
    </div>
  );
}
