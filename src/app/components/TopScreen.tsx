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

const fontFamily = '"Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN", "メイリオ", Meiryo, sans-serif';

export function TopScreen({ onPlay }: TopScreenProps) {
  const isMobile = useMediaQuery(768);
  const textSize = isMobile ? 17 : 16;
  const subSize = isMobile ? 15 : 13;
  const btnSize = isMobile ? 18 : 18;
  return (
    <Stage showLogo>
      <p style={{ margin: 0, fontSize: textSize, lineHeight: 1.6, color: '#1f2937' }}>
        あなたが好きな同人誌を妄想してみて。私が当ててあげるわ。何でもお見通しだから。
      </p>
      <p style={{ marginTop: isMobile ? 12 : 20, fontSize: subSize, color: 'rgba(0,0,0,0.65)' }}>
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
            backgroundColor: '#fff',
            color: '#1f2937',
            border: '2px solid #d1d5db',
            borderRadius: 12,
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            fontFamily,
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
            color: '#6b7280',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontFamily,
          }}
        >
          推薦モードをプレイする（18歳以上）※近日実装
        </button>
      </div>
      <div style={{ marginTop: isMobile ? 20 : 32, marginBottom: isMobile ? 16 : 24 }}>
        <a href="/contact" style={{ fontSize: subSize, color: '#4b5563', textDecoration: 'underline' }}>
          お問い合わせ
        </a>
        <span style={{ marginLeft: 8, fontSize: subSize, color: '#9ca3af' }}>{APP_VERSION}</span>
      </div>
    </Stage>
  );
}
