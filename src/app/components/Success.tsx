/**
 * SUCCESSコンポーネント
 */

'use client';

import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';

interface SuccessProps {
  work: {
    workId: string;
    title: string;
    authorName: string;
    productUrl: string;
    thumbnailUrl?: string | null;
  };
  onRestart?: () => void;
}

export function Success({ work, onRestart }: SuccessProps) {
  const linkText = 'FANZAで見る'; // 固定テンプレート

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>正解です！</h1>
      <div style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{work.title}</h2>
        <p style={{ fontSize: '1rem', color: '#666', marginBottom: '1rem' }}>作者: {work.authorName}</p>
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
      {onRestart && <RestartButton onRestart={onRestart} />}
    </div>
  );
}
