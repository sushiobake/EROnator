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
    <div style={{ marginTop: 32, textAlign: 'center' }}>
      <button
        onClick={onRestart}
        style={{
          padding: '12px 32px',
          fontSize: 16,
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
