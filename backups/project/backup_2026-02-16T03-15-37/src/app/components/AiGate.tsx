/**
 * AI_GATEコンポーネント
 * 右中央ホワイトボード内で「あなたが妄想した作品は……」＋AI生成作品選択（3択）。レイアウトは px。
 */

'use client';

import { useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

const AI_GATE_OPTIONS: { value: 'NO' | 'YES' | 'DONT_CARE'; label: string }[] = [
  { value: 'NO', label: 'AI生成作品ではない' },
  { value: 'YES', label: 'AI生成作品だ' },
  { value: 'DONT_CARE', label: 'どちらでも構わない' },
];

interface AiGateProps {
  onSelect: (choice: 'YES' | 'NO' | 'DONT_CARE') => void;
}

export function AiGate({ onSelect }: AiGateProps) {
  const [hoveredChoice, setHoveredChoice] = useState<string | null>(null);
  const isMobile = useMediaQuery(768);

  return (
    <>
      <p style={{ fontSize: isMobile ? 16 : 15, color: 'var(--color-text-muted)', margin: '0 0 6px 0' }}>
        あなたが妄想した作品は……
      </p>
      <div style={{ marginBottom: isMobile ? 20 : 32 }}>
        <div
          style={{
            display: 'flex',
            minWidth: 260,
            alignItems: 'center',
            border: '1px solid #e5e7eb',
            backgroundColor: '#fafafa',
            padding: isMobile ? '12px 16px' : '16px 24px',
            borderRadius: 8,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <p style={{ fontSize: isMobile ? 18 : 18, fontWeight: 500, color: 'var(--color-text)', margin: 0 }}>
            AI生成作品ではない？
          </p>
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 320, marginTop: 8 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {AI_GATE_OPTIONS.map(({ value, label }, index) => (
            <button
              key={value}
              onClick={() => onSelect(value)}
              onMouseEnter={() => setHoveredChoice(value)}
              onMouseLeave={() => setHoveredChoice(null)}
              style={{
                position: 'relative',
                width: '100%',
                padding: isMobile ? '8px 16px' : '8px 20px',
                minHeight: 40,
                textAlign: 'center',
                fontSize: isMobile ? 17 : 16,
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: hoveredChoice === value ? '#dbeafe' : 'var(--color-surface)',
                color: hoveredChoice === value ? 'var(--color-primary)' : 'var(--color-text-muted)',
                border: 'none',
                borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                boxShadow: hoveredChoice === value ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s',
              }}
            >
              {label}
              {hoveredChoice === value && (
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--color-primary)' }}>
                  &gt;&gt;
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
