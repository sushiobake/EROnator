/**
 * トップ画面
 * キャラ位置は gameLayoutConstants で GameScreenLayout と同一（px 固定）。コンテンツは少し右に配置。
 */

'use client';

import {
  CHARACTER_LEFT_PX,
  CHARACTER_WIDTH_PX,
  CHARACTER_HEIGHT_PX,
  CHARACTER_TOP_MARGIN_PX,
  CONTENT_OFFSET_LEFT_PX,
} from './gameLayoutConstants';

const BACKGROUND_URL = '/ilust/back.png';
const CHARACTER_URL = '/ilust/inari_1.png';

const fontFamily = '"Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN", "メイリオ", Meiryo, sans-serif';

interface TopScreenProps {
  onPlay: () => void;
}

export function TopScreen({ onPlay }: TopScreenProps) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        fontFamily,
      }}
    >
      {/* 背景（全面） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${BACKGROUND_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }}
      />

      {/* キャラ（大きく・左下・下余白なし） */}
      <div
        style={{
          position: 'absolute',
          left: CHARACTER_LEFT_PX,
          bottom: 0,
          top: 'auto',
          width: CHARACTER_WIDTH_PX,
          height: CHARACTER_HEIGHT_PX,
          maxHeight: `calc(100vh - ${CHARACTER_TOP_MARGIN_PX}px)`,
          maxWidth: '100%',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <img
          src={CHARACTER_URL}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'left bottom',
          }}
        />
      </div>

      {/* コンテンツ行: 左スペーサー（キャラ幅）＋右にセリフ・ボタン（必ずキャラの右隣） */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          width: '100%',
          minHeight: '100vh',
          paddingTop: CHARACTER_TOP_MARGIN_PX,
        }}
      >
        <div style={{ width: CONTENT_OFFSET_LEFT_PX, flexShrink: 0 }} aria-hidden />
        <div
          style={{
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '2rem 2rem 2rem 0',
            maxWidth: '480px',
          }}
        >
        {/* セリフ */}
        <div
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            maxWidth: '420px',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, color: '#1f2937' }}>
            あなたが好きな同人誌を妄想してみて。私が当ててあげるわ。何でもお見通しだから。
          </p>
        </div>

        {/* 18歳注意（小さく） */}
        <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'rgba(0,0,0,0.65)' }}>
          このコンテンツは18歳以上の方を対象としています。
        </p>

        {/* プレイする（18歳以上） */}
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onPlay}
            style={{
              padding: '0.75rem 2.5rem',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              backgroundColor: '#fff',
              color: '#1f2937',
              border: '2px solid #d1d5db',
              borderRadius: '12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              fontFamily,
            }}
          >
            プレイする（18歳以上）
          </button>
        </div>

        {/* 推薦モード（未実装・小さく） */}
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            disabled
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: '0.9rem',
              cursor: 'not-allowed',
              backgroundColor: 'rgba(255,255,255,0.7)',
              color: '#6b7280',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontFamily,
            }}
          >
            推薦モードをプレイする（18歳以上）
          </button>
        </div>

        {/* お問い合わせ */}
        <div style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
          <a href="/contact" style={{ fontSize: '0.9rem', color: '#4b5563', textDecoration: 'underline' }}>
            お問い合わせ
          </a>
        </div>
        </div>
      </div>
    </div>
  );
}
