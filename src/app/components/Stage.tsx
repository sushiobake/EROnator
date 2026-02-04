/**
 * ステージ：固定 px サイズのキャンバスを viewport に合わせて scale する
 * 背景・キャラ・ホワイトボードのバランスを保ったまま全体を拡大縮小する
 */

'use client';

import { useEffect, useState } from 'react';
import {
  STAGE_WIDTH_PX,
  STAGE_HEIGHT_PX,
  CHARACTER_LEFT_PX,
  CHARACTER_WIDTH_PX,
  CHARACTER_HEIGHT_PX,
  CONTENT_OFFSET_LEFT_PX,
  WHITEBOARD_MAX_WIDTH_PX,
  WHITEBOARD_PADDING_PX,
  WHITEBOARD_BORDER_RADIUS_PX,
} from './gameLayoutConstants';

const BACKGROUND_URL = '/ilust/back.png';
const CHARACTER_URL = '/ilust/inari_1.png';
const fontFamily = '"Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN", "メイリオ", Meiryo, sans-serif';

interface StageProps {
  children: React.ReactNode;
}

function getScale(): number {
  if (typeof window === 'undefined') return 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.min(w / STAGE_WIDTH_PX, h / STAGE_HEIGHT_PX);
  return Math.max(0.2, Math.min(2, scale));
}

export function Stage({ children }: StageProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setScale(getScale());
    const onResize = () => setScale(getScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily,
      }}
    >
      <div
        style={{
          width: STAGE_WIDTH_PX,
          height: STAGE_HEIGHT_PX,
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        {/* 背景（ステージ全面） */}
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
        {/* キャラ：固定 px で左下寄せ */}
        <div
          style={{
            position: 'absolute',
            left: CHARACTER_LEFT_PX,
            bottom: 0,
            width: CHARACTER_WIDTH_PX,
            height: CHARACTER_HEIGHT_PX,
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
        {/* ホワイトボードエリア：キャラの直右・縦中央 */}
        <div
          style={{
            position: 'absolute',
            left: CONTENT_OFFSET_LEFT_PX,
            top: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: '32px 32px 32px 0',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: WHITEBOARD_MAX_WIDTH_PX,
              backgroundColor: '#fff',
              borderRadius: WHITEBOARD_BORDER_RADIUS_PX,
              padding: WHITEBOARD_PADDING_PX,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
