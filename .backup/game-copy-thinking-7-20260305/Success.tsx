/**
 * SUCCESS（正解）画面
 * 上: 正解作品を大きめ（はみ出しなし）。下: おすすめ5件を横一列（横スクロール可）。
 * スマホ・mobileListBelow時：おすすめはキャンバス下に縦リスト表示。
 */

'use client';

import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';
import { useMediaQuery } from './useMediaQuery';
import { MobileWorkCardHorizontal } from './MobileWorkCardHorizontal';

interface WorkItem {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
  reviewAverage?: number | null;
  reviewCount?: number | null;
}

interface RecommendedWorkItem extends WorkItem {
  matchRate?: number;
}

interface SuccessProps {
  work: WorkItem;
  recommendedWorks?: RecommendedWorkItem[];
  onRestart?: () => void;
  successTitle?: string;
  recommendTitle?: string;
  mobileListBelow?: boolean;
  sessionId?: string | null;
  questionCount?: number;
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
  mobileListBelow,
  sessionId,
  questionCount,
}: SuccessProps) {
  const linkText = '読んでみる';
  const isMobile = useMediaQuery(768);
  const hideRecommendations = isMobile && mobileListBelow;

  return (
    <>
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
          <h2 style={{ fontSize: isMobile ? 18 : 18, fontWeight: 'bold', color: 'var(--color-text)', margin: '0 0 4px 0', wordBreak: 'break-word' }}>
            {work.title}
          </h2>
          <p style={{ fontSize: isMobile ? 15 : 14, color: 'var(--color-text-muted)', margin: '0 0 6px 0' }}>{work.authorName}</p>
          {work.reviewAverage != null && work.reviewCount != null && work.reviewCount > 0 && (
            <p style={{ fontSize: isMobile ? 14 : 13, color: '#f59e0b', margin: '0 0 8px 0', fontWeight: 600 }}>
              {'★'.repeat(Math.round(work.reviewAverage))} {work.reviewAverage.toFixed(1)}（{work.reviewCount}件）
            </p>
          )}
          <ExternalLink href={work.productUrl} linkText={linkText} sessionId={sessionId}>
            <span style={{
              display: 'inline-block',
              padding: isMobile ? '10px 22px' : '12px 29px',
              backgroundColor: '#ff6b35',
              color: '#fff',
              fontWeight: 700,
              fontSize: isMobile ? 17 : 18,
              borderRadius: 8,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(255,107,53,0.3)',
            }}>
              {linkText}
            </span>
          </ExternalLink>
        </div>
      </div>

      {/* 下半分: おすすめ5件。スマホ・mobileListBelow時はキャンバス下に表示 */}
      {recommendedWorks.length > 0 && !hideRecommendations && (
        <>
          <p style={{ fontSize: isMobile ? 16 : 15, color: 'var(--color-text-muted)', margin: isMobile ? '14px 0 8px 0' : '20px 0 10px 0', fontWeight: 500 }}>
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
                      <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>
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
                  <p style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 2px 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rec.title}
                  </p>
                  <p style={{ fontSize: isMobile ? 10 : 11, color: 'var(--color-text-muted)', margin: '0 0 4px 0' }}>{rec.authorName}</p>
                  <div style={{ fontSize: isMobile ? 11 : 14, color: 'var(--color-text-muted)' }}>
                    <ExternalLink href={rec.productUrl} linkText={linkText} sessionId={sessionId}>
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            width: '100%',
            marginTop: isMobile ? 12 : 14,
          }}
        >
          <RestartButton onRestart={onRestart} inline compact={isMobile} small={!isMobile} />
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const qCount = questionCount ?? 0;
              const isAlmostSuccess = successTitle !== '正解！？やっぱりね！';
              const text = isAlmostSuccess
                ? `【ERONATOR】${qCount}問で惜しかった…！ あなたの妄想、エロネイターが当ててみる？\n#エロネイター`
                : `【ERONATOR】${qCount}問で当てられた！ あなたの妄想、エロネイターが当ててみる？\n#エロネイター`;
              const resultParam = isAlmostSuccess ? 'fail' : 'success';
              const shareUrl = `${origin}?q=${qCount}&result=${resultParam}`;
              const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
              window.open(intent, '_blank', 'noopener,noreferrer');
            }}
            style={{
              padding: '8px 14px',
              height: 36,
              boxSizing: 'border-box',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              backgroundColor: '#0f1419',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              lineHeight: 1,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            ポストする
          </a>
        </div>
      )}
    </>
  );
}

/** スマホ・キャンバス下用：おすすめ縦リスト。FANZAで見るを表示 */
export function SuccessRecommendationsVertical({
  recommendedWorks,
  recommendTitle = 'そんなあなたには…おすすめもあるわ！',
  sessionId,
}: {
  recommendedWorks: RecommendedWorkItem[];
  recommendTitle?: string;
  sessionId?: string | null;
}) {
  if (recommendedWorks.length === 0) return null;
  return (
    <>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-text)',
          margin: '0 0 10px 0',
          fontWeight: 500,
          padding: '8px 12px',
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {recommendTitle}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recommendedWorks.slice(0, 5).map((rec) => (
          <MobileWorkCardHorizontal
            key={rec.workId}
            work={rec}
            showFanzaLink={true}
            matchRate={rec.matchRate}
            sessionId={sessionId}
          />
        ))}
      </div>
    </>
  );
}
