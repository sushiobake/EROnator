# -*- coding: utf-8 -*-
"""Replace tag-selection Stage block by markers (avoids huge exact-string match)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8").replace("\r\n", "\n")

start = "\n  return (\n    <>\n    <Stage\n      characterVariant=\"usually\"\n      characterSpeech={\n"
# 閉じ </Stage> まで置換し、{isDebugLocal からは元ファイルを継続
end = "\n    {isDebugLocal &&"
i = t.find(start)
j = t.find(end, i)
if i < 0 or j < 0:
    raise SystemExit(f"markers not found i={i} j={j}")

new_block = """
  return (
    <>
    <Stage
      characterVariant="usually"
      characterSpeech={
        isMobile ? undefined : (
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 'bold', marginRight: 8, verticalAlign: 'middle' }}>
                {questionNumDisplay}
              </span>
              {instruction}
            </p>
          </div>
        )
      }
      mobileHideCharacter={isMobile}
      mobileExtendWhiteboard={isMobile}
      whiteboardWide={true}
      mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
    >
      <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
        {isMobile && (
          <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 14, lineHeight: 1.35 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: 10, fontWeight: 'bold', marginRight: 6, verticalAlign: 'middle' }}>
              {questionNumDisplay}
            </span>
            {instruction}
          </p>
        )}
        {renderTagGrid()}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            gap: isMobile ? 8 : 12,
            alignItems: isMobile ? 'stretch' : 'center',
            marginTop: isMobile ? 8 : 0,
            width: '100%',
            maxWidth: 640,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flex: isMobile ? undefined : 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
            <button
              type="button"
              onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
              style={{
                flex: 1,
                minWidth: 0,
                padding: isMobile ? '8px 10px' : '16px 32px',
                fontSize: isMobile ? 13 : 17,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnOk}
            </button>
            <button
              type="button"
              onClick={() => (isFamousStep ? goNextFromFamous(true) : goNextFromUnknown(true))}
              style={{
                flex: 1,
                minWidth: 0,
                padding: isMobile ? '8px 10px' : '10px 20px',
                fontSize: isMobile ? 13 : 14,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                backgroundColor: '#faf8f5',
                color: 'var(--color-text)',
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnNotInList}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isFamousStep) setCheckedFamous(new Set());
              else setCheckedUnknown(new Set());
            }}
            style={{
              alignSelf: isMobile ? 'flex-end' : 'center',
              padding: isMobile ? '4px 10px' : '10px 20px',
              fontSize: isMobile ? 12 : 14,
              fontWeight: 600,
              backgroundColor: '#fff',
              color: 'var(--color-text-muted)',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            {rc.btnRetry}
          </button>
        </div>
        {isFamousStep && <RecommendPickedTagsRow tags={selectedFamous} isMobile={isMobile} />}
        {isBackStep && <RecommendPickedTagsRow tags={selectedUnknown} isMobile={isMobile} />}
        {(isFamousStep || isBackStep) && (
          <div style={{ marginTop: 8, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                const s = step as FrontStep | BackStep;
                if (s === 'f1') {
                  setCheckedFamous(new Set());
                  setStep('initial');
                } else if (isFamousStep) {
                  const prevMap: Record<string, FrontStep> = { f1_2: 'f1', f2: 'f1_2', f2_2: 'f2', f3: 'f2_2', f3_2: 'f3' };
                  const prev = prevMap[s];
                  if (prev) {
                    const toRestore = selectedFamous.slice(-lastAddedFamousCount);
                    setSelectedFamous(prevSel => prevSel.slice(0, -lastAddedFamousCount));
                    setCheckedFamous(new Set(toRestore.map(x => x.tagKey)));
                    setStep(prev);
                  }
                } else if (s === 's4') {
                  setStep('sort1');
                } else if (isBackStep) {
                  const prevMap: Record<string, BackStep> = { s5: 's4', s6: 's5', s7: 's6', s8: 's7' };
                  const prev = prevMap[s];
                  if (prev) {
                    const toRestore = selectedUnknown.slice(-lastAddedUnknownCount);
                    setSelectedUnknown(prevSel => prevSel.slice(0, -lastAddedUnknownCount));
                    setCheckedUnknown(new Set(toRestore.map(x => x.tagKey)));
                    setStep(prev);
                  }
                }
              }}
              style={sortFixBtnStyle}
            >
              <svg style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rc.btnFix}
            </button>
          </div>
        )}
      </div>
    </Stage>
"""

out = t[:i] + new_block + t[j:]
p.write_text(out, encoding="utf-8")
print("OK patch tag stage", i, j)
