# -*- coding: utf-8 -*-
"""Patch Stage.tsx: mobileHideCharacter, mobileWhiteboardOverflowY, MobileStageInner layout."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src" / "app" / "components" / "Stage.tsx"
text = path.read_text(encoding="utf-8")

old_iface = """  /** スマホのみ：キャンバス下にリストを配置。③ゲーム上寄せ・下にスクロール。 */
  mobileBelowCanvas?: React.ReactNode;
  /**
   * スマホのみ：白板内の zoom（未指定時 1.62）。推薦モード等で 1 にするとコンパクト化しスクロール不要にしやすい。
   * 指定時は白板の縦スクロールを無効化（hidden）する。
   */
  mobileWhiteboardZoom?: number;"""

new_iface = """  /** スマホのみ：キャンバス下にリストを配置。③ゲーム上寄せ・下にスクロール。 */
  mobileBelowCanvas?: React.ReactNode;
  /** スマホのみ：キャラ列を出さず白板を全幅（推薦モード等）。未指定時 false */
  mobileHideCharacter?: boolean;
  /** スマホのみ：白板の縦スクロール。未指定時は extendWhiteboard / zoom から推論 */
  mobileWhiteboardOverflowY?: 'auto' | 'hidden';
  /**
   * スマホのみ：白板内の zoom（未指定時 1.62）。推薦モード等で 1 にするとコンパクト化しスクロール不要にしやすい。
   * mobileHideCharacter 時の未指定デフォルトは約 2.2（MobileStageInner 内）。
   * 指定時は白板の縦スクロール推論に影響（従来どおり）。
   */
  mobileWhiteboardZoom?: number;"""

if old_iface not in text:
    raise SystemExit("Stage interface block not found")

text = text.replace(old_iface, new_iface, 1)

old_inner_sig = """function MobileStageInner({
  children,
  characterSpeech,
  characterUrl,
  extendWhiteboard,
  whiteboardZoom,
  whiteboardPadding,
}: {
  children: React.ReactNode;
  characterSpeech?: React.ReactNode;
  characterUrl: string;
  /** 断定画面など：白板を上に伸ばしてスクロールをなくす */
  extendWhiteboard?: boolean;
  /** 未指定時 1.62。指定時は縦スクロールを出さない用途向け */
  whiteboardZoom?: number;
  whiteboardPadding?: string;
}) {
  const wbZoom = whiteboardZoom ?? 1.62;
  const wbPad = whiteboardPadding ?? '12px 14px';
  /** 推薦コンパクト時：白板内スクロールを出さない */
  const wbOverflowY: 'auto' | 'hidden' = extendWhiteboard ? 'hidden' : whiteboardZoom !== undefined ? 'hidden' : 'auto';
  const speechTop = characterSpeech ? 12 + MOBILE_TOP_BOARD_HEIGHT + 8 : 0;"""

new_inner_sig = """function MobileStageInner({
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
  const wbFullHeight = !!extendWhiteboard || hc;"""

if old_inner_sig not in text:
    raise SystemExit("MobileStageInner signature block not found")

text = text.replace(old_inner_sig, new_inner_sig, 1)

old_speech = """      {characterSpeech && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 12,
            height: MOBILE_TOP_BOARD_HEIGHT,"""

new_speech = """      {characterSpeech && !hc && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 12,
            height: MOBILE_TOP_BOARD_HEIGHT,"""

if old_speech not in text:
    raise SystemExit("characterSpeech block not found")
text = text.replace(old_speech, new_speech, 1)

old_row = """      <div
        style={{
          position: 'absolute',
          left: 0,
          top: speechTop,
          right: 0,
          bottom: MOBILE_FOOTER_HEIGHT,
          display: 'flex',
          flexDirection: 'row',
          /* セリフ板の有無でキャラ列の位置がズレないよう、1画面目(ai_gate)と同じ 0 12px 0 8px に統一 */
          padding: '0 12px 0 8px',
          gap: 8,
          zIndex: 1,
        }}
      >
        {/* 左半分：キャラ（1.2倍、はみ出しOK・左寄せ）。flexShrink:0 で白板の内容量に依存せず固定（実機Safariで縮む不具合対策） */}
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
        {/* 右半分：白板（正方形、下固定・キャラの右に並ぶ、1.4倍） */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            minWidth: 0,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              ...(extendWhiteboard
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
      </div>"""

new_row = """      <div
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
            justifyContent: 'flex-end',
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
      </div>"""

if old_row not in text:
    raise SystemExit("Mobile row/whiteboard block not found")
text = text.replace(old_row, new_row, 1)

old_export = """export function Stage({
  children,
  characterVariant,
  showLogo,
  characterSpeech,
  mobileExtendWhiteboard,
  mobileBelowCanvas,
  mobileWhiteboardZoom,
  mobileWhiteboardPadding,
  whiteboardWide,
  thinkingSubType,
}: StageProps) {"""

new_export = """export function Stage({
  children,
  characterVariant,
  showLogo,
  characterSpeech,
  mobileExtendWhiteboard,
  mobileBelowCanvas,
  mobileHideCharacter,
  mobileWhiteboardOverflowY,
  mobileWhiteboardZoom,
  mobileWhiteboardPadding,
  whiteboardWide,
  thinkingSubType,
}: StageProps) {"""

if old_export not in text:
    raise SystemExit("Stage export not found")
text = text.replace(old_export, new_export, 1)

old_mobile_inner_call = """                <MobileStageInner
                  characterSpeech={characterSpeech}
                  characterUrl={characterUrl}
                  extendWhiteboard={mobileExtendWhiteboard ?? !!mobileBelowCanvas}
                  whiteboardZoom={mobileWhiteboardZoom}
                  whiteboardPadding={mobileWhiteboardPadding}
                >
                  {children}
                </MobileStageInner>"""

new_mobile_inner_call = """                <MobileStageInner
                  characterSpeech={characterSpeech}
                  characterUrl={characterUrl}
                  extendWhiteboard={mobileExtendWhiteboard ?? !!mobileBelowCanvas}
                  whiteboardZoom={mobileWhiteboardZoom}
                  whiteboardPadding={mobileWhiteboardPadding}
                  hideCharacter={mobileHideCharacter}
                  whiteboardOverflowY={mobileWhiteboardOverflowY}
                >
                  {children}
                </MobileStageInner>"""

if old_mobile_inner_call not in text:
    raise SystemExit("MobileStageInner call not found")
text = text.replace(old_mobile_inner_call, new_mobile_inner_call, 1)

path.write_text(text, encoding="utf-8")
print("OK Stage.tsx")
