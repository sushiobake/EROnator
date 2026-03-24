/**
 * スマホ用：縦リスト内の横長カード（画像左・情報右）
 * ②③でキャンバス下のリストに使用。画像サイズはなるべく維持、FANZAで見るをわかりやすく。
 */

'use client';

import { ExternalLink } from './ExternalLink';
import { StreamerCensoredText } from './StreamerCensoredText';

const IMG_WIDTH = 120;
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
  /** おすすめ用：％表示のラベル（本編は「似てる度」、推薦は「好みマッチ度」など） */
  matchRate?: number;
  matchRateLabel?: string;
  /** FANZAクリック記録用（本編セッション） */
  sessionId?: string | null;
  /** 推薦モードのプレイ履歴用 */
  recommendSessionId?: string | null;
  /** 2列グリッド用：画像を小さく */
  compact?: boolean;
  /** 配信者モード時はタイトルを部分的伏字 */
  streamerMode?: boolean;
}

export function MobileWorkCardHorizontal({
  work,
  onClick,
  showFanzaLink = true,
  matchRate,
  matchRateLabel = '似てる度',
  sessionId,
  recommendSessionId,
  compact = false,
  streamerMode,
}: MobileWorkCardHorizontalProps) {
  const imgW = compact ? 70 : IMG_WIDTH;
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
          width: imgW,
          minWidth: imgW,
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
          <p style={{ fontSize: compact ? 12 : 13, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0' }}>
            {matchRateLabel}{' '}
            <span style={{ color: '#059669', fontWeight: 700, fontSize: compact ? 14 : 20 }}>{matchRate.toFixed(1)}％</span>
          </p>
        )}
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 1px 0', lineHeight: 1.3, minHeight: 47, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, wordBreak: 'break-word' }}>
          {streamerMode ? <StreamerCensoredText text={work.title} censorAll /> : work.title}
        </h3>
        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: 0 }}>{work.authorName}</p>
        {showFanzaLink && (
          <div style={{ marginTop: 5, fontSize: 12 }}>
            <ExternalLink
              href={work.productUrl}
              linkText={LINK_TEXT}
              compact
              sessionId={sessionId}
              recommendSessionId={recommendSessionId}
            >
              {LINK_TEXT}
            </ExternalLink>
          </div>
        )}
      </div>
    </div>
  );
}
