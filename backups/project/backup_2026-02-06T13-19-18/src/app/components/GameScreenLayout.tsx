/**
 * ゲーム画面用レイアウト：背景画像＋キャラ（透過）を重ね、その上に子要素を表示
 * キャラ位置は px 指定でブラウザ間の差を抑える（左少し・下なし・上少し）
 */

'use client';

import {
  CHARACTER_LEFT_PX,
  CHARACTER_WIDTH_PX,
  CHARACTER_HEIGHT_PX,
  CHARACTER_TOP_MARGIN_PX,
} from './gameLayoutConstants';

const BACKGROUND_URL = '/ilust/back.png';
const CHARACTER_URL = '/ilust/inari_1.png';

interface GameScreenLayoutProps {
  children: React.ReactNode;
}

export function GameScreenLayout({ children }: GameScreenLayoutProps) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
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
      {/* キャラ：左に少し余白・下余白なし・上に少し余白・pxで固定 */}
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
      {/* コンテンツ（質問・ボタン等） */}
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  );
}
