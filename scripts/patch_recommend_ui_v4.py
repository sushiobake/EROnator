# -*- coding: utf-8 -*-
"""
① 初期画面モバイル：3択グリッドを幅80%・右寄せ、次へ/やり直しも同様
② 整理 sort2 モバイル：前半ラベル余白+小さく、前半5タグを後半と同一グリッド・同一ボタン
③ PC：タグリスト・整理のタグボタンを共通で少し大きく（15px 等）
"""

from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

# ── ① 初期：人気度グリッド
OLD1 = "          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 8 : 32 }}>\n            {[\n              { value: 'famous' as const, label: 'やっぱり有名作品！' },"
NEW1 = "          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 8 : 32, ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>\n            {[\n              { value: 'famous' as const, label: 'やっぱり有名作品！' },"
assert OLD1 in t, "initial grid1 not found"
t = t.replace(OLD1, NEW1, 1)

# ── ① 初期：優先カテゴリグリッド
OLD2 = "          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 6 : 20 }}>\n            {CATEGORIES.map((cat) => {"
NEW2 = "          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 6 : 20, ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>\n            {CATEGORIES.map((cat) => {"
assert OLD2 in t, "initial grid2 not found"
t = t.replace(OLD2, NEW2, 1)

# ── ① 初期：次へ・やり直し行
OLD3 = "          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 12, alignItems: 'center' }}>\n            <button\n              onClick={() => canProceedFromInitial && setStep('f1')}"
NEW3 = "          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 12, alignItems: 'center', ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>\n            <button\n              onClick={() => canProceedFromInitial && setStep('f1')}"
assert OLD3 in t, "initial next row not found"
t = t.replace(OLD3, NEW3, 1)

# ── ② sort2 モバイル：ラベル（質問から1行分離・PCと同程度の小ささ）
OLD_LBL = "<p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 4px 0', fontWeight: 600 }}>前半の１位～５位</p>"
NEW_LBL = "<p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '14px 0 4px 0', fontWeight: 500 }}>前半の１位～５位</p>"
assert OLD_LBL in t, "sort2 mobile label not found"
t = t.replace(OLD_LBL, NEW_LBL, 1)

# ── ② sort2 モバイル：前半5タグ → 2列グリッド＋TagButton相当（後半と同一）
OLD_FRONT = """                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 0, paddingBottom: 8, borderBottom: '3px solid #6b7280' }}>
                  {rankedFamous.map((t) => {
                    const rr = sort2Ranks.get(t.tagKey);
                    return (
                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          padding: '5px 7px',
                          fontSize: 10,
                          fontWeight: 500,
                          textAlign: 'left',
                          minHeight: 23,
                          borderRadius: 6,
                          backgroundColor: rr ? '#dbeafe' : '#faf8f5',
                          color: rr ? '#1d4ed8' : 'var(--color-text)',
                          border: `2px solid ${rr ? '#3b82f6' : '#e5e7eb'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {t.displayName}
                      </button>
                    );
                  })}
                </div>"""
NEW_FRONT = """                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 0, paddingBottom: 8, borderBottom: '3px solid #6b7280' }}>
                  {rankedFamous.map((t) => {
                    const rr = sort2Ranks.get(t.tagKey);
                    return (
                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '5px 7px',
                          fontSize: 10,
                          minHeight: 23,
                          fontWeight: 500,
                          textAlign: 'left',
                          width: '100%',
                          boxSizing: 'border-box',
                          backgroundColor: rr ? '#dbeafe' : '#faf8f5',
                          color: rr ? '#1d4ed8' : 'var(--color-text)',
                          border: `2px solid ${rr ? '#3b82f6' : '#e5e7eb'}`,
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
                      </button>
                    );
                  })}
                </div>"""
assert OLD_FRONT in t, "sort2 mobile front block not found"
t = t.replace(OLD_FRONT, NEW_FRONT, 1)

# ── ② sort2 モバイル：後半タグを前半と完全同一スタイル
OLD_BACK = """                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          padding: '5px 7px',
                          fontSize: 10,
                          fontWeight: 500,
                          textAlign: 'left',
                          minHeight: 23,
                          backgroundColor: r ? '#dbeafe' : '#faf8f5',
                          color: r ? '#1d4ed8' : 'var(--color-text)',
                          border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        {t.displayName}
                      </button>"""
NEW_BACK = """                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '5px 7px',
                          fontSize: 10,
                          minHeight: 23,
                          fontWeight: 500,
                          textAlign: 'left',
                          width: '100%',
                          boxSizing: 'border-box',
                          backgroundColor: r ? '#dbeafe' : '#faf8f5',
                          color: r ? '#1d4ed8' : 'var(--color-text)',
                          border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
                      </button>"""
assert OLD_BACK in t, "sort2 mobile back btn not found"
t = t.replace(OLD_BACK, NEW_BACK, 1)

# ── ③ TagButton PC 大きめ・共通
OLD_TB = """        style={{
          display: 'flex',
          alignItems: 'center',
          padding: isMobile ? '5px 7px' : '8px 10px',
          fontSize: isMobile ? 10 : 13,
          minHeight: isMobile ? 23 : undefined,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}"""
NEW_TB = """        style={{
          display: 'flex',
          alignItems: 'center',
          padding: isMobile ? '5px 7px' : '10px 12px',
          fontSize: isMobile ? 10 : 15,
          minHeight: isMobile ? 23 : 36,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}"""
assert OLD_TB in t, "TagButton block not found"
t = t.replace(OLD_TB, NEW_TB, 1)

# ── ③ sort1 renderCol ボタン（PCを TagButton と揃える）
OLD_S1 = """              style={{
                padding: isMobile ? '5px 7px' : '8px 11px',
                fontSize: isMobile ? 10 : 13,
                fontWeight: 500,
                textAlign: 'left',
                minHeight: isMobile ? 23 : undefined,
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 6,
                cursor: 'pointer',
              }}"""
NEW_S1 = """              style={{
                padding: isMobile ? '5px 7px' : '10px 12px',
                fontSize: isMobile ? 10 : 15,
                fontWeight: 500,
                textAlign: 'left',
                minHeight: isMobile ? 23 : 36,
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}"""
assert OLD_S1 in t, "sort1 col btn not found"
t = t.replace(OLD_S1, NEW_S1, 1)

# ── ③ sort2 renderCol（PC・モバイルをタグリストと統一）
OLD_S2RC = """              style={{
                padding: '8px 11px',
                fontSize: isMobile ? 12 : 13,
                fontWeight: 500,
                textAlign: 'left',
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 6,
                cursor: 'pointer',
              }}"""
NEW_S2RC = """              style={{
                display: 'flex',
                alignItems: 'center',
                padding: isMobile ? '5px 7px' : '10px 12px',
                fontSize: isMobile ? 10 : 15,
                minHeight: isMobile ? 23 : 36,
                fontWeight: 500,
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}"""
assert OLD_S2RC in t, "sort2 renderCol btn not found"
t = t.replace(OLD_S2RC, NEW_S2RC, 1)

# 内側のテキストを省略対応に（PC sort2 3列）
OLD_S2_INNER = """            >
              {t.displayName}
            </button>
          );
        })}
      </div>
    );
    const sortBtnStyle2 = {"""
NEW_S2_INNER = """            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
            </button>
          );
        })}
      </div>
    );
    const sortBtnStyle2 = {"""
assert OLD_S2_INNER in t, "sort2 renderCol inner not found"
t = t.replace(OLD_S2_INNER, NEW_S2_INNER, 1)

# ── ③ sort2 PC 左列（前半5タグ）を同サイズに
OLD_S2PC_L = """                            style={{
                              padding: '8px 11px',
                              fontSize: 11,
                              fontWeight: 500,
                              textAlign: 'left',
                              backgroundColor: r ? '#dbeafe' : '#faf8f5',
                              color: r ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 6,
                              cursor: 'pointer',
                            }}
                          >
                            {t.displayName}
                          </button>"""
NEW_S2PC_L = """                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 12px',
                              fontSize: 15,
                              minHeight: 36,
                              fontWeight: 500,
                              textAlign: 'left',
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: r ? '#dbeafe' : '#faf8f5',
                              color: r ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
                          </button>"""
assert OLD_S2PC_L in t, "sort2 PC left col not found"
t = t.replace(OLD_S2PC_L, NEW_S2PC_L, 1)

p.write_text(t, encoding="utf-8")
print("OK: RecommendMode.tsx v4")
