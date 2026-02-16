/**
 * REVEAL（断定）画面
 * 右中央ホワイトボード内で「あなたが妄想した作品は……」＋ズバリ！／作品名・画像・作者／はい・いいえ。レイアウトは px。
 */

'use client';

import { useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

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
  const isMobile = useMediaQuery(768);

  return (
    <>
      <p style={{ fontSize: isMobile ? 16 : 15, color: 'var(--color-text-muted)', margin: '0 0 6px 0' }}>
        あなたが妄想した作品は……
      </p>
      <p style={{ fontSize: isMobile ? 18 : 18, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 12px 0' }}>
        ズバリ！コレ…でしょ！
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 10 : 20,
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexWrap: 'wrap',
          marginBottom: isMobile ? 16 : 24,
        }}
      >
        <img
          src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
          alt={work.title}
          style={{
            width: isMobile ? '100%' : 140,
            maxWidth: isMobile ? 200 : undefined,
            height: 'auto',
            objectFit: 'cover',
            borderRadius: 8,
            flexShrink: 0,
            alignSelf: isMobile ? 'center' : undefined,
          }}
        />
        <div>
          <h2 style={{ fontSize: isMobile ? 18 : 19, fontWeight: 'bold', color: 'var(--color-text)', margin: '0 0 4px 0', wordBreak: 'break-word' }}>
            {work.title}
          </h2>
          <p style={{ fontSize: isMobile ? 16 : 16, color: 'var(--color-text-muted)', margin: 0 }}>{work.authorName}</p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 10,
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
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
                padding: isMobile ? '8px 16px' : '8px 20px',
                minHeight: 40,
                textAlign: 'center',
                fontSize: isMobile ? 17 : 16,
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: hoveredChoice === choice ? '#dbeafe' : 'var(--color-surface)',
                color: hoveredChoice === choice ? 'var(--color-primary)' : 'var(--color-text-muted)',
                border: 'none',
                borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                boxShadow: hoveredChoice === choice ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s',
              }}
            >
              {labels[choice]}
              {hoveredChoice === choice && (
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--color-primary)' }}>
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
