# -*- coding: utf-8 -*-
"""schema.postgres.prisma に visitorId を追加"""
import pathlib

ROOT = pathlib.Path(r'c:\tool\eronator_mvp0_ws_v1_5_3')
p = ROOT / 'prisma' / 'schema.postgres.prisma'
t = p.read_text(encoding='utf-8')

if 'visitorId' in t:
    print('schema.postgres.prisma: already patched, skip')
else:
    # Session
    OLD_S = '  questionHistory         String   @default("[]") // JSON array\n  createdAt               DateTime @default(now())'
    NEW_S = '  questionHistory         String   @default("[]") // JSON array\n  visitorId               String?  // ブラウザ識別用（localStorage由来）\n  createdAt               DateTime @default(now())'
    if OLD_S not in t:
        raise SystemExit('Session questionHistory not found')
    t = t.replace(OLD_S, NEW_S, 1)
    # Session index
    t = t.replace('  @@index([sessionId])\n}', '  @@index([sessionId])\n  @@index([visitorId])\n}', 1)

    # PlayHistory - postgres version has no /// comment
    OLD_PH = '  failListContextJson String?\n  createdAt           DateTime  @default(now())'
    NEW_PH = '  failListContextJson String?\n  visitorId           String?   // ブラウザ識別用（localStorage由来）\n  createdAt           DateTime  @default(now())'
    if OLD_PH not in t:
        raise SystemExit('PlayHistory failListContextJson not found')
    t = t.replace(OLD_PH, NEW_PH, 1)
    # PlayHistory indexes
    OLD_PH_IDX = '  @@index([sessionId])\n  @@index([outcome])\n  @@index([createdAt])\n}'
    NEW_PH_IDX  = '  @@index([sessionId])\n  @@index([outcome])\n  @@index([createdAt])\n  @@index([visitorId])\n}'
    if OLD_PH_IDX not in t:
        raise SystemExit('PlayHistory index block not found')
    t = t.replace(OLD_PH_IDX, NEW_PH_IDX, 1)

    # RecommendPlayHistory
    OLD_RH = '  topWorkId          String?\n  topWorkTitle       String?\n  createdAt          DateTime  @default(now())'
    NEW_RH = '  topWorkId          String?\n  topWorkTitle       String?\n  visitorId          String?   // ブラウザ識別用（localStorage由来）\n  createdAt          DateTime  @default(now())'
    if OLD_RH not in t:
        raise SystemExit('RecommendPlayHistory topWorkTitle not found')
    t = t.replace(OLD_RH, NEW_RH, 1)
    # RecommendPlayHistory index
    rh_pos = t.find('// RecommendPlayHistory:')
    idx = t.find('  @@index([createdAt])\n}', rh_pos)
    if idx < 0:
        raise SystemExit('RecommendPlayHistory @@index([createdAt]) not found')
    t = t[:idx] + '  @@index([createdAt])\n  @@index([visitorId])\n}' + t[idx + len('  @@index([createdAt])\n}'):]

    p.write_text(t, encoding='utf-8')
    print('OK schema.postgres.prisma')
