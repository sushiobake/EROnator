/**
 * AI_GATEコンポーネント
 * AI作品フィルタ選択（3択）
 * 文言: 「あなたが妄想した作品は……」＋「AI生成作品ではない？」／選択肢順: ではない→だ→どちらでも
 */

'use client';

import { useState } from 'react';
import { CONTENT_OFFSET_LEFT_PX } from './gameLayoutConstants';

interface AiGateProps {
  onSelect: (choice: 'YES' | 'NO' | 'DONT_CARE') => void;
}

// 表示順: 1. AI生成作品ではない → API NO, 2. AI生成作品だ → API YES, 3. どちらでも構わない → DONT_CARE
const AI_GATE_OPTIONS: { value: 'NO' | 'YES' | 'DONT_CARE'; label: string }[] = [
  { value: 'NO', label: 'AI生成作品ではない' },
  { value: 'YES', label: 'AI生成作品だ' },
  { value: 'DONT_CARE', label: 'どちらでも構わない' },
];

export function AiGate({ onSelect }: AiGateProps) {
  const [hoveredChoice, setHoveredChoice] = useState<string | null>(null);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          maxWidth: '1400px',
          gap: '3rem',
          position: 'relative',
        }}
      >
        <div
          style={{
            flex: '0 0 auto',
            width: CONTENT_OFFSET_LEFT_PX,
            zIndex: 1,
          }}
          aria-hidden
        />

        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginLeft: 0,
          }}
        >
          {/* 共通表示: あなたが妄想した作品は……（小さめ） */}
          <p
            style={{
              fontSize: '0.95rem',
              color: '#6b7280',
              margin: '0 0 0.5rem 0',
            }}
          >
            あなたが妄想した作品は……
          </p>

          {/* 質問吹き出し */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'stretch',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                minWidth: '260px',
                alignItems: 'center',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                padding: '1rem 1.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              }}
            >
              <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#1f2937', margin: 0 }}>
                AI生成作品ではない？
              </p>
            </div>
          </div>

          {/* 回答ボタン（順序: ではない → だ → どちらでも） */}
          <div style={{ marginLeft: '1rem', width: '100%', maxWidth: '320px', marginTop: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              {AI_GATE_OPTIONS.map(({ value, label }, index) => {
                const isFirst = index === 0;
                return (
                  <button
                    key={value}
                    onClick={() => onSelect(value)}
                    onMouseEnter={() => setHoveredChoice(value)}
                    onMouseLeave={() => setHoveredChoice(null)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      padding: '0.875rem 1.5rem',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      backgroundColor: hoveredChoice === value ? '#eff6ff' : '#fff',
                      color: hoveredChoice === value ? '#111827' : '#374151',
                      border: 'none',
                      borderTop: !isFirst ? '1px solid #e5e7eb' : 'none',
                      transition: 'background-color 0.1s, color 0.1s',
                    }}
                  >
                    {label}
                    {hoveredChoice === value && (
                      <span
                        style={{
                          position: 'absolute',
                          right: '1rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '1rem',
                          color: '#6b7280',
                        }}
                      >
                        &gt;&gt;
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
