/**
 * StageV2：アキネイター風レイアウト
 * - PC：fluid レイアウト＋2倍サイズ感。固定アスペクト窓内でキャラ35%、白板65%
 *       黒い外枠（stage-bg）あり
 * - 白板：内部スクロールなし（プレイしづらいため NG）
 * - スマホ横：compact 時はフォント縮小でスクロール回避
 * - スマホ縦：横レイアウトを transform scale で幅に縮小（アキネイター同様）
 */

'use client';

import { useEffect, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

/** 背景画像（テスト時は null で真っ白） */
const BACKGROUND_URL: string | null = null; // '/ilust/back.png';
const CHARACTER_URL = '/ilust/inari_1.png';
const LOGO_URL = '/ilust/eronator_logo.jpg';

/** PC：固定キャンバス寸法（2倍・scale で確実に表示） */
const PC_STAGE_WIDTH = 2400;
const PC_STAGE_HEIGHT = 1600;

/** ゲームエリアのベース寸法（スマホ縦用） */
const GAME_BASE_WIDTH = 800;
const GAME_BASE_HEIGHT = 500;

const FOOTER_HEIGHT = 56;
const WIDE_BREAKPOINT = 768;
const COMPACT_HEIGHT_THRESHOLD = 500;

interface StageV2Props {
  children: React.ReactNode;
  showLogo?: boolean;
}

export function StageV2({ children, showLogo }: StageV2Props) {
  // useMediaQuery(768)=true は幅≤768（モバイル）。PC用に反転する
  const isWide = !useMediaQuery(WIDE_BREAKPOINT);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () =>
      setViewport({
        w: typeof window !== 'undefined' ? window.innerWidth : 0,
        h: typeof window !== 'undefined' ? window.innerHeight : 0,
      });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isCompact = isWide && viewport.h > 0 && viewport.h < COMPACT_HEIGHT_THRESHOLD;

  // PC：2400×1600 を scale でビューポートにフィット（contain＝黒枠残す）
  const pcScale =
    viewport.w > 0 && viewport.h > 0 && isWide
      ? Math.min(
          2,
          Math.min(
            viewport.w / PC_STAGE_WIDTH,
            (viewport.h - FOOTER_HEIGHT) / PC_STAGE_HEIGHT
          )
        )
      : 1;

  // スマホ縦: 横レイアウトを幅に収める scale
  const portraitScale =
    viewport.w > 0 && !isWide ? Math.max(0.35, Math.min(viewport.w / GAME_BASE_WIDTH, 1)) : 1;

  const footer = (
    <footer
      style={{
        flexShrink: 0,
        height: FOOTER_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '0 12px',
        backgroundColor: 'rgba(0,0,0,0.25)',
        backdropFilter: 'saturate(1.1)',
        fontSize: 13,
      }}
    >
      <a href="/contact" style={{ color: 'rgba(255,255,255,0.9)', textDecoration: 'underline' }}>
        お問い合わせ
      </a>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>SNSなど載せる場所</span>
    </footer>
  );

  // 白板コンテンツラッパー（内部スクロールなし・2倍サイズ感）
  const whiteboardInner = (
    <div
      className={isCompact ? 'stage-whiteboard-compact' : undefined}
      style={{
        width: '100%',
        maxWidth: 1000,
        backgroundColor: '#fff',
        borderRadius: 'var(--radius-xl)',
        padding: '40px 48px',
        boxShadow: 'var(--shadow-card)',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );

  // PC・スマホ横：2400×1600 固定＋scale（contain・黒枠残す・2倍・キャラ35%）
  if (isWide) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--stage-bg)',
        }}
      >
        <main
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: PC_STAGE_WIDTH,
              height: PC_STAGE_HEIGHT,
              flexShrink: 0,
              transform: `scale(${pcScale})`,
              transformOrigin: 'center center',
            }}
          >
            {/* 背景：全エリアをカバー（テスト時は真っ白） */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                ...(BACKGROUND_URL
                  ? {
                      backgroundImage: `url(${BACKGROUND_URL})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }
                  : { backgroundColor: '#fff' }),
                zIndex: 0,
              }}
            />
            {/* ロゴ（showLogo 時） */}
            {showLogo && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  right: 0,
                  height: 160,
                  zIndex: 1,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 32,
                }}
              >
                <img
                  src={LOGO_URL}
                  alt="ERONATOR"
                  style={{
                    height: 96,
                    width: 'auto',
                    maxWidth: '55%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}
            {/* キャラ：左側 35%・75% */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                width: '35%',
                height: '75%',
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
            {/* 白板：右側 35%〜 */}
            <div
              style={{
                position: 'absolute',
                left: '35%',
                top: 0,
                right: 0,
                bottom: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                padding: '48px 56px 56px 32px',
              }}
            >
              {whiteboardInner}
            </div>
          </div>
        </main>
        {footer}
      </div>
    );
  }

  // スマホ縦：横レイアウトを transform scale で幅に縮小（アキネイター同様）
  const scaledW = GAME_BASE_WIDTH * portraitScale;
  const scaledH = GAME_BASE_HEIGHT * portraitScale;

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100dvh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--stage-bg)',
      }}
    >
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 0',
        }}
      >
        <div
          style={{
            width: scaledW,
            height: scaledH,
            overflow: 'hidden',
            flexShrink: 0,
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              width: GAME_BASE_WIDTH,
              height: GAME_BASE_HEIGHT,
              position: 'relative',
              transform: `scale(${portraitScale})`,
              transformOrigin: 'top left',
            }}
          >
              {/* 背景（テスト時は真っ白） */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  ...(BACKGROUND_URL
                    ? {
                        backgroundImage: `url(${BACKGROUND_URL})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : { backgroundColor: '#fff' }),
                  zIndex: 0,
                }}
              />
              {showLogo && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    height: 80,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 12,
                  }}
                >
                  <img
                    src={LOGO_URL}
                    alt="ERONATOR"
                    style={{ height: 40, width: 'auto', maxWidth: '55%', objectFit: 'contain' }}
                  />
                </div>
              )}
              {/* キャラ */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  width: '42%',
                  height: '85%',
                  zIndex: 1,
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
              {/* 白板（スマホ縦：固定配置・内部スクロールなし） */}
              <div
                style={{
                  position: 'absolute',
                  left: '42%',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  padding: '24px 24px 24px 12px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: '20px 24px',
                    boxShadow: 'var(--shadow-card)',
                    boxSizing: 'border-box',
                  }}
                >
                  {children}
                </div>
              </div>
          </div>
        </div>
      </main>
      {footer}
    </div>
  );
}
