/**
 * REVEALコンポーネント
 * Yes/No回答のみ（アキネーター風レイアウト）
 */

'use client';

import { useState } from 'react';
import { ExternalLink } from './ExternalLink';

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
  // リンク文言は固定テンプレート（自動生成しない）
  const linkText = 'FANZAで見る'; // 固定テンプレート
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
            maxWidth: '800px',
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
                flexDirection: 'column',
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
                  margin: '0 0 1rem 0',
                }}
              >
                もしかして、これですか？
              </p>
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                  {work.title}
                </h2>
                <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '1rem' }}>
                  作者: {work.authorName}
                </p>
                {work.thumbnailUrl && (
                  <img
                    src={work.thumbnailUrl}
                    alt={work.title}
                    style={{ maxWidth: '200px', margin: '1rem 0', borderRadius: '4px' }}
                  />
                )}
                <div style={{ marginTop: '1rem' }}>
                  <ExternalLink href={work.productUrl} linkText={linkText}>
                    {linkText}
                  </ExternalLink>
                </div>
              </div>
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
      </div>
    </div>
  );
}
