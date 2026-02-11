/**
 * ゲーム画面用レイアウト：背景画像＋キャラ（透過）を重ね、その上に子要素を表示
 */

'use client';

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
      {/* キャラ（透過PNG・背景の上に重ね） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 'min(42vw, 480px)',
          height: '75vh',
          maxHeight: '680px',
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
