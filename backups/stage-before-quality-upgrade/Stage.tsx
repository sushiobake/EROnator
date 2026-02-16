/**
 * ステージ：PCは 1200×800 を cover で表示。
 * スマホ：正方形キャンバス、左半分キャラ・右半分白板。フッターはキャンバス内。アキネイター風。
 *
 * バックアップ：質感アップ・キャラ影 実装前
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
  const h = Math.max(1, window.outerHeight - PC_FOOTER_HEIGHT - PC_CANVAS_FOOTER_GAP - 8);
  const scale = Math.max(w / STAGE_WIDTH_PX, h / STAGE_HEIGHT_PX);
  return Math.max(0.2, Math.min(1.5, scale));
}

const PC_FOOTER_HEIGHT = 67;
const PC_CANVAS_FOOTER_GAP = 40;
const PC_CANVAS_CORNER_RADIUS = 16;
const PC_FRAME_WIDTH = 10;
const PC_FRAME_TRAY_HEIGHT = 14;
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

function WhiteboardFrameSvg() {
  const R = PC_CANVAS_CORNER_RADIUS;
  const W = STAGE_WIDTH_PX;
  const H = STAGE_HEIGHT_PX;
  const FRAME_W = PC_FRAME_WIDTH;
  const TRAY_H = PC_FRAME_TRAY_HEIGHT;
  const PAD = 2;
  const pathD = `M ${R + FRAME_W / 2} ${FRAME_W / 2} L ${W - R - FRAME_W / 2} ${FRAME_W / 2} Q ${W - FRAME_W / 2} ${FRAME_W / 2} ${W - FRAME_W / 2} ${R + FRAME_W / 2} L ${W - FRAME_W / 2} ${H - FRAME_W / 2} L ${FRAME_W / 2} ${H - FRAME_W / 2} L ${FRAME_W / 2} ${R + FRAME_W / 2} Q ${FRAME_W / 2} ${FRAME_W / 2} ${R + FRAME_W / 2} ${FRAME_W / 2} Z`;
  return (
    <svg viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`} preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} aria-hidden>
      <defs>
        <linearGradient id="frame-metal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a8a8a8" /><stop offset="50%" stopColor="#888" /><stop offset="100%" stopColor="#6a6a6a" />
        </linearGradient>
        <linearGradient id="corner-cap" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2a2a2a" /><stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
        <linearGradient id="tray-metal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7a7a7a" /><stop offset="100%" stopColor="#555" />
        </linearGradient>
      </defs>
      <path d={pathD} fill="none" stroke="url(#frame-metal)" strokeWidth={FRAME_W} strokeLinejoin="round" />
      <rect x={0} y={0} width={R + 4} height={R + 4} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={W - R - 4} y={0} width={R + 4} height={R + 4} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={0} y={H - R - 4} width={R + 4} height={R + 4} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={W - R - 4} y={H - R - 4} width={R + 4} height={R + 4} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={FRAME_W} y={H - TRAY_H - FRAME_W / 2} width={W - FRAME_W * 2} height={TRAY_H} rx={2} fill="url(#tray-metal)" />
    </svg>
  );
}

function MobileStageInner({ children, characterSpeech }: { children: React.ReactNode; characterSpeech?: React.ReactNode }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#fff', zIndex: 0 }} />
      {characterSpeech && (
        <div style={{ position: 'absolute', left: 12, right: 12, top: 12, height: MOBILE_TOP_BOARD_HEIGHT, backgroundColor: '#f0ede8', borderRadius: 10, padding: '10px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 2, overflow: 'hidden' }}>
          {characterSpeech}
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, top: characterSpeech ? 12 + MOBILE_TOP_BOARD_HEIGHT + 8 : 0, right: 0, bottom: MOBILE_FOOTER_HEIGHT, display: 'flex', flexDirection: 'row', padding: characterSpeech ? '0 12px 0 8px' : '8px', gap: 8, zIndex: 1 }}>
        <div style={{ width: '50%', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 0, marginLeft: -8, pointerEvents: 'none', overflow: 'visible' }}>
          <img src={CHARACTER_URL} alt="" style={{ width: '120%', maxWidth: 547, height: 'auto', maxHeight: '100%', objectFit: 'contain', objectPosition: 'left bottom' }} />
        </div>
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0, zIndex: 2 }}>
          <div style={{ width: '100%', maxWidth: 420, aspectRatio: '3/4', maxHeight: '100%', backgroundColor: '#faf8f5', borderRadius: 10, padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', boxSizing: 'border-box', overflowY: 'auto', fontSize: 14, lineHeight: 1.45, zoom: 1.62 } as React.CSSProperties }>
            {children}
          </div>
        </div>
      </div>
      <footer style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: MOBILE_FOOTER_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(15,15,20,0.98) 100%)', borderTop: '1px solid rgba(255,255,255,0.06)', zIndex: 1 }}>
        <a href="/contact" style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', textDecoration: 'none', letterSpacing: '0.02em' }}>お問い合わせ</a>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>SNS</span>
      </footer>
    </>
  );
}

function StageInner({ children, showLogo, characterSpeech, scale }: { children: React.ReactNode; showLogo?: boolean; characterSpeech?: React.ReactNode; scale?: number }) {
  const insetTop = PC_FRAME_WIDTH;
  const insetBottom = PC_FRAME_TRAY_HEIGHT + PC_FRAME_WIDTH;
  const insetSide = PC_FRAME_WIDTH;
  return (
    <>
      <div style={{ position: 'absolute', left: insetSide, top: insetTop, right: insetSide, bottom: insetBottom, backgroundColor: '#fff', zIndex: 0, borderRadius: `${Math.max(0, PC_CANVAS_CORNER_RADIUS - insetSide)}px ${Math.max(0, PC_CANVAS_CORNER_RADIUS - insetSide)}px 0 0` }} />
      {showLogo && (
        <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 120, zIndex: 1, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 32 }}>
          <img src={LOGO_URL} alt="ERONATOR" style={{ height: 72, width: 'auto', maxWidth: '60%', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ position: 'absolute', left: CHARACTER_LEFT_PX, bottom: scale ? -Math.ceil(PC_CANVAS_FOOTER_GAP / (scale * 0.6)) : 0, width: CHARACTER_WIDTH_PX, height: CHARACTER_HEIGHT_PX, zIndex: 1, pointerEvents: 'none' }}>
        <img src={CHARACTER_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'left bottom' }} />
      </div>
      <div style={{ position: 'absolute', left: CONTENT_OFFSET_LEFT_PX, top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '32px 32px 32px 0', zIndex: 2 }}>
        <div style={{ width: '100%', maxWidth: WHITEBOARD_MAX_WIDTH_PX, backgroundColor: '#faf8f5', borderRadius: WHITEBOARD_BORDER_RADIUS_PX, padding: WHITEBOARD_PADDING_PX, boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)', boxSizing: 'border-box' }}>
          {characterSpeech && <div style={{ marginBottom: 16 }}>{characterSpeech}</div>}
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
    if (!isMobile) { setScale(getScale()); const onResize = () => setScale(getScale()); window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }
    else { setMobileScale(getMobileScale()); const onResize = () => setMobileScale(getMobileScale()); window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize); }
  }, [isMobile]);
  if (isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '18%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${BACKGROUND_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, position: 'relative', zIndex: 10 }}>
          <img src={LOGO_URL} alt="ERONATOR" style={{ height: 56, width: 'auto', maxWidth: '90%', objectFit: 'contain', marginBottom: 12 }} />
          <div style={{ width: MOBILE_CANVAS_PX, height: MOBILE_CANVAS_PX, position: 'relative', transform: `scale(${mobileScale})`, transformOrigin: 'center center', flexShrink: 0, borderRadius: 14, overflow: 'hidden', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.5), 0 0 0 2px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.2)' }}>
            <MobileStageInner characterSpeech={characterSpeech}>{children}</MobileStageInner>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-20%', right: '-20%', bottom: '-20%', zIndex: 0, backgroundImage: `url(${BACKGROUND_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(10px)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)' }} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', position: 'relative', zIndex: 1, minHeight: 0 }}>
        <div style={{ width: STAGE_WIDTH_PX, height: STAGE_HEIGHT_PX, position: 'relative', transform: `scale(${scale * 0.6})`, transformOrigin: 'center bottom', flexShrink: 0, marginBottom: PC_CANVAS_FOOTER_GAP, borderRadius: `${PC_CANVAS_CORNER_RADIUS}px ${PC_CANVAS_CORNER_RADIUS}px 0 0`, overflow: 'visible', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.35), 0 10px 36px rgba(0,0,0,0.16)' }}>
          <WhiteboardFrameSvg />
          <StageInner showLogo={showLogo} characterSpeech={characterSpeech} scale={scale}>{children}</StageInner>
        </div>
      </div>
      <footer style={{ width: '100%', height: PC_FOOTER_HEIGHT, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(15,15,20,0.98) 100%)', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 1 }}>
        <a href="/contact" style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', textDecoration: 'none', letterSpacing: '0.02em' }}>お問い合わせ</a>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>SNS</span>
      </footer>
    </div>
  );
}
