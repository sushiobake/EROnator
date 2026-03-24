/**
 * SUCCESS（正解）画面
 * 上: 正解作品を大きめ（はみ出しなし）。下: おすすめ5件を横一列（横スクロール可）。
 * スマホ・mobileListBelow時：おすすめはキャンバス下に縦リスト表示。
 */

'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';
import { useMediaQuery } from './useMediaQuery';
import { MobileWorkCardHorizontal } from './MobileWorkCardHorizontal';
import { StreamerCensoredText } from './StreamerCensoredText';
import { MosaicImage } from './MosaicImage';
import { MobileRecommendCaptureGrid } from './MobileRecommendCaptureGrid';
import { useToast } from './ToastContext';
import { ResultScreenFourButtons } from './ResultScreenFourButtons';

const LOGO_URL = '/ilust/inari_thinking_opening.png';
/** 保存画像ヘッダ（推薦結果キャプチャと同じロゴ） */
const SHARE_CAPTURE_LOGO_URL = '/ilust/eronator_logo.jpg';

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
  onBackToTop?: () => void;
  successTitle?: string;
  recommendTitle?: string;
  /** 推薦結果見出しと同じ文言を保存画像に埋め込む */
  shareCaptureHeading?: string;
  mobileListBelow?: boolean;
  sessionId?: string | null;
  questionCount?: number;
  /** 配信者モード時はタイトルを部分的伏字 */
  streamerMode?: boolean;
}

/** 正解作品より小さく。PC・スマホとも横スクロール */
const REC_CARD_MIN_WIDTH = 130;
const REC_GAP = 10;
const CAPTURE_WIDTH_PC = 1200;
/** 保存画像（モバイル・推薦モードと同幅） */
const CAPTURE_WIDTH_MOBILE = 400;
const CAPTURE_PAD = 16;
const CAPTURE_CARD_GAP = 10;

export function Success({
  work,
  recommendedWorks = [],
  onRestart,
  onBackToTop,
  successTitle = '正解！？やっぱりね！',
  recommendTitle = 'そんなあなたには…おすすめもあるわ！',
  shareCaptureHeading = 'こんな作品なんてどう？',
  mobileListBelow,
  sessionId,
  questionCount,
  streamerMode,
}: SuccessProps) {
  const linkText = '読んでみる';
  const isMobile = useMediaQuery(768);
  const hideRecommendations = isMobile && mobileListBelow;
  const { showToast } = useToast();
  const captureRef = useRef<HTMLDivElement>(null);
  const [captureMosaic, setCaptureMosaic] = useState(false);
  const thumbSrc = work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`;
  const isAlmostSuccess = successTitle !== '正解！？やっぱりね！';

  const handlePostToX = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qCount = questionCount ?? 0;
    const text = isAlmostSuccess
      ? `【ERONATOR】${qCount}問で惜しかった…！ あなたの妄想、エロネイターが当ててみる？\n#エロネイター`
      : `【ERONATOR】${qCount}問で当てられた！ あなたの妄想、エロネイターが当ててみる？\n#エロネイター`;
    const resultParam = isAlmostSuccess ? 'fail' : 'success';
    const shareUrl = `${origin}?q=${qCount}&result=${resultParam}`;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
  };

  const runCapture = (withMosaic: boolean) => {
    const el = captureRef.current;
    if (!el) {
      showToast('画像の準備ができませんでした');
      return;
    }
    const finish = () => {
      html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        .then((canvas) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return;
              const downloadUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = withMosaic ? 'eronator-success-mosaic.png' : 'eronator-success.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(downloadUrl);
              if (withMosaic) setCaptureMosaic(false);
              showToast('画像を保存しました', 'success');
            },
            'image/png'
          );
        })
        .catch((err) => {
          console.error(err);
          showToast('画像の保存に失敗しました');
          if (withMosaic) setCaptureMosaic(false);
        });
    };
    if (withMosaic) {
      setCaptureMosaic(true);
      setTimeout(finish, 1200);
    } else {
      finish();
    }
  };

  return (
    <>
      <div
        ref={captureRef}
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: isMobile ? CAPTURE_WIDTH_MOBILE : CAPTURE_WIDTH_PC,
          backgroundColor: '#fff',
          padding: CAPTURE_PAD,
          boxSizing: 'border-box',
          zIndex: -1,
        }}
        aria-hidden
      >
        {isMobile ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
              <img src={SHARE_CAPTURE_LOGO_URL} alt="ERONATOR" style={{ height: 32, width: 'auto', maxWidth: '48%', marginBottom: 4 }} />
              <p
                style={{
                  margin: 0,
                  padding: '0 6px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1f2937',
                  lineHeight: 1.35,
                  textAlign: 'center',
                }}
              >
                {successTitle}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: 340,
                  padding: 8,
                  backgroundColor: '#fafafa',
                  border: '2px solid #f59e0b',
                  borderRadius: 10,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <p style={{ fontSize: 10, color: '#b45309', fontWeight: 700, margin: '0 0 4px 0', lineHeight: 1.2, textAlign: 'center' }}>当てた作品</p>
                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                  {captureMosaic ? (
                    <MosaicImage src={thumbSrc} alt={work.title} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <img src={thumbSrc} alt={work.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#1f2937',
                    margin: '0 0 2px 0',
                    lineHeight: 1.3,
                    minHeight: 29,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {streamerMode ? '（配信モードのためタイトル省略）' : work.title}
                </p>
                <p style={{ fontSize: 9, color: '#6b7280', margin: 0, textAlign: 'center' }}>{work.authorName}</p>
              </div>
              <p
                style={{
                  margin: '12px 0 16px 0',
                  padding: '0 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1f2937',
                  lineHeight: 1.45,
                  textAlign: 'center',
                }}
              >
                {recommendTitle}
              </p>
            </div>
            <MobileRecommendCaptureGrid
              works={recommendedWorks}
              captureMosaic={captureMosaic}
              maxItems={5}
              streamerMode={streamerMode}
            />
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
              <img src={SHARE_CAPTURE_LOGO_URL} alt="ERONATOR" style={{ height: 38, width: 'auto', maxWidth: '42%', marginBottom: 6 }} />
              <p style={{ margin: 0, padding: '0 12px', fontSize: 13, fontWeight: 700, color: '#1f2937', lineHeight: 1.35, textAlign: 'center' }}>
                {successTitle}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
              <div
                style={{
                  width: 480,
                  maxWidth: '100%',
                  padding: 12,
                  backgroundColor: '#fafafa',
                  border: '2px solid #f59e0b',
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <p style={{ fontSize: 11, color: '#b45309', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.2, textAlign: 'center' }}>当てた作品</p>
                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                  {captureMosaic ? (
                    <MosaicImage src={thumbSrc} alt={work.title} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <img src={thumbSrc} alt={work.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1f2937',
                    margin: '0 0 2px 0',
                    lineHeight: 1.35,
                    textAlign: 'center',
                    wordBreak: 'break-word',
                  }}
                >
                  {streamerMode ? '（配信モードのためタイトル省略）' : work.title}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0, textAlign: 'center' }}>{work.authorName}</p>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: '#4b5563', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>{recommendTitle}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: CAPTURE_CARD_GAP }}>
              {recommendedWorks.slice(0, 5).map((rec) => (
                <div
                  key={rec.workId}
                  style={{
                    padding: 10,
                    backgroundColor: '#fafafa',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {typeof rec.matchRate === 'number' && (
                    <div style={{ marginBottom: 6 }}>
                      <p style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>好みマッチ度</p>
                      <p style={{ fontSize: 16, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>
                        {Number(rec.matchRate).toFixed(1)}％
                      </p>
                    </div>
                  )}
                  <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                    {captureMosaic ? (
                      <MosaicImage src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`} alt={rec.title} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <img src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`} alt={rec.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#1f2937',
                      margin: '0 0 2px 0',
                      lineHeight: 1.3,
                      minHeight: 31,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                    }}
                  >
                    {streamerMode ? '（配信モードのためタイトル省略）' : rec.title}
                  </p>
                  <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>{rec.authorName}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div
        style={{
          width: '100%',
          /** キャンバス内フッター（GameChromeFooter）直前でスクロール末尾に余白（margin より確実） */
          paddingBottom: isMobile ? 32 : 0,
          boxSizing: 'border-box',
        }}
      >
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
            maxWidth: isMobile ? 190 : '100%',
            alignSelf: isMobile ? 'center' : undefined,
            height: 'auto',
            objectFit: 'cover',
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: isMobile ? 'none' : '1 1 180px', minWidth: 0 }}>
          <h2 style={{ fontSize: isMobile ? 15 : 18, fontWeight: 'bold', color: 'var(--color-text)', margin: '0 0 4px 0', wordBreak: 'break-word', lineHeight: 1.25 }}>
            {streamerMode ? <StreamerCensoredText text={work.title} censorAll /> : work.title}
          </h2>
          <p style={{ fontSize: isMobile ? 12 : 14, color: 'var(--color-text-muted)', margin: '0 0 4px 0' }}>{work.authorName}</p>
          {work.reviewAverage != null && work.reviewCount != null && work.reviewCount > 0 && (
            <p style={{ fontSize: isMobile ? 11 : 13, color: '#f59e0b', margin: '0 0 6px 0', fontWeight: 600 }}>
              {'★'.repeat(Math.round(work.reviewAverage))} {work.reviewAverage.toFixed(1)}（{work.reviewCount}件）
            </p>
          )}
          <ExternalLink href={work.productUrl} linkText={linkText} sessionId={sessionId}>
            <span
              style={{
                display: 'inline-block',
                padding: isMobile ? '10px 24px' : '12px 29px',
                backgroundColor: '#ff6b35',
                color: '#fff',
                fontWeight: 700,
                fontSize: isMobile ? 18 : 18,
                borderRadius: 8,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(255,107,53,0.3)',
              }}
            >
              {linkText}
            </span>
          </ExternalLink>
        </div>
      </div>

      {/* 下半分: おすすめ5件。スマホ・mobileListBelow時はキャンバス下に表示 */}
      {recommendedWorks.length > 0 && !hideRecommendations && (
        <>
          <p
            style={{
              fontSize: isMobile ? 11 : 15,
              color: 'var(--color-text-muted)',
              margin: isMobile ? '12px 0 6px 0' : '20px 0 10px 0',
              fontWeight: 500,
              lineHeight: isMobile ? 1.35 : 1.45,
            }}
          >
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
                    padding: isMobile ? 6 : 8,
                    backgroundColor: '#fafafa',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    flexShrink: 0,
                    ...(isMobile
                      ? {
                          WebkitFontSmoothing: 'antialiased',
                          textRendering: 'optimizeLegibility',
                        }
                      : {}),
                  }}
                >
                  {typeof rec.matchRate === 'number' && (
                    <div style={{ marginBottom: isMobile ? 3 : 6 }}>
                      <p style={{ fontSize: isMobile ? 8 : 11, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>
                        似てる度
                      </p>
                      <p style={{ fontSize: isMobile ? 11 : 18, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>
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
                  <p
                    style={
                      isMobile
                        ? {
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            margin: '0 0 2px 0',
                            lineHeight: 1.35,
                            minHeight: 34,
                            maxHeight: 40,
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                          }
                        : {
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            margin: '0 0 2px 0',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }
                    }
                  >
                    {streamerMode ? <StreamerCensoredText text={rec.title} censorAll /> : rec.title}
                  </p>
                  <p style={{ fontSize: isMobile ? 9 : 11, color: 'var(--color-text-muted)', margin: '0 0 4px 0', lineHeight: 1.25 }}>
                    {rec.authorName}
                  </p>
                  <div style={{ fontSize: isMobile ? 10 : 14, color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
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

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          marginTop: isMobile ? 12 : 14,
        }}
      >
        <ResultScreenFourButtons
          onSavePlain={() => runCapture(false)}
          onSaveMosaic={() => runCapture(true)}
          onPost={handlePostToX}
          onBackToTop={onBackToTop}
          isMobile={isMobile}
        />
        {onRestart && (
          <RestartButton onRestart={onRestart} inline compact={isMobile} small={!isMobile} />
        )}
      </div>
      </div>
    </>
  );
}

/** スマホ・キャンバス下用：おすすめ縦リスト。FANZAで見るを表示 */
export function SuccessRecommendationsVertical({
  recommendedWorks,
  recommendTitle = 'そんなあなたには…おすすめもあるわ！',
  sessionId,
  streamerMode,
}: {
  recommendedWorks: RecommendedWorkItem[];
  recommendTitle?: string;
  sessionId?: string | null;
  streamerMode?: boolean;
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
            streamerMode={streamerMode}
          />
        ))}
      </div>
    </>
  );
}
