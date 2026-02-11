/**
 * SUCCESS（正解）画面
 * 枠は他画面と共通。正解！？やったわ！／作品・画像・作者・FANZAで見る(PR)／推奨作品3つ（top2～4）
 */

'use client';

import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';
import { CONTENT_OFFSET_LEFT_PX } from './gameLayoutConstants';

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
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '2rem',
      }}
    >
      <div style={{ flex: '0 0 auto', width: CONTENT_OFFSET_LEFT_PX, zIndex: 1 }} aria-hidden />

      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          marginLeft: 0,
          maxWidth: '800px',
        }}
      >
        <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: '0 0 1rem 0' }}>
          正解！？やったわ！
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: '1rem',
          }}
        >
          <img
            src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
            alt={work.title}
            style={{
              width: '160px',
              height: 'auto',
              objectFit: 'cover',
              borderRadius: '8px',
              flexShrink: 0,
            }}
          />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', margin: '0 0 0.25rem 0' }}>
              {work.title}
            </h2>
            <p style={{ fontSize: '1rem', color: '#6b7280', margin: '0 0 0.75rem 0' }}>{work.authorName}</p>
            <div style={{ fontSize: '1.05rem', fontWeight: '600' }}>
              <ExternalLink href={work.productUrl} linkText={linkText}>
                {linkText}
              </ExternalLink>
            </div>
          </div>
        </div>

        {recommendedWorks.length > 0 && (
          <>
            <p style={{ fontSize: '1rem', color: '#374151', margin: '1.5rem 0 0.75rem 0', fontWeight: '500' }}>
              そんなあなたにおススメ！似ている作品かも！
            </p>
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                width: '100%',
              }}
            >
              {recommendedWorks.slice(0, 3).map((rec) => (
                <div
                  key={rec.workId}
                  style={{
                    width: 'min(180px, 100%)',
                    padding: '0.75rem',
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
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
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                    }}
                  />
                  <p
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#1f2937',
                      margin: '0 0 0.25rem 0',
                      lineHeight: 1.3,
                    }}
                  >
                    {rec.title}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>{rec.authorName}</p>
                  <ExternalLink href={rec.productUrl} linkText={linkText}>
                    {linkText}
                  </ExternalLink>
                </div>
              ))}
            </div>
          </>
        )}

        {onRestart && (
          <div style={{ width: '100%', marginTop: '1.5rem' }}>
            <RestartButton onRestart={onRestart} />
          </div>
        )}
      </div>
    </div>
  );
}
