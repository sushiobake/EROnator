/**
 * QUIZコンポーネント
 * 右中央ホワイトボード内で質問＋6択。レイアウトは px。
 * - Q1〜Q11: 「どっちでもいい」は非表示。Q12から表示。
 * - 特別質問（SERIES/TITLE_CHAR_TYPE/TITLE_SYLLABLE、POPULARITYは除外）では「たぶんそう」「たぶん違う」「どっちでもいい」をブロック（押すとメッセージ表示・無効化・薄く表示）。わからないは許可。
 */

'use client';

import { useState, useEffect } from 'react';
import { useMediaQuery } from './useMediaQuery';
import { useClickGuard } from './useClickGuard';

interface QuizProps {
  question: {
    kind:
      | 'EXPLORE_TAG'
      | 'SOFT_CONFIRM'
      | 'HARD_CONFIRM'
      | 'SPECIAL_QUESTION'
      | 'NEW_TAG_QUESTION'
      | 'NOISE_GUIDE_RECOMMEND';
    displayText: string;
    specialQuestionType?:
      | 'SERIES'
      | 'TITLE_CHAR_TYPE'
      | 'POPULARITY'
      | 'TITLE_SYLLABLE'
      | 'TITLE_SYLLABLE_2'
      | 'AUTHOR_CHAR_TYPE'
      | 'TITLE_LENGTH_STYLE';
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

/** Q12から「どっちでもいい」を表示（questionCount は 1始まり） */
const DONT_CARE_FROM_QUESTION = 12;

/** 特別質問でブロックする選択肢（たぶんそう・たぶん違う・どっちでもいい）。わからないは許可 */
const SPECIAL_QUESTION_BLOCKED_VALUES = ['PROBABLY_YES', 'PROBABLY_NO', 'DONT_CARE'] as const;

/** 曖昧回答をブロックする特別質問タイプ（POPULARITY は除外） */
const NO_AMBIGUOUS_SPECIAL_TYPES = ['SERIES', 'TITLE_CHAR_TYPE', 'TITLE_SYLLABLE', 'TITLE_LENGTH_STYLE'] as const;

export function Quiz({ question, questionCount, onAnswer, onBack, canGoBack }: QuizProps) {
  const [hoveredChoice, setHoveredChoice] = useState<string | null>(null);
  const [ambiguousRejected, setAmbiguousRejected] = useState(false);
  const interactionDisabled = useClickGuard([questionCount]);
  const isMobile = useMediaQuery(768);

  const disallowAmbiguous =
    question.kind === 'SPECIAL_QUESTION' &&
    question.specialQuestionType &&
    (NO_AMBIGUOUS_SPECIAL_TYPES as readonly string[]).includes(question.specialQuestionType);

  useEffect(() => {
    setAmbiguousRejected(false);
  }, [questionCount]);

  const handleAnswer = (choice: string) => {
    if (interactionDisabled) return;
    if (disallowAmbiguous && (SPECIAL_QUESTION_BLOCKED_VALUES as readonly string[]).includes(choice)) {
      setAmbiguousRejected(true);
      return;
    }
    onAnswer(choice);
  };

  const isBlockedDisabled = disallowAmbiguous && ambiguousRejected;

  const visibleChoices = questionCount >= DONT_CARE_FROM_QUESTION
    ? ANSWER_CHOICES
    : ANSWER_CHOICES.filter((c) => c.value !== 'DONT_CARE');

  const handleBack = () => {
    if (interactionDisabled) return;
    onBack?.();
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
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
          {visibleChoices.map((choice, index) => {
            const isBlocked = isBlockedDisabled && (SPECIAL_QUESTION_BLOCKED_VALUES as readonly string[]).includes(choice.value);
            const isDisabled = interactionDisabled || isBlocked;
            return (
            <button
              key={choice.value}
              onClick={() => handleAnswer(choice.value)}
              onMouseEnter={() => setHoveredChoice(choice.value)}
              onMouseLeave={() => setHoveredChoice(null)}
              disabled={isDisabled}
              style={{
                position: 'relative',
                width: '100%',
                padding: isMobile ? '8px 16px' : '8px 20px',
                minHeight: 40,
                textAlign: 'center',
                fontSize: isMobile ? 17 : 16,
                fontWeight: 500,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isBlocked ? 0.35 : isDisabled ? 0.7 : 1,
                backgroundColor: hoveredChoice === choice.value && !isDisabled ? '#dbeafe' : 'var(--color-surface)',
                color: isBlocked ? '#9ca3af' : hoveredChoice === choice.value && !isDisabled ? 'var(--color-primary)' : 'var(--color-text-muted)',
                border: 'none',
                borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                boxShadow: hoveredChoice === choice.value && !isDisabled ? 'inset 0 0 0 2px var(--color-primary)' : 'none',
                transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s, opacity 0.1s',
              }}
            >
              {choice.label}
              {hoveredChoice === choice.value && !isDisabled && (
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--color-primary)' }}>
                  &gt;&gt;
                </span>
              )}
            </button>
          );
          })}
        </div>
        {ambiguousRejected && (
          <p style={{ marginTop: 12, marginBottom: 0, fontWeight: 'bold', color: 'var(--color-text)', fontSize: 14 }}>
            曖昧にしないで！わかるならちゃんと妄想して！
          </p>
        )}
        </div>
        {canGoBack && onBack && (
          <div style={{ marginTop: 16, width: '100%', maxWidth: 320, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleBack}
            disabled={interactionDisabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 14,
              cursor: interactionDisabled ? 'not-allowed' : 'pointer',
              opacity: interactionDisabled ? 0.7 : 1,
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
      </div>
    </>
  );
}
