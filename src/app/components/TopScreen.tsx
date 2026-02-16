/**
 * トップ画面
 * Stage でラップし、ホワイトボード内に台詞・ボタンのみ表示。
 */

'use client';

import { APP_VERSION } from '@/config/app';
import { Stage } from './Stage';
import { useMediaQuery } from './useMediaQuery';

interface TopScreenProps {
  onPlay: () => void;
}

export function TopScreen({ onPlay }: TopScreenProps) {
  const isMobile = useMediaQuery(768);
  const subSize = isMobile ? 15 : 13;
  const btnSize = isMobile ? 18 : 18;
  return (
    <Stage
      showLogo
      characterSpeech={
        <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17, lineHeight: 1.6 }}>
          あなたが好きな同人誌を妄想してみて。私が当ててあげるわ。何でもお見通しだから。
        </p>
      }
    >
      <p style={{ margin: 0, fontSize: subSize, color: 'var(--color-text-muted)' }}>
        このコンテンツは18歳以上の方を対象としています。
      </p>
      <div style={{ marginTop: isMobile ? 12 : 16 }}>
        <button
          type="button"
          onClick={onPlay}
          style={{
            padding: isMobile ? '12px 28px' : '14px 40px',
            minHeight: 48,
            fontSize: btnSize,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '2px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          プレイする（18歳以上）
        </button>
      </div>
      <div style={{ marginTop: isMobile ? 8 : 12 }}>
        <button
          type="button"
          disabled
          style={{
            padding: isMobile ? '6px 16px' : '8px 24px',
            fontSize: isMobile ? 15 : 14,
            cursor: 'not-allowed',
            backgroundColor: 'rgba(255,255,255,0.7)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          推薦モードをプレイする（18歳以上）※近日実装
        </button>
      </div>
      <div style={{ marginTop: isMobile ? 20 : 32, marginBottom: isMobile ? 16 : 24 }}>
        <a href="/contact" style={{ fontSize: subSize, color: 'var(--color-text-muted)', textDecoration: 'underline' }}>
          お問い合わせ
        </a>
        <span style={{ marginLeft: 8, fontSize: subSize, color: 'var(--color-text-subtle)' }}>SNS</span>
        <span style={{ marginLeft: 8, fontSize: subSize, color: 'var(--color-text-subtle)' }}>{APP_VERSION}</span>
      </div>
    </Stage>
  );
}
