/**
 * QUIZコンポーネント
 * 6択回答（アキネーター風レイアウト）
 */

'use client';

import { useState } from 'react';

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
        {/* キャラクター - 左側、縦方向は中央 */}
        <div
          style={{
            flex: '0 0 auto',
            width: '35%',
            maxWidth: '450px',
            minWidth: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          {/* キャラクター画像のプレースホルダー（後で差し替え） */}
          <div
            style={{
              width: '100%',
              aspectRatio: '1',
              maxHeight: '500px',
              backgroundColor: '#e8e8e8',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '1rem',
              border: '2px dashed #ccc',
            }}
          >
            キャラクター画像
          </div>
        </div>

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
            {/* 数字ボックス（濃いグレー、吹き出しの尻尾付き） */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                height: '56px',
                width: '56px',
                flexShrink: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#334155',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            >
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#fff',
                }}
              >
                {questionCount}
              </span>
              {/* 左向きの三角形（吹き出しの尻尾） */}
              <div
                style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translate(-100%, -50%)',
                  width: 0,
                  height: 0,
                  borderTop: '10px solid transparent',
                  borderBottom: '10px solid transparent',
                  borderRight: '14px solid #334155',
                }}
              />
            </div>

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
                {question.displayText}
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
              {ANSWER_CHOICES.map((choice, index) => {
                const isFirst = index === 0;
                return (
                  <button
                    key={choice.value}
                    onClick={() => onAnswer(choice.value)}
                    onMouseEnter={() => setHoveredChoice(choice.value)}
                    onMouseLeave={() => setHoveredChoice(null)}
                    style={{
                      position: 'relative',
                      width: '100%',
                      padding: '0.875rem 1.5rem',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      backgroundColor: hoveredChoice === choice.value ? '#eff6ff' : '#fff',
                      color: hoveredChoice === choice.value ? '#111827' : '#374151',
                      border: 'none',
                      borderTop: !isFirst ? '1px solid #e5e7eb' : 'none',
                      transition: 'background-color 0.1s, color 0.1s',
                    }}
                  >
                    {choice.label}
                    {hoveredChoice === choice.value && (
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

          {/* 修正するボタン */}
          {canGoBack && onBack && (
            <div
              style={{
                marginTop: '1rem',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={onBack}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#6b7280',
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
                {/* 左向き矢印 */}
                <svg
                  style={{
                    width: '16px',
                    height: '16px',
                  }}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                </svg>
                <span>修正する</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
