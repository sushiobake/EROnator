/**
 * 再利用可能な「もう１度妄想する」ボタンコンポーネント
 * どの結果画面でも使える
 */

'use client';

import { useMediaQuery } from './useMediaQuery';

interface RestartButtonProps {
  onRestart: () => void;
  label?: string;
  /** 横並びで使うときは true（余白・中央寄せなし） */
  inline?: boolean;
}

export function RestartButton({ onRestart, label = 'もう１度妄想する', inline = false }: RestartButtonProps) {
  const isMobile = useMediaQuery(768);
  return (
    <div style={{ marginTop: inline ? 0 : isMobile ? 20 : 32, textAlign: inline ? 'left' : 'center' }}>
      <button
        onClick={onRestart}
        style={{
          padding: isMobile ? '12px 24px' : '14px 32px',
          minHeight: 48,
          fontSize: isMobile ? 14 : 16,
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
