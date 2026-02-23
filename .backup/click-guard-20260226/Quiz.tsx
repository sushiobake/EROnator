/**
 * QUIZコンポーネント
 * 右中央ホワイトボード内で質問＋6択。レイアウトは px。
 */

'use client';

import { useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

interface QuizProps {
  question: {
    kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';
    displayText: string;
  };
  questionCount: number;
  onAnswer: (choice: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

const ANSWER_CHOICES = [
  { value: 'YES', label: 'はい' },
  { value: 'PROBABLY_YES', label: 'たぶんそう' },
  { value: 'UNKNOWN', label: 'わからない' },
  { value: 'PROBABLY_NO', label: 'たぶん違う' },
  { value: 'NO', label: 'いいえ' },
  { value: 'DONT_CARE', label: 'どっちでもいい' },
] as const;

export function Quiz({ question, questionCount, onAnswer, onBack, canGoBack }: QuizProps) {
  const [hoveredChoice, setHoveredChoice] = useState<string | null>(null);
  const isMobile = useMediaQuery(768);

  return (
    <>
      <div style={{ width: '100%', maxWidth: 320 }}>
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
          {ANSWER_CHOICES.map((choice, index) => (
            <button
              key={choice.value}
              onClick={() => onAnswer(choice.value)}
              onMouseEnter={() => setHoveredChoice(choice.value)}
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
                backgroundColor: hoveredChoice === choice.value ? '#dbeafe' : 'var(--color-surface)',
                color: hoveredChoice === choice.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
                border: 'none',
                borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                boxShadow: hoveredChoice === choice.value ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s',
              }}
            >
              {choice.label}
              {hoveredChoice === choice.value && (
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--color-primary)' }}>
                  &gt;&gt;
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {canGoBack && onBack && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 14,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 6,
              color: 'var(--color-text-muted)',
              transition: 'background-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
            </svg>
            <span>修正する</span>
          </button>
        </div>
      )}
    </>
  );
}
