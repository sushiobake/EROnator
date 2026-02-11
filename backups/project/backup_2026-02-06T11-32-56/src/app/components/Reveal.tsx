/**
 * REVEAL（断定）画面
 * 右中央ホワイトボード内で「あなたが妄想した作品は……」＋ズバリ！／作品名・画像・作者／はい・いいえ。レイアウトは px。
 */

'use client';

import { useState } from 'react';

interface RevealProps {
  work: {
    workId: string;
    title: string;
    authorName: string;
    productUrl: string;
    thumbnailUrl?: string | null;
  };
  onAnswer: (answer: 'YES' | 'NO') => void;
}

export function Reveal({ work, onAnswer }: RevealProps) {
  const [hoveredChoice, setHoveredChoice] = useState<string | null>(null);

  return (
    <>
      <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 8px 0' }}>
        あなたが妄想した作品は……
      </p>
      <p style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', margin: '0 0 16px 0' }}>
        ズバリ！コレ…でしょ！
      </p>
      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <img
          src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
          alt={work.title}
          style={{
            width: 140,
            height: 'auto',
            objectFit: 'cover',
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 'bold', color: '#1f2937', margin: '0 0 4px 0' }}>
            {work.title}
          </h2>
          <p style={{ fontSize: 16, color: '#6b7280', margin: 0 }}>{work.authorName}</p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 10,
          border: '1px solid #d1d5db',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: 320,
        }}
      >
        {(['YES', 'NO'] as const).map((choice, index) => {
          const labels = { YES: 'はい', NO: 'いいえ' };
          return (
            <button
              key={choice}
              onClick={() => onAnswer(choice)}
              onMouseEnter={() => setHoveredChoice(choice)}
              onMouseLeave={() => setHoveredChoice(null)}
              style={{
                position: 'relative',
                width: '100%',
                padding: '14px 24px',
                textAlign: 'center',
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: hoveredChoice === choice ? '#eff6ff' : '#fff',
                color: hoveredChoice === choice ? '#111827' : '#374151',
                border: 'none',
                borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                transition: 'background-color 0.1s, color 0.1s',
              }}
            >
              {labels[choice]}
              {hoveredChoice === choice && (
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#6b7280' }}>
                  &gt;&gt;
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
