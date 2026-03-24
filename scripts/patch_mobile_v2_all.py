# -*- coding: utf-8 -*-
"""
推薦モード モバイル UI 修正まとめ v2
① 初期画面：上部空白 + ボタンサイズを本番と合わせる
② タグリストボタン縦0.9倍
③ 選択タグピル：PCより小さくして形をそろえる
④ 整理画面（sort1/sort2）：質問文・ボタン・前半1位〜5位・結果1位〜5位
⑥ PC版 sort1/sort2 characterSpeech fontSize 14→17
"""

from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

# ─────────────────────────────────────────
# ③ ピルサイズ（PC より少し小さく、形は共通）
# ─────────────────────────────────────────
OLD_PIL = "            fontSize: isMobile ? 12 : 11,\n            fontWeight: 500,\n            lineHeight: 1.3,\n            padding: isMobile ? '5px 11px' : '4px 10px',"
NEW_PIL = "            fontSize: isMobile ? 10 : 11,\n            fontWeight: 500,\n            lineHeight: 1.3,\n            padding: isMobile ? '3px 8px' : '4px 10px',"
assert OLD_PIL in t, "ピルサイズ OLD not found"
t = t.replace(OLD_PIL, NEW_PIL, 1)

# ─────────────────────────────────────────
# ① 初期画面：上部スペーサー追加
# ─────────────────────────────────────────
OLD_INIT_TOP = "        <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>\n          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>"
NEW_INIT_TOP = "        <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>\n          {isMobile && <div style={{ height: 14 }} />}\n          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>"
assert OLD_INIT_TOP in t, "初期画面 top spacer OLD not found"
t = t.replace(OLD_INIT_TOP, NEW_INIT_TOP, 1)

# ① 初期画面：選択ボタン（人気度・優先カテゴリ）サイズを本番と合わせる
# 本番 zoom=2.2, 初期 zoom=1.3 → サイズ比 2.2/1.3≈1.69 → 17*1.69≈28.7 / 40*1.69≈67.6
# 初期: fontSize 17→19 (apparent 24.7px), minHeight 40→52 (apparent 67.6px)
OLD_INIT_BTN_CHOICES = "                    ? { ...initBtnBase, padding: '8px 16px', fontSize: 17, minHeight: 40, borderRadius: 10, fontWeight: 500 }"
NEW_INIT_BTN_CHOICES = "                    ? { ...initBtnBase, padding: '12px 16px', fontSize: 19, minHeight: 52, borderRadius: 10, fontWeight: 500 }"
assert t.count(OLD_INIT_BTN_CHOICES) == 2, f"選択ボタン OLD count={t.count(OLD_INIT_BTN_CHOICES)}, expected 2"
t = t.replace(OLD_INIT_BTN_CHOICES, NEW_INIT_BTN_CHOICES)  # 2箇所ともreplaceAll

# ① 初期画面：次へボタン
OLD_BTN_NEXT = "                padding: isMobile ? '8px 16px' : '16px 32px',\n                fontSize: isMobile ? 17 : 17,\n                minHeight: isMobile ? 40 : undefined,"
NEW_BTN_NEXT = "                padding: isMobile ? '12px 16px' : '16px 32px',\n                fontSize: isMobile ? 19 : 17,\n                minHeight: isMobile ? 52 : undefined,"
assert OLD_BTN_NEXT in t, "次へボタン OLD not found"
t = t.replace(OLD_BTN_NEXT, NEW_BTN_NEXT, 1)

# ① 初期画面：やり直しボタン
OLD_BTN_RETRY_INIT = "                padding: isMobile ? '8px 14px' : '10px 20px',\n                fontSize: isMobile ? 14 : 14,\n                minHeight: isMobile ? 40 : undefined,"
NEW_BTN_RETRY_INIT = "                padding: isMobile ? '10px 14px' : '10px 20px',\n                fontSize: isMobile ? 16 : 14,\n                minHeight: isMobile ? 48 : undefined,"
assert OLD_BTN_RETRY_INIT in t, "やり直しボタン OLD not found"
t = t.replace(OLD_BTN_RETRY_INIT, NEW_BTN_RETRY_INIT, 1)

# ─────────────────────────────────────────
# ② タグリスト TagButton 縦 0.9 倍
# ─────────────────────────────────────────
OLD_TAG_BTN = "          padding: isMobile ? '6px 8px' : '8px 10px',\n          fontSize: isMobile ? 10 : 11,\n          minHeight: isMobile ? 26 : undefined,"
NEW_TAG_BTN = "          padding: isMobile ? '5px 7px' : '8px 10px',\n          fontSize: isMobile ? 10 : 11,\n          minHeight: isMobile ? 23 : undefined,"
assert OLD_TAG_BTN in t, "TagButton OLD not found"
t = t.replace(OLD_TAG_BTN, NEW_TAG_BTN, 1)

# ─────────────────────────────────────────
# ⑥ PC版 sort1/sort2 characterSpeech fontSize 14→17
# ─────────────────────────────────────────
OLD_SORT1_CS = "characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>{getSortPromptFront(rcTyped)}</p>}"
NEW_SORT1_CS = "characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}"
assert OLD_SORT1_CS in t, "sort1 PC characterSpeech OLD not found"
t = t.replace(OLD_SORT1_CS, NEW_SORT1_CS, 1)

OLD_SORT2_CS = "characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>{getSortPromptBack(rcTyped)}</p>}"
NEW_SORT2_CS = "characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}"
assert OLD_SORT2_CS in t, "sort2 PC characterSpeech OLD not found"
t = t.replace(OLD_SORT2_CS, NEW_SORT2_CS, 1)

# ─────────────────────────────────────────
# ④ sort1：質問文 fontSize 10→14
# ─────────────────────────────────────────
OLD_SORT1_Q = "              <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>\n                {getSortPromptFront(rcTyped)}"
NEW_SORT1_Q = "              <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 14, lineHeight: 1.3 }}>\n                {getSortPromptFront(rcTyped)}"
assert OLD_SORT1_Q in t, "sort1 question OLD not found"
t = t.replace(OLD_SORT1_Q, NEW_SORT1_Q, 1)

# ④ sort1：proceed ボタン
OLD_SORT1_PROC = "                    padding: isMobile ? '6px 11px' : '13px 26px',\n                    fontSize: isMobile ? 11 : 14,\n                    minHeight: isMobile ? 29 : undefined,"
NEW_SORT1_PROC = "                    padding: isMobile ? '8px 11px' : '13px 26px',\n                    fontSize: isMobile ? 13 : 14,\n                    minHeight: isMobile ? 30 : undefined,"
assert OLD_SORT1_PROC in t, "sort1 proceed OLD not found"
t = t.replace(OLD_SORT1_PROC, NEW_SORT1_PROC, 1)

# ④ sort1：sortBtnStyle
OLD_SORT1_STYLE = """      padding: isMobile ? '5px 10px' : '8px 16px',
      fontSize: isMobile ? 10 : 11,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 24 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}"""
NEW_SORT1_STYLE = """      padding: isMobile ? '6px 10px' : '8px 16px',
      fontSize: isMobile ? 13 : 11,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}"""
assert OLD_SORT1_STYLE in t, "sort1 sortBtnStyle OLD not found"
t = t.replace(OLD_SORT1_STYLE, NEW_SORT1_STYLE, 1)

# ④ sort1：1位〜5位 row → marginTop 追加
OLD_SORT1_RANK_ROW = "            <div style={{ marginBottom: isMobile ? 8 : 16, display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 6, flexDirection: 'row' }}>"
NEW_SORT1_RANK_ROW = "            <div style={{ margin: isMobile ? '10px 0 8px 0' : '0 0 16px 0', display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 6, flexDirection: 'row' }}>"
assert OLD_SORT1_RANK_ROW in t, "sort1 rank row OLD not found"
t = t.replace(OLD_SORT1_RANK_ROW, NEW_SORT1_RANK_ROW, 1)

# ─────────────────────────────────────────
# ④ sort2：質問文 fontSize 10→14
# ─────────────────────────────────────────
OLD_SORT2_Q = "                <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>{getSortPromptBack(rcTyped)}</p>"
NEW_SORT2_Q = "                <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 14, lineHeight: 1.3 }}>{getSortPromptBack(rcTyped)}</p>"
assert OLD_SORT2_Q in t, "sort2 question OLD not found"
t = t.replace(OLD_SORT2_Q, NEW_SORT2_Q, 1)

# ④ sort2：「前半の１位～５位」ラベル
OLD_SORT2_FRONT_LABEL = "                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 6px 0', fontWeight: 500 }}>前半の１位～５位</p>"
NEW_SORT2_FRONT_LABEL = "                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '0 0 4px 0', fontWeight: 600 }}>前半の１位～５位</p>"
assert OLD_SORT2_FRONT_LABEL in t, "sort2 front label OLD not found"
t = t.replace(OLD_SORT2_FRONT_LABEL, NEW_SORT2_FRONT_LABEL, 1)

# ④ sort2：「前半の1位〜5位」のボタン群をピル→角丸ボタン＋横線区切りに変更
OLD_SORT2_FRONT_BTNS = """                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {rankedFamous.map((t) => {
                    const rr = sort2Ranks.get(t.tagKey);
                    const labelRank = rr ?? t.rank;
                    return (
                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          padding: '3px 6px',
                          fontSize: 8,
                          fontWeight: 600,
                          borderRadius: 9999,
                          backgroundColor: rr ? '#dbeafe' : '#e5e7eb',
                          color: rr ? '#1d4ed8' : 'var(--color-text)',
                          border: rr ? '1px solid #93c5fd' : '1px solid #d1d5db',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                      >
                        {labelRank}位:{t.displayName}
                      </button>
                    );
                  })}
                </div>"""
NEW_SORT2_FRONT_BTNS = """                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 0, paddingBottom: 10, borderBottom: '3px solid #6b7280' }}>
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
assert OLD_SORT2_FRONT_BTNS in t, "sort2 front buttons OLD not found"
t = t.replace(OLD_SORT2_FRONT_BTNS, NEW_SORT2_FRONT_BTNS, 1)

# ④ sort2：backTags グリッドに marginTop 追加
OLD_SORT2_BACK_GRID = "                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>"
NEW_SORT2_BACK_GRID = "                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 10, marginBottom: 10 }}>"
assert OLD_SORT2_BACK_GRID in t, "sort2 backTags grid OLD not found"
t = t.replace(OLD_SORT2_BACK_GRID, NEW_SORT2_BACK_GRID, 1)

# ④ sort2：1位〜5位 result row に marginTop 追加
OLD_SORT2_RANK_ROW = "                <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>"
NEW_SORT2_RANK_ROW = "                <div style={{ margin: '10px 0 10px 0', display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>"
assert OLD_SORT2_RANK_ROW in t, "sort2 rank row OLD not found"
t = t.replace(OLD_SORT2_RANK_ROW, NEW_SORT2_RANK_ROW, 1)

# ④ sort2：proceed ボタン（モバイル）
OLD_SORT2_PROC = "                        padding: '6px 11px',\n                        fontSize: 11,\n                        minHeight: 29,"
NEW_SORT2_PROC = "                        padding: '8px 11px',\n                        fontSize: 13,\n                        minHeight: 30,"
assert OLD_SORT2_PROC in t, "sort2 proceed OLD not found"
t = t.replace(OLD_SORT2_PROC, NEW_SORT2_PROC, 1)

# ④ sort2：sortBtnStyle2（retry ボタン）
OLD_SORT2_STYLE2 = """      padding: isMobile ? '5px 10px' : '8px 16px',
      fontSize: isMobile ? 10 : 11,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 24 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}"""
NEW_SORT2_STYLE2 = """      padding: isMobile ? '6px 10px' : '8px 16px',
      fontSize: isMobile ? 13 : 11,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}"""
assert OLD_SORT2_STYLE2 in t, "sort2 sortBtnStyle2 OLD not found"
t = t.replace(OLD_SORT2_STYLE2, NEW_SORT2_STYLE2, 1)

# ─────────────────────────────────────────
# 書き出し
# ─────────────────────────────────────────
p.write_text(t, encoding="utf-8")
print("OK: RecommendMode.tsx patched")

# ─────────────────────────────────────────
# ⑤ MobileWorkCardHorizontal.tsx
# ─────────────────────────────────────────
mwc_p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "MobileWorkCardHorizontal.tsx"
mwc = mwc_p.read_text(encoding="utf-8")

# 画像幅 100→120
OLD_IMG = "const IMG_WIDTH = 100;"
NEW_IMG = "const IMG_WIDTH = 120;"
assert OLD_IMG in mwc, "IMG_WIDTH OLD not found"
mwc = mwc.replace(OLD_IMG, NEW_IMG, 1)

# 好みマッチ度ラベル fontSize 16→13 (0.8倍), 数字 (span) はそのまま
OLD_MATCH_P = "          <p style={{ fontSize: compact ? 12 : 16, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0' }}>"
NEW_MATCH_P = "          <p style={{ fontSize: compact ? 12 : 13, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0' }}>"
assert OLD_MATCH_P in mwc, "matchRate label OLD not found"
mwc = mwc.replace(OLD_MATCH_P, NEW_MATCH_P, 1)

# タイトル 2行→3行, minHeight 32→47
OLD_TITLE = "        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 1px 0', lineHeight: 1.3, minHeight: 32, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, wordBreak: 'break-word' }}>"
NEW_TITLE = "        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 1px 0', lineHeight: 1.3, minHeight: 47, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, wordBreak: 'break-word' }}>"
assert OLD_TITLE in mwc, "title OLD not found"
mwc = mwc.replace(OLD_TITLE, NEW_TITLE, 1)

mwc_p.write_text(mwc, encoding="utf-8")
print("OK: MobileWorkCardHorizontal.tsx patched")
