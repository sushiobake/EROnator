/**
 * SUCCESS（正解）画面
 * 右中央ホワイトボード内で正解！？やったわ！／作品・画像・作者・FANZAで見る／推薦3つ。レイアウトは px。
 */

'use client';

import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';

interface WorkItem {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
}

interface SuccessProps {
  work: WorkItem;
  recommendedWorks?: WorkItem[];
  onRestart?: () => void;
}

export function Success({ work, recommendedWorks = [], onRestart }: SuccessProps) {
  const linkText = 'FANZAで見る';

  return (
    <>
      <p style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', margin: '0 0 16px 0' }}>
        正解！？やったわ！
      </p>
      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <img
          src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
          alt={work.title}
          style={{
            width: 160,
            height: 'auto',
            objectFit: 'cover',
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', margin: '0 0 4px 0' }}>
            {work.title}
          </h2>
          <p style={{ fontSize: 16, color: '#6b7280', margin: '0 0 12px 0' }}>{work.authorName}</p>
          <div style={{ fontSize: 17, fontWeight: 600 }}>
            <ExternalLink href={work.productUrl} linkText={linkText}>
              {linkText}
            </ExternalLink>
          </div>
        </div>
      </div>

      {recommendedWorks.length > 0 && (
        <>
          <p style={{ fontSize: 16, color: '#374151', margin: '24px 0 12px 0', fontWeight: 500 }}>
            そんなあなたにおススメ！似ている作品かも！
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', width: '100%' }}>
            {recommendedWorks.slice(0, 3).map((rec) => (
              <div
                key={rec.workId}
                style={{
                  width: 'min(180px, 100%)',
                  padding: 12,
                  backgroundColor: '#fafafa',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <img
                  src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
                  alt={rec.title}
                  style={{
                    width: '100%',
                    height: 'auto',
                    objectFit: 'cover',
                    borderRadius: 6,
                    marginBottom: 8,
                  }}
                />
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', margin: '0 0 4px 0', lineHeight: 1.3 }}>
                  {rec.title}
                </p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px 0' }}>{rec.authorName}</p>
                <ExternalLink href={rec.productUrl} linkText={linkText}>
                  {linkText}
                </ExternalLink>
              </div>
            ))}
          </div>
        </>
      )}

      {onRestart && (
        <div style={{ width: '100%', marginTop: 24 }}>
          <RestartButton onRestart={onRestart} />
        </div>
      )}
    </>
  );
}
