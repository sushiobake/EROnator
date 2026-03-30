# -*- coding: utf-8 -*-
"""Patch 1: Prisma スキーマ 3 ファイルに visitorId を追加"""
import pathlib, re

ROOT = pathlib.Path(r'c:\tool\eronator_mvp0_ws_v1_5_3')

SCHEMA_FILES = [
    ROOT / 'prisma' / 'schema.prisma',
    ROOT / 'prisma' / 'schema.sqlite.prisma',
    ROOT / 'prisma' / 'schema.postgres.prisma',
]

def patch(path):
    t = path.read_text(encoding='utf-8')

    # --- Session: questionHistory の後に visitorId を追加 ---
    OLD_SESSION = '  questionHistory         String   @default("[]") // JSON array\n  createdAt               DateTime @default(now())'
    NEW_SESSION  = '  questionHistory         String   @default("[]") // JSON array\n  visitorId               String?  // ブラウザ識別用（localStorage由来）\n  createdAt               DateTime @default(now())'
    if OLD_SESSION not in t:
        raise SystemExit(f'Session questionHistory marker not found in {path.name}')
    t = t.replace(OLD_SESSION, NEW_SESSION, 1)

    # Session index 追加
    OLD_S_IDX = '  @@index([sessionId])\n}'
    NEW_S_IDX  = '  @@index([sessionId])\n  @@index([visitorId])\n}'
    # Session の @@index は2か所あるかもしれないので最初の出現のみ
    t = t.replace(OLD_S_IDX, NEW_S_IDX, 1)

    # --- PlayHistory: failListContextJson の後に visitorId を追加 ---
    # 2種類の書き方に対応
    OLD_PH_V1 = '  /// FAIL_LIST 時のみ: 候補スナップショット等（管理画面・分析用 JSON）\n  failListContextJson String?\n  createdAt           DateTime  @default(now())'
    OLD_PH_V2 = '  failListContextJson String?\n  createdAt           DateTime  @default(now())'
    if OLD_PH_V1 in t:
        NEW_PH = '  /// FAIL_LIST 時のみ: 候補スナップショット等（管理画面・分析用 JSON）\n  failListContextJson String?\n  visitorId           String?   // ブラウザ識別用（localStorage由来）\n  createdAt           DateTime  @default(now())'
        t = t.replace(OLD_PH_V1, NEW_PH, 1)
    elif OLD_PH_V2 in t:
        NEW_PH = '  failListContextJson String?\n  visitorId           String?   // ブラウザ識別用（localStorage由来）\n  createdAt           DateTime  @default(now())'
        t = t.replace(OLD_PH_V2, NEW_PH, 1)
    else:
        raise SystemExit(f'PlayHistory failListContextJson marker not found in {path.name}')

    OLD_PH_IDX = '  @@index([sessionId])\n  @@index([outcome])\n  @@index([createdAt])\n}'
    NEW_PH_IDX  = '  @@index([sessionId])\n  @@index([outcome])\n  @@index([createdAt])\n  @@index([visitorId])\n}'
    if OLD_PH_IDX not in t:
        raise SystemExit(f'PlayHistory index block not found in {path.name}')
    t = t.replace(OLD_PH_IDX, NEW_PH_IDX, 1)

    # --- RecommendPlayHistory: topWorkTitle の後に visitorId を追加 ---
    OLD_RH = '  topWorkId          String?\n  topWorkTitle       String?\n  createdAt          DateTime  @default(now())'
    NEW_RH  = '  topWorkId          String?\n  topWorkTitle       String?\n  visitorId          String?   // ブラウザ識別用（localStorage由来）\n  createdAt          DateTime  @default(now())'
    if OLD_RH not in t:
        raise SystemExit(f'RecommendPlayHistory topWorkTitle marker not found in {path.name}')
    t = t.replace(OLD_RH, NEW_RH, 1)

    # RecommendPlayHistory の @@index([createdAt]) を特定してパッチ
    RH_MARKER = '// RecommendPlayHistory:'
    rh_pos = t.find(RH_MARKER)
    if rh_pos < 0:
        raise SystemExit(f'RecommendPlayHistory comment not found in {path.name}')
    search_from = rh_pos
    idx = t.find('  @@index([createdAt])\n}', search_from)
    if idx < 0:
        raise SystemExit(f'Could not find RecommendPlayHistory @@index block in {path.name}')
    t = t[:idx] + '  @@index([createdAt])\n  @@index([visitorId])\n}' + t[idx + len('  @@index([createdAt])\n}'):]

    path.write_text(t, encoding='utf-8')
    print(f'OK {path.name}')

for f in SCHEMA_FILES:
    patch(f)
