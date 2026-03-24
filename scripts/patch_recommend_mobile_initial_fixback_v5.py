# -*- coding: utf-8 -*-
"""
① 初期画面モバイル：質問を1画面目に合わせ＋全体やや大きく＋上余白＋次へ/やり直し大きく
② PICKED_TAGS_ROW_HEIGHT = 64
③ rcFixBack / frontNavStack / バックアップ相当の「ひとつ前に戻る」挙動
"""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

# FrontNavEntry 型
if "type FrontNavEntry" not in t:
    ins = "type RecommendStep = 'ai_gate' | 'initial' | FrontStep | 'sort1' | BackStep | 'sort2' | 'thinking' | 'results';\n\ninterface RecommendModeProps"
    rep = "type RecommendStep = 'ai_gate' | 'initial' | FrontStep | 'sort1' | BackStep | 'sort2' | 'thinking' | 'results';\n\n/** 有名ステップで「次へ」したときの戻り先（ひとつ前に戻るで1段階ずつ戻す） */\ntype FrontNavEntry = { returnTo: FrontStep; undoCount: number };\n\ninterface RecommendModeProps"
    assert ins in t
    t = t.replace(ins, rep, 1)

t = t.replace("const PICKED_TAGS_ROW_HEIGHT = 32;", "const PICKED_TAGS_ROW_HEIGHT = 64;", 1)

# rc デフォルトに btnFixRecommend
if "btnFixRecommend:" not in t.split("const rc = recommendCopy")[1].split("const isDebugLocal")[0]:
    t = t.replace(
        "    btnFix: '修正する',\n    btnTopReset: 'トップに戻る',",
        "    btnFix: '修正する',\n    btnFixRecommend: 'ひとつ前に戻る',\n    btnTopReset: 'トップに戻る',",
        1,
    )

# rcFixBack
if "const rcFixBack" not in t:
    t = t.replace(
        "    recommendResultsHeading: 'こんな作品なんてどう？',\n  };\n\n  const isDebugLocal =",
        "    recommendResultsHeading: 'こんな作品なんてどう？',\n  };\n\n  const rcTypedForFix = rc as RecommendCopy;\n  /** 推薦フロー内の「戻る」（やり直しと区別） */\n  const rcFixBack = rcTypedForFix.btnFixRecommend?.trim()\n    ? rcTypedForFix.btnFixRecommend\n    : (rc.btnFix ?? 'ひとつ前に戻る');\n\n  const isDebugLocal =",
        1,
    )
    # Avoid duplicate rcTyped - we already have rcTyped later. Use inline cast only for rcFixBack
    t = t.replace(
        "  const rcTypedForFix = rc as RecommendCopy;\n  /** 推薦フロー内の「戻る」（やり直しと区別） */\n  const rcFixBack = rcTypedForFix.btnFixRecommend?.trim()\n    ? rcTypedForFix.btnFixRecommend\n    : (rc.btnFix ?? 'ひとつ前に戻る');\n\n",
        "  /** 推薦フロー内の「戻る」（やり直しと区別） */\n  const rcFixBack = (rc as RecommendCopy).btnFixRecommend?.trim()\n    ? (rc as RecommendCopy).btnFixRecommend!\n    : (rc.btnFix ?? 'ひとつ前に戻る');\n\n",
        1,
    )

# frontNavStack state
if "frontNavStack" not in t:
    t = t.replace(
        "  const [lastAddedUnknownCount, setLastAddedUnknownCount] = useState(0);\n\n  const MAX_SELECT = 3;",
        "  const [lastAddedUnknownCount, setLastAddedUnknownCount] = useState(0);\n  const [frontNavStack, setFrontNavStack] = useState<FrontNavEntry[]>([]);\n\n  const MAX_SELECT = 3;",
        1,
    )

# goNextFromFamous: push stack before setStep
OLD_GN = """    } else {
      nextStep = getNextCategoryStep(s);
    }
    setStep(nextStep);
  };"""
NEW_GN = """    } else {
      nextStep = getNextCategoryStep(s);
    }
    setFrontNavStack(prev => [...prev, { returnTo: s, undoCount: added.length }]);
    setStep(nextStep);
  };"""
assert OLD_GN in t
t = t.replace(OLD_GN, NEW_GN, 1)

# 初期：上余白 14→28（もう1行分）
t = t.replace("{isMobile && <div style={{ height: 14 }} />}", "{isMobile && <div style={{ height: 28 }} />}", 1)

# 初期：質問1（initialMain）— モバイルは1画面目メインと同じ 16px
OLD_P1 = "<p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 17, lineHeight: 1.3 }}>\n            {rc.initialMain}"
NEW_P1 = "<p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>\n            {rc.initialMain}"
assert OLD_P1 in t
t = t.replace(OLD_P1, NEW_P1, 1)

# 初期：質問2 — モバイルは1画面目の補助文と同じ 14px ミュート
OLD_P2 = "<p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 17, lineHeight: 1.3 }}>\n            {rc.initialPriorityQuestion}"
NEW_P2 = "<p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: isMobile ? 'var(--color-text-muted)' : 'var(--color-text)', fontSize: isMobile ? 14 : 17, lineHeight: 1.3 }}>\n            {rc.initialPriorityQuestion}"
assert OLD_P2 in t
t = t.replace(OLD_P2, NEW_P2, 1)

# 選択ボタン（人気・優先）モバイルをやや大きく
OLD_BTN_ROW = "? { ...initBtnBase, padding: '9px 14px', fontSize: 16, minHeight: 44, borderRadius: 10, fontWeight: 500 }"
NEW_BTN_ROW = "? { ...initBtnBase, padding: '11px 16px', fontSize: 18, minHeight: 50, borderRadius: 10, fontWeight: 500 }"
assert t.count(OLD_BTN_ROW) == 2
t = t.replace(OLD_BTN_ROW, NEW_BTN_ROW)

# ①②③ バッジ
t = t.replace(
    "{selected && <span style={{ fontSize: isMobile ? 10 : 13, fontWeight: 'bold' }}>{['①', '②', '③'][idx]}</span>}",
    "{selected && <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 'bold' }}>{['①', '②', '③'][idx]}</span>}",
    1,
)

# 次へ・やり直し モバイル大きく
OLD_NEXT = """                padding: isMobile ? '9px 14px' : '16px 32px',
                fontSize: isMobile ? 16 : 17,
                minHeight: isMobile ? 44 : undefined,"""
NEW_NEXT = """                padding: isMobile ? '12px 18px' : '16px 32px',
                fontSize: isMobile ? 18 : 17,
                minHeight: isMobile ? 50 : undefined,"""
assert OLD_NEXT in t
t = t.replace(OLD_NEXT, NEW_NEXT, 1)

OLD_RETRY = """                padding: isMobile ? '8px 14px' : '10px 20px',
                fontSize: isMobile ? 14 : 14,
                minHeight: isMobile ? 40 : undefined,"""
NEW_RETRY = """                padding: isMobile ? '10px 16px' : '10px 20px',
                fontSize: isMobile ? 16 : 14,
                minHeight: isMobile ? 46 : undefined,"""
assert OLD_RETRY in t
t = t.replace(OLD_RETRY, NEW_RETRY, 1)

# 初期→ai_gate のリンク：表記とサイズ（バックアップ寄せ）
OLD_FIX_INIT = """          <div style={{ marginTop: isMobile ? 4 : 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep('ai_gate')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 4 : 6,
                padding: isMobile ? '3px 8px' : '6px 12px',
                fontSize: isMobile ? 11 : 14,
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
              {rc.btnFix}
            </button>
          </div>"""
NEW_FIX_INIT = """          <div style={{ marginTop: isMobile ? 12 : 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep('ai_gate')}
              style={{
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
          </div>"""
assert OLD_FIX_INIT in t
t = t.replace(OLD_FIX_INIT, NEW_FIX_INIT, 1)

# 次へ：f1 へ進むときにスタッククリア
t = t.replace(
    "onClick={() => canProceedFromInitial && setStep('f1')}",
    "onClick={() => {\n              if (!canProceedFromInitial) return;\n              setFrontNavStack([]);\n              setStep('f1');\n            }}",
    1,
)

# sort1 修正ボタン
OLD_S1F = """              <button type="button" onClick={() => { setSort1Ranks(new Map()); setStep('f3_2'); }} style={sortFixBtnStyle}>
                <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                </svg>
                {rc.btnFix}
              </button>"""
NEW_S1F = """              <button
                type="button"
                onClick={() => {
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
assert OLD_S1F in t
t = t.replace(OLD_S1F, NEW_S1F, 1)

# sort2 モバイル・PC 修正ボタン表記
t = t.replace(
    """                    {rc.btnFix}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>""",
    """                    {rcFixBack}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>""",
    1,
)

t = t.replace(
    """                    {rc.btnFix}
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
    """                    {rcFixBack}
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

# 本編モバイル「ひとつ前に戻る」
MOB_FIX_OLD = """                    if (s === 'f1') {
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
                    } else if (s === 's4') {"""
MOB_FIX_NEW = """                    if (s === 'f1') {
                      setFrontNavStack([]);
                      setCheckedFamous(new Set());
                      setStep('initial');
                    } else if (isFamousStep) {
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
                    } else if (s === 's4') {"""
assert MOB_FIX_OLD in t
t = t.replace(MOB_FIX_OLD, MOB_FIX_NEW, 1)

# 本編PC 同様
PC_FIX_OLD = """                    if (s === 'f1') {
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
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rc.btnFix}
                </button>"""
PC_FIX_NEW = """                    if (s === 'f1') {
                      setFrontNavStack([]);
                      setCheckedFamous(new Set());
                      setStep('initial');
                    } else if (isFamousStep) {
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
                </button>"""
assert PC_FIX_OLD in t
t = t.replace(PC_FIX_OLD, PC_FIX_NEW, 1)

# モバイル側の {rc.btnFix} を rcFixBack（残り1箇所）
t = t.replace(
    """                  </svg>
                  {rc.btnFix}
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
                gap: 12,""",
    """                  </svg>
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
                gap: 12,""",
    1,
)

p.write_text(t, encoding="utf-8")
print("OK")
