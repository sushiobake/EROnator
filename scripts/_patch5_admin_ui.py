# -*- coding: utf-8 -*-
"""
Patch 5: 管理画面 (src/app/admin/tags/page.tsx)
- historyItems 型に visitorId, hasRecommendPlay 追加
- recHistItems 型に visitorId, hasNormalPlay 追加
- 一覧の日時セルに visitorId バッジ（推薦◎ も）追加
- モーダルヘッダーに outcome + 作品名 + ID 末尾を表示
- FAIL_LIST セクションを常時表示（データなしメッセージも出す）
- 推薦履歴一覧の日時セルに visitorId バッジ（通常◎ も）追加
"""
import pathlib

ROOT = pathlib.Path(r'c:\tool\eronator_mvp0_ws_v1_5_3')
p = ROOT / 'src' / 'app' / 'admin' / 'tags' / 'page.tsx'
t = p.read_text(encoding='utf-8')

# --------------------------------------------------------
# 1. historyItems 型に visitorId + hasRecommendPlay 追加
# --------------------------------------------------------
OLD_HIST_TYPE = (
    '    failListContext?: unknown | null;\n'
    '  }>>([]);'
)
NEW_HIST_TYPE = (
    '    failListContext?: unknown | null;\n'
    '    visitorId?: string | null;\n'
    '    hasRecommendPlay?: boolean;\n'
    '  }>>([]);'
)
if 'visitorId?: string | null;' not in t:
    if OLD_HIST_TYPE not in t:
        raise SystemExit('historyItems type close not found')
    t = t.replace(OLD_HIST_TYPE, NEW_HIST_TYPE, 1)
    print('patched historyItems type')

# --------------------------------------------------------
# 2. recHistItems 型に visitorId + hasNormalPlay 追加
# --------------------------------------------------------
OLD_REC_TYPE = (
    '    topWorkId: string | null;\n'
    '    topWorkTitle: string | null;\n'
    '    createdAt: string;\n'
    '  }>\n'
    '>([]);'
)
NEW_REC_TYPE = (
    '    topWorkId: string | null;\n'
    '    topWorkTitle: string | null;\n'
    '    createdAt: string;\n'
    '    visitorId?: string | null;\n'
    '    hasNormalPlay?: boolean;\n'
    '  }>\n'
    '>([]);'
)
if OLD_REC_TYPE not in t:
    print('WARN: recHistItems type close not found, skip')
else:
    t = t.replace(OLD_REC_TYPE, NEW_REC_TYPE, 1)
    print('patched recHistItems type')

# --------------------------------------------------------
# 3. 通常プレイ履歴 一覧の日時セルに visitorId バッジ追加
# --------------------------------------------------------
OLD_DATE_CELL = (
    "                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>\n"
    "                        {row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}\n"
    "                      </td>"
)
NEW_DATE_CELL = (
    "                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>\n"
    "                        <div>{row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}</div>\n"
    "                        {row.visitorId && (\n"
    "                          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>\n"
    "                            #{row.visitorId.slice(-8)}\n"
    "                            {row.hasRecommendPlay && <span style={{ marginLeft: '0.3rem', color: '#7c3aed', fontWeight: 'bold', fontSize: '0.7rem' }}>推薦◎</span>}\n"
    "                          </div>\n"
    "                        )}\n"
    "                      </td>"
)
if '推薦◎' not in t:
    if OLD_DATE_CELL not in t:
        raise SystemExit('normal play history date cell not found')
    t = t.replace(OLD_DATE_CELL, NEW_DATE_CELL, 1)
    print('patched normal play history date cell')
else:
    print('normal play history date cell: already patched, skip')

# --------------------------------------------------------
# 4. モーダルヘッダーに outcome + 作品名 + ID 末尾
# --------------------------------------------------------
OLD_MODAL_HDR = "                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>\n                      <strong style={{ fontSize: '1.1rem' }}>過程（質問・回答の流れ）</strong>"
NEW_MODAL_HDR = (
    "                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>\n"
    "                      <div>\n"
    "                        <strong style={{ fontSize: '1.1rem' }}>過程（質問・回答の流れ）</strong>\n"
    "                        {row && (\n"
    "                          <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: '#555' }}>\n"
    "                            <span style={{ fontWeight: 'bold', color: row.outcome === 'SUCCESS' ? '#2e7d32' : row.outcome === 'FAIL_LIST' ? '#c62828' : '#666' }}>{row.outcome}</span>\n"
    "                            {(row.resultWorkTitle ?? row.submittedTitleText) && (\n"
    "                              <span style={{ marginLeft: '0.4rem' }}>— {row.resultWorkTitle ?? row.submittedTitleText}</span>\n"
    "                            )}\n"
    "                            <span style={{ marginLeft: '0.4rem', color: '#aaa', fontFamily: 'monospace', fontSize: '0.78rem' }}>#{row.id.slice(-8)}</span>\n"
    "                          </span>\n"
    "                        )}\n"
    "                      </div>"
)
if 'row.outcome === ' not in t:
    if OLD_MODAL_HDR not in t:
        raise SystemExit('modal header not found')
    t = t.replace(OLD_MODAL_HDR, NEW_MODAL_HDR, 1)
    print('patched modal header')
else:
    print('modal header: already patched, skip')

# --------------------------------------------------------
# 5. FAIL_LIST スナップショットセクション: null でも表示
# --------------------------------------------------------
OLD_FAILLIST_SEC = (
    "                      {row?.outcome === 'FAIL_LIST' && row.failListContext != null && (\n"
    "                        <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#fff8e1', borderRadius: '6px', border: '1px solid #ffcc80', fontSize: '0.88rem' }}>\n"
    "                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>FAIL_LIST 時の候補スナップショット（分析用）</strong>\n"
    "                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '240px', overflow: 'auto', fontSize: '0.8rem' }}>{JSON.stringify(row.failListContext, null, 2)}</pre>\n"
    "                        </div>\n"
    "                      )}"
)
NEW_FAILLIST_SEC = (
    "                      {row?.outcome === 'FAIL_LIST' && (\n"
    "                        <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#fff8e1', borderRadius: '6px', border: '1px solid #ffcc80', fontSize: '0.88rem' }}>\n"
    "                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>FAIL_LIST 時の候補スナップショット（分析用）</strong>\n"
    "                          {row.failListContext != null\n"
    "                            ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '240px', overflow: 'auto', fontSize: '0.8rem' }}>{JSON.stringify(row.failListContext, null, 2)}</pre>\n"
    "                            : <p style={{ margin: 0, color: '#999', fontSize: '0.8rem' }}>スナップショット未保存（旧データまたは保存エラー）</p>\n"
    "                          }\n"
    "                        </div>\n"
    "                      )}"
)
if 'スナップショット未保存' not in t:
    if OLD_FAILLIST_SEC not in t:
        raise SystemExit('FAIL_LIST section not found')
    t = t.replace(OLD_FAILLIST_SEC, NEW_FAILLIST_SEC, 1)
    print('patched FAIL_LIST section')
else:
    print('FAIL_LIST section: already patched, skip')

# --------------------------------------------------------
# 6. 推薦プレイ履歴の日時セルに visitorId バッジ追加
#    recHistItems の日時列を探す（推薦タブ内）
# --------------------------------------------------------
# 推薦タブ内のテーブル行の日時セルを特定する
# page.tsx 内で recHistItems.map が使われる箇所の createdAt セル
REC_DATE_OLD = (
    "                        {r.createdAt ? new Date(r.createdAt).toLocaleString('ja-JP') : '—'}"
)
REC_DATE_NEW = (
    "                        <div>{r.createdAt ? new Date(r.createdAt).toLocaleString('ja-JP') : '—'}</div>\n"
    "                        {r.visitorId && (\n"
    "                          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>\n"
    "                            #{r.visitorId.slice(-8)}\n"
    "                            {r.hasNormalPlay && <span style={{ marginLeft: '0.3rem', color: '#0070f3', fontWeight: 'bold', fontSize: '0.7rem' }}>通常◎</span>}\n"
    "                          </div>\n"
    "                        )}"
)
if '通常◎' not in t:
    if REC_DATE_OLD in t:
        t = t.replace(REC_DATE_OLD, REC_DATE_NEW, 1)
        print('patched recommend history date cell')
    else:
        print('WARN: recommend history date cell not found, skip')
else:
    print('recommend history date cell: already patched, skip')

p.write_text(t, encoding='utf-8')
print('DONE admin/tags/page.tsx')
