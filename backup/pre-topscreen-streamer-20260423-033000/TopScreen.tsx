/**
 * トップ画面
 * Stage でラップし、ホワイトボード内に台詞・ボタンのみ表示。
 */

'use client';

import { useState, useEffect } from 'react';
import { Stage } from './Stage';
import { ChangelogSection } from './ChangelogSection';
import { useMediaQuery } from './useMediaQuery';
import { StreamerCensoredText } from './StreamerCensoredText';

type RecentSuccessItem = {
  workId: string;
  title: string;
  questionCount: number;
};

interface TopScreenProps {
  /** トップの文言（行配列）。{workCount} は作品数に置換。未指定時は従来の固定文 */
  topLines?: string[];
  onPlay: () => void;
  onRecommend?: () => void;
  streamerMode?: boolean;
  onToggleStreamerMode?: () => void;
  recentSuccesses?: RecentSuccessItem[];
}

const DEFAULT_TOP_LINES = [
  '有名な同人誌を妄想してみて。',
  '{workCount}作品の中から当ててあげるわ。',
  '私は何でもお見通しだから。',
];

type HoveredButton = 'play' | 'recommend' | null;

const hoverStyle = {
  backgroundColor: '#dbeafe',
  color: 'var(--color-primary)',
  boxShadow: 'inset 0 0 0 2px var(--color-primary)',
};

export function TopScreen({ topLines, onPlay, onRecommend, streamerMode, onToggleStreamerMode, recentSuccesses = [] }: TopScreenProps) {
  const isMobile = useMediaQuery(768);
  const subSize = isMobile ? 15 : 13;
  const [workCount, setWorkCount] = useState<number | null>(null);
  const [hoveredButton, setHoveredButton] = useState<HoveredButton>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.ok ? res.json() : null)
      .then((data: { gameRegisteredCount?: number } | null) => {
        if (data && typeof data.gameRegisteredCount === 'number') {
          setWorkCount(data.gameRegisteredCount);
        }
      })
      .catch(() => {});
  }, []);

  const workCountText = workCount !== null ? workCount.toString() : '…';
  const fontSize = isMobile ? 18 : 17;
  const lineHeight = isMobile ? 1.08 : 1.15;
  const lines = (topLines && topLines.length > 0) ? topLines : DEFAULT_TOP_LINES;
  const shouldShowRecentSuccesses = recentSuccesses.length >= 5;
  const recentItems = recentSuccesses.slice(0, 10);

  const speechContent = (
    <p
      style={{
        margin: 0,
        fontWeight: 500,
        color: 'var(--color-text)',
        fontSize,
        lineHeight,
        maxWidth: isMobile ? '100%' : '24em',
      }}
    >
      {lines.map((line, i) => {
        const key = `line-${i}`;
        if (line.includes('{workCount}')) {
          const parts = line.split(/{workCount}/g);
          return (
            <span key={key}>
              {i > 0 && <br />}
              {parts[0]}
              <span style={{ color: '#c62828', fontWeight: 800, fontSize: '1.35em', letterSpacing: '0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                {workCountText}
              </span>
              {parts[1]}
              {i < lines.length - 1 && <br />}
            </span>
          );
        }
        return <span key={key}>{i > 0 && <br />}{line}{i < lines.length - 1 && <br />}</span>;
      })}
    </p>
  );

  return (
    <Stage
      showLogo
      characterVariant="usually"
      characterSpeech={speechContent}
      mobileBelowCanvas={isMobile ? <ChangelogSection variant="mobile" hideVersion /> : undefined}
    >
      <>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: isMobile ? 'auto' : 220 }}>
          <p style={{ margin: 0, fontSize: subSize, color: 'var(--color-text-muted)' }}>
            このコンテンツは<strong style={{ fontWeight: 700, textDecoration: 'underline' }}>18歳以上</strong>の方を対象としています。
          </p>
          <div
            style={{
              marginTop: isMobile ? 12 : 16,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'stretch',
              gap: isMobile ? 0 : 8,
              maxWidth: isMobile ? '100%' : 520,
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                maxWidth: isMobile ? '100%' : 320,
                width: '100%',
              }}
            >
            <button
              type="button"
              onClick={onPlay}
              onMouseEnter={() => setHoveredButton('play')}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '90%',
                padding: isMobile ? '18px 20px 18px 20px' : '20px 26px 20px 28px',
                  minHeight: isMobile ? 56 : 60,
                  fontSize: isMobile ? 20 : 19,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: hoveredButton === 'play' ? hoverStyle.backgroundColor : 'var(--color-surface)',
                  color: hoveredButton === 'play' ? hoverStyle.color : 'var(--color-text)',
                  border: '3px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: hoveredButton === 'play' ? hoverStyle.boxShadow : '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s',
                }}
              >
                <span style={{ fontSize: isMobile ? 13 : 12, fontWeight: 500, color: hoveredButton === 'play' ? 'var(--color-primary)' : 'var(--color-text-muted)', marginBottom: 4 }}>
                  同人誌エロネイターを
                </span>
                <span style={{ whiteSpace: 'nowrap', marginLeft: isMobile ? '0.25em' : '1em', fontSize: '1.45em' }}>プレイする</span>
              </button>
              <div
                style={{
                  marginTop: isMobile ? 12 : 14,
                  width: '90%',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => onRecommend?.()}
                  onMouseEnter={() => setHoveredButton('recommend')}
                  onMouseLeave={() => setHoveredButton(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: isMobile ? '12px 20px' : '14px 28px',
                    minHeight: isMobile ? 44 : 48,
                    fontSize: isMobile ? 15 : 14,
                    fontWeight: 700,
                    cursor: onRecommend ? 'pointer' : 'default',
                    opacity: onRecommend ? 1 : 0.7,
                    backgroundColor: hoveredButton === 'recommend' ? hoverStyle.backgroundColor : 'rgba(255,255,255,0.9)',
                    color: hoveredButton === 'recommend' ? hoverStyle.color : 'var(--color-text)',
                    border: '3px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: hoveredButton === 'recommend' ? hoverStyle.boxShadow : '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s',
                  }}
                >
                  <span style={{ fontSize: isMobile ? 13 : 12, fontWeight: 500, color: hoveredButton === 'recommend' ? 'var(--color-primary)' : 'var(--color-text-muted)', marginBottom: 4 }}>
                    稲荷さんに同人誌を
                  </span>
                  <span style={{ whiteSpace: 'nowrap', marginLeft: '1em', fontSize: '1.1em' }}>推薦してもらう</span>
                </button>
              </div>
            </div>
            {!isMobile && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  flex: '0 0 auto',
                  alignSelf: 'center',
                  marginRight: 12,
                }}
              >
                <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 700, textAlign: 'center' }}>
                  ※配信モード（β版）
                </span>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: onToggleStreamerMode ? 'pointer' : 'default', opacity: onToggleStreamerMode ? 1 : 0.7 }}>
                  <input
                    type="checkbox"
                    checked={streamerMode ?? false}
                    onChange={() => onToggleStreamerMode?.()}
                    disabled={!onToggleStreamerMode}
                    style={{ width: 20, height: 20, accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>オンにする</span>
                </label>
              </div>
            )}
          </div>

          {isMobile && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 700, textAlign: 'center' }}>
                ※配信モード（β版）
              </span>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: onToggleStreamerMode ? 'pointer' : 'default', opacity: onToggleStreamerMode ? 1 : 0.7 }}>
                <input
                  type="checkbox"
                  checked={streamerMode ?? false}
                  onChange={() => onToggleStreamerMode?.()}
                  disabled={!onToggleStreamerMode}
                  style={{ width: 20, height: 20, accentColor: 'var(--color-primary)' }}
                />
                <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>オンにする</span>
              </label>
            </div>
          )}
          {!isMobile && (
            <div
              style={{
                marginTop: 'auto',
                alignSelf: 'stretch',
                marginBottom: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0,
              }}
            >
              <ChangelogSection variant="pc" />
            </div>
          )}
        </div>
        {!isMobile && shouldShowRecentSuccesses && (
          <aside
            style={{
              position: 'fixed',
              top: 108,
              right: 24,
              width: 232,
              maxHeight: 'calc(100vh - 220px)',
              overflowY: 'auto',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.24)',
              background: 'rgba(12, 14, 20, 0.54)',
              backdropFilter: 'blur(4px)',
              padding: '8px 8px 6px',
              boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
              zIndex: 6,
            }}
          >
            <p style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.86)', letterSpacing: '0.03em' }}>
              最近当てられた作品
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {recentItems.map((item) => (
                <div
                  key={`${item.workId}-${item.questionCount}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    padding: '2px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 26,
                      textAlign: 'right',
                      fontSize: 10,
                      lineHeight: 1.3,
                      fontWeight: 700,
                      color: '#93c5fd',
                    }}
                  >
                    {item.questionCount}問
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      fontSize: 11,
                      lineHeight: 1.3,
                      color: 'rgba(255,255,255,0.92)',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {streamerMode ? <StreamerCensoredText text={item.title} censorAll /> : item.title}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </>
    </Stage>
  );
}
