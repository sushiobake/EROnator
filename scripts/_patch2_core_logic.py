# -*- coding: utf-8 -*-
"""
Patch 2: コアロジック変更
- engine.ts: handleRevealResponse の qIndex 重複バグ修正
- manager.ts: SessionState に visitorId 追加, getSession に visitorId を返す
- savePlayHistory.ts: visitorId を保存
- saveRecommendPlayHistory.ts: visitorId を受け取って保存
"""
import pathlib

ROOT = pathlib.Path(r'c:\tool\eronator_mvp0_ws_v1_5_3')

# ==========================================================
# 1. engine.ts — handleRevealResponse の newQIndex 修正
# ==========================================================
p = ROOT / 'src' / 'server' / 'game' / 'engine.ts'
t = p.read_text(encoding='utf-8')

OLD_ENGINE = '  const newQIndex = session.questionCount + 1;\n  const newHistory: QuestionHistoryEntry[] = [\n    ...session.questionHistory,'
NEW_ENGINE  = (
    '  const maxQIndex = session.questionHistory.length > 0\n'
    '    ? Math.max(...session.questionHistory.map((e) => e.qIndex ?? 0))\n'
    '    : 0;\n'
    '  const newQIndex = maxQIndex + 1;\n'
    '  const newHistory: QuestionHistoryEntry[] = [\n'
    '    ...session.questionHistory,'
)

if OLD_ENGINE not in t:
    raise SystemExit('engine.ts: newQIndex marker not found')
if 'maxQIndex' in t:
    print('engine.ts: already patched, skip')
else:
    t = t.replace(OLD_ENGINE, NEW_ENGINE, 1)
    p.write_text(t, encoding='utf-8')
    print('OK engine.ts')

# ==========================================================
# 2. manager.ts — SessionState + getSession
# ==========================================================
p = ROOT / 'src' / 'server' / 'session' / 'manager.ts'
t = p.read_text(encoding='utf-8')

# SessionState interface に visitorId 追加
OLD_SS = '  questionHistory: QuestionHistoryEntry[];\n}'
NEW_SS  = '  questionHistory: QuestionHistoryEntry[];\n  visitorId?: string | null;\n}'
if 'visitorId?: string | null;' not in t:
    if OLD_SS not in t:
        raise SystemExit('manager.ts: SessionState closing brace not found')
    t = t.replace(OLD_SS, NEW_SS, 1)
    print('manager.ts: added visitorId to SessionState')
else:
    print('manager.ts: SessionState already has visitorId, skip')

# getSession の return に visitorId を追加
OLD_RETURN = '      questionHistory: JSON.parse(session.questionHistory || \'[]\'),\n    };'
NEW_RETURN  = '      questionHistory: JSON.parse(session.questionHistory || \'[]\'),\n      visitorId: (session as { visitorId?: string | null }).visitorId ?? null,\n    };'
if 'visitorId: (session as' not in t:
    if OLD_RETURN not in t:
        raise SystemExit('manager.ts: getSession return not found')
    t = t.replace(OLD_RETURN, NEW_RETURN, 1)
    print('manager.ts: added visitorId to getSession return')
else:
    print('manager.ts: getSession return already has visitorId, skip')

p.write_text(t, encoding='utf-8')
print('OK manager.ts')

# ==========================================================
# 3. savePlayHistory.ts — visitorId 保存
# ==========================================================
p = ROOT / 'src' / 'server' / 'playHistory' / 'savePlayHistory.ts'
t = p.read_text(encoding='utf-8')

OLD_PH = '      sessionStartedAt,\n      failListContextJson,\n    },'
NEW_PH  = '      sessionStartedAt,\n      failListContextJson,\n      visitorId: session.visitorId ?? null,\n    },'
if 'visitorId: session.visitorId' not in t:
    if OLD_PH not in t:
        raise SystemExit('savePlayHistory.ts: create data block not found')
    t = t.replace(OLD_PH, NEW_PH, 1)
    p.write_text(t, encoding='utf-8')
    print('OK savePlayHistory.ts')
else:
    print('savePlayHistory.ts: already patched, skip')

# ==========================================================
# 4. saveRecommendPlayHistory.ts — visitorId 受け取って保存
# ==========================================================
p = ROOT / 'src' / 'server' / 'recommendPlayHistory' / 'saveRecommendPlayHistory.ts'
t = p.read_text(encoding='utf-8')

# input 型に visitorId 追加
OLD_INPUT = '  topWorkTitle: string | null;\n}): Promise<void>'
NEW_INPUT  = '  topWorkTitle: string | null;\n  visitorId?: string | null;\n}): Promise<void>'
if 'visitorId?: string | null;' not in t:
    if OLD_INPUT not in t:
        raise SystemExit('saveRecommendPlayHistory.ts: input type not found')
    t = t.replace(OLD_INPUT, NEW_INPUT, 1)

# prisma.create data に visitorId 追加
OLD_CREATE = '      topWorkTitle: input.topWorkTitle,\n    },'
NEW_CREATE  = '      topWorkTitle: input.topWorkTitle,\n      visitorId: input.visitorId ?? null,\n    },'
if 'visitorId: input.visitorId' not in t:
    if OLD_CREATE not in t:
        raise SystemExit('saveRecommendPlayHistory.ts: create data not found')
    t = t.replace(OLD_CREATE, NEW_CREATE, 1)

p.write_text(t, encoding='utf-8')
print('OK saveRecommendPlayHistory.ts')
