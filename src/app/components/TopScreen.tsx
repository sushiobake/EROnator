/**
 * トップ画面
 * Stage でラップし、ホワイトボード内に台詞・ボタンのみ表示。
 */

'use client';

import { useState, useEffect } from 'react';
import { Stage } from './Stage';
import { ChangelogSection } from './ChangelogSection';
import { useMediaQuery } from './useMediaQuery';

interface TopScreenProps {
  onPlay: () => void;
}

export function TopScreen({ onPlay }: TopScreenProps) {
  const isMobile = useMediaQuery(768);
  const subSize = isMobile ? 15 : 13;
  const [workCount, setWorkCount] = useState<number | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isMobile) return;
    fetch('/api/app-info')
      .then(res => res.ok ? res.json() : null)
      .then((data: { version?: string } | null) => {
        if (data && typeof data.version === 'string') setAppVersion(data.version);
      })
      .catch(() => {});
  }, [isMobile]);

  const workCountText = workCount !== null ? workCount.toString() : '…';
  const fontSize = isMobile ? 24 : 17;

  return (
    <Stage
      showLogo
      characterSpeech={
        <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text)', fontSize, lineHeight: 1.6 }}>
          お気に入りの同人誌、心に浮かべてみて。
          <br />
          <span
            style={{
              color: '#c62828',
              fontWeight: 800,
              fontSize: '1.35em',
              letterSpacing: '0.02em',
              textShadow: '0 1px 2px rgba(0,0,0,0.08)',
            }}
          >
            {workCountText}作品
          </span>
          の中から当ててあげるわ。
          <br />
          何でもお見通しだから。
        </p>
      }
      mobileBelowCanvas={isMobile ? <ChangelogSection variant="mobile" hideVersion /> : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: isMobile ? 'auto' : 220 }}>
        <p style={{ margin: 0, fontSize: subSize, color: 'var(--color-text-muted)' }}>
          このコンテンツは18歳以上の方を対象としています。
        </p>
        <div style={{ marginTop: isMobile ? 12 : 16 }}>
          <button
            type="button"
            onClick={onPlay}
            style={{
              padding: isMobile ? '16px 36px' : '18px 48px',
              minHeight: isMobile ? 52 : 56,
              fontSize: isMobile ? 20 : 19,
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '3px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            プレイする（18歳以上）
          </button>
        </div>
        <div style={{ marginTop: isMobile ? 12 : 14 }}>
          <button
            type="button"
            disabled
            style={{
              padding: isMobile ? '14px 32px' : '16px 44px',
              minHeight: isMobile ? 48 : 52,
              fontSize: isMobile ? 17 : 16,
              fontWeight: 700,
              cursor: 'not-allowed',
              backgroundColor: 'rgba(255,255,255,0.7)',
              color: 'var(--color-text-muted)',
              border: '3px solid var(--color-border-light)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            推薦モードをプレイする（18歳以上）※近日実装
          </button>
        </div>
        {isMobile && appVersion && (
          <p style={{ margin: 0, marginTop: 14, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
            {appVersion}
          </p>
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
    </Stage>
  );
}
