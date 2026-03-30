# -*- coding: utf-8 -*-
"""
Patch 3: API ルート変更
"""
import pathlib

ROOT = pathlib.Path(r'c:\tool\eronator_mvp0_ws_v1_5_3')

# =====================================================================
# 1. reveal/route.ts — REVEAL MISS 行注入
# =====================================================================
p = ROOT / 'src' / 'app' / 'api' / 'reveal' / 'route.ts'
t = p.read_text(encoding='utf-8')

REVEAL_MISS_ANCHOR = '    // FAIL_LIST / QUIZ: セッション更新を適用。QUIZ のときはスナップショットを 1 行だけ INSERT。\n    if (result.sessionUpdates) {\n      await SessionManager.updateSession(sessionId, result.sessionUpdates, session);'

REVEAL_MISS_NEW = (
    '    // FAIL_LIST / QUIZ: セッション更新を適用。QUIZ のときはスナップショットを 1 行だけ INSERT。\n'
    '    if (result.sessionUpdates) {\n'
    '      // REVEAL→NO 時: 断定ミス行を questionHistory に追加（管理画面での分析用）\n'
    '      if (answer === \'NO\') {\n'
    '        const rejectedSetForReveal = new Set(session.revealRejectedWorkIds ?? []);\n'
    '        const sortedForReveal = [...probabilities].sort((a, b) => b.probability - a.probability);\n'
    '        const revealedWorkId = sortedForReveal.find((p) => !rejectedSetForReveal.has(p.workId))?.workId ?? null;\n'
    '        if (revealedWorkId) {\n'
    '          const revealedWork = await prisma.work.findUnique({\n'
    '            where: { workId: revealedWorkId },\n'
    '            select: { title: true },\n'
    '          });\n'
    '          const existingHist = session.questionHistory;\n'
    '          const maxExistingQ = existingHist.length > 0\n'
    '            ? Math.max(...existingHist.map((e) => e.qIndex ?? 0))\n'
    '            : 0;\n'
    '          const revealMissEntry: QuestionHistoryEntry = {\n'
    '            qIndex: maxExistingQ + 1,\n'
    '            kind: \'REVEAL\',\n'
    "            displayText: `断定: この作品は「${revealedWork?.title ?? revealedWorkId}」ですか？`,\n"
    "            answer: 'NO',\n"
    "            revealResult: 'MISS',\n"
    '            revealWorkId: revealedWorkId,\n'
    '            revealWorkTitle: revealedWork?.title ?? undefined,\n'
    '          };\n'
    '          if (result.state === \'QUIZ\' && result.sessionUpdates.questionHistory) {\n'
    '            const hist = result.sessionUpdates.questionHistory;\n'
    '            const lastEntry = hist[hist.length - 1];\n'
    '            result.sessionUpdates.questionHistory = [\n'
    '              ...hist.slice(0, -1),\n'
    '              revealMissEntry,\n'
    '              { ...lastEntry, qIndex: maxExistingQ + 2 },\n'
    '            ];\n'
    '            if (result.sessionUpdates.questionCount != null) {\n'
    '              result.sessionUpdates.questionCount = maxExistingQ + 2;\n'
    '            }\n'
    '          } else if (result.state === \'FAIL_LIST\') {\n'
    '            result.sessionUpdates.questionHistory = [...session.questionHistory, revealMissEntry];\n'
    '          }\n'
    '        }\n'
    '      }\n'
    '      await SessionManager.updateSession(sessionId, result.sessionUpdates, session);'
)

if 'revealMissEntry' not in t:
    if REVEAL_MISS_ANCHOR not in t:
        raise SystemExit('reveal/route.ts: FAIL_LIST/QUIZ anchor not found')
    t = t.replace(REVEAL_MISS_ANCHOR, REVEAL_MISS_NEW, 1)
    p.write_text(t, encoding='utf-8')
    print('OK reveal/route.ts')
else:
    print('reveal/route.ts: already patched, skip')

# =====================================================================
# 2. start/route.ts — visitorId 受け取ってセッションに保存
# =====================================================================
p = ROOT / 'src' / 'app' / 'api' / 'start' / 'route.ts'
t = p.read_text(encoding='utf-8')

CHECK_LINE = "    if (!aiGateChoice || !['YES', 'NO', 'DONT_CARE'].includes(aiGateChoice)) {"
VISITOR_PREFIX = (
    '    const visitorId =\n'
    "      typeof body.visitorId === 'string' && body.visitorId.length > 0\n"
    '        ? body.visitorId.slice(0, 128)\n'
    '        : null;\n\n'
)

if 'visitorId' not in t:
    if CHECK_LINE not in t:
        raise SystemExit('start/route.ts: aiGateChoice check not found')
    t = t.replace(CHECK_LINE, VISITOR_PREFIX + CHECK_LINE, 1)

    OLD_CREATE = '        questionHistory: JSON.stringify([firstQuestionEntry]),\n      },'
    NEW_CREATE  = '        questionHistory: JSON.stringify([firstQuestionEntry]),\n        ...(visitorId ? { visitorId } : {}),\n      },'
    if OLD_CREATE not in t:
        raise SystemExit('start/route.ts: prisma session create not found')
    t = t.replace(OLD_CREATE, NEW_CREATE, 1)
    p.write_text(t, encoding='utf-8')
    print('OK start/route.ts')
else:
    print('start/route.ts: already patched, skip')

# =====================================================================
# 3. recommend/play-history/route.ts — visitorId 受け取って保存
# =====================================================================
p = ROOT / 'src' / 'app' / 'api' / 'recommend' / 'play-history' / 'route.ts'
t = p.read_text(encoding='utf-8')

OLD_REC = (
    '    await createRecommendPlayHistory({\n'
    '      recommendSessionId,\n'
    '      sessionStartedAt,\n'
    '      detailJson,\n'
    '      topWorkId,\n'
    '      topWorkTitle,\n'
    '    });'
)
NEW_REC = (
    '    const visitorId =\n'
    "      typeof body.visitorId === 'string' && body.visitorId.length > 0\n"
    '        ? body.visitorId.slice(0, 128)\n'
    '        : null;\n\n'
    '    await createRecommendPlayHistory({\n'
    '      recommendSessionId,\n'
    '      sessionStartedAt,\n'
    '      detailJson,\n'
    '      topWorkId,\n'
    '      topWorkTitle,\n'
    '      visitorId,\n'
    '    });'
)
if 'visitorId' not in t:
    if OLD_REC not in t:
        raise SystemExit('recommend/play-history/route.ts: createRecommendPlayHistory block not found')
    t = t.replace(OLD_REC, NEW_REC, 1)
    p.write_text(t, encoding='utf-8')
    print('OK recommend/play-history/route.ts')
else:
    print('recommend/play-history/route.ts: already patched, skip')

# =====================================================================
# 4. admin/play-history/route.ts — visitorId + hasRecommendPlay
# =====================================================================
p = ROOT / 'src' / 'app' / 'api' / 'admin' / 'play-history' / 'route.ts'
t = p.read_text(encoding='utf-8')

if 'hasRecommendPlay' not in t:
    # interface に追加
    OLD_IF = '    /** FAIL_LIST 時の候補スナップショット（JSON オブジェクト） */\n    failListContext: unknown | null;\n    createdAt: string;'
    NEW_IF  = '    /** FAIL_LIST 時の候補スナップショット（JSON オブジェクト） */\n    failListContext: unknown | null;\n    visitorId: string | null;\n    hasRecommendPlay: boolean;\n    createdAt: string;'
    if OLD_IF not in t:
        raise SystemExit('admin/play-history/route.ts: interface not found')
    t = t.replace(OLD_IF, NEW_IF, 1)

    # titleByWorkId 後にクロス参照クエリ追加
    OLD_TITLE = '    const titleByWorkId = Object.fromEntries(workTitles.map((w) => [w.workId, w.title]));'
    NEW_TITLE = (
        '    const titleByWorkId = Object.fromEntries(workTitles.map((w) => [w.workId, w.title]));\n\n'
        '    const visitorIds = [...new Set(items.map((r) => r.visitorId).filter(Boolean) as string[])];\n'
        '    const recPlays = visitorIds.length > 0\n'
        '      ? await prisma.recommendPlayHistory.findMany({\n'
        '          where: { visitorId: { in: visitorIds } },\n'
        '          select: { visitorId: true },\n'
        '        })\n'
        '      : [];\n'
        '    const recVisitorIds = new Set(recPlays.map((r) => r.visitorId).filter(Boolean) as string[]);'
    )
    if OLD_TITLE not in t:
        raise SystemExit('admin/play-history/route.ts: titleByWorkId not found')
    t = t.replace(OLD_TITLE, NEW_TITLE, 1)

    # map 内に追加
    OLD_MAP = '        createdAt: row.createdAt.toISOString(),\n      })),'
    NEW_MAP  = (
        '        visitorId: row.visitorId ?? null,\n'
        '        hasRecommendPlay: row.visitorId ? recVisitorIds.has(row.visitorId) : false,\n'
        '        createdAt: row.createdAt.toISOString(),\n'
        '      })),'
    )
    if OLD_MAP not in t:
        raise SystemExit('admin/play-history/route.ts: createdAt map line not found')
    t = t.replace(OLD_MAP, NEW_MAP, 1)

    p.write_text(t, encoding='utf-8')
    print('OK admin/play-history/route.ts')
else:
    print('admin/play-history/route.ts: already patched, skip')

# =====================================================================
# 5. admin/recommend-play-history/route.ts — visitorId + hasNormalPlay
# =====================================================================
p = ROOT / 'src' / 'app' / 'api' / 'admin' / 'recommend-play-history' / 'route.ts'
t = p.read_text(encoding='utf-8')

if 'hasNormalPlay' not in t:
    OLD_RETURN_REC = '    return NextResponse.json({\n      success: true,\n      items: items.map'
    NEW_RETURN_REC = (
        '    const visitorIdsRH = [...new Set(items.map((r) => r.visitorId).filter(Boolean) as string[])];\n'
        '    const normalPlays = visitorIdsRH.length > 0\n'
        '      ? await prisma.playHistory.findMany({\n'
        '          where: { visitorId: { in: visitorIdsRH } },\n'
        '          select: { visitorId: true },\n'
        '        })\n'
        '      : [];\n'
        '    const normalVisitorIds = new Set(normalPlays.map((r) => r.visitorId).filter(Boolean) as string[]);\n\n'
        '    return NextResponse.json({\n      success: true,\n      items: items.map'
    )
    if OLD_RETURN_REC not in t:
        raise SystemExit('admin/recommend-play-history/route.ts: return block not found')
    t = t.replace(OLD_RETURN_REC, NEW_RETURN_REC, 1)

    OLD_REC_MAP = '        createdAt: row.createdAt.toISOString(),\n      })),'
    NEW_REC_MAP  = (
        '        visitorId: row.visitorId ?? null,\n'
        '        hasNormalPlay: row.visitorId ? normalVisitorIds.has(row.visitorId) : false,\n'
        '        createdAt: row.createdAt.toISOString(),\n'
        '      })),'
    )
    if OLD_REC_MAP not in t:
        raise SystemExit('admin/recommend-play-history/route.ts: createdAt map line not found')
    t = t.replace(OLD_REC_MAP, NEW_REC_MAP, 1)

    p.write_text(t, encoding='utf-8')
    print('OK admin/recommend-play-history/route.ts')
else:
    print('admin/recommend-play-history/route.ts: already patched, skip')
