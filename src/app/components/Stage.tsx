/**
 * ステージ：PCは 1200×800 を cover で表示。
 * スマホ：正方形キャンバス、左半分キャラ・右半分白板。フッター（法務リンク等）はキャンバス内 GameChromeFooter。ルート / では layout の SiteFooter は出さない。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { XLogo } from './icons/XLogo';
import {
  STAGE_WIDTH_PX,
  STAGE_HEIGHT_PX,
  CHARACTER_LEFT_PX,
  CHARACTER_WIDTH_PX,
  CHARACTER_HEIGHT_PX,
  CONTENT_OFFSET_LEFT_PX,
  WHITEBOARD_MAX_WIDTH_PX,
  WHITEBOARD_NARROW_WIDTH_PX,
  USE_NARROW_WHITEBOARD,
  WHITEBOARD_PADDING_PX,
  WHITEBOARD_BORDER_RADIUS_PX,
} from './gameLayoutConstants';
import { useMediaQuery } from './useMediaQuery';

const BACKGROUND_URL = '/ilust/back.png';
const CHARACTER_VARIANTS: Record<string, string> = {
  usually: '/ilust/inari_usually.png',
  question: '/ilust/inari_question.png',
  embarrassing: '/ilust/inari_embarrassing.png',
  very_embarrassing: '/ilust/inari_very_embarrassing.png',
  thinking: '/ilust/inari_thinking.png',
};
/** 考え中9種の画像。同じファイルでも可。未配置時は thinking にフォールバック */
export const THINKING_IMAGE_PATHS: Record<string, string> = {
  opening: '/ilust/inari_thinking_opening.png',
  early: '/ilust/inari_thinking_early.png',
  mid: '/ilust/inari_thinking_mid.png',
  late: '/ilust/inari_thinking_late.png',
  closing: '/ilust/inari_thinking_closing.png',
  endingCorrect: '/ilust/inari_thinking_ending_correct.png',
  endingWrong: '/ilust/inari_thinking_ending_wrong.png',
  failListSelect: '/ilust/inari_thinking_fail_list_select.png',
  failListNotInList: '/ilust/inari_thinking_fail_list_not_in_list.png',
};
const DEFAULT_CHARACTER_URL = CHARACTER_VARIANTS.usually;
const LOGO_URL = '/ilust/eronator_logo.jpg';

/** キャラ画像切り替えのクロスフェード。false で従来の単一表示に戻せる（thinking→次画像の切り替え遅延対策） */
const USE_CHARACTER_CROSSFADE = false;
/** ノベルゲーム風のスムーズさ（300ms, ease-out） */
const CROSSFADE_DURATION_MS = 300;

/** 2枚重ねでクロスフェードするキャラ画像。戻す場合は USE_CHARACTER_CROSSFADE=false */
function CharacterImage({ src, style }: { src: string; style: React.CSSProperties }) {
  const [prevSrc, setPrevSrc] = useState<string | null>(null);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [prevVisible, setPrevVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (src === currentSrc) return;
    setPrevSrc(currentSrc);
    setCurrentSrc(src);
    setPrevVisible(true);
    rafRef.current = requestAnimationFrame(() => {
      setPrevVisible(false);
      rafRef.current = null;
    });
    const t = setTimeout(() => setPrevSrc(null), CROSSFADE_DURATION_MS + 50);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(t);
    };
  }, [src, currentSrc]);

  if (!USE_CHARACTER_CROSSFADE) {
    return <img src={src} alt="" style={style} />;
  }

  const transition = `opacity ${CROSSFADE_DURATION_MS}ms ease-out`;
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: (style as React.CSSProperties).objectFit ?? 'contain',
    objectPosition: (style as React.CSSProperties).objectPosition ?? 'left bottom',
    filter: (style as React.CSSProperties).filter,
    transition,
  };
  const imgStyle = { ...style, opacity: prevSrc ? (prevVisible ? 0 : 1) : 1, transition } as React.CSSProperties;

  /** 親コンテナを埋める（レイアウトを壊さない）。PCは絶対配置、モバイルは相対でコンテンツに合わせる */
  const isAbsoluteFill = (style as React.CSSProperties).width === '100%' && (style as React.CSSProperties).height === '100%';
  const wrapperStyle: React.CSSProperties = isAbsoluteFill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%' }
    : { position: 'relative' };

  return (
    <div style={wrapperStyle}>
      <img src={currentSrc} alt="" style={imgStyle} />
      {prevSrc && (
        <img src={prevSrc} alt="" style={{ ...overlayStyle, opacity: prevVisible ? 1 : 0, zIndex: 1 }} />
      )}
    </div>
  );
}

export type CharacterVariant = 'usually' | 'question' | 'embarrassing' | 'very_embarrassing' | 'thinking';

interface StageProps {
  children: React.ReactNode;
  /** キャラ画像の差分（usually=トップ・断定、question/embarrassing=通常質問、very_embarrassing=エロ質問） */
  characterVariant?: CharacterVariant;
  /** PCのみ：トップ画面でロゴを表示 */
  showLogo?: boolean;
  /** キャラの発言（全画面共通。スマホ=横長板、PC=質問文と同じスタイル） */
  characterSpeech?: React.ReactNode;
  /** スマホのみ：断定画面で白板を上に伸ばしてスクロールをなくす */
  mobileExtendWhiteboard?: boolean;
  /** スマホのみ：キャンバス下にリストを配置。③ゲーム上寄せ・下にスクロール。 */
  mobileBelowCanvas?: React.ReactNode;
  /** スマホのみ：キャラ列を出さず白板を全幅（推薦モード等）。未指定時 false */
  mobileHideCharacter?: boolean;
  /** PC/スマホ共通: キャラ自体を非表示にする（失敗画面など） */
  hideCharacter?: boolean;
  /** スマホのみ：白板の縦スクロール。未指定時は extendWhiteboard / zoom から推論 */
  mobileWhiteboardOverflowY?: 'auto' | 'hidden';
  /**
   * スマホのみ：白板内の zoom（未指定時 1.62）。推薦モード等で 1 にするとコンパクト化しスクロール不要にしやすい。
   * mobileHideCharacter 時の未指定デフォルトは約 2.2（MobileStageInner 内）。
   * 指定時は白板の縦スクロール推論に影響（従来どおり）。
   */
  mobileWhiteboardZoom?: number;
  /** スマホのみ：白板の padding（未指定時 12px 14px） */
  mobileWhiteboardPadding?: string;
  /**
   * スマホのみ：ロゴ下のステージ本体の論理高さ（px）。既定 800（MOBILE_CANVAS_PX）。
   * 推薦モード本番で縦方向に余白を白板へ回すとき 1200（1.5倍）など。
   */
  mobileCanvasBodyHeightPx?: number;
  /** PCのみ：true で白板を広い幅に（おすすめ5件表示時）。USE_NARROW_WHITEBOARD が false のときは無視され常に広い */
  whiteboardWide?: boolean;
  /**
   * PCのみ：キャラ非表示時に白板をコンテンツエリアいっぱい（maxWidth 固定を外し左右パディング対称）。
   * FAIL_LIST など「全体を使った白板」向け。
   */
  whiteboardFullContentWidth?: boolean;
  /** characterVariant='thinking' のとき、どの考え中画像を使うか。未指定なら inari_thinking.png */
  thinkingSubType?: 'opening' | 'early' | 'mid' | 'late' | 'closing' | 'endingCorrect' | 'endingWrong' | 'failListSelect' | 'failListNotInList';
}

function getScale(): number {
  if (typeof window === 'undefined') return 1;
  const w = window.outerWidth;
  // 隙間分を差し引き、キャンバス分の高さだけ上に収める
  const h = Math.max(1, window.outerHeight - PC_FOOTER_HEIGHT - PC_CANVAS_FOOTER_GAP - 8);
  const scale = Math.max(w / STAGE_WIDTH_PX, h / STAGE_HEIGHT_PX);
  return Math.max(0.2, Math.min(1.5, scale));
}

const PC_FOOTER_HEIGHT = 84;
/** PC版：キャンバスとフッターの隙間（px）。キャラの足はここにはみ出してフッターとくっつく（境界で接する） */
const PC_CANVAS_FOOTER_GAP = 40;
const PC_CANVAS_CORNER_RADIUS = 16;
/** PC版：SVGフレームの幅・マーカートレイ高さ（白背景の inset 計算に使用） */
const PC_FRAME_WIDTH = 10;
/** 下側フレームのみ細く（上・左右は PC_FRAME_WIDTH） */
const PC_FRAME_BOTTOM_WIDTH = 5;
const PC_FRAME_TRAY_HEIGHT = 14;
const MOBILE_CANVAS_PX = 800;
/** 法務2行＋主リンク行を収める（白板の bottom と一致） */
const MOBILE_FOOTER_HEIGHT = 70;
const MOBILE_TOP_BOARD_HEIGHT = 100;

const STAGE_FOOTER_X_URL = 'https://x.com/eronator_jp';

/** ゲーム画面下部：お問い合わせ・公式X＋法務リンク・注記（キャンバス内） */
function GameChromeFooter({ variant }: { variant: 'mobile' | 'pc' }) {
  const mainFs = variant === 'mobile' ? 16 : 15;
  const main: React.CSSProperties = {
    fontSize: mainFs,
    color: 'rgba(255,255,255,0.9)',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    letterSpacing: '0.02em',
  };
  const xIconSize = variant === 'mobile' ? 15 : 14;
  const small: React.CSSProperties = {
    fontSize: 10,
    color: 'rgba(255,255,255,0.68)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  };
  const noteFs = 9;
  const noteColor = 'rgba(255,255,255,0.48)';
  const gapMain = variant === 'mobile' ? '6px 10px' : '8px 14px';

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: gapMain,
          rowGap: 4,
          width: '100%',
        }}
      >
        <a href="/contact" style={main}>
          お問い合わせ
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, userSelect: 'none' }}>|</span>
        <a
          href={STAGE_FOOTER_X_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...main,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'underline',
          }}
        >
          <XLogo size={xIconSize} />
          公式X
        </a>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, userSelect: 'none' }} aria-hidden>
          |
        </span>
        <Link href="/privacy" style={small} prefetch={false}>
          プライバシーポリシー
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, userSelect: 'none' }} aria-hidden>
          |
        </span>
        <Link href="/terms" style={small} prefetch={false}>
          利用規約
        </Link>
      </div>
      <div
        style={{
          fontSize: noteFs,
          color: noteColor,
          textAlign: 'center',
          lineHeight: 1.25,
          width: '100%',
          padding: variant === 'mobile' ? '0 4px' : '0 8px',
        }}
      >
        <div>このコンテンツは18歳以上の方を対象としています</div>
        <div>アフィリエイト広告を利用しています</div>
      </div>
    </>
  );
}

function getMobileScale(canvasBodyHeightPx: number = MOBILE_CANVAS_PX): number {
  if (typeof window === 'undefined') return 0.5;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const totalLogicalH = 72 + 2 + canvasBodyHeightPx;
  const s = Math.min(w / MOBILE_CANVAS_PX, h / totalLogicalH);
  return Math.max(0.3, Math.min(1.2, s));
}

/** PC版：ホワイトボード風フレーム（SVG）キャラの後ろに描画・質感強化 */
function WhiteboardFrameSvg() {
  const R = PC_CANVAS_CORNER_RADIUS;
  const W = STAGE_WIDTH_PX;
  const H = STAGE_HEIGHT_PX;
  const FRAME_W = PC_FRAME_WIDTH;
  const FRAME_BOTTOM = PC_FRAME_BOTTOM_WIDTH;
  const TRAY_H = PC_FRAME_TRAY_HEIGHT;
  const PAD = 2;
  // 上・左右は太め、下だけ細く：U字＋下を別パスで
  const pathU = `M ${R + FRAME_W / 2} ${FRAME_W / 2} L ${W - R - FRAME_W / 2} ${FRAME_W / 2} Q ${W - FRAME_W / 2} ${FRAME_W / 2} ${W - FRAME_W / 2} ${R + FRAME_W / 2} L ${W - FRAME_W / 2} ${H - FRAME_BOTTOM / 2} M ${FRAME_W / 2} ${H - FRAME_BOTTOM / 2} L ${FRAME_W / 2} ${R + FRAME_W / 2} Q ${FRAME_W / 2} ${FRAME_W / 2} ${R + FRAME_W / 2} ${FRAME_W / 2} Z`;
  const pathBottom = `M ${W - FRAME_W / 2} ${H - FRAME_BOTTOM / 2} L ${FRAME_W / 2} ${H - FRAME_BOTTOM / 2}`;
  const capSize = R + 4;
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden
    >
      <defs>
        {/* 金属フレーム：銀寄り・多段階で光沢 */}
        <linearGradient id="frame-metal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d4d6da" />
          <stop offset="15%" stopColor="#b8bcc4" />
          <stop offset="35%" stopColor="#9ca0a8" />
          <stop offset="65%" stopColor="#7a7e86" />
          <stop offset="85%" stopColor="#5e6268" />
          <stop offset="100%" stopColor="#4a4e54" />
        </linearGradient>
        {/* 角キャップ：中心明るめ・縁暗めで立体感 */}
        <radialGradient id="corner-cap" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="70%" stopColor="#252525" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>
        {/* 角キャップ上端ハイライト */}
        <linearGradient id="corner-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        {/* マーカートレイ：溝っぽい奥行き */}
        <linearGradient id="tray-metal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8a8e94" />
          <stop offset="30%" stopColor="#6a6e74" />
          <stop offset="100%" stopColor="#4a4e54" />
        </linearGradient>
        {/* トレイ内側の影 */}
        <linearGradient id="tray-inset" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.04)" />
        </linearGradient>
      </defs>
      {/* 金属フレーム（上・左右：太め、下：細め） */}
      <path d={pathU} fill="none" stroke="url(#frame-metal)" strokeWidth={FRAME_W} strokeLinejoin="round" strokeLinecap="round" />
      <path d={pathBottom} fill="none" stroke="url(#frame-metal)" strokeWidth={FRAME_BOTTOM} strokeLinecap="round" />
      {/* フレーム上端エッジハイライト */}
      <path
        d={`M ${R + FRAME_W} ${FRAME_W + 1} L ${W - R - FRAME_W} ${FRAME_W + 1}`}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1}
      />
      {/* 角キャップ（4隅） */}
      <rect x={0} y={0} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={0} y={0} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-highlight)" />
      <rect x={W - capSize} y={0} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={W - capSize} y={0} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-highlight)" />
      <rect x={0} y={H - capSize} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={0} y={H - capSize} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-highlight)" />
      <rect x={W - capSize} y={H - capSize} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-cap)" />
      <rect x={W - capSize} y={H - capSize} width={capSize} height={capSize} rx={4} ry={4} fill="url(#corner-highlight)" />
      {/* マーカートレイ */}
      <rect
        x={FRAME_W}
        y={H - TRAY_H - FRAME_BOTTOM / 2}
        width={W - FRAME_W * 2}
        height={TRAY_H}
        rx={2}
        fill="url(#tray-metal)"
      />
      {/* トレイ内側の影（上部） */}
      <rect
        x={FRAME_W + 2}
        y={H - TRAY_H - FRAME_BOTTOM / 2}
        width={W - FRAME_W * 2 - 4}
        height={Math.min(4, TRAY_H / 2)}
        rx={1}
        fill="url(#tray-inset)"
      />
    </svg>
  );
}

/** スマホ：横長板=キャラ発言、左キャラ・右白板。フッターはキャンバス内。 */
function MobileStageInner({
  children,
  characterSpeech,
  characterUrl,
  extendWhiteboard,
  whiteboardZoom,
  whiteboardPadding,
  hideCharacter,
  whiteboardOverflowY,
}: {
  children: React.ReactNode;
  characterSpeech?: React.ReactNode;
  characterUrl: string;
  /** 断定画面など：白板を上に伸ばしてスクロールをなくす */
  extendWhiteboard?: boolean;
  /** 未指定時：hideCharacter なら約 2.2、それ以外 1.62 */
  whiteboardZoom?: number;
  whiteboardPadding?: string;
  /** キャラ列を隠し白板を全幅 */
  hideCharacter?: boolean;
  /** 白板の縦スクロール（未指定時は従来ロジック） */
  whiteboardOverflowY?: 'auto' | 'hidden';
}) {
  const hc = !!hideCharacter;
  const wbZoom = whiteboardZoom ?? (hc ? 2.2 : 1.62);
  const wbPad = whiteboardPadding ?? (hc ? '10px 12px' : '12px 14px');
  const wbOverflowY: 'auto' | 'hidden' =
    whiteboardOverflowY !== undefined
      ? whiteboardOverflowY
      : extendWhiteboard
        ? 'hidden'
        : whiteboardZoom !== undefined
          ? 'hidden'
          : 'auto';
  const speechTop = !hc && characterSpeech ? 12 + MOBILE_TOP_BOARD_HEIGHT + 8 : 0;
  const wbFullHeight = !!extendWhiteboard || hc;

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
      {characterSpeech && !hc && (
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
          top: speechTop,
          right: 0,
          bottom: MOBILE_FOOTER_HEIGHT,
          display: 'flex',
          flexDirection: 'row',
          padding: hc ? '0 12px' : '0 12px 0 8px',
          gap: hc ? 0 : 8,
          zIndex: 1,
        }}
      >
        {!hc && (
        <div
          style={{
            width: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            padding: 0,
            marginLeft: -8,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <CharacterImage
            src={characterUrl}
            style={{
              width: '120%',
              maxWidth: 547,
              height: 'auto',
              maxHeight: '100%',
              objectFit: 'contain',
              objectPosition: 'left bottom',
              filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))',
            }}
          />
        </div>
        )}
        <div
          style={{
            width: hc ? '100%' : '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: hc ? 'center' : 'flex-end',
            minWidth: 0,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: hc ? '100%' : 420,
              ...(wbFullHeight
                ? { height: '100%', minHeight: 0 }
                : { aspectRatio: '3/4', maxHeight: '100%' }),
              backgroundColor: '#faf8f5',
              borderRadius: 10,
              padding: wbPad,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              boxSizing: 'border-box',
              overflowY: wbOverflowY,
              overflowX: 'hidden',
              fontSize: 14,
              lineHeight: 1.45,
              zoom: wbZoom,
            } as React.CSSProperties}
          >
            {children}
          </div>
        </div>
      </div>
      <footer
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          minHeight: MOBILE_FOOTER_HEIGHT,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '5px 6px 6px',
          background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(15,15,20,0.98) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 1,
        }}
      >
        <GameChromeFooter variant="mobile" />
      </footer>
    </>
  );
}

function StageInner({
  children,
  showLogo,
  characterSpeech,
  characterUrl,
  scale,
  whiteboardWide,
  hideCharacter,
  whiteboardFullContentWidth,
}: {
  children: React.ReactNode;
  showLogo?: boolean;
  characterSpeech?: React.ReactNode;
  characterUrl: string;
  scale?: number;
  whiteboardWide?: boolean;
  hideCharacter?: boolean;
  whiteboardFullContentWidth?: boolean;
}) {
  // 白背景はフレーム内側に収める（フレームの外に白が出ない）
  const insetTop = PC_FRAME_WIDTH;
  const insetBottom = PC_FRAME_TRAY_HEIGHT + PC_FRAME_WIDTH;
  const insetSide = PC_FRAME_WIDTH;
  const fullWb = !!(whiteboardFullContentWidth && hideCharacter);
  const whiteboardWidthPx = fullWb
    ? undefined
    : !USE_NARROW_WHITEBOARD
      ? WHITEBOARD_MAX_WIDTH_PX
      : whiteboardWide
        ? WHITEBOARD_MAX_WIDTH_PX
        : WHITEBOARD_NARROW_WIDTH_PX;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: insetSide,
          top: insetTop,
          right: insetSide,
          bottom: insetBottom,
          backgroundColor: '#faf9f7',
          zIndex: 0,
          borderRadius: `${Math.max(0, PC_CANVAS_CORNER_RADIUS - insetSide)}px ${Math.max(0, PC_CANVAS_CORNER_RADIUS - insetSide)}px 0 0`,
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.6)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: 100,
          zIndex: 1,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 8,
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
      {!hideCharacter && (
        <div
          style={{
            position: 'absolute',
            left: CHARACTER_LEFT_PX,
            bottom: scale ? -Math.ceil(PC_CANVAS_FOOTER_GAP / (scale * 0.8)) : 0,
            width: CHARACTER_WIDTH_PX,
            height: CHARACTER_HEIGHT_PX,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          <CharacterImage
            src={characterUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'left bottom',
              filter: 'drop-shadow(2px 4px 8px rgba(0,0,0,0.35))',
            }}
          />
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: hideCharacter ? 80 : CONTENT_OFFSET_LEFT_PX,
          top: 100,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: fullWb ? 'stretch' : 'flex-start',
          padding: fullWb ? '32px' : '32px 32px 32px 0',
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: whiteboardWidthPx ?? '100%',
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

export function Stage({
  children,
  characterVariant,
  showLogo,
  characterSpeech,
  mobileExtendWhiteboard,
  mobileBelowCanvas,
  mobileHideCharacter,
  hideCharacter,
  mobileWhiteboardOverflowY,
  mobileWhiteboardZoom,
  mobileWhiteboardPadding,
  mobileCanvasBodyHeightPx,
  whiteboardWide,
  whiteboardFullContentWidth,
  thinkingSubType,
}: StageProps) {
  const characterUrl =
    (characterVariant === 'thinking' && thinkingSubType)
      ? (THINKING_IMAGE_PATHS[thinkingSubType] ?? CHARACTER_VARIANTS.thinking)
      : (CHARACTER_VARIANTS[characterVariant ?? 'usually'] ?? DEFAULT_CHARACTER_URL);
  const [scale, setScale] = useState(1);
  const [mobileScale, setMobileScale] = useState(0.5);
  const [isLandscape, setIsLandscape] = useState(false);
  const isMobile = useMediaQuery(768);

  useEffect(() => {
    const check = () => setIsLandscape(typeof window !== 'undefined' && window.innerWidth > window.innerHeight);
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
    } else {
      const bodyPx = mobileCanvasBodyHeightPx ?? MOBILE_CANVAS_PX;
      setMobileScale(getMobileScale(bodyPx));
      const onResize = () => setMobileScale(getMobileScale(mobileCanvasBodyHeightPx ?? MOBILE_CANVAS_PX));
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [isMobile, mobileCanvasBodyHeightPx]);

  if (isMobile) {
    const hasBelowCanvas = !!mobileBelowCanvas;
    const mobileCanvasBodyPx = mobileCanvasBodyHeightPx ?? MOBILE_CANVAS_PX;
    const allowScroll = hasBelowCanvas || isLandscape;
    return (
      <div
        style={{
          position: allowScroll ? 'relative' : 'fixed',
          inset: allowScroll ? undefined : 0,
          minHeight: allowScroll ? '100dvh' : undefined,
          width: '100%',
          overflowY: allowScroll ? 'auto' : 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 4,
          paddingBottom: allowScroll ? (hasBelowCanvas ? 0 : '4%') : '4%',
        }}
      >
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${BACKGROUND_URL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(10px)',
            zIndex: -2,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.7) 100%)',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />
        {/* ③ゲーム上寄せ＋キャンバス直下にリスト。scaleの余白を消してプレイ画面→おすすめを隣接 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            position: 'relative',
            zIndex: 10,
            width: '100%',
            backgroundColor: 'transparent',
            maxWidth: hasBelowCanvas ? (whiteboardFullContentWidth ? 'min(100%, 720px)' : 600) : undefined,
          }}
        >
          {/* scaleでレイアウトが伸びるのを防ぎ、見た目高さだけ確保。リストをキャンバス直下に */}
          <div
            style={{
              width: MOBILE_CANVAS_PX * mobileScale,
              height: (72 + 2 + mobileCanvasBodyPx) * mobileScale,
              flexShrink: 0,
              overflow: 'hidden',
              ...(hasBelowCanvas ? {} : { alignSelf: 'center' }),
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: MOBILE_CANVAS_PX,
                height: 72 + 2 + mobileCanvasBodyPx,
                transform: `scale(${mobileScale})`,
                transformOrigin: 'top left',
              }}
            >
              <img
                src={LOGO_URL}
                alt="ERONATOR"
                style={{
                  height: 72,
                  width: 'auto',
                  maxWidth: '90%',
                  objectFit: 'contain',
                  marginBottom: 2,
                }}
              />
              <div
                style={{
                  width: MOBILE_CANVAS_PX,
                  height: mobileCanvasBodyPx,
                  position: 'relative',
                  flexShrink: 0,
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.5), 0 0 0 2px rgba(0,0,0,0.15)',
                }}
              >
                <MobileStageInner
                  characterSpeech={characterSpeech}
                  characterUrl={characterUrl}
                  extendWhiteboard={mobileExtendWhiteboard ?? !!mobileBelowCanvas}
                  whiteboardZoom={mobileWhiteboardZoom}
                  whiteboardPadding={mobileWhiteboardPadding}
                  hideCharacter={hideCharacter || mobileHideCharacter}
                  whiteboardOverflowY={mobileWhiteboardOverflowY}
                >
                  {children}
                </MobileStageInner>
              </div>
            </div>
          </div>
          {/* ②キャンバスのすぐ下：縦リスト（隙間なく） */}
          {hasBelowCanvas && (
            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                padding: '12px 14px 32px',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              {mobileBelowCanvas}
            </div>
          )}
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
      {/* 背景：blur + gradient はルートに1セットのみ。flex は transparent で同じレイヤーを透過。背景とキャンバス端が同一処理になる。 */}
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
          top: '-20%',
          left: '-20%',
          right: '-20%',
          bottom: '-20%',
          zIndex: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          position: 'relative',
          zIndex: 2,
          minHeight: 0,
          background: 'transparent',
        }}
      >
        <div
          style={{
            width: STAGE_WIDTH_PX,
            height: STAGE_HEIGHT_PX,
            position: 'relative',
            zIndex: 1,
            transform: `scale(${scale * 0.8})`,
            transformOrigin: 'center bottom',
            flexShrink: 0,
            marginBottom: PC_CANVAS_FOOTER_GAP,
            borderRadius: `${PC_CANVAS_CORNER_RADIUS}px ${PC_CANVAS_CORNER_RADIUS}px 0 0`,
            overflow: 'visible',
            background: 'transparent',
            boxShadow: 'none',
          }}
        >
          <WhiteboardFrameSvg />
          <StageInner
            showLogo={showLogo}
            characterSpeech={characterSpeech}
            characterUrl={characterUrl}
            scale={scale}
            whiteboardWide={whiteboardWide}
            hideCharacter={hideCharacter}
            whiteboardFullContentWidth={whiteboardFullContentWidth}
          >
            {children}
          </StageInner>
        </div>
      </div>
      <footer
        style={{
          width: '100%',
          minHeight: PC_FOOTER_HEIGHT,
          boxSizing: 'border-box',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          padding: '8px 12px 10px',
          background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(15,15,20,0.98) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <GameChromeFooter variant="pc" />
      </footer>
    </div>
  );
}
