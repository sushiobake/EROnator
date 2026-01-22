/**
 * QUIZコンポーネント
 * 6択回答
 */

'use client';

interface QuizProps {
  question: {
    kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';
    displayText: string;
  };
  questionCount: number;
  onAnswer: (choice: string) => void;
  onBack?: () => void; // 修正機能用
  canGoBack?: boolean; // 前の質問に戻れるか（1問目以外）
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
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ fontSize: '1.3rem', margin: '2rem 0', fontWeight: 'bold', lineHeight: '1.6' }}>
        {question.displayText}
      </p>
      <div style={{ marginTop: '2rem' }}>
        {ANSWER_CHOICES.map((choice) => (
          <button
            key={choice.value}
            onClick={() => onAnswer(choice.value)}
            style={{
              display: 'block',
              width: '280px',
              margin: '0.6rem auto',
              padding: '0.75rem',
              fontSize: '1rem',
              cursor: 'pointer',
              backgroundColor: '#f0f0f0',
              border: '2px solid #ccc',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e0e0e0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {canGoBack && onBack && (
        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={onBack}
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
              backgroundColor: '#fff',
              border: '1px solid #999',
              borderRadius: '4px',
              color: '#666',
            }}
          >
            修正する
          </button>
        </div>
      )}
    </div>
  );
}
