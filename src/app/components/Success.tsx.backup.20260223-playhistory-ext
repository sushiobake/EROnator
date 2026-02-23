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
  /** スマホ：おすすめはキャンバス下に表示、白板には正解作品のみ */
  mobileListBelow?: boolean;
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
}: SuccessProps) {
  const linkText = 'FANZAで見る';
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
          <div style={{ fontSize: isMobile ? 14 : 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>
            <ExternalLink href={work.productUrl} linkText={linkText}>
              {linkText}
            </ExternalLink>
          </div>
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
                  <div style={{ fontSize: isMobile ? 9 : 12, color: 'var(--color-text-muted)' }}>
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
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'row' : undefined,
            justifyContent: isMobile ? 'center' : 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: isMobile ? 8 : 12,
            width: '100%',
            marginTop: isMobile ? 12 : 24,
          }}
        >
          <RestartButton onRestart={onRestart} inline compact={isMobile} />
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const text = `【ERONATOR】「${work.title}」が当たった！ あなたの妄想、当ててみる？`;
              const url = typeof window !== 'undefined' ? window.location.origin : '';
              const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
              window.open(intent, '_blank', 'noopener,noreferrer');
            }}
            style={{
              padding: isMobile ? '8px 14px' : '14px 24px',
              minHeight: isMobile ? 36 : 48,
              fontSize: isMobile ? 12 : 15,
              fontWeight: 600,
              color: '#0f1419',
              backgroundColor: '#fff',
              border: '1px solid #cfd9de',
              borderRadius: 8,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Xでポストする
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
}: {
  recommendedWorks: RecommendedWorkItem[];
  recommendTitle?: string;
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
          />
        ))}
      </div>
    </>
  );
}
