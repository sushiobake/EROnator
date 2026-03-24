'use client';

import { Noto_Sans_JP } from 'next/font/google';
import { MosaicImage } from './MosaicImage';

const notoCapture = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

/** モバイル保存画像のグリッド間隔（推薦・本編共通） */
export const MOBILE_RECOMMEND_CAPTURE_CARD_GAP = 10;

export type MobileRecommendCaptureItem = {
  workId: string;
  title: string;
  authorName: string;
  matchRate?: number;
  thumbnailUrl?: string | null;
};

type Props = {
  works: MobileRecommendCaptureItem[];
  captureMosaic: boolean;
  /** Recommend 結果は 10、Success は 5 */
  maxItems?: number;
  streamerMode?: boolean;
};

/**
 * 推薦モード・本編 Success のモバイル保存画像で共有するおすすめ2列グリッド。
 * body と同じ Noto Sans JP を明示し、html2canvas でも読みやすいようカード内余白を確保する。
 */
export function MobileRecommendCaptureGrid({
  works,
  captureMosaic,
  maxItems = 10,
  streamerMode = false,
}: Props) {
  const gap = MOBILE_RECOMMEND_CAPTURE_CARD_GAP;
  return (
    <div
      className={notoCapture.className}
      style={{
        display: 'grid',
        width: '100%',
        boxSizing: 'border-box',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap,
        letterSpacing: '0.02em',
      }}
    >
      {works.slice(0, maxItems).map((rec) => {
        const src = rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`;
        const titleText = streamerMode ? '（配信モードのためタイトル省略）' : rec.title;
        return (
          <div
            key={rec.workId}
            style={{
              minWidth: 0,
              padding: 10,
              backgroundColor: '#fafafa',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              boxSizing: 'border-box',
            }}
          >
            {typeof rec.matchRate === 'number' && (
              <div style={{ marginBottom: 8 }}>
                <p
                  style={{
                    fontSize: 9,
                    color: '#6b7280',
                    fontWeight: 600,
                    margin: '0 0 4px 0',
                    lineHeight: 1.35,
                  }}
                >
                  好みマッチ度
                </p>
                <p style={{ fontSize: 12, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.25 }}>
                  {Number(rec.matchRate).toFixed(1)}％
                </p>
              </div>
            )}
            <div
              style={{
                width: '100%',
                aspectRatio: '4/3',
                borderRadius: 6,
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              {captureMosaic ? (
                <MosaicImage src={src} alt={rec.title} style={{ width: '100%', height: '100%' }} />
              ) : (
                <img src={src} alt={rec.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#1f2937',
                margin: '0 0 8px 0',
                lineHeight: 1.45,
                minHeight: 32,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
              }}
            >
              {titleText}
            </p>
            <p style={{ fontSize: 9, color: '#6b7280', margin: 0, lineHeight: 1.35 }}>{rec.authorName}</p>
          </div>
        );
      })}
    </div>
  );
}
