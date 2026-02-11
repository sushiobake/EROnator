/**
 * トップ画面
 * Stage でラップし、ホワイトボード内に台詞・ボタンのみ表示。
 */

'use client';

import { Stage } from './Stage';

interface TopScreenProps {
  onPlay: () => void;
}

const fontFamily = '"Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN", "メイリオ", Meiryo, sans-serif';

export function TopScreen({ onPlay }: TopScreenProps) {
  return (
    <Stage>
      <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, color: '#1f2937' }}>
        あなたが好きな同人誌を妄想してみて。私が当ててあげるわ。何でもお見通しだから。
      </p>
      <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
        このコンテンツは18歳以上の方を対象としています。
      </p>
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={onPlay}
          style={{
            padding: '12px 40px',
            fontSize: 18,
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
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          disabled
          style={{
            padding: '8px 24px',
            fontSize: 14,
            cursor: 'not-allowed',
            backgroundColor: 'rgba(255,255,255,0.7)',
            color: '#6b7280',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontFamily,
          }}
        >
          推薦モードをプレイする（18歳以上）
        </button>
      </div>
      <div style={{ marginTop: 32, marginBottom: 24 }}>
        <a href="/contact" style={{ fontSize: 14, color: '#4b5563', textDecoration: 'underline' }}>
          お問い合わせ
        </a>
      </div>
    </Stage>
  );
}
