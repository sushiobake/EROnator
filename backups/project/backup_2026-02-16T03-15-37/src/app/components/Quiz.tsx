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
      <p style={{ fontSize: isMobile ? 16 : 15, color: 'var(--color-text-muted)', margin: '0 0 6px 0' }}>
        あなたが妄想した作品は……
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'stretch',
          gap: isMobile ? 10 : 0,
          marginBottom: isMobile ? 24 : 32,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            height: 56,
            width: 56,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#334155',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            alignSelf: isMobile ? 'flex-start' : undefined,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>{questionCount}</span>
          {!isMobile && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translate(-100%, -50%)',
                width: 0,
                height: 0,
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderRight: '14px solid #334155',
              }}
            />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            flex: 1,
            minWidth: 0,
            alignItems: 'flex-start',
            minHeight: isMobile ? 56 : 72,
            border: '1px solid #e5e7eb',
            backgroundColor: '#fff',
            padding: isMobile ? '12px 16px' : '16px 24px',
            borderRadius: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          <p
            style={{
              fontSize: isMobile ? 18 : 18,
              fontWeight: 500,
              color: 'var(--color-text)',
              margin: 0,
              lineHeight: 1.5,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {question.displayText}
          </p>
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 320, marginTop: isMobile ? 6 : 8 }}>
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
