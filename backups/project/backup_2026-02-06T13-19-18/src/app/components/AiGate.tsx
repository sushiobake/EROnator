/**
 * AI_GATEコンポーネント
 * 右中央ホワイトボード内で「あなたが妄想した作品は……」＋AI生成作品選択（3択）。レイアウトは px。
 */

'use client';

import { useState } from 'react';

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

  return (
    <>
      <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 8px 0' }}>
        あなたが妄想した作品は……
      </p>
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            minWidth: 260,
            alignItems: 'center',
            border: '1px solid #e5e7eb',
            backgroundColor: '#fafafa',
            padding: '16px 24px',
            borderRadius: 8,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 500, color: '#1f2937', margin: 0 }}>
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
            border: '1px solid #d1d5db',
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
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
                padding: '14px 24px',
                textAlign: 'center',
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: hoveredChoice === value ? '#eff6ff' : '#fff',
                color: hoveredChoice === value ? '#111827' : '#374151',
                border: 'none',
                borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                transition: 'background-color 0.1s, color 0.1s',
              }}
            >
              {label}
              {hoveredChoice === value && (
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#6b7280' }}>
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
