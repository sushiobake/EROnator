/**
 * ステージ：PCは 1200×800 を cover で表示。
 * スマホは 800×800 の正方形ステージを中央に（横長 contain をやめた）。白板はキャラに寄せる。
 * スマホ縦: 中央エリアに合わせて scale。横: visualViewport で確実に収め、スクロール・見切れなし。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useMediaQuery } from './useMediaQuery';

const BACKGROUND_URL = '/ilust/back.png';
const CHARACTER_URL = '/ilust/inari_1.png';
const LOGO_URL = '/ilust/eronator_logo.jpg';

interface StageProps {
  children: React.ReactNode;
  /** トップ画面のみロゴを表示する */
  showLogo?: boolean;
}

function getScale(): number {
  if (typeof window === 'undefined') return 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.max(w / STAGE_WIDTH_PX, h / STAGE_HEIGHT_PX);
  return Math.max(0.2, Math.min(2, scale));
}

const MOBILE_STAGE_PX = 800;
const MOBILE_LANDSCAPE_MARGIN = 12; // 横のときの余裕（見切れ・スクロール防止）
/** 横のときの安全マージン（高さ方向） */
const MOBILE_LANDSCAPE_SAFE_HEIGHT = 32;
/** Android 横のみ: visualViewport が実際より大きい場合の追加マージン＋高さを保守的に */
const ANDROID_LANDSCAPE_SAFE_HEIGHT = 40;

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** 縦: 中央エリアの幅・高さに収める。 */
function getMobileCenterScale(containerWidth: number, containerHeight: number): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 0.3;
  const scale = Math.min(containerWidth / MOBILE_STAGE_PX, containerHeight / MOBILE_STAGE_PX);
  return Math.max(0.25, Math.min(1.1, scale));
}

const MOBILE_HEADER_HEIGHT = 20;
const MOBILE_FOOTER_HEIGHT = 28;
const MOBILE_SQ_CHAR_LEFT = 0;
const MOBILE_SQ_CHAR_WIDTH = 360;
const MOBILE_SQ_GAP = 8;
const MOBILE_SQ_CONTENT_LEFT = MOBILE_SQ_CHAR_LEFT + MOBILE_SQ_CHAR_WIDTH + MOBILE_SQ_GAP;
const MOBILE_SQ_CHAR_HEIGHT = 720;
const MOBILE_SQ_WHITEBOARD_SIZE = 400;
const MOBILE_SQ_WHITEBOARD_PADDING = '28px 22px 28px 22px';
const MOBILE_SQ_WHITEBOARD_TOP_OFFSET = 160;

function MobileStageInner({ children, showLogo }: { children: React.ReactNode; showLogo?: boolean }) {
  return (
    <>
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
      {showLogo && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: 120,
            zIndex: 1,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 28,
          }}
        >
          <img
            src={LOGO_URL}
            alt="ERONATOR"
            style={{
              height: 64,
              width: 'auto',
              maxWidth: '70%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: MOBILE_SQ_CHAR_LEFT,
          bottom: 0,
          width: MOBILE_SQ_CHAR_WIDTH,
          height: MOBILE_SQ_CHAR_HEIGHT,
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
      <div
        style={{
          position: 'absolute',
          left: MOBILE_SQ_CONTENT_LEFT,
          top: MOBILE_SQ_WHITEBOARD_TOP_OFFSET,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: '0 8px 16px 0',
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: MOBILE_SQ_WHITEBOARD_SIZE,
            minWidth: MOBILE_SQ_WHITEBOARD_SIZE,
            height: MOBILE_SQ_WHITEBOARD_SIZE,
            minHeight: MOBILE_SQ_WHITEBOARD_SIZE,
            backgroundColor: '#fff',
            borderRadius: WHITEBOARD_BORDER_RADIUS_PX,
            padding: MOBILE_SQ_WHITEBOARD_PADDING,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

function StageInner({ children, showLogo }: { children: React.ReactNode; showLogo?: boolean }) {
  return (
    <>
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
      {showLogo && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: 120,
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
              height: 72,
              width: 'auto',
              maxWidth: '60%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
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
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

export function Stage({ children, showLogo }: StageProps) {
  const [scale, setScale] = useState(1);
  const [mobileCenterScale, setMobileCenterScale] = useState(0.3);
  const [isLandscape, setIsLandscape] = useState(false);
  const [landscapeViewport, setLandscapeViewport] = useState({ w: 0, h: 0 });
  const centerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery(768);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setScale(getScale());
      const onResize = () => setScale(getScale());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [isMobile]);

  // 縦: centerRef のサイズで scale。横: visualViewport でコンテナと scale を一致。Android 横のみ保守的にして見切れ防止。
  useEffect(() => {
    if (!isMobile) return;
    if (isLandscape) {
      const update = () => {
        const android = isAndroid();
        const vv = window.visualViewport;
        const w = vv?.width ?? window.innerWidth;
        let h = vv?.height ?? window.innerHeight;
        if (android) {
          h = Math.min(h, window.innerHeight);
        }
        setLandscapeViewport({ w, h });
        const margin = MOBILE_LANDSCAPE_MARGIN * 2;
        const availW = w - margin;
        let availH = h - MOBILE_HEADER_HEIGHT - MOBILE_FOOTER_HEIGHT - margin - MOBILE_LANDSCAPE_SAFE_HEIGHT;
        if (android) availH -= ANDROID_LANDSCAPE_SAFE_HEIGHT;
        if (availW <= 0 || availH <= 0) return;
        const s = android
          ? availH / MOBILE_STAGE_PX
          : Math.min(availW / MOBILE_STAGE_PX, availH / MOBILE_STAGE_PX);
        setMobileCenterScale(Math.max(0.25, Math.min(1.1, s)));
      };
      update();
      const vv = window.visualViewport;
      if (vv) {
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
          vv.removeEventListener('resize', update);
          vv.removeEventListener('scroll', update);
        };
      }
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    if (!centerRef.current) return;
    const el = centerRef.current;
    const update = () => {
      if (!el) return;
      setMobileCenterScale(getMobileCenterScale(el.offsetWidth, el.offsetHeight));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile, isLandscape]);

  // 横のときは body のスクロールを止める（固定レイヤーで見えている範囲だけにする）
  useEffect(() => {
    if (!isMobile || !isLandscape) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, isLandscape]);

  if (isMobile) {
    const isLandscapeActive = isLandscape && landscapeViewport.h > 0;
    const wrapperStyle = isLandscapeActive
      ? {
          position: 'fixed' as const,
          top: 0,
          left: 0,
          width: landscapeViewport.w,
          height: landscapeViewport.h,
          display: 'flex',
          flexDirection: 'column' as const,
          overflow: 'hidden',
          backgroundColor: '#e8eaed',
          zIndex: 9999,
        }
      : {
          minHeight: '100dvh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
          overflow: 'hidden',
          backgroundColor: '#e8eaed',
        };

    return (
      <div style={wrapperStyle}>
        <header
          style={{
            flexShrink: 0,
            height: MOBILE_HEADER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 12px',
            backgroundColor: 'rgba(0,0,0,0.15)',
          }}
        >
          <a href="/contact" style={{ fontSize: 12, color: '#fff', textDecoration: 'underline' }}>
            お問い合わせ
          </a>
        </header>
        <div
          ref={centerRef}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          <div
            style={{
              width: MOBILE_STAGE_PX,
              height: MOBILE_STAGE_PX,
              position: 'relative',
              flexShrink: 0,
              transform: `scale(${mobileCenterScale})`,
              transformOrigin: 'center center',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.5), 0 0 0 4px #9ca89c, 0 6px 24px rgba(0,0,0,0.14)',
            }}
          >
            <MobileStageInner showLogo={showLogo}>{children}</MobileStageInner>
          </div>
        </div>
        <footer
          style={{
            flexShrink: 0,
            height: MOBILE_FOOTER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            backgroundColor: 'rgba(0,0,0,0.15)',
          }}
        >
          <a href="/contact" style={{ fontSize: 12, color: '#fff', textDecoration: 'underline' }}>
            お問い合わせ
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.45), 0 0 0 5px #9ca89c, 0 10px 36px rgba(0,0,0,0.16)',
        }}
      >
        <StageInner showLogo={showLogo}>{children}</StageInner>
      </div>
    </div>
  );
}
