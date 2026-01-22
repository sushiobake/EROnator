/**
 * REVEALコンポーネント
 * Yes/No回答のみ
 */

'use client';

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

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>もしかして、これですか？</h1>
      <div style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>{work.title}</h2>
        <p>作者: {work.authorName}</p>
        {work.thumbnailUrl && (
          <img
            src={work.thumbnailUrl}
            alt={work.title}
            style={{ maxWidth: '200px', margin: '1rem 0' }}
          />
        )}
        <ExternalLink href={work.productUrl} linkText={linkText}>
          {linkText}
        </ExternalLink>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={() => onAnswer('YES')}
          style={{
            display: 'block',
            width: '200px',
            margin: '0.5rem auto',
            padding: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
          }}
        >
          はい
        </button>
        <button
          onClick={() => onAnswer('NO')}
          style={{
            display: 'block',
            width: '200px',
            margin: '0.5rem auto',
            padding: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
          }}
        >
          いいえ
        </button>
      </div>
    </div>
  );
}
