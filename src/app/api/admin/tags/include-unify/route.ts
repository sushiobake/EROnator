/**
 * /api/admin/tags/include-unify
 * 選択タグを「メインタグ中心」に統合・包括として保存する。
 *
 * ルール:
 * - main と同ランク: unify グループへ
 * - main と異ランク: include[main] へ
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';

type UnifiedRank = 'S' | 'A' | 'B' | 'C' | 'X' | 'N' | '';

type IncludeUnifyConfig = {
  description?: string;
  updatedAt?: string;
  note?: string;
  include?: Record<string, string[]>;
  unify?: string[][];
};

type SaveRequest = {
  mainDisplayName?: string;
  selectedDisplayNames?: string[];
  rankByDisplayName?: Record<string, UnifiedRank>;
};

function normalizeDisplayName(v: unknown): string {
  return String(v ?? '').trim();
}

function uniqNonEmpty(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = normalizeDisplayName(raw);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function isSameRank(a: UnifiedRank, b: UnifiedRank): boolean {
  return a === b && a !== '';
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as SaveRequest;
    const mainDisplayName = normalizeDisplayName(body.mainDisplayName);
    const selectedDisplayNames = uniqNonEmpty(body.selectedDisplayNames ?? []);
    const rankByDisplayName = body.rankByDisplayName ?? {};

    if (!mainDisplayName) {
      return NextResponse.json({ success: false, error: 'mainDisplayName is required' }, { status: 400 });
    }
    if (selectedDisplayNames.length < 2) {
      return NextResponse.json({ success: false, error: '2つ以上のタグ選択が必要です' }, { status: 400 });
    }
    if (!selectedDisplayNames.includes(mainDisplayName)) {
      return NextResponse.json({ success: false, error: 'mainDisplayName must be included in selectedDisplayNames' }, { status: 400 });
    }

    const configPath = path.join(process.cwd(), 'config', 'tagIncludeUnify.json');
    let config: IncludeUnifyConfig = {};
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(raw) as IncludeUnifyConfig;
    } catch {
      config = {};
    }

    const include = { ...(config.include ?? {}) };
    const unify = [...(config.unify ?? [])];

    // 1) 選択タグを既存 include / unify から切り離す
    const selectedSet = new Set(selectedDisplayNames);
    const carriedSubs = new Set<string>();
    const carriedMainUnifyMembers = new Set<string>();

    for (const key of Object.keys(include)) {
      if (selectedSet.has(key) && key !== mainDisplayName) {
        for (const sub of include[key] ?? []) {
          const dn = normalizeDisplayName(sub);
          if (dn && dn !== mainDisplayName) carriedSubs.add(dn);
        }
      }
    }
    for (const sub of include[mainDisplayName] ?? []) {
      const dn = normalizeDisplayName(sub);
      if (dn && dn !== mainDisplayName) carriedSubs.add(dn);
    }

    for (const group of unify) {
      const normalized = uniqNonEmpty(group);
      if (!normalized.includes(mainDisplayName)) continue;
      for (const dn of normalized) {
        if (dn && dn !== mainDisplayName) carriedMainUnifyMembers.add(dn);
      }
    }

    for (const key of Object.keys(include)) {
      if (selectedSet.has(key) && key !== mainDisplayName) {
        delete include[key];
        continue;
      }
      const current = include[key] ?? [];
      include[key] = current.filter((sub) => {
        const dn = normalizeDisplayName(sub);
        return !selectedSet.has(dn) || dn === mainDisplayName;
      });
      if (include[key].length === 0) delete include[key];
    }

    const cleanedUnify = unify
      .map((group) => uniqNonEmpty(group))
      .map((group) => group.filter((dn) => !selectedSet.has(dn)))
      .filter((group) => group.length >= 2);

    // 2) main とのランク差で unify/include を自動分類
    const mainRank = rankByDisplayName[mainDisplayName] ?? '';
    const others = selectedDisplayNames.filter((dn) => dn !== mainDisplayName);
    const sameRankMembers: string[] = [];
    const includeMembers: string[] = [];

    for (const dn of others) {
      const rank = rankByDisplayName[dn] ?? '';
      if (isSameRank(mainRank, rank)) sameRankMembers.push(dn);
      else includeMembers.push(dn);
    }

    // 3) unify を反映（main + 同ランク）
    const nextUnifyMembers = uniqNonEmpty([
      ...sameRankMembers,
      ...Array.from(carriedMainUnifyMembers),
    ]).filter((dn) => dn !== mainDisplayName);
    if (nextUnifyMembers.length > 0) {
      cleanedUnify.push([mainDisplayName, ...nextUnifyMembers]);
    }

    // 4) include を反映（main + 異ランク + 元代表配下を維持）
    const nextIncludeSubs = new Set<string>(include[mainDisplayName] ?? []);
    for (const dn of includeMembers) nextIncludeSubs.add(dn);
    for (const dn of carriedSubs) nextIncludeSubs.add(dn);
    for (const dn of nextUnifyMembers) nextIncludeSubs.delete(dn);
    nextIncludeSubs.delete(mainDisplayName);

    const includeList = [...nextIncludeSubs].map(normalizeDisplayName).filter(Boolean);
    if (includeList.length > 0) include[mainDisplayName] = includeList;
    else delete include[mainDisplayName];

    const nextConfig: IncludeUnifyConfig = {
      ...config,
      updatedAt: new Date().toISOString().slice(0, 10),
      include,
      unify: cleanedUnify,
    };

    await fs.writeFile(configPath, JSON.stringify(nextConfig, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: '統合・包括設定を更新しました',
      mainDisplayName,
      summary: {
        selectedCount: selectedDisplayNames.length,
        unifyAdded: sameRankMembers.length,
        includeAdded: includeMembers.length,
      },
    });
  } catch (error) {
    console.error('[include-unify] save failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
