# -*- coding: utf-8 -*-
"""①初期2問をAIゲートメインと同列 ②次へ/やり直し ③タグリストこれでok大きく ④ひとつ前バグ修正+モバイル表記統一"""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

# sortFixBtnStyle モバイル統一（ひとつ前に戻る）
OLD_SF = """  const sortFixBtnStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 3 : 5,
    padding: isMobile ? '3px 6px' : '5px 8px',
    fontSize: isMobile ? 9 : 10,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 5,
    color: 'var(--color-text-muted)',
  };"""
NEW_SF = """  const sortFixBtnStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 6 : 5,
    padding: isMobile ? '6px 10px' : '5px 8px',
    fontSize: isMobile ? 12 : 10,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: isMobile ? 6 : 5,
    color: 'var(--color-text-muted)',
  };"""
assert OLD_SF in t
t = t.replace(OLD_SF, NEW_SF, 1)

# 初期2つ目の質問を1つ目と同列（AIゲートメイン相当）
OLD_P2 = """          <p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>
            {rc.initialPriorityQuestion}
          </p>"""
NEW_P2 = """          <p style={{ margin: isMobile ? '4px 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>
            {rc.initialPriorityQuestion}
          </p>"""
assert OLD_P2 in t
t = t.replace(OLD_P2, NEW_P2, 1)

# 次へ・やり直し：同じ高さ/文字、次へだけやや横に flex 比率
OLD_ROW = """          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 12, alignItems: 'center', ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>
            <button
              onClick={() => {
              if (!canProceedFromInitial) return;
              setFrontNavStack([]);
              setStep('f1');
            }}
              disabled={!canProceedFromInitial}
              style={{
                padding: isMobile ? '12px 18px' : '16px 32px',
                fontSize: isMobile ? 18 : 17,
                minHeight: isMobile ? 50 : undefined,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
              }}
            >
              {rc.btnNext}
            </button>
            <button
              onClick={resetInitial}
              style={{
                padding: isMobile ? '10px 16px' : '10px 20px',
                fontSize: isMobile ? 16 : 14,
                minHeight: isMobile ? 46 : undefined,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {rc.btnRetry}
            </button>
          </div>"""
NEW_ROW = """          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: isMobile ? 8 : 12, alignItems: 'stretch', ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>
            <button
              onClick={() => {
              if (!canProceedFromInitial) return;
              setFrontNavStack([]);
              setStep('f1');
            }}
              disabled={!canProceedFromInitial}
              style={{
                flex: isMobile ? '1.22 1 0' : undefined,
                minWidth: 0,
                padding: isMobile ? '12px 14px' : '16px 32px',
                fontSize: isMobile ? 17 : 17,
                minHeight: isMobile ? 48 : undefined,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: isMobile ? 10 : 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnNext}
            </button>
            <button
              onClick={resetInitial}
              style={{
                flex: isMobile ? '1 1 0' : undefined,
                minWidth: 0,
                padding: isMobile ? '12px 14px' : '10px 20px',
                fontSize: isMobile ? 17 : 14,
                minHeight: isMobile ? 48 : undefined,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: isMobile ? 10 : 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnRetry}
            </button>
          </div>"""
assert OLD_ROW in t
t = t.replace(OLD_ROW, NEW_ROW, 1)

# 初期のひとつ前：sortFixBtnStyle と揃える
OLD_INIT_FIX = """              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: isMobile ? 14 : 14,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rcFixBack}
            </button>
          </div>
        </div>
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
      )}
      </>
    );
  }

  const questionNumDisplay = isFamousStep"""
NEW_INIT_FIX = """              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 6 : 5,
                padding: isMobile ? '6px 10px' : '5px 8px',
                fontSize: isMobile ? 12 : 10,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: isMobile ? 6 : 5,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rcFixBack}
            </button>
          </div>
        </div>
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
      )}
      </>
    );
  }

  const questionNumDisplay = isFamousStep"""
assert OLD_INIT_FIX in t
t = t.replace(OLD_INIT_FIX, NEW_INIT_FIX, 1)

# タグリストモバイル：これでok 行を大きく
OLD_OK_ROW = """              <button
                type="button"
                onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
                style={{
                  flex: '1 1 30%',
                  minWidth: 0,
                  padding: '4px 6px',
                  fontSize: 11,
                  minHeight: 30,
                  fontWeight: 600,
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
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
                  flex: '1 1 40%',
                  minWidth: 0,
                  padding: '4px 6px',
                  fontSize: 10,
                  minHeight: 30,
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
              <button
                type="button"
                onClick={() => {
                  if (isFamousStep) setCheckedFamous(new Set());
                  else setCheckedUnknown(new Set());
                }}
                style={{
                  flex: '1 1 25%',
                  minWidth: 0,
                  padding: '4px 6px',
                  fontSize: 10,
                  minHeight: 30,
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
            </div>"""
NEW_OK_ROW = """              <button
                type="button"
                onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
                style={{
                  flex: '1 1 30%',
                  minWidth: 0,
                  padding: '8px 8px',
                  fontSize: 13,
                  minHeight: 38,
                  fontWeight: 600,
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
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
                  flex: '1 1 40%',
                  minWidth: 0,
                  padding: '7px 6px',
                  fontSize: 12,
                  minHeight: 38,
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
              <button
                type="button"
                onClick={() => {
                  if (isFamousStep) setCheckedFamous(new Set());
                  else setCheckedUnknown(new Set());
                }}
                style={{
                  flex: '1 1 25%',
                  minWidth: 0,
                  padding: '7px 6px',
                  fontSize: 12,
                  minHeight: 38,
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
            </div>"""
assert OLD_OK_ROW in t
t = t.replace(OLD_OK_ROW, NEW_OK_ROW, 1)

# モバイル本編 ひとつ前：スタイル統一 + 挙動修正（checked 空・undoCount0 で全消し防止）
OLD_MOB_FIX = """                    } else if (isFamousStep) {
                      setFrontNavStack(prev => {
                        if (prev.length === 0) return prev;
                        const ent = prev[prev.length - 1]!;
                        setSelectedFamous(sel => {
                          const popped = sel.slice(-ent.undoCount);
                          setCheckedFamous(new Set(popped.map(x => x.tagKey)));
                          return sel.slice(0, -ent.undoCount);
                        });
                        setStep(ent.returnTo);
                        return prev.slice(0, -1);
                      });
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
                  style={{ ...sortFixBtnStyle, padding: '2px 6px', fontSize: 10, gap: 3 }}
                >
                  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rcFixBack}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,"""
NEW_MOB_FIX = """                    } else if (isFamousStep) {
                      setFrontNavStack(prev => {
                        if (prev.length === 0) return prev;
                        const ent = prev[prev.length - 1]!;
                        setSelectedFamous(sel => (ent.undoCount > 0 ? sel.slice(0, -ent.undoCount) : sel));
                        setCheckedFamous(new Set());
                        setStep(ent.returnTo);
                        return prev.slice(0, -1);
                      });
                    } else if (s === 's4') {
                      setStep('sort1');
                    } else if (isBackStep) {
                      const prevMap: Record<string, BackStep> = { s5: 's4', s6: 's5', s7: 's6', s8: 's7' };
                      const prev = prevMap[s];
                      if (prev) {
                        setSelectedUnknown(prevSel => prevSel.slice(0, -lastAddedUnknownCount));
                        setCheckedUnknown(new Set());
                        setStep(prev);
                      }
                    }
                  }}
                  style={sortFixBtnStyle}
                >
                  <svg style={{ width: isMobile ? 14 : 12, height: isMobile ? 14 : 12 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rcFixBack}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,"""
assert OLD_MOB_FIX in t
t = t.replace(OLD_MOB_FIX, NEW_MOB_FIX, 1)

# PC 本編 ひとつ前：同じ挙動
OLD_PC_FIX = """                    } else if (isFamousStep) {
                      setFrontNavStack(prev => {
                        if (prev.length === 0) return prev;
                        const ent = prev[prev.length - 1]!;
                        setSelectedFamous(sel => {
                          const popped = sel.slice(-ent.undoCount);
                          setCheckedFamous(new Set(popped.map(x => x.tagKey)));
                          return sel.slice(0, -ent.undoCount);
                        });
                        setStep(ent.returnTo);
                        return prev.slice(0, -1);
                      });
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
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rcFixBack}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Stage>

    {isDebugLocal && (
      <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
    )}
    </>
  );
}"""
NEW_PC_FIX = """                    } else if (isFamousStep) {
                      setFrontNavStack(prev => {
                        if (prev.length === 0) return prev;
                        const ent = prev[prev.length - 1]!;
                        setSelectedFamous(sel => (ent.undoCount > 0 ? sel.slice(0, -ent.undoCount) : sel));
                        setCheckedFamous(new Set());
                        setStep(ent.returnTo);
                        return prev.slice(0, -1);
                      });
                    } else if (s === 's4') {
                      setStep('sort1');
                    } else if (isBackStep) {
                      const prevMap: Record<string, BackStep> = { s5: 's4', s6: 's5', s7: 's6', s8: 's7' };
                      const prev = prevMap[s];
                      if (prev) {
                        setSelectedUnknown(prevSel => prevSel.slice(0, -lastAddedUnknownCount));
                        setCheckedUnknown(new Set());
                        setStep(prev);
                      }
                    }
                  }}
                  style={sortFixBtnStyle}
                >
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rcFixBack}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Stage>

    {isDebugLocal && (
      <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
    )}
    </>
  );
}"""
assert OLD_PC_FIX in t
t = t.replace(OLD_PC_FIX, NEW_PC_FIX, 1)

# sort1 ひとつ前
OLD_S1 = """                onClick={() => {
                  setSort1Ranks(new Map());
                  setFrontNavStack(prev => {
                    if (prev.length === 0) return prev;
                    const ent = prev[prev.length - 1]!;
                    setSelectedFamous(sel => {
                      const popped = sel.slice(-ent.undoCount);
                      setCheckedFamous(new Set(popped.map(x => x.tagKey)));
                      return sel.slice(0, -ent.undoCount);
                    });
                    setStep(ent.returnTo);
                    return prev.slice(0, -1);
                  });
                }}
                style={sortFixBtnStyle}
              >
                <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                </svg>
                {rcFixBack}
              </button>"""
NEW_S1 = """                onClick={() => {
                  setSort1Ranks(new Map());
                  setFrontNavStack(prev => {
                    if (prev.length === 0) return prev;
                    const ent = prev[prev.length - 1]!;
                    setSelectedFamous(sel => (ent.undoCount > 0 ? sel.slice(0, -ent.undoCount) : sel));
                    setCheckedFamous(new Set());
                    setStep(ent.returnTo);
                    return prev.slice(0, -1);
                  });
                }}
                style={sortFixBtnStyle}
              >
                <svg style={{ width: isMobile ? 14 : 11, height: isMobile ? 14 : 11 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                </svg>
                {rcFixBack}
              </button>"""
assert OLD_S1 in t
t = t.replace(OLD_S1, NEW_S1, 1)

# sort2 モバイル・PC の svg サイズ（sortFixBtnStyle 既に更新）
t = t.replace(
    """                <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                </svg>
                {rcFixBack}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>""",
    """                <svg style={{ width: isMobile ? 14 : 11, height: isMobile ? 14 : 11 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                </svg>
                {rcFixBack}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>""",
    1,
)

# sort2 PC 側の svg（13x13 のブロック）
t = t.replace(
    """                    <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </>
            )}
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }

  const renderTagGrid = () => {""",
    """                    <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </>
            )}
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }

  const renderTagGrid = () => {""",
    1,
)

p.write_text(t, encoding="utf-8")
print("OK")
