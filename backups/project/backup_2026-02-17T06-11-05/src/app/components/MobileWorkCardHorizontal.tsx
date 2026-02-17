/**
 * スマホ用：縦リスト内の横長カード（画像左・情報右）
 * ②③でキャンバス下のリストに使用。画像サイズはなるべく維持、FANZAで見るをわかりやすく。
 */

'use client';

import { ExternalLink } from './ExternalLink';

const IMG_WIDTH = 100;
const LINK_TEXT = 'FANZAで見る';

interface WorkItem {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
}

interface MobileWorkCardHorizontalProps {
  work: WorkItem;
  onClick?: () => void;
  showFanzaLink?: boolean;
  /** おすすめ用：似てる度 */
  matchRate?: number;
}

export function MobileWorkCardHorizontal({
  work,
  onClick,
  showFanzaLink = true,
  matchRate,
}: MobileWorkCardHorizontalProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 10,
        padding: 8,
        backgroundColor: '#fafafa',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : undefined,
        width: '100%',
        boxSizing: 'border-box',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: IMG_WIDTH,
          minWidth: IMG_WIDTH,
          flexShrink: 0,
          aspectRatio: '4/3',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <img
          src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
          alt={work.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {typeof matchRate === 'number' && (
          <p style={{ fontSize: 16, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0' }}>
            似てる度 <span style={{ color: '#059669', fontWeight: 700, fontSize: 20 }}>{matchRate.toFixed(1)}％</span>
          </p>
        )}
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 1px 0', lineHeight: 1.3, wordBreak: 'break-word' }}>
          {work.title}
        </h3>
        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: 0 }}>{work.authorName}</p>
        {showFanzaLink && (
          <div style={{ marginTop: 4, fontSize: 10 }}>
            <ExternalLink href={work.productUrl} linkText={LINK_TEXT} compact>
              {LINK_TEXT}
            </ExternalLink>
          </div>
        )}
      </div>
    </div>
  );
}
