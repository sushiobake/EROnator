/**
 * SUCCESS（正解）画面
 * 上: 正解作品を大きめ（はみ出しなし）。下: おすすめ5件を横一列（横スクロール可）。
 * 一致度 → サムネ → タイトル → 作者・FANZA の優先順。
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

interface RecommendedWorkItem extends WorkItem {
  matchRate?: number;
}

interface SuccessProps {
  work: WorkItem;
  recommendedWorks?: RecommendedWorkItem[];
  onRestart?: () => void;
}

const REC_CARD_MIN_WIDTH = 130;
const REC_GAP = 12;

export function Success({ work, recommendedWorks = [], onRestart }: SuccessProps) {
  const linkText = 'FANZAで見る';

  return (
    <>
      {/* 上半分: 正解作品（大きめ・はみ出さない） */}
      <p style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', margin: '0 0 12px 0' }}>
        正解！？やっぱりね！
      </p>
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 20,
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <img
          src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
          alt={work.title}
          style={{
            width: 'clamp(120px, 28vw, 200px)',
            maxWidth: '100%',
            height: 'auto',
            objectFit: 'cover',
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', margin: '0 0 4px 0', wordBreak: 'break-word' }}>
            {work.title}
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px 0' }}>{work.authorName}</p>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
            <ExternalLink href={work.productUrl} linkText={linkText}>
              {linkText}
            </ExternalLink>
          </div>
        </div>
      </div>

      {/* 下半分: おすすめ5件を横一列（横スクロール） */}
      {recommendedWorks.length > 0 && (
        <>
          <p style={{ fontSize: 15, color: '#374151', margin: '20px 0 10px 0', fontWeight: 500 }}>
            そんなあなたには…おすすめもあるわ！
          </p>
          <div style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 8, maxWidth: '100%' }}>
            <div
              style={{
                display: 'flex',
                gap: REC_GAP,
                flexWrap: 'nowrap',
                width: 'max-content',
                minHeight: 1,
              }}
            >
              {recommendedWorks.slice(0, 5).map((rec) => (
                <div
                  key={rec.workId}
                  style={{
                    minWidth: REC_CARD_MIN_WIDTH,
                    width: REC_CARD_MIN_WIDTH,
                    padding: 10,
                    backgroundColor: '#fafafa',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    flexShrink: 0,
                  }}
                >
                  {typeof rec.matchRate === 'number' && (
                    <p style={{ fontSize: 15, color: '#059669', fontWeight: 700, margin: '0 0 6px 0', lineHeight: 1.2 }}>
                      {rec.matchRate}％
                    </p>
                  )}
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                    <img
                      src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
                      alt={rec.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', margin: '0 0 2px 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rec.title}
                  </p>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px 0' }}>{rec.authorName}</p>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>
                    <ExternalLink href={rec.productUrl} linkText={linkText}>
                      {linkText}
                    </ExternalLink>
                  </div>
                </div>
              ))}
            </div>
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
