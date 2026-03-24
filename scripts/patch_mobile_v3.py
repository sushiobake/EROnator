# -*- coding: utf-8 -*-
"""
推薦モード UI 修正 v3
① 初期画面：質問文を共通化（両方 17px）・選択ボタンを小さく
③ 選択タグピル：コンパクト化・「修正する」を下げる
④ 整理画面：タグサイズ共通・1位〜5位スペース・前半タグ横並び&「●位」除去
⑥ PC版：タグ・ボタン文字を 11→13 px に統一
"""

from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

# ═══════════════════════════════════════════
# ① 初期画面
# ═══════════════════════════════════════════

# 質問文1（rc.initialMain）: fontSize 16→17 に統一
OLD_Q1 = "          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>"
NEW_Q1 = "          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 17, lineHeight: 1.3 }}>"
assert OLD_Q1 in t, "Q1 not found"
t = t.replace(OLD_Q1, NEW_Q1, 1)

# 質問文2（rc.initialPriorityQuestion）: fontSize 14→17, color を text-muted から統一
OLD_Q2 = "          <p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: isMobile ? 'var(--color-text-muted)' : 'var(--color-text)', fontSize: isMobile ? 14 : 17, lineHeight: 1.3 }}>"
NEW_Q2 = "          <p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 17, lineHeight: 1.3 }}>"
assert OLD_Q2 in t, "Q2 not found"
t = t.replace(OLD_Q2, NEW_Q2, 1)

# 選択ボタン（人気度・優先カテゴリ共通）：19→16, 52→44, padding 縮小
OLD_CHOICE_BTN = "                    ? { ...initBtnBase, padding: '12px 16px', fontSize: 19, minHeight: 52, borderRadius: 10, fontWeight: 500 }"
NEW_CHOICE_BTN = "                    ? { ...initBtnBase, padding: '9px 14px', fontSize: 16, minHeight: 44, borderRadius: 10, fontWeight: 500 }"
assert t.count(OLD_CHOICE_BTN) == 2, f"choice btn count={t.count(OLD_CHOICE_BTN)}"
t = t.replace(OLD_CHOICE_BTN, NEW_CHOICE_BTN)  # 2箇所とも

# 次へボタン
OLD_BTN_NEXT = "                padding: isMobile ? '12px 16px' : '16px 32px',\n                fontSize: isMobile ? 19 : 17,\n                minHeight: isMobile ? 52 : undefined,"
NEW_BTN_NEXT = "                padding: isMobile ? '9px 14px' : '16px 32px',\n                fontSize: isMobile ? 16 : 17,\n                minHeight: isMobile ? 44 : undefined,"
assert OLD_BTN_NEXT in t, "next btn not found"
t = t.replace(OLD_BTN_NEXT, NEW_BTN_NEXT, 1)

# やり直しボタン
OLD_BTN_RETRY = "                padding: isMobile ? '10px 14px' : '10px 20px',\n                fontSize: isMobile ? 16 : 14,\n                minHeight: isMobile ? 48 : undefined,"
NEW_BTN_RETRY = "                padding: isMobile ? '8px 14px' : '10px 20px',\n                fontSize: isMobile ? 14 : 14,\n                minHeight: isMobile ? 40 : undefined,"
assert OLD_BTN_RETRY in t, "retry btn not found"
t = t.replace(OLD_BTN_RETRY, NEW_BTN_RETRY, 1)

# ═══════════════════════════════════════════
# ③ 選択タグピル：コンパクト化
# ═══════════════════════════════════════════

# PICKED_TAGS_ROW_HEIGHT 44→32
OLD_HEIGHT = "const PICKED_TAGS_ROW_HEIGHT = 44;"
NEW_HEIGHT = "const PICKED_TAGS_ROW_HEIGHT = 32;"
assert OLD_HEIGHT in t, "HEIGHT not found"
t = t.replace(OLD_HEIGHT, NEW_HEIGHT, 1)

# ピル font/padding をさらに小さく
OLD_PIL = "            fontSize: isMobile ? 10 : 11,\n            fontWeight: 500,\n            lineHeight: 1.3,\n            padding: isMobile ? '3px 8px' : '4px 10px',"
NEW_PIL = "            fontSize: isMobile ? 9 : 11,\n            fontWeight: 500,\n            lineHeight: 1.3,\n            padding: isMobile ? '1px 5px' : '4px 10px',"
assert OLD_PIL in t, "pill style not found"
t = t.replace(OLD_PIL, NEW_PIL, 1)

# 「修正する」ボタン marginTop 4→14
OLD_FIX_MARGIN = "              <div style={{ marginTop: 4, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>"
NEW_FIX_MARGIN = "              <div style={{ marginTop: 14, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>"
assert OLD_FIX_MARGIN in t, "fix margin not found"
t = t.replace(OLD_FIX_MARGIN, NEW_FIX_MARGIN, 1)

# ═══════════════════════════════════════════
# ④ 整理画面 sort1
# ═══════════════════════════════════════════

# sort1 renderCol ボタン: TagButton 共通（padding + minHeight）
OLD_S1_COL = "                padding: isMobile ? '4px 3px' : '8px 11px',\n                fontSize: isMobile ? 10 : 11,\n                fontWeight: 500,\n                textAlign: 'left',\n                backgroundColor: r ? '#dbeafe' : '#faf8f5',\n                color: r ? '#1d4ed8' : 'var(--color-text)',\n                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,\n                borderRadius: 6,\n                cursor: 'pointer',"
NEW_S1_COL = "                padding: isMobile ? '5px 7px' : '8px 11px',\n                fontSize: isMobile ? 10 : 13,\n                fontWeight: 500,\n                textAlign: 'left',\n                minHeight: isMobile ? 23 : undefined,\n                backgroundColor: r ? '#dbeafe' : '#faf8f5',\n                color: r ? '#1d4ed8' : 'var(--color-text)',\n                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,\n                borderRadius: 6,\n                cursor: 'pointer',"
assert OLD_S1_COL in t, "sort1 col btn not found"
t = t.replace(OLD_S1_COL, NEW_S1_COL, 1)

# sort1 1位〜5位 marginTop: 10px→16px
OLD_S1_RANK = "            <div style={{ margin: isMobile ? '10px 0 8px 0' : '0 0 16px 0', display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 6, flexDirection: 'row' }}>"
NEW_S1_RANK = "            <div style={{ margin: isMobile ? '16px 0 8px 0' : '0 0 16px 0', display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 6, flexDirection: 'row' }}>"
assert OLD_S1_RANK in t, "sort1 rank row not found"
t = t.replace(OLD_S1_RANK, NEW_S1_RANK, 1)

# sort1 1位〜5位 PC fontSize 10→12
OLD_S1_RANK_BADGE = "padding: isMobile ? '2px 5px' : '5px 10px', minWidth: isMobile ? 40 : 64, fontSize: isMobile ? 9 : 10, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}`"
NEW_S1_RANK_BADGE = "padding: isMobile ? '2px 5px' : '5px 10px', minWidth: isMobile ? 40 : 64, fontSize: isMobile ? 9 : 12, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}`"
assert OLD_S1_RANK_BADGE in t, "sort1 rank badge not found"
t = t.replace(OLD_S1_RANK_BADGE, NEW_S1_RANK_BADGE, 1)

# ═══════════════════════════════════════════
# ④ 整理画面 sort2
# ═══════════════════════════════════════════

# sort2「前半の1位〜5位」：縦列→横並び、「●位:」削除、TagButton共通サイズに
OLD_S2_FRONT = """                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 0, paddingBottom: 10, borderBottom: '3px solid #6b7280' }}>
                  {rankedFamous.map((t) => {
                    const rr = sort2Ranks.get(t.tagKey);
                    const labelRank = rr ?? t.rank;
                    return (
                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          padding: '5px 8px',
                          fontSize: 10,
                          fontWeight: 500,
                          textAlign: 'left',
                          borderRadius: 6,
                          backgroundColor: rr ? '#dbeafe' : '#faf8f5',
                          color: rr ? '#1d4ed8' : 'var(--color-text)',
                          border: `2px solid ${rr ? '#3b82f6' : '#e5e7eb'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {labelRank}位: {t.displayName}
                      </button>
                    );
                  })}
                </div>"""
NEW_S2_FRONT = """                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 0, paddingBottom: 8, borderBottom: '3px solid #6b7280' }}>
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
assert OLD_S2_FRONT in t, "sort2 front not found"
t = t.replace(OLD_S2_FRONT, NEW_S2_FRONT, 1)

# sort2 backTags ボタン: TagButton 共通
OLD_S2_BACK_BTN = "                          padding: '4px 5px',\n                          fontSize: 10,\n                          fontWeight: 500,\n                          textAlign: 'left',\n                          minHeight: 22,"
NEW_S2_BACK_BTN = "                          padding: '5px 7px',\n                          fontSize: 10,\n                          fontWeight: 500,\n                          textAlign: 'left',\n                          minHeight: 23,"
assert OLD_S2_BACK_BTN in t, "sort2 back btn not found"
t = t.replace(OLD_S2_BACK_BTN, NEW_S2_BACK_BTN, 1)

# sort2 1位〜5位 mobile marginTop: 10px→16px
OLD_S2_RANK = "                <div style={{ margin: '10px 0 10px 0', display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>"
NEW_S2_RANK = "                <div style={{ margin: '16px 0 10px 0', display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>"
assert OLD_S2_RANK in t, "sort2 rank row not found"
t = t.replace(OLD_S2_RANK, NEW_S2_RANK, 1)

# sort2 1位〜5位 PC fontSize 10→12
OLD_S2_RANK_BADGE = "padding: '5px 10px', minWidth: 64, fontSize: 10, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}`"
NEW_S2_RANK_BADGE = "padding: '5px 10px', minWidth: 64, fontSize: 12, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}`"
assert OLD_S2_RANK_BADGE in t, "sort2 rank badge not found"
t = t.replace(OLD_S2_RANK_BADGE, NEW_S2_RANK_BADGE, 1)

# sort2 renderCol ボタン（PC 3列グリッド）: fontSize 11→13
OLD_S2_COL = "                padding: '8px 11px',\n                fontSize: isMobile ? 12 : 11,"
NEW_S2_COL = "                padding: '8px 11px',\n                fontSize: isMobile ? 12 : 13,"
assert OLD_S2_COL in t, "sort2 renderCol not found"
t = t.replace(OLD_S2_COL, NEW_S2_COL, 1)

# ═══════════════════════════════════════════
# ⑥ PC版全体：タグ文字サイズ 11→13
# ═══════════════════════════════════════════

# TagButton PC: fontSize 11→13
OLD_TAG_PC = "          fontSize: isMobile ? 10 : 11,\n          minHeight: isMobile ? 23 : undefined,"
NEW_TAG_PC = "          fontSize: isMobile ? 10 : 13,\n          minHeight: isMobile ? 23 : undefined,"
assert OLD_TAG_PC in t, "TagButton PC font not found"
t = t.replace(OLD_TAG_PC, NEW_TAG_PC, 1)

# sortBtnStyle PC: fontSize 11→13
OLD_SBS_PC = "      fontSize: isMobile ? 13 : 11,\n      fontWeight: 600,\n      borderRadius: 6,\n      cursor: 'pointer' as const,\n      boxSizing: 'border-box' as const,\n      ...(isMobile ? { minHeight: 30 } : {}),\n    };\n    return (\n      <>\n        <Stage\n          characterVariant=\"usually\"\n          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}"
NEW_SBS_PC = "      fontSize: isMobile ? 13 : 13,\n      fontWeight: 600,\n      borderRadius: 6,\n      cursor: 'pointer' as const,\n      boxSizing: 'border-box' as const,\n      ...(isMobile ? { minHeight: 30 } : {}),\n    };\n    return (\n      <>\n        <Stage\n          characterVariant=\"usually\"\n          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}"
assert OLD_SBS_PC in t, "sortBtnStyle PC not found"
t = t.replace(OLD_SBS_PC, NEW_SBS_PC, 1)

# sortBtnStyle2 PC: fontSize 11→13
OLD_SBS2_PC = "      fontSize: isMobile ? 13 : 11,\n      fontWeight: 600,\n      borderRadius: 6,\n      cursor: 'pointer' as const,\n      boxSizing: 'border-box' as const,\n      ...(isMobile ? { minHeight: 30 } : {}),\n    };\n    return (\n      <>\n        <Stage\n          characterVariant=\"usually\"\n          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}"
NEW_SBS2_PC = "      fontSize: isMobile ? 13 : 13,\n      fontWeight: 600,\n      borderRadius: 6,\n      cursor: 'pointer' as const,\n      boxSizing: 'border-box' as const,\n      ...(isMobile ? { minHeight: 30 } : {}),\n    };\n    return (\n      <>\n        <Stage\n          characterVariant=\"usually\"\n          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}"
assert OLD_SBS2_PC in t, "sortBtnStyle2 PC not found"
t = t.replace(OLD_SBS2_PC, NEW_SBS2_PC, 1)

# ─────────────────────────────────────────
# 書き出し
# ─────────────────────────────────────────
p.write_text(t, encoding="utf-8")
print("OK: RecommendMode.tsx patched (v3)")
