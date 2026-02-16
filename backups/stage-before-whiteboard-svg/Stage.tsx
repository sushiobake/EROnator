/**
 * ステージ：PCは 1200×800 を cover で表示。
 * スマホ：正方形キャンバス、左半分キャラ・右半分白板。フッターはキャンバス内。アキネイター風。
 *
 * バックアップ：SVG ホワイトボードフレーム実装前
 * 日付：2026-02-16
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
import { useMediaQuery } from './useMediaQuery';

const BACKGROUND_URL = '/ilust/back.png';
const CHARACTER_URL = '/ilust/inari_1.png';
const LOGO_URL = '/ilust/eronator_logo.jpg';

interface StageProps {
  children: React.ReactNode;
  /** PCのみ：トップ画面でロゴを表示 */
  showLogo?: boolean;
  /** キャラの発言（全画面共通。スマホ=横長板、PC=質問文と同じスタイル） */
  characterSpeech?: React.ReactNode;
}

function getScale(): number {
  if (typeof window === 'undefined') return 1;
  const w = window.outerWidth;
  // 隙間分を差し引き、キャンバス分の高さだけ上に収める
  const h = Math.max(1, window.outerHeight - PC_FOOTER_HEIGHT - PC_CANVAS_FOOTER_GAP - 8);
  const scale = Math.max(w / STAGE_WIDTH_PX, h / STAGE_HEIGHT_PX);
  return Math.max(0.2, Math.min(1.5, scale));
}

const PC_FOOTER_HEIGHT = 67;
/** PC版：キャンバスとフッターの隙間（px）。キャラの足はここにはみ出してフッターとつながる */
const PC_CANVAS_FOOTER_GAP = 40;
const MOBILE_CANVAS_PX = 800;
const MOBILE_FOOTER_HEIGHT = 40;
const MOBILE_TOP_BOARD_HEIGHT = 100;

function getMobileScale(): number {
  if (typeof window === 'undefined') return 0.5;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const s = Math.min(w / MOBILE_CANVAS_PX, h / MOBILE_CANVAS_PX);
  return Math.max(0.3, Math.min(1.2, s));
}

/** スマホ：横長板=キャラ発言、左キャラ・右白板。フッターはキャンバス内。 */
function MobileStageInner({
  children,
  characterSpeech,
}: {
  children: React.ReactNode;
  characterSpeech?: React.ReactNode;
}) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#fff',
          zIndex: 0,
        }}
      />
      {/* 中央上：横長の板（キャラ発言） */}
      {characterSpeech && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 12,
            height: MOBILE_TOP_BOARD_HEIGHT,
            backgroundColor: '#f0ede8',
            borderRadius: 10,
            padding: '10px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2,
            overflow: 'hidden',
          }}
        >
          {characterSpeech}
        </div>
      )}
      {/* メイン：左キャラ、右白板 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: characterSpeech ? 12 + MOBILE_TOP_BOARD_HEIGHT + 8 : 0,
          right: 0,
          bottom: MOBILE_FOOTER_HEIGHT,
          display: 'flex',
          flexDirection: 'row',
          padding: characterSpeech ? '0 12px 0 8px' : '8px',
          gap: 8,
          zIndex: 1,
        }}
      >
        {/* 左半分：キャラ（1.2倍、はみ出しOK・左寄せ） */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            padding: 0,
            marginLeft: -8,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <img
            src={CHARACTER_URL}
            alt=""
            style={{
              width: '120%',
              maxWidth: 547,
              height: 'auto',
              maxHeight: '100%',
              objectFit: 'contain',
              objectPosition: 'left bottom',
            }}
          />
        </div>
        {/* 右半分：白板（正方形、下固定・キャラの右に並ぶ、1.4倍） */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            minWidth: 0,
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              aspectRatio: '3/4',
              maxHeight: '100%',
              backgroundColor: '#faf8f5',
              borderRadius: 10,
              padding: '12px 14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              boxSizing: 'border-box',
              overflowY: 'auto',
              fontSize: 14,
              lineHeight: 1.45,
              zoom: 1.62,
            } as React.CSSProperties}
          >
            {children}
          </div>
        </div>
      </div>
      {/* フッター：キャンバス内 */}
      <footer
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: MOBILE_FOOTER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(15,15,20,0.98) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 1,
        }}
      >
        <a
          href="/contact"
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.9)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          お問い合わせ
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>
          SNS
        </span>
      </footer>
    </>
  );
}

function StageInner({ children, showLogo, characterSpeech, scale }: { children: React.ReactNode; showLogo?: boolean; characterSpeech?: React.ReactNode; scale?: number }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#fff',
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
          bottom: scale ? -Math.ceil(PC_CANVAS_FOOTER_GAP / (scale * 0.6)) : 0,
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
            backgroundColor: '#faf8f5',
            borderRadius: WHITEBOARD_BORDER_RADIUS_PX,
            padding: WHITEBOARD_PADDING_PX,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
            boxSizing: 'border-box',
          }}
        >
          {characterSpeech && (
            <div style={{ marginBottom: 16 }}>
              {characterSpeech}
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}

export function Stage({ children, showLogo, characterSpeech }: StageProps) {
  const [scale, setScale] = useState(1);
  const [mobileScale, setMobileScale] = useState(0.5);
  const isMobile = useMediaQuery(768);

  useEffect(() => {
    if (!isMobile) {
      setScale(getScale());
      const onResize = () => setScale(getScale());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    } else {
      setMobileScale(getMobileScale());
      const onResize = () => setMobileScale(getMobileScale());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [isMobile]);

  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '18%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${BACKGROUND_URL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(10px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {/* ロゴ＋キャンバス：ロゴはキャンバスの少し上、ヘッダー無し */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <img
            src={LOGO_URL}
            alt="ERONATOR"
            style={{
              height: 56,
              width: 'auto',
              maxWidth: '90%',
              objectFit: 'contain',
              marginBottom: 12,
            }}
          />
          <div
            style={{
              width: MOBILE_CANVAS_PX,
              height: MOBILE_CANVAS_PX,
              position: 'relative',
              transform: `scale(${mobileScale})`,
              transformOrigin: 'center center',
              flexShrink: 0,
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.5), 0 0 0 2px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            <MobileStageInner characterSpeech={characterSpeech}>{children}</MobileStageInner>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-20%',
          right: '-20%',
          bottom: '-20%',
          zIndex: 0,
          backgroundImage: `url(${BACKGROUND_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(10px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          position: 'relative',
          zIndex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: STAGE_WIDTH_PX,
            height: STAGE_HEIGHT_PX,
            position: 'relative',
            transform: `scale(${scale * 0.6})`,
            transformOrigin: 'center bottom',
            flexShrink: 0,
            marginBottom: PC_CANVAS_FOOTER_GAP,
            borderRadius: '16px 16px 0 0',
            overflow: 'visible',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.45), 0 0 0 5px #000, 0 10px 36px rgba(0,0,0,0.16)',
          }}
        >
          <StageInner showLogo={showLogo} characterSpeech={characterSpeech} scale={scale}>{children}</StageInner>
        </div>
      </div>
      <footer
        style={{
          width: '100%',
          height: PC_FOOTER_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(15,15,20,0.98) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <a
          href="/contact"
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.9)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          お問い合わせ
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>
          SNS
        </span>
      </footer>
    </div>
  );
}
