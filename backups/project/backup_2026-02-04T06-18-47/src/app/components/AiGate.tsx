/**
 * AI_GATEコンポーネント
 * AI作品フィルタ選択（3択、アキネーター風レイアウト）
 */

'use client';

import { useState } from 'react';

interface AiGateProps {
  onSelect: (choice: 'YES' | 'NO' | 'DONT_CARE') => void;
}

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
      {/* メインコンテンツエリア - キャラクターと質問を相対配置 */}
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
        {/* 左側スペース（GameScreenLayout のキャラがここに表示される） */}
        <div
          style={{
            flex: '0 0 auto',
            width: '35%',
            maxWidth: '450px',
            minWidth: '300px',
            zIndex: 1,
          }}
          aria-hidden
        />

        {/* 質問と回答エリア - キャラクターの右側、少し右寄り */}
        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginLeft: '2rem',
          }}
        >
          {/* 質問吹き出し */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'stretch',
              marginBottom: '2rem',
            }}
          >
            {/* 質問テキスト - 白背景で清潔に */}
            <div
              style={{
                display: 'flex',
                minWidth: '260px',
                alignItems: 'center',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                padding: '1rem 1.5rem',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              }}
            >
              <p
                style={{
                  fontSize: '1.125rem',
                  fontWeight: '500',
                  color: '#1f2937',
                  margin: 0,
                }}
              >
                それはAI作品？
              </p>
            </div>
          </div>

          {/* 回答ボタン */}
          <div
            style={{
              marginLeft: '1rem',
              width: '100%',
              maxWidth: '320px',
              marginTop: '0.5rem',
            }}
          >
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
              {(['YES', 'NO', 'DONT_CARE'] as const).map((choice, index) => {
                const labels = { YES: 'はい', NO: 'いいえ', DONT_CARE: '気にしない' };
                const isFirst = index === 0;
                return (
                  <button
                    key={choice}
                    onClick={() => onSelect(choice)}
                    onMouseEnter={() => setHoveredChoice(choice)}
                    onMouseLeave={() => setHoveredChoice(null)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      padding: '0.875rem 1.5rem',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      backgroundColor: hoveredChoice === choice ? '#eff6ff' : '#fff',
                      color: hoveredChoice === choice ? '#111827' : '#374151',
                      border: 'none',
                      borderTop: !isFirst ? '1px solid #e5e7eb' : 'none',
                      transition: 'background-color 0.1s, color 0.1s',
                    }}
                  >
                    {labels[choice]}
                    {hoveredChoice === choice && (
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
