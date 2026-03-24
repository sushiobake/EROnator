# -*- coding: utf-8 -*-
"""Apply RecommendMode mobile layout from UTF-8 backup without corrupting Japanese text."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRAG = ROOT / "scripts/fragments/recommend_mobile"
BACKUP = ROOT / "src/app/components/RecommendMode.tsx.backup.20260226-mobile-recommend-layout"
OUT = ROOT / "src/app/components/RecommendMode.tsx"


def main() -> None:
    b = BACKUP.read_text(encoding="utf-8")
    out = b

    # 1) Picked row + mobile helpers (slice from backup markers)
    picked = (FRAG / "picked.txt").read_text(encoding="utf-8")
    i = out.index("/** ピル1行分")
    j = out.index("export function RecommendMode")
    out = out[:i] + picked + out[j:]

    old_init_btn = """  const initBtnBase = {
    padding: isMobile ? '10px 14px' : '12px 18px',
    fontSize: isMobile ? 15 : 14,
    fontWeight: 500,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box' as const,
  };"""
    new_init_btn = """  const initBtnBase = isMobile
    ? {
        ...mobileQuizLikeChoiceStyle({
          borderRadius: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }),
      }
    : {
        padding: '12px 18px',
        fontSize: 14,
        fontWeight: 500,
        borderRadius: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        boxSizing: 'border-box' as const,
      };"""
    assert old_init_btn in out, "initBtnBase block not found"
    out = out.replace(old_init_btn, new_init_btn, 1)

    out = out.replace(
        """          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
            {rc.initialMain}
          </p>""",
        """          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 18 : 17 }}>
            {rc.initialMain}
          </p>""",
        1,
    )
    out = out.replace(
        """          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
            {rc.initialPriorityQuestion}
          </p>""",
        """          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 18 : 17 }}>
            {rc.initialPriorityQuestion}
          </p>""",
        1,
    )

    out = out.replace(
        "<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 32 }}>",
        "<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: isMobile ? 20 : 32 }}>",
        1,
    )
    out = out.replace(
        "<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>",
        "<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>",
        1,
    )

    old_next = """            <button
              onClick={() => canProceedFromInitial && setStep('f1')}
              disabled={!canProceedFromInitial}
              style={{
                padding: isMobile ? '14px 24px' : '16px 32px',
                fontSize: isMobile ? 16 : 17,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
              }}
            >
              {rc.btnNext}
            </button>"""
    new_next = """            <button
              onClick={() => canProceedFromInitial && setStep('f1')}
              disabled={!canProceedFromInitial}
              style={{
                ...(isMobile
                  ? mobileQuizLikeChoiceStyle({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                    })
                  : { padding: '16px 32px', fontSize: 17, fontWeight: 600 }),
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
              }}
            >
              {rc.btnNext}
            </button>"""
    assert old_next in out
    out = out.replace(old_next, new_next, 1)

    dbg = "        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}"

    s1_start = "    const renderCol = (col: SelectedTag[], idx: number) => ("
    i1 = out.index(s1_start)
    j1 = out.index(dbg, i1)
    s1_new = (FRAG / "sort1.txt").read_text(encoding="utf-8") + "\n"
    out = out[:i1] + s1_new + out[j1:]

    s2_start = "    const renderCol = (col: typeof backTags, idx: number) => ("
    i2 = out.index(s2_start)
    j2 = out.index(dbg, i2)
    s2_new = (FRAG / "sort2.txt").read_text(encoding="utf-8") + "\n"
    out = out[:i2] + s2_new + out[j2:]

    ts_start = "  const renderTagGrid = () => {"
    ts_end = "        {isBackStep && <RecommendPickedTagsRow tags={backPickedTagsDisplay} isMobile={isMobile} />}\n"
    it = out.index(ts_start)
    jt = out.index(ts_end, it) + len(ts_end)
    ts_new = (FRAG / "tagstage.txt").read_text(encoding="utf-8")
    out = out[:it] + ts_new + out[jt:]

    # initial 画面：白板 zoom=1・伸長・詰め（板内スクロール回避）
    frag_init = FRAG / "initial_compact_block.txt"
    si = out.index("  if (step === 'initial') {")
    ei = out.index("\n  const questionNumDisplay = isFamousStep", si)
    out = out[:si] + frag_init.read_text(encoding="utf-8") + out[ei:]

    OUT.write_text(out, encoding="utf-8", newline="\n")
    assert "やっぱり有名作品" in out, "Japanese sanity check failed"
    print("Wrote", OUT, "UTF-8 OK, やっぱり有名作品 found")


if __name__ == "__main__":
    main()
