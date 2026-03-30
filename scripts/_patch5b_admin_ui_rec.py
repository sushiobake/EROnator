# -*- coding: utf-8 -*-
"""Patch 5b: recHistItems 型 + 推薦履歴日時セル"""
import pathlib

ROOT = pathlib.Path(r'c:\tool\eronator_mvp0_ws_v1_5_3')
p = ROOT / 'src' / 'app' / 'admin' / 'tags' / 'page.tsx'
t = p.read_text(encoding='utf-8')

# --------------------------------------------------------
# 1. recHistItems 型に visitorId + hasNormalPlay 追加
# --------------------------------------------------------
OLD_REC_TYPE = (
    '      topWorkId: string | null;\n'
    '      topWorkTitle: string | null;\n'
    '      createdAt: string;\n'
    '    }>\n'
    '  >([]);'
)
NEW_REC_TYPE = (
    '      topWorkId: string | null;\n'
    '      topWorkTitle: string | null;\n'
    '      createdAt: string;\n'
    '      visitorId?: string | null;\n'
    '      hasNormalPlay?: boolean;\n'
    '    }>\n'
    '  >([]);'
)
if 'hasNormalPlay' not in t:
    if OLD_REC_TYPE not in t:
        raise SystemExit(f'recHistItems type not found.\nLooking for:\n{repr(OLD_REC_TYPE)}')
    t = t.replace(OLD_REC_TYPE, NEW_REC_TYPE, 1)
    print('patched recHistItems type')
else:
    print('recHistItems type: already patched')

# --------------------------------------------------------
# 2. 推薦履歴テーブルの日時セル（row 変数）
# --------------------------------------------------------
OLD_REC_DATE = (
    "                        <td style={{ padding: '0.45rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>\n"
    "                          {row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}\n"
    "                        </td>"
)
NEW_REC_DATE = (
    "                        <td style={{ padding: '0.45rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>\n"
    "                          <div>{row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}</div>\n"
    "                          {row.visitorId && (\n"
    "                            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>\n"
    "                              #{row.visitorId.slice(-8)}\n"
    "                              {row.hasNormalPlay && <span style={{ marginLeft: '0.3rem', color: '#0070f3', fontWeight: 'bold', fontSize: '0.7rem' }}>通常◎</span>}\n"
    "                            </div>\n"
    "                          )}\n"
    "                        </td>"
)
if '通常◎' not in t:
    if OLD_REC_DATE not in t:
        raise SystemExit('recommend history date cell not found')
    t = t.replace(OLD_REC_DATE, NEW_REC_DATE, 1)
    print('patched recommend history date cell')
else:
    print('recommend history date cell: already patched')

p.write_text(t, encoding='utf-8')
print('DONE')
