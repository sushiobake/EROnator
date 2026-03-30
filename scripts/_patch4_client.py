# -*- coding: utf-8 -*-
"""
Patch 4: クライアント側
- src/app/page.tsx: visitorId を localStorage で管理し /api/start に送信
- src/app/components/RecommendMode.tsx: visitorId を /api/recommend/play-history に送信
"""
import pathlib

ROOT = pathlib.Path(r'c:\tool\eronator_mvp0_ws_v1_5_3')

# =====================================================================
# 1. src/app/page.tsx — visitorId 生成・送信
# =====================================================================
p = ROOT / 'src' / 'app' / 'page.tsx'
t = p.read_text(encoding='utf-8')

OLD_FETCH_START = "        fetch('/api/start', {\n          method: 'POST',\n          headers,\n          body: JSON.stringify({ aiGateChoice: choice }),\n        }),"
NEW_FETCH_START = (
    "        fetch('/api/start', {\n"
    "          method: 'POST',\n"
    "          headers,\n"
    "          body: JSON.stringify({\n"
    "            aiGateChoice: choice,\n"
    "            visitorId: (() => {\n"
    "              try {\n"
    "                let vid = localStorage.getItem('eronator.visitorId');\n"
    "                if (!vid) {\n"
    "                  vid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);\n"
    "                  localStorage.setItem('eronator.visitorId', vid);\n"
    "                }\n"
    "                return vid;\n"
    "              } catch { return null; }\n"
    "            })(),\n"
    "          }),\n"
    "        }),"
)

if 'eronator.visitorId' not in t:
    if OLD_FETCH_START not in t:
        raise SystemExit('page.tsx: /api/start fetch body not found')
    t = t.replace(OLD_FETCH_START, NEW_FETCH_START, 1)
    p.write_text(t, encoding='utf-8')
    print('OK page.tsx')
else:
    print('page.tsx: already patched, skip')

# =====================================================================
# 2. src/app/components/RecommendMode.tsx — visitorId 送信
# =====================================================================
p = ROOT / 'src' / 'app' / 'components' / 'RecommendMode.tsx'
t = p.read_text(encoding='utf-8')

OLD_REC_BODY = (
    "              body: JSON.stringify({\n"
    "                recommendSessionId,\n"
    "                sessionStartedAt: new Date(sessionStartedAtRef.current).toISOString(),\n"
    "                detail,\n"
    "                topWorkId: top?.workId ?? null,\n"
    "                topWorkTitle: top?.title ?? null,\n"
    "              }),"
)
NEW_REC_BODY = (
    "              body: JSON.stringify({\n"
    "                recommendSessionId,\n"
    "                sessionStartedAt: new Date(sessionStartedAtRef.current).toISOString(),\n"
    "                detail,\n"
    "                topWorkId: top?.workId ?? null,\n"
    "                topWorkTitle: top?.title ?? null,\n"
    "                visitorId: (() => {\n"
    "                  try { return typeof window !== 'undefined' ? localStorage.getItem('eronator.visitorId') : null; } catch { return null; }\n"
    "                })(),\n"
    "              }),"
)

if 'eronator.visitorId' not in t:
    if OLD_REC_BODY not in t:
        raise SystemExit('RecommendMode.tsx: recommend play-history body not found')
    t = t.replace(OLD_REC_BODY, NEW_REC_BODY, 1)
    p.write_text(t, encoding='utf-8')
    print('OK RecommendMode.tsx')
else:
    print('RecommendMode.tsx: already patched, skip')
