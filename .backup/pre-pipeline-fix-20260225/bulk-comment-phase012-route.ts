/**
 * コメント未取得 → Phase0+1+2 一括実行
 * POST body: { count: number, background?: boolean }
 * 未コメント作品を上からN件取得し、100件ずつラウンドで処理。
 * パイプライン: Phase0 8件完了 → Phase1+2 8件開始、同時に Phase0 次の8件を継続（8件ずつ）
 * バックグラウンド: background=1 で即レスポンス、進捗は bulk-job-status でポーリング
 * チェックポイント: 中断時は未処理分を次回自動で処理（pending の Phase1+2 を先に消化）
 */

import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import {
  readBulkProgress,
  writeBulkProgress,
  clearBulkProgress,
  type BulkProgress,
} from '@/server/bulk/progressStore';

/** Puppeteer コメント取得の同時実行数 */
const SCRAPE_CONCURRENCY = 4;

const ROUND_SIZE = 100;
const MAX_COUNT = 1000;
const MIN_COUNT = 100;
/** パイプラインのユニットサイズ（Phase0 と Phase1+2 の重なり粒度） */
const PIPELINE_UNIT = 8;

function getOrigin(request: NextRequest): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
  }
}

async function fetchCommentsForWorkIds(
  workIds: string[],
  prismaClient: typeof prisma,
  onProgress?: (done: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const { scrapeWorkComment } = await import('@/server/scraping/fanzaScraper');

  function computePopularityBase(reviewCount: number | null, reviewAverage: number | null): number {
    const rc = reviewCount ?? 0;
    let base = 0;
    if (rc >= 100) base = 50;
    else if (rc >= 10) base = 30;
    else if (rc >= 1) base = 10;
    if (reviewAverage != null && !isNaN(reviewAverage)) base += Math.round(reviewAverage);
    return Math.max(0, Math.min(55, base));
  }

  const works = await prismaClient.work.findMany({
    where: { workId: { in: workIds } },
    select: { workId: true, productUrl: true, commentText: true, manualTaggingFolder: true },
  });

  let success = 0;
  let failed = 0;
  const limit = pLimit(SCRAPE_CONCURRENCY);

  const toProcess = works.filter((w) => !w.commentText);
  await Promise.all(
    toProcess.map((work) =>
      limit(async () => {
        try {
          const data = await scrapeWorkComment(work.productUrl, { headless: true, timeout: 30000 });

          if (data?.commentText) {
            const updateData: Record<string, unknown> = {
              commentText: data.commentText,
              manualTaggingFolder: work.manualTaggingFolder == null || work.manualTaggingFolder === '' ? 'untagged' : undefined,
            };
            if (data.reviewCount != null || data.reviewAverage != null) {
              updateData.reviewCount = data.reviewCount;
              updateData.reviewAverage = data.reviewAverage;
              updateData.popularityBase = computePopularityBase(data.reviewCount, data.reviewAverage);
            }
            if (data.isAi && data.isAi !== 'UNKNOWN') updateData.isAi = data.isAi;

            await prismaClient.work.update({
              where: { workId: work.workId },
              data: updateData,
            });
            success++;
          } else {
            failed++;
          }
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[bulk-comment-phase012] コメント取得失敗 workId=${work.workId}:`, msg);
        }
        onProgress?.(success + failed, workIds.length);
      })
    )
  );

  return { success, failed };
}

async function consumeStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onLine: (obj: unknown) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as unknown;
        onLine(obj);
      } catch {
        // skip
      }
    }
  }
}

async function runBulk(
  params: {
    count: number;
    totalRounds: number;
    origin: string;
    adminToken: string;
    send: (obj: object) => void;
    persistProgress?: (job: 'comment' | 'phase0' | 'phase12', data: Partial<BulkProgress>) => void;
  }
): Promise<void> {
  const { count, totalRounds, origin, adminToken, send, persistProgress } = params;

  const pendingCount = await prisma.work.count({
    where: { commentText: { not: null }, manualTaggingFolder: 'pending' },
  });
  if (pendingCount > 0) {
    send({ type: 'progress', job: 'phase12', done: 0, total: pendingCount, detail: `中断分 ${pendingCount}件 を再開` });
    persistProgress?.('phase12', { phase: 'phase12', done: 0, total: pendingCount, detail: `中断分 ${pendingCount}件 を再開` });
    const phase12Res = await fetch(
      `${origin}/api/admin/groq-check-batch?count=${pendingCount}`,
      { method: 'POST', headers: { 'x-eronator-admin-token': adminToken } }
    );
    if (phase12Res.ok && phase12Res.body) {
      await consumeStream(phase12Res.body.getReader(), (obj: unknown) => {
        const o = obj as { type?: string; done?: number; total?: number; workId?: string; result?: string };
        if (o.type === 'progress') {
          const detailStr = o.workId && o.result ? o.workId + ': ' + o.result : (o.workId || o.result || '');
          send({ ...o, job: 'phase12', detail: detailStr });
          persistProgress?.('phase12', { phase: 'phase12', done: o.done ?? 0, total: o.total ?? pendingCount, currentWorkId: o.workId, detail: o.result });
        }
      });
    }
  }

  for (let round = 1; round <= totalRounds; round++) {
    const skip = (round - 1) * ROUND_SIZE;
    const rows = await prisma.work.findMany({
      where: { commentText: null },
      select: { workId: true },
      orderBy: { createdAt: 'desc' },
      take: ROUND_SIZE,
      skip,
    });
    const workIds = rows.map((r) => r.workId);
    if (workIds.length === 0) break;

    if (round === 1) {
      send({
        type: 'progress',
        job: 'comment',
        done: 0,
        total: ROUND_SIZE,
        round,
        roundTotal: totalRounds,
      });
      persistProgress?.('comment', { phase: 'comment', done: 0, total: ROUND_SIZE, round, roundTotal: totalRounds });
      const { success: fetched, failed } = await fetchCommentsForWorkIds(workIds, prisma, (done, total) => {
        send({ type: 'progress', job: 'comment', done, total: ROUND_SIZE, round, roundTotal: totalRounds });
        persistProgress?.('comment', { phase: 'comment', done, total: ROUND_SIZE, round, roundTotal: totalRounds });
      });
      send({
        type: 'progress',
        job: 'comment',
        done: fetched,
        total: ROUND_SIZE,
        round,
        roundTotal: totalRounds,
        detail: `ラウンド${round}: ${fetched}件取得`,
      });
      if (fetched === 0 && failed > 0) {
        send({ type: 'error', error: `ラウンド${round}: コメント取得が全て失敗しました` });
        break;
      }
    }

    send({
      type: 'progress',
      job: 'phase0',
      done: (round - 1) * ROUND_SIZE,
      total: count,
      round,
      roundTotal: totalRounds,
    });

    const hasNext = round < totalRounds;
    const nextRows = hasNext
      ? await prisma.work.findMany({
          where: { commentText: null },
          select: { workId: true },
          orderBy: { createdAt: 'desc' },
          take: ROUND_SIZE,
          skip: 0,
        })
      : [];
    const nextWorkIds = nextRows.map((r) => r.workId);

    const runPhase0 = async (unitCount: number): Promise<number> => {
      const phase0Res = await fetch(
        `${origin}/api/admin/groq-tag-batch?count=${unitCount}&source=untagged`,
        { method: 'POST', headers: { 'x-eronator-admin-token': adminToken } }
      );
      if (!phase0Res.ok || !phase0Res.body) {
        const err = await phase0Res.json().catch(() => ({ error: phase0Res.statusText }));
        throw new Error(`Phase0 失敗: ${err.error || phase0Res.statusText}`);
      }
      let phase0Count = 0;
      await consumeStream(phase0Res.body.getReader(), (obj: unknown) => {
        const o = obj as { type?: string; done?: number; total?: number; count?: number; error?: string; workId?: string; tagsAdded?: number };
        if (o.type === 'progress') {
          send({ ...o, job: 'phase0', round, roundTotal: totalRounds });
          persistProgress?.('phase0', { phase: 'phase0', done: o.done ?? 0, total: o.total ?? unitCount, round, roundTotal: totalRounds, currentWorkId: o.workId, detail: o.tagsAdded != null ? `+${o.tagsAdded}tags` : undefined });
        }
        if (o.type === 'done') phase0Count = o.count ?? 0;
        if (o.type === 'error') throw new Error(o.error);
      });
      return phase0Count;
    };

    const runPhase12 = async (unitCount: number): Promise<void> => {
      const phase12Res = await fetch(
        `${origin}/api/admin/groq-check-batch?count=${unitCount}`,
        { method: 'POST', headers: { 'x-eronator-admin-token': adminToken } }
      );
      if (!phase12Res.ok || !phase12Res.body) {
        const err = await phase12Res.json().catch(() => ({ error: phase12Res.statusText }));
        throw new Error(`Phase1+2 失敗: ${err.error || phase12Res.statusText}`);
      }
      await consumeStream(phase12Res.body.getReader(), (obj: unknown) => {
        const o = obj as { type?: string; done?: number; total?: number; error?: string; workId?: string; result?: string };
        if (o.type === 'progress') {
          send({ ...o, job: 'phase12', round, roundTotal: totalRounds });
          persistProgress?.('phase12', { phase: 'phase12', done: o.done ?? 0, total: o.total ?? unitCount, round, roundTotal: totalRounds, currentWorkId: o.workId, detail: o.result });
        }
        if (o.type === 'error') throw new Error(o.error);
      });
    };

    const runPipelineForRound = async (): Promise<number> => {
      const chunkCount = Math.ceil(ROUND_SIZE / PIPELINE_UNIT);
      const unit = PIPELINE_UNIT;
      if (chunkCount <= 1) {
        const cnt = await runPhase0(ROUND_SIZE);
        send({ type: 'progress', job: 'phase0', done: (round - 1) * ROUND_SIZE + cnt, total: count, round, roundTotal: totalRounds });
        send({ type: 'progress', job: 'phase12', done: (round - 1) * ROUND_SIZE, total: count, round, roundTotal: totalRounds });
        await runPhase12(cnt);
        return cnt;
      }
      let phase0Acc = await runPhase0(unit);
      send({ type: 'progress', job: 'phase0', done: (round - 1) * ROUND_SIZE + phase0Acc, total: count, round, roundTotal: totalRounds });
      persistProgress?.('phase0', { phase: 'phase0', done: (round - 1) * ROUND_SIZE + phase0Acc, total: count, round, roundTotal: totalRounds });
      for (let i = 2; i <= chunkCount; i++) {
        send({ type: 'progress', job: 'phase12', done: (round - 1) * ROUND_SIZE + (i - 2) * unit, total: count, round, roundTotal: totalRounds });
        const [add] = await Promise.all([runPhase0(unit), runPhase12(unit)]);
        phase0Acc += add;
        send({ type: 'progress', job: 'phase0', done: (round - 1) * ROUND_SIZE + phase0Acc, total: count, round, roundTotal: totalRounds });
        send({ type: 'progress', job: 'phase12', done: (round - 1) * ROUND_SIZE + (i - 1) * unit, total: count, round, roundTotal: totalRounds });
        persistProgress?.('phase12', { phase: 'phase12', done: (round - 1) * ROUND_SIZE + (i - 1) * unit, total: count, round, roundTotal: totalRounds });
      }
      const lastUnit = ROUND_SIZE - (chunkCount - 1) * unit;
      await runPhase12(lastUnit);
      return phase0Acc;
    };

    let phase0Count: number;
    if (hasNext && nextWorkIds.length > 0) {
      const [cnt, parallelResult] = await Promise.all([
        runPipelineForRound(),
        fetchCommentsForWorkIds(nextWorkIds, prisma),
      ]);
      phase0Count = cnt;
      if (parallelResult.success === 0 && parallelResult.failed > 0) {
        console.warn(`[bulk-comment-phase012] ラウンド${round}: 並列コメント取得が全て失敗`);
      }
    } else {
      phase0Count = await runPipelineForRound();
    }

    if (phase0Count === 0 && round < totalRounds) {
      const fallbackRows = await prisma.work.findMany({
        where: { commentText: null },
        select: { workId: true },
        orderBy: { createdAt: 'desc' },
        take: ROUND_SIZE,
        skip: 0,
      });
      const fallbackIds = fallbackRows.map((r) => r.workId);
      if (fallbackIds.length > 0) {
        send({
          type: 'progress',
          job: 'comment',
          done: 0,
          total: ROUND_SIZE,
          round,
          roundTotal: totalRounds,
          detail: `ラウンド${round}: フォールバック取得`,
        });
        const fallbackResult = await fetchCommentsForWorkIds(fallbackIds, prisma, (done, total) => {
          send({ type: 'progress', job: 'comment', done, total: ROUND_SIZE, round, roundTotal: totalRounds });
        });
        if (fallbackResult.success > 0) {
          phase0Count = await runPipelineForRound();
        }
      }
    }

    if (phase0Count === 0) throw new Error('Phase0 が0件でした');

    send({
      type: 'progress',
      job: 'phase12',
      done: (round - 1) * ROUND_SIZE + ROUND_SIZE,
      total: count,
      round,
      roundTotal: totalRounds,
      roundDone: round,
    });
    persistProgress?.('phase12', { phase: 'phase12', done: (round - 1) * ROUND_SIZE + ROUND_SIZE, total: count, round, roundTotal: totalRounds });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminToken = request.headers.get('x-eronator-admin-token') || '';
  const origin = getOrigin(request);
  const background = request.nextUrl.searchParams.get('background') === '1';

  try {
    await ensurePrismaConnected();

    const body = await request.json().catch(() => ({}));
    const rawCount = body.count ?? 100;
    const count = Math.min(
      MAX_COUNT,
      Math.max(MIN_COUNT, Math.floor(Number(rawCount) / ROUND_SIZE) * ROUND_SIZE)
    );
    const totalRounds = Math.floor(count / ROUND_SIZE);

    const withoutCommentCount = await prisma.work.count({
      where: { commentText: null },
    });

    if (withoutCommentCount < count) {
      return NextResponse.json(
        {
          success: false,
          error: `コメント未取得の作品が${withoutCommentCount}件しかありません。`,
        },
        { status: 400 }
      );
    }

    if (background) {
      const jobId = `bulk-${Date.now()}`;
      const progress: BulkProgress = {
        jobId,
        status: 'running',
        phase: 'comment',
        done: 0,
        total: count,
        round: 1,
        roundTotal: totalRounds,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writeBulkProgress(progress);

      setImmediate(async () => {
        const encoder = new TextEncoder();
        const send = (_obj: object) => {};
        const persistProgress = (job: 'comment' | 'phase0' | 'phase12', data: Partial<BulkProgress>) => {
          const current = readBulkProgress();
          if (current && current.jobId === jobId) {
            writeBulkProgress({ ...current, ...data, phase: job });
          }
        };
        try {
          await runBulk({
            count,
            totalRounds,
            origin,
            adminToken,
            send,
            persistProgress,
          });
          const done = readBulkProgress();
          if (done && done.jobId === jobId) {
            writeBulkProgress({ ...done, status: 'done', done: count, total: count });
            setTimeout(() => clearBulkProgress(), 5000);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const current = readBulkProgress();
          if (current && current.jobId === jobId) {
            writeBulkProgress({ ...current, status: 'error', error: msg });
          }
        }
      });

      return NextResponse.json({
        success: true,
        background: true,
        jobId,
        message: 'バックグラウンドで開始しました。進捗は右下の進行状況で確認できます。',
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };

        try {
          await runBulk({
            count,
            totalRounds,
            origin,
            adminToken,
            send,
          });
          send({ type: 'done', success: true, totalProcessed: count });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          send({ type: 'error', error: msg });
          send({ type: 'done', success: false, error: msg });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[bulk-comment-phase012]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
