/**
 * SUCCESS（正解）画面
 * 上: 正解作品を大きめ（はみ出しなし）。下: おすすめ5件を横一列（横スクロール可）。
 * 似てる度 → サムネ → タイトル → 作者・FANZA の優先順。
 */

'use client';

import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';
import { useMediaQuery } from './useMediaQuery';

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
  /** 正解時は「正解！？やっぱりね！」、惜しかった時は「それか～～～！次回は当てるからね！」など */
  successTitle?: string;
  /** おすすめ見出し（省略時は「そんなあなたには…おすすめもあるわ！」） */
  recommendTitle?: string;
}

/** 正解作品より小さく。PC・スマホとも横スクロール */
const REC_CARD_MIN_WIDTH = 130;
const REC_GAP = 10;

export function Success({
  work,
  recommendedWorks = [],
  onRestart,
  successTitle = '正解！？やっぱりね！',
  recommendTitle = 'そんなあなたには…おすすめもあるわ！',
}: SuccessProps) {
  const linkText = 'FANZAで見る';
  const isMobile = useMediaQuery(768);

  return (
    <>
      {/* 上半分: 正解／選んだ作品（大きめ・はみ出しなし） */}
      <p style={{ fontSize: isMobile ? 19 : 20, fontWeight: 600, color: '#1f2937', margin: isMobile ? '0 0 8px 0' : '0 0 12px 0' }}>
        {successTitle}
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 10 : 16,
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          marginBottom: isMobile ? 14 : 20,
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <img
          src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
          alt={work.title}
          style={{
            width: isMobile ? '100%' : 'clamp(120px, 28vw, 200px)',
            maxWidth: isMobile ? 220 : '100%',
            alignSelf: isMobile ? 'center' : undefined,
            height: 'auto',
            objectFit: 'cover',
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: isMobile ? 'none' : '1 1 180px', minWidth: 0 }}>
          <h2 style={{ fontSize: isMobile ? 18 : 18, fontWeight: 'bold', color: '#1f2937', margin: '0 0 4px 0', wordBreak: 'break-word' }}>
            {work.title}
          </h2>
          <p style={{ fontSize: isMobile ? 15 : 14, color: '#6b7280', margin: '0 0 6px 0' }}>{work.authorName}</p>
          <div style={{ fontSize: isMobile ? 14 : 12, color: '#6b7280', fontWeight: 500 }}>
            <ExternalLink href={work.productUrl} linkText={linkText}>
              {linkText}
            </ExternalLink>
          </div>
        </div>
      </div>

      {/* 下半分: おすすめ5件を横一列（横スクロール） */}
      {recommendedWorks.length > 0 && (
        <>
          <p style={{ fontSize: isMobile ? 16 : 15, color: '#374151', margin: isMobile ? '14px 0 8px 0' : '20px 0 10px 0', fontWeight: 500 }}>
            {recommendTitle}
          </p>
          <div
            style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 8, maxWidth: '100%' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
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
                    padding: isMobile ? 8 : 8,
                    backgroundColor: '#fafafa',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    flexShrink: 0,
                  }}
                >
                  {typeof rec.matchRate === 'number' && (
                    <div style={{ marginBottom: isMobile ? 4 : 6 }}>
                      <p style={{ fontSize: isMobile ? 10 : 11, color: '#374151', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>
                        似てる度
                      </p>
                      <p style={{ fontSize: isMobile ? 15 : 18, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>
                        {Number(rec.matchRate).toFixed(1)}％
                      </p>
                    </div>
                  )}
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', marginBottom: isMobile ? 4 : 6 }}>
                    <img
                      src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
                      alt={rec.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <p style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#1f2937', margin: '0 0 2px 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rec.title}
                  </p>
                  <p style={{ fontSize: isMobile ? 10 : 11, color: '#6b7280', margin: '0 0 4px 0' }}>{rec.authorName}</p>
                  <div style={{ fontSize: isMobile ? 9 : 10, color: '#6b7280' }}>
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
        <div style={{ width: '100%', marginTop: isMobile ? 16 : 24 }}>
          <RestartButton onRestart={onRestart} />
        </div>
      )}
    </>
  );
}
