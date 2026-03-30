/**
 * FAIL_LIST 時に PlayHistory へ保存するスナップショット JSON を組み立てる。
 * 管理画面での分析用（本番ゲームの挙動は変えない）。
 */

import { normalizeWeights } from '@/server/algo/scoring';
import type { SessionState } from '@/server/session/manager';
import type { MvpConfig } from '@/server/config/schema';
import type { QuestionHistoryEntry } from '@/server/session/manager';
import { prisma } from '@/server/db/client';

export type FailListContextSnapshot = {
  version: 1;
  /** FAIL_LIST 画面に出していた候補（最大 failListN 件・作者重複除外は GET /api/failList と同様の簡易版） */
  topCandidates: Array<{ workId: string; title: string; probability: number }>;
  /** 直近の REVEAL 行（あれば） */
  lastReveal?: {
    revealWorkId?: string;
    displayText?: string;
    answer?: string;
    revealResult?: string;
  };
  /** スナップショット時点のミス数・閾値（参考） */
  revealMissCount: number;
  maxRevealMisses: number;
};

function getRejectedSet(session: SessionState): Set<string> {
  const raw = session.revealRejectedWorkIds;
  const arr = (typeof raw === 'string' ? JSON.parse(raw || '[]') : raw ?? []) as string[];
  return new Set(arr);
}

/**
 * セッションと設定からスナップショットを生成。失敗時は null。
 */
export async function buildFailListContextSnapshot(
  session: SessionState,
  config: MvpConfig
): Promise<FailListContextSnapshot | null> {
  try {
    const weights = Object.entries(session.weights).map(([workId, weight]) => ({ workId, weight }));
    const probabilities = normalizeWeights(weights);
    const sorted = [...probabilities].sort((a, b) => {
      if (a.probability !== b.probability) return b.probability - a.probability;
      return a.workId.localeCompare(b.workId);
    });
    const rejected = getRejectedSet(session);
    const filtered = sorted.filter((p) => !rejected.has(p.workId));
    const failListN = config.flow.failListN as number;
    const slice = filtered.slice(0, Math.max(failListN * 3, 30));
    const workIds = slice.map((p) => p.workId);
    const works =
      workIds.length > 0
        ? await prisma.work.findMany({
            where: { workId: { in: workIds } },
            select: { workId: true, title: true, authorName: true },
          })
        : [];
    const workMap = new Map(works.map((w) => [w.workId, w]));
    const seenAuthors = new Set<string>();
    const topCandidates: Array<{ workId: string; title: string; probability: number }> = [];
    for (const p of slice) {
      if (topCandidates.length >= failListN) break;
      const w = workMap.get(p.workId);
      if (!w || seenAuthors.has(w.authorName)) continue;
      seenAuthors.add(w.authorName);
      topCandidates.push({
        workId: p.workId,
        title: w.title,
        probability: p.probability,
      });
    }

    const hist = session.questionHistory ?? [];
    let lastReveal: FailListContextSnapshot['lastReveal'];
    for (let i = hist.length - 1; i >= 0; i--) {
      const e = hist[i] as QuestionHistoryEntry & {
        kind?: string;
        revealWorkId?: string;
        revealResult?: string;
      };
      if (e?.kind === 'REVEAL') {
        lastReveal = {
          revealWorkId: e.revealWorkId,
          displayText: e.displayText,
          answer: e.answer,
          revealResult: e.revealResult,
        };
        break;
      }
    }

    return {
      version: 1,
      topCandidates,
      lastReveal,
      revealMissCount: session.revealMissCount ?? 0,
      maxRevealMisses: config.flow.maxRevealMisses as number,
    };
  } catch (e) {
    console.error('[buildFailListContextSnapshot]', e);
    return null;
  }
}
