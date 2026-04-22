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
  /** 当てた (SUCCESS) / 惜しかった (ALMOST_SUCCESS) */
  outcome?: 'SUCCESS' | 'ALMOST_SUCCESS';
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
  const [streamerInfoOpen, setStreamerInfoOpen] = useState(false);

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
  // 3件以上あれば出す。10件までは白板右のカードで表示。
  const shouldShowRecentSuccesses = recentSuccesses.length >= 3;
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
                  backgroundColor: hoveredButton === 'play' ? 'var(--color-primary-hover)' : 'var(--color-primary)',
                  color: '#ffffff',
                  border: '3px solid var(--color-primary)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: hoveredButton === 'play'
                    ? '0 6px 18px rgba(37, 99, 235, 0.35), 0 2px 4px rgba(0,0,0,0.12)'
                    : '0 4px 12px rgba(37, 99, 235, 0.28), 0 2px 4px rgba(0,0,0,0.08)',
                  transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s, border-color 0.1s',
                }}
              >
                <span style={{ fontSize: isMobile ? 13 : 12, fontWeight: 500, color: 'rgba(255,255,255,0.82)', marginBottom: 4 }}>
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
                  gap: 4,
                  flex: '0 0 auto',
                  alignSelf: 'center',
                  marginRight: 12,
                  position: 'relative',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  onMouseEnter={() => setStreamerInfoOpen(true)}
                  onMouseLeave={() => setStreamerInfoOpen(false)}
                >
                  <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 700, textAlign: 'center' }}>
                    ※配信モード（β版）
                  </span>
                  <button
                    type="button"
                    onFocus={() => setStreamerInfoOpen(true)}
                    onBlur={() => setStreamerInfoOpen(false)}
                    aria-label="配信モードの説明"
                    style={{
                      width: 18,
                      height: 18,
                      lineHeight: '16px',
                      padding: 0,
                      border: '1px solid var(--color-border)',
                      borderRadius: '50%',
                      background: streamerInfoOpen ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: streamerInfoOpen ? '#fff' : 'var(--color-text-muted)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    i
                  </button>
                </div>
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
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1.3,
                    color: 'var(--color-text-muted)',
                    textAlign: 'center',
                    letterSpacing: '0.02em',
                  }}
                >
                  サムネぼかし・伏字表示
                </span>
                {streamerInfoOpen && (
                  <div
                    role="dialog"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      width: 240,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 6px 18px rgba(15,23,42,0.16)',
                      padding: '10px 12px',
                      fontSize: 12,
                      lineHeight: 1.55,
                      color: 'var(--color-text)',
                      zIndex: 8,
                      textAlign: 'left',
                    }}
                  >
                    <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>配信モード ON でこう変わります</p>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      <li>作品サムネ画像にぼかしがかかる（ホバーで薄くなる）</li>
                      <li>エロワード・タイトル頭文字などが伏字表示になる</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => setStreamerInfoOpen(false)}
                      style={{
                        marginTop: 6,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-muted)',
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      閉じる
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isMobile && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={() => setStreamerInfoOpen(true)}
                onMouseLeave={() => setStreamerInfoOpen(false)}
              >
                <span style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 700, textAlign: 'center' }}>
                  ※配信モード（β版）
                </span>
                <button
                  type="button"
                  onClick={() => setStreamerInfoOpen((v) => !v)}
                  aria-label="配信モードの説明"
                  style={{
                    width: 18,
                    height: 18,
                    lineHeight: '16px',
                    padding: 0,
                    border: '1px solid var(--color-border)',
                    borderRadius: '50%',
                    background: streamerInfoOpen ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: streamerInfoOpen ? '#fff' : 'var(--color-text-muted)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  i
                </button>
              </div>
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
              <span
                style={{
                  fontSize: 11,
                  lineHeight: 1.3,
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                }}
              >
                サムネぼかし・伏字表示
              </span>
              {streamerInfoOpen && (
                <div
                  role="dialog"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 260,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 6px 18px rgba(15,23,42,0.16)',
                    padding: '10px 12px',
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'var(--color-text)',
                    zIndex: 8,
                    textAlign: 'left',
                  }}
                >
                  <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>配信モード ON でこう変わります</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>作品サムネ画像にぼかしがかかる（タップで薄くなる）</li>
                    <li>エロワード・タイトル頭文字などが伏字表示になる</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => setStreamerInfoOpen(false)}
                    style={{
                      marginTop: 6,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      fontSize: 11,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    閉じる
                  </button>
                </div>
              )}
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
            aria-label="最近のプレイ履歴"
            style={{
              position: 'fixed',
              top: 188,
              right: 20,
              width: 264,
              maxHeight: 'calc(100vh - 260px)',
              overflowY: 'auto',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              padding: '10px 12px 8px',
              boxShadow: '0 6px 18px rgba(15, 23, 42, 0.10)',
              zIndex: 6,
              color: 'var(--color-text)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                margin: '0 0 8px 0',
                paddingBottom: 6,
                borderBottom: '1px solid var(--color-border-light)',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>🔮</span>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.03em' }}>
                最近のプレイ履歴
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentItems.map((item, idx) => {
                const isAlmost = item.outcome === 'ALMOST_SUCCESS';
                return (
                  <div
                    key={`${item.workId}-${idx}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '4px 2px',
                      borderBottom: idx === recentItems.length - 1 ? 'none' : '1px solid var(--color-border-light)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        lineHeight: 1.35,
                        fontWeight: 500,
                        color: isAlmost ? '#9a3412' : 'var(--color-text)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-all',
                      }}
                      title={item.title}
                    >
                      {streamerMode ? <StreamerCensoredText text={item.title} censorAll /> : item.title}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 10,
                        lineHeight: 1.3,
                        color: 'var(--color-text-subtle)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {isAlmost && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0 6px',
                            borderRadius: 999,
                            background: '#fff1e6',
                            color: '#c2410c',
                            fontWeight: 700,
                            fontSize: 10,
                          }}
                        >
                          惜しかった…
                        </span>
                      )}
                      <span>{item.questionCount}問</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </>
    </Stage>
  );
}
