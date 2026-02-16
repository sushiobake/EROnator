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
  /** スマホ：さらに小さく（もう一度妄想する・Xでポスト横並び用） */
  compact?: boolean;
}

export function RestartButton({ onRestart, label = 'もう１度妄想する', inline = false, compact = false }: RestartButtonProps) {
  const isMobile = useMediaQuery(768);
  const useCompact = compact && isMobile;
  return (
    <div style={{ marginTop: inline ? 0 : isMobile ? 20 : 32, textAlign: inline ? 'left' : 'center' }}>
      <button
        onClick={onRestart}
        style={{
          padding: useCompact ? '8px 14px' : isMobile ? '12px 24px' : '14px 32px',
          minHeight: useCompact ? 36 : 48,
          fontSize: useCompact ? 12 : isMobile ? 14 : 16,
          cursor: 'pointer',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 'bold',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
        }}
      >
        {label}
      </button>
    </div>
  );
}
