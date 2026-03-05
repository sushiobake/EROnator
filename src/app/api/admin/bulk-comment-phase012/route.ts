/**
 * コメント未取得 → Phase0+1+2 一括実行
 * POST body: { count: number, background?: boolean }
 * 未コメント作品を上からN件取得し、8件＝1ラウンドで処理。
 * パイプライン: 8件コメント取得 → Phase0(8) → Phase1+2(8) を並列で流す
 * バックグラウンド: background=1 で即レスポンス、進捗は bulk-job-status でポーリング
 * チェックポイント: 中断時は未処理分を次回自動で処理（pending の Phase1+2 を先に消化）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import {
  readBulkProgress,
  writeBulkProgress,
  completeBulkProgress,
  updatePhaseProgress,
  appendPhaseRoundTiming,
  shouldBulkCancel,
  clearBulkCancel,
  consumeQueuedJob,
  type BulkProgress,
} from '@/server/bulk/progressStore';

/** 1ラウンド＝8作品 */
const ROUND_SIZE = 8;
const MAX_COUNT = 4000;
const MIN_COUNT = 80;

/** 前の作業から作品が来るまで待つ: 待機間隔（ms） */
const WAIT_INTERVAL_MS = 10_000;
/** 最大待機リトライ数（10分＝60回） */
const MAX_WAIT_RETRIES = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOrigin(request: NextRequest): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
  }
}

async function consumeStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onLine: (obj: unknown) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  try {
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
          // JSON parse error - skip
        }
      }
    }
  } finally {
    try { reader.cancel(); } catch { /* already closed */ }
  }
}

async function runBulk(
  params: {
    jobId: string;
    count: number;
    totalRounds: number;
    origin: string;
    adminToken: string;
    send: (obj: object) => void;
    persistProgress?: (job: 'comment' | 'phase0' | 'phase12', data: Partial<BulkProgress>) => void;
    appendRoundTiming?: (job: 'comment' | 'phase0' | 'phase12', round: number, elapsedSec: number) => void;
  }
): Promise<number> {
  const { jobId, count, totalRounds, origin, adminToken, send, persistProgress, appendRoundTiming } = params;
  let processedCount = 0;

  if (shouldBulkCancel()) {
    clearBulkCancel();
    throw new Error('停止要求により中断しました');
  }

  const pendingCount = await prisma.work.count({
    where: { commentText: { not: null }, manualTaggingFolder: 'pending' },
  });
  if (pendingCount > 0) {
    send({ type: 'progress', job: 'phase12', done: 0, total: pendingCount, detail: `中断分 ${pendingCount}件 を再開` });
    persistProgress?.('phase12', { phase: 'phase12', done: 0, total: pendingCount, detail: `中断分 ${pendingCount}件 を再開` });
    const phase12Res = await fetch(
      `${origin}/api/admin/openai-check-batch?count=${pendingCount}`,
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
    if (shouldBulkCancel()) {
      clearBulkCancel();
      throw new Error('停止要求により中断しました');
    }
    const rows = await prisma.work.findMany({
      where: { commentText: null },
      select: { workId: true },
      orderBy: { createdAt: 'desc' },
      take: ROUND_SIZE,
    });
    const workIds = rows.map((r) => r.workId);
    if (workIds.length === 0) break;

    if (round === 1) {
      send({
        type: 'progress',
        job: 'comment',
        done: 0,
        total: count,
        round,
        roundTotal: totalRounds,
      });
      persistProgress?.('comment', { phase: 'comment', done: 0, total: count, round, roundTotal: totalRounds });
      const commentRoundStart = Date.now();
      const commentRes = await fetch(`${origin}/api/admin/tags/fetch-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({
          workIds,
          overwrite: false,
          bulkJobId: jobId,
          progressContext: { doneOffset: 0, total: count, round: 1, roundTotal: totalRounds },
        }),
      });
      const commentData = await commentRes.json();
      if (!commentRes.ok || !commentData.success) {
        throw new Error(commentData.error ?? `fetch-comments failed: ${commentRes.status}`);
      }
      const fetched = commentData.fetched ?? 0;
      const failed = commentData.failed ?? 0;
      appendRoundTiming?.('comment', round, Math.round((Date.now() - commentRoundStart) / 1000));
      send({
        type: 'progress',
        job: 'comment',
        done: fetched,
        total: count,
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

    if (round > 1) {
      send({ type: 'progress', job: 'comment', done: round * ROUND_SIZE, total: count, round, roundTotal: totalRounds });
      persistProgress?.('comment', { phase: 'comment', done: round * ROUND_SIZE, total: count, round, roundTotal: totalRounds });
    }

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
        `${origin}/api/admin/openai-tag-batch?count=${unitCount}&source=untagged`,
        { method: 'POST', headers: { 'x-eronator-admin-token': adminToken } }
      );
      if (!phase0Res.ok || !phase0Res.body) {
        const err = await phase0Res.json().catch(() => ({ error: phase0Res.statusText }));
        throw new Error(`Phase0 失敗: ${err.error || phase0Res.statusText}`);
      }
      let phase0Count = 0;
      let streamError: string | undefined;
      await consumeStream(phase0Res.body.getReader(), (obj: unknown) => {
        const o = obj as { type?: string; done?: number; total?: number; count?: number; error?: string; workId?: string; tagsAdded?: number; workIds?: string[] };
        if (o.type === 'progress') {
          const doneOverall = (round - 1) * ROUND_SIZE + (o.done ?? 0);
          send({ ...o, job: 'phase0', done: doneOverall, total: count, round, roundTotal: totalRounds });
          persistProgress?.('phase0', { phase: 'phase0', done: doneOverall, total: count, round, roundTotal: totalRounds, currentWorkId: o.workId, detail: o.tagsAdded != null ? `+${o.tagsAdded}tags` : undefined });
        }
        if (o.type === 'chunkError') send({ ...o, job: 'phase0' });
        if (o.type === 'done') phase0Count = o.count ?? 0;
        if (o.type === 'error') streamError = o.error ?? 'Unknown Phase0 error';
      });
      if (streamError) throw new Error(streamError);
      return phase0Count;
    };

    const runPhase12 = async (unitCount: number): Promise<number> => {
      const phase12Res = await fetch(
        `${origin}/api/admin/openai-check-batch?count=${unitCount}`,
        { method: 'POST', headers: { 'x-eronator-admin-token': adminToken } }
      );
      if (!phase12Res.ok || !phase12Res.body) {
        const err = await phase12Res.json().catch(() => ({ error: phase12Res.statusText }));
        throw new Error(`Phase1+2 失敗: ${err.error || phase12Res.statusText}`);
      }
      let streamError: string | undefined;
      let phase12Count = 0;
      await consumeStream(phase12Res.body.getReader(), (obj: unknown) => {
        const o = obj as { type?: string; done?: number; total?: number; count?: number; error?: string; workId?: string; result?: string; workIds?: string[] };
        if (o.type === 'progress') {
          const doneOverall = (round - 1) * ROUND_SIZE + (o.done ?? 0);
          send({ ...o, job: 'phase12', done: doneOverall, total: count, round, roundTotal: totalRounds });
          persistProgress?.('phase12', { phase: 'phase12', done: doneOverall, total: count, round, roundTotal: totalRounds, currentWorkId: o.workId, detail: o.result });
        }
        if (o.type === 'chunkError') send({ ...o, job: 'phase12' });
        if (o.type === 'done') phase12Count = o.count ?? 0;
        if (o.type === 'error') streamError = o.error ?? 'Unknown Phase1+2 error';
      });
      if (streamError) throw new Error(streamError);
      return phase12Count;
    };

    const runPipelineForRound = async (): Promise<{ phase0Cnt: number; phase12Cnt: number }> => {
      let cnt = 0;
      const phase0Start = Date.now();
      for (let retries = 0; retries < MAX_WAIT_RETRIES; retries++) {
        cnt = await runPhase0(ROUND_SIZE);
        if (cnt > 0) break;
        if (shouldBulkCancel()) throw new Error('停止要求により中断しました');
        if (round === totalRounds) {
          return { phase0Cnt: 0, phase12Cnt: 0 };
        }
        send({ type: 'progress', job: 'phase0', done: (round - 1) * ROUND_SIZE, total: count, round, roundTotal: totalRounds, detail: `untagged 待機中… (${retries + 1}/${MAX_WAIT_RETRIES})` });
        persistProgress?.('phase0', { phase: 'phase0', done: (round - 1) * ROUND_SIZE, total: count, round, roundTotal: totalRounds, detail: `untagged 待機中` });
        await sleep(WAIT_INTERVAL_MS);
      }
      if (cnt === 0) {
        const doneCount = (round - 1) * ROUND_SIZE;
        throw new Error(`Phase0: ${MAX_WAIT_RETRIES * (WAIT_INTERVAL_MS / 1000)}秒待機しても作品が来ませんでした（${doneCount}件まで処理済み）`);
      }
      appendRoundTiming?.('phase0', round, Math.round((Date.now() - phase0Start) / 1000));

      send({ type: 'progress', job: 'phase0', done: (round - 1) * ROUND_SIZE + cnt, total: count, round, roundTotal: totalRounds });
      send({ type: 'progress', job: 'phase12', done: (round - 1) * ROUND_SIZE, total: count, round, roundTotal: totalRounds });

      let phase12Count = 0;
      const phase12Start = Date.now();
      for (let retries = 0; retries < MAX_WAIT_RETRIES; retries++) {
        phase12Count = await runPhase12(cnt);
        if (phase12Count > 0) break;
        if (shouldBulkCancel()) throw new Error('停止要求により中断しました');
        send({ type: 'progress', job: 'phase12', done: (round - 1) * ROUND_SIZE, total: count, round, roundTotal: totalRounds, detail: `pending 待機中… (${retries + 1}/${MAX_WAIT_RETRIES})` });
        persistProgress?.('phase12', { phase: 'phase12', done: (round - 1) * ROUND_SIZE, total: count, round, roundTotal: totalRounds, detail: `pending 待機中` });
        await sleep(WAIT_INTERVAL_MS);
      }
      if (phase12Count === 0) {
        const doneCount = (round - 1) * ROUND_SIZE + cnt;
        throw new Error(`Phase12: ${MAX_WAIT_RETRIES * (WAIT_INTERVAL_MS / 1000)}秒待機しても作品が来ませんでした（${doneCount}件まで処理済み）`);
      }
      appendRoundTiming?.('phase12', round, Math.round((Date.now() - phase12Start) / 1000));

      return { phase0Cnt: cnt, phase12Cnt: phase12Count };
    };

    let phase0Count: number;
    let phase12Count: number;
    if (hasNext && nextWorkIds.length > 0) {
      const nextRound = round + 1;
      const commentNextStart = Date.now();
      const fetchNextComments = (async () => {
        try {
          const res = await fetch(`${origin}/api/admin/tags/fetch-comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
            body: JSON.stringify({
              workIds: nextWorkIds,
              overwrite: false,
              bulkJobId: jobId,
              progressContext: { doneOffset: round * ROUND_SIZE, total: count, round: nextRound, roundTotal: totalRounds },
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) return { success: 0, failed: nextWorkIds.length };
          return { success: data.fetched ?? 0, failed: data.failed ?? 0 };
        } catch (e) {
          console.error('[bulk-comment-phase012] 次ラウンドコメント取得エラー:', e);
          return { success: 0, failed: nextWorkIds.length };
        }
      })();
      const [pipelineResult, parallelResult] = await Promise.all([runPipelineForRound(), fetchNextComments]);
      appendRoundTiming?.('comment', nextRound, Math.round((Date.now() - commentNextStart) / 1000));
      phase0Count = pipelineResult.phase0Cnt;
      phase12Count = pipelineResult.phase12Cnt;
      if (parallelResult.success === 0 && parallelResult.failed > 0) {
        console.warn(`[bulk-comment-phase012] ラウンド${nextRound}: 並列コメント取得が全て失敗`);
      }
    } else {
      const pipelineResult = await runPipelineForRound();
      phase0Count = pipelineResult.phase0Cnt;
      phase12Count = pipelineResult.phase12Cnt;
    }

    if (phase0Count === 0 && round === totalRounds) {
      processedCount = (round - 1) * ROUND_SIZE;
      break;
    }

    processedCount = (round - 1) * ROUND_SIZE + phase0Count;
    send({
      type: 'progress',
      job: 'phase12',
      done: (round - 1) * ROUND_SIZE + phase12Count,
      total: count,
      round,
      roundTotal: totalRounds,
      roundDone: round,
    });
    persistProgress?.('phase12', { phase: 'phase12', done: (round - 1) * ROUND_SIZE + phase12Count, total: count, round, roundTotal: totalRounds });
  }
  return processedCount;
}

async function startQueuedJobIfAny(origin: string, adminToken: string): Promise<void> {
  const queued = consumeQueuedJob();
  if (!queued) return;
  console.log(`[bulk-comment-phase012] 予約ジョブ開始: ${queued.count}件`);
  try {
    await fetch(`${origin}/api/admin/bulk-comment-phase012?background=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
      body: JSON.stringify({ count: queued.count }),
    });
  } catch (e) {
    console.error('[bulk-comment-phase012] 予約ジョブ開始失敗:', e);
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminToken = request.headers.get('x-eronator-admin-token') || '';
  const origin = getOrigin(request);
  const background = request.nextUrl.searchParams.get('background') === '1';

  clearBulkCancel();

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

    if (withoutCommentCount === 0) {
      return NextResponse.json(
        { success: false, error: 'コメント未取得の作品がありません。' },
        { status: 400 }
      );
    }
    const effectiveCount = Math.min(count, Math.ceil(withoutCommentCount / ROUND_SIZE) * ROUND_SIZE);
    const effectiveRounds = Math.max(1, Math.ceil(effectiveCount / ROUND_SIZE));

    if (background) {
      const jobId = `bulk-${Date.now()}`;
      const bgProgress: BulkProgress = {
        jobId,
        status: 'running',
        phase: 'comment',
        done: 0,
        total: effectiveCount,
        round: 1,
        roundTotal: effectiveRounds,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writeBulkProgress(bgProgress);

      (async () => {
        const send = (_obj: object) => {};
        const persistProgress = (job: 'comment' | 'phase0' | 'phase12', data: Partial<BulkProgress>) => {
          updatePhaseProgress(jobId, job, {
            done: data.done ?? 0,
            total: data.total ?? 0,
            round: data.round,
            roundTotal: data.roundTotal,
            currentWorkId: data.currentWorkId,
            detail: data.detail,
          });
        };
        const appendRoundTiming = (job: 'comment' | 'phase0' | 'phase12', round: number, elapsedSec: number) => {
          appendPhaseRoundTiming(jobId, job, round, elapsedSec);
        };
        try {
          const processed = await runBulk({
            jobId,
            count: effectiveCount,
            totalRounds: effectiveRounds,
            origin,
            adminToken,
            send,
            persistProgress,
            appendRoundTiming,
          });
          const done = readBulkProgress();
          if (done && done.jobId === jobId) {
            completeBulkProgress({ ...done, status: 'done', done: processed, total: effectiveCount });
          }
          // 予約ジョブがあれば自動開始
          await startQueuedJobIfAny(origin, adminToken);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const current = readBulkProgress();
          if (current && current.jobId === jobId) {
            completeBulkProgress({ ...current, status: 'error', error: msg });
          }
        }
      })();

      return NextResponse.json({
        success: true,
        background: true,
        jobId,
        message: `バックグラウンドで開始しました（${effectiveCount}件）。進捗は右下の進行状況で確認できます。`,
      });
    }

    const jobId = `bulk-${Date.now()}`;
    const streamProgress: BulkProgress = {
      jobId,
      status: 'running',
      phase: 'comment',
      done: 0,
      total: effectiveCount,
      round: 1,
      roundTotal: effectiveRounds,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeBulkProgress(streamProgress);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };
        const persistProgress = (job: 'comment' | 'phase0' | 'phase12', data: Partial<BulkProgress>) => {
          updatePhaseProgress(jobId, job, {
            done: data.done ?? 0,
            total: data.total ?? 0,
            round: data.round,
            roundTotal: data.roundTotal,
            currentWorkId: data.currentWorkId,
            detail: data.detail,
          });
        };
        const appendRoundTiming = (job: 'comment' | 'phase0' | 'phase12', round: number, elapsedSec: number) => {
          appendPhaseRoundTiming(jobId, job, round, elapsedSec);
        };

        try {
          const processed = await runBulk({
            jobId,
            count: effectiveCount,
            totalRounds: effectiveRounds,
            origin,
            adminToken,
            send,
            persistProgress,
            appendRoundTiming,
          });
          const done = readBulkProgress();
          if (done && done.jobId === jobId) {
            completeBulkProgress({ ...done, status: 'done', done: processed, total: effectiveCount });
          }
          send({ type: 'done', success: true, totalProcessed: processed });
          startQueuedJobIfAny(origin, adminToken).catch(() => {});
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const current = readBulkProgress();
          if (current && current.jobId === jobId) {
            completeBulkProgress({ ...current, status: 'error', error: msg });
          }
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
