# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "Stage.tsx"
t = p.read_text(encoding="utf-8")

repls = [
    (
        """function getMobileScale(): number {
  if (typeof window === 'undefined') return 0.5;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const s = Math.min(w / MOBILE_CANVAS_PX, h / MOBILE_CANVAS_PX);
  return Math.max(0.3, Math.min(1.2, s));
}""",
        """function getMobileScale(canvasBodyHeightPx: number = MOBILE_CANVAS_PX): number {
  if (typeof window === 'undefined') return 0.5;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const totalLogicalH = 72 + 2 + canvasBodyHeightPx;
  const s = Math.min(w / MOBILE_CANVAS_PX, h / totalLogicalH);
  return Math.max(0.3, Math.min(1.2, s));
}""",
    ),
    (
        """  /** スマホのみ：白板の padding（未指定時 12px 14px） */
  mobileWhiteboardPadding?: string;
  /** PCのみ：true で白板を広い幅に（おすすめ5件表示時）。USE_NARROW_WHITEBOARD が false のときは無視され常に広い */
  whiteboardWide?: boolean;""",
        """  /** スマホのみ：白板の padding（未指定時 12px 14px） */
  mobileWhiteboardPadding?: string;
  /**
   * スマホのみ：ロゴ下のステージ本体の論理高さ（px）。既定 800（MOBILE_CANVAS_PX）。
   * 推薦モード本番で縦方向に余白を白板へ回すとき 1200（1.5倍）など。
   */
  mobileCanvasBodyHeightPx?: number;
  /** PCのみ：true で白板を広い幅に（おすすめ5件表示時）。USE_NARROW_WHITEBOARD が false のときは無視され常に広い */
  whiteboardWide?: boolean;""",
    ),
    (
        """  mobileWhiteboardPadding,
  whiteboardWide,
  thinkingSubType,
}: StageProps) {""",
        """  mobileWhiteboardPadding,
  mobileCanvasBodyHeightPx,
  whiteboardWide,
  thinkingSubType,
}: StageProps) {""",
    ),
    (
        """    } else {
      setMobileScale(getMobileScale());
      const onResize = () => setMobileScale(getMobileScale());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [isMobile]);""",
        """    } else {
      const bodyPx = mobileCanvasBodyHeightPx ?? MOBILE_CANVAS_PX;
      setMobileScale(getMobileScale(bodyPx));
      const onResize = () => setMobileScale(getMobileScale(mobileCanvasBodyHeightPx ?? MOBILE_CANVAS_PX));
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [isMobile, mobileCanvasBodyHeightPx]);""",
    ),
    (
        """  if (isMobile) {
    const hasBelowCanvas = !!mobileBelowCanvas;
    const allowScroll = hasBelowCanvas || isLandscape;
    return (
      <div""",
        """  if (isMobile) {
    const hasBelowCanvas = !!mobileBelowCanvas;
    const mobileCanvasBodyPx = mobileCanvasBodyHeightPx ?? MOBILE_CANVAS_PX;
    const allowScroll = hasBelowCanvas || isLandscape;
    return (
      <div""",
    ),
    (
        """          <div
            style={{
              width: MOBILE_CANVAS_PX * mobileScale,
              height: (72 + 2 + MOBILE_CANVAS_PX) * mobileScale,
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
                height: 72 + 2 + MOBILE_CANVAS_PX,
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
                  height: MOBILE_CANVAS_PX,
                  position: 'relative',
                  flexShrink: 0,
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.5), 0 0 0 2px rgba(0,0,0,0.15)',
                }}
              >
                <MobileStageInner""",
        """          <div
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
                <MobileStageInner""",
    ),
]

for i, (a, b) in enumerate(repls):
    if a not in t:
        raise SystemExit(f"Block {i} not found in Stage.tsx")
    t = t.replace(a, b, 1)

p.write_text(t, encoding="utf-8")
print("Stage.tsx OK", len(repls))
