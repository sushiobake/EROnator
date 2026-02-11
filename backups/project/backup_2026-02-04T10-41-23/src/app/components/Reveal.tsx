/**
 * REVEAL（断定）画面
 * 「あなたが妄想した作品は……」＋「ズバリ！コレ…でしょ！」／作品名・画像・作者／はい・いいえ（FANZAリンクは削除）
 */

'use client';

import { useState } from 'react';
import { CONTENT_OFFSET_LEFT_PX } from './gameLayoutConstants';

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
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '2rem',
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
          maxWidth: '800px',
        }}
      >
        <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>
          あなたが妄想した作品は……
        </p>
        <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', margin: '0 0 1rem 0' }}>
          ズバリ！コレ…でしょ！
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          <img
            src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
            alt={work.title}
            style={{
              width: '140px',
              height: 'auto',
              objectFit: 'cover',
              borderRadius: '8px',
              flexShrink: 0,
            }}
          />
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1f2937', margin: '0 0 0.25rem 0' }}>
              {work.title}
            </h2>
            <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>{work.authorName}</p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '10px',
            border: '1px solid #d1d5db',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            width: '100%',
            maxWidth: '320px',
          }}
        >
          {(['YES', 'NO'] as const).map((choice, index) => {
            const labels = { YES: 'はい', NO: 'いいえ' };
            const isFirst = index === 0;
            return (
              <button
                key={choice}
                onClick={() => onAnswer(choice)}
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
  );
}
