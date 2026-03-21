/**
 * 繝医ャ繝礼判髱｢
 * Stage 縺ｧ繝ｩ繝・・縺励√・繝ｯ繧､繝医・繝ｼ繝牙・縺ｫ蜿ｰ隧槭・繝懊ち繝ｳ縺ｮ縺ｿ陦ｨ遉ｺ縲・ */

'use client';

import { useState, useEffect } from 'react';
import { Stage } from './Stage';
import { ChangelogSection } from './ChangelogSection';
import { useMediaQuery } from './useMediaQuery';

interface TopScreenProps {
  onPlay: () => void;
  onRecommend?: () => void;
  streamerMode?: boolean;
  onToggleStreamerMode?: () => void;
}

export function TopScreen({ onPlay, onRecommend, streamerMode, onToggleStreamerMode }: TopScreenProps) {
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

  const workCountText = workCount !== null ? workCount.toString() : '窶ｦ';
  const fontSize = isMobile ? 24 : 17;

  return (
    <Stage
      showLogo
      characterVariant="usually"
      characterSpeech={
        <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text)', fontSize, lineHeight: 1.6 }}>
          縺頑ｰ励↓蜈･繧翫・蜷御ｺｺ隱後∝ｿ・↓豬ｮ縺九∋縺ｦ縺ｿ縺ｦ縲・          <br />
          <span
            style={{
              color: '#c62828',
              fontWeight: 800,
              fontSize: '1.35em',
              letterSpacing: '0.02em',
              textShadow: '0 1px 2px rgba(0,0,0,0.08)',
            }}
          >
            {workCountText}菴懷刀
          </span>
          縺ｮ荳ｭ縺九ｉ蠖薙※縺ｦ縺ゅ￡繧九ｏ縲・          <br />
          菴輔〒繧ゅ♀隕矩壹＠縺縺九ｉ縲・        </p>
      }
      mobileBelowCanvas={isMobile ? <ChangelogSection variant="mobile" hideVersion /> : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: isMobile ? 'auto' : 220 }}>
        <p style={{ margin: 0, fontSize: subSize, color: 'var(--color-text-muted)' }}>
          縺薙・繧ｳ繝ｳ繝・Φ繝・・18豁ｳ莉･荳翫・譁ｹ繧貞ｯｾ雎｡縺ｨ縺励※縺・∪縺吶・        </p>
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
            繝励Ξ繧､縺吶ｋ・・8豁ｳ莉･荳奇ｼ・          </button>
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
              opacity: 0.6,
              backgroundColor: 'rgba(255,255,255,0.9)',
              color: 'var(--color-text)',
              border: '3px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            謗ｨ阮ｦ繝｢繝ｼ繝会ｼ・8豁ｳ莉･荳奇ｼ俄ｻ霑第律螳溯｣・          </button>
        </div>
        <div style={{ marginTop: isMobile ? 10 : 12 }}>
          <button
            type="button"
            disabled
            style={{
              padding: '8px 20px',
              fontSize: isMobile ? 14 : 13,
              fontWeight: 600,
              cursor: 'not-allowed',
              opacity: 0.6,
              backgroundColor: 'rgba(255,255,255,0.7)',
              color: 'var(--color-text-muted)',
              border: '2px solid var(--color-border-light)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            驟堺ｿ｡繝｢繝ｼ繝・窶ｻ霑第律螳溯｣・          </button>
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
