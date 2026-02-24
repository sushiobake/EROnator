/**
 * コメント未取得 → Phase0+1+2 一括実行
 * POST body: { count: number } (100～1000、100刻み)
 * 未コメント作品を上からN件取得し、100件ずつラウンドで処理。
 * 各ラウンド: コメント取得 → Phase0 → Phase1+2
 * パイプライン: Phase0実行中に次ラウンドのコメント取得を並行
 * エラー時: それまでのラウンドは確定保存（ロールバックなし）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

const ROUND_SIZE = 100;
const MAX_COUNT = 1000;
const MIN_COUNT = 100;

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

  for (const work of works) {
    if (work.commentText) continue;

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
      onProgress?.(success + failed, workIds.length);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[bulk-comment-phase012] コメント取得失敗 workId=${work.workId}:`, msg);
      onProgress?.(success + failed, workIds.length);
    }
  }

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

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminToken = request.headers.get('x-eronator-admin-token') || '';
  const origin = getOrigin(request);

  try {
    await ensurePrismaConnected();

    const body = await request.json().catch(() => ({}));
    const rawCount = body.count ?? 100;
    const count = Math.min(
      MAX_COUNT,
      Math.max(MIN_COUNT, Math.floor(Number(rawCount) / ROUND_SIZE) * ROUND_SIZE)
    );
    const totalRounds = Math.floor(count / ROUND_SIZE);

    // 事前チェック: コメント未取得が足りるか
    const withoutCommentCount = await prisma.work.count({
      where: { commentText: null },
    });

    if (withoutCommentCount < count) {
      return NextResponse.json(
        {
          success: false,
          error: `コメント未取得の作品が${withoutCommentCount}件しかありません。${count}件指定するには先にDMM APIから作品をインポートしてください。`,
        },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };

        try {
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

            // 初回のみコメント取得。2回目以降は前ラウンドの並列で取得済み
            if (round === 1) {
              send({
                type: 'progress',
                job: 'comment',
                done: 0,
                total: ROUND_SIZE,
                round,
                roundTotal: totalRounds,
              });
              const { success: fetched, failed } = await fetchCommentsForWorkIds(workIds, prisma, (done, total) => {
                send({ type: 'progress', job: 'comment', done, total: ROUND_SIZE, round, roundTotal: totalRounds });
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
            // 次バッチ = コメント未取得の先頭100件（毎ラウンドで1バッチずつ取得済みになるため常にskip 0）
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

            const runPhase0 = async () => {
              const phase0Res = await fetch(
                `${origin}/api/admin/groq-tag-batch?count=${ROUND_SIZE}&source=untagged`,
                { method: 'POST', headers: { 'x-eronator-admin-token': adminToken } }
              );
              if (!phase0Res.ok || !phase0Res.body) {
                const err = await phase0Res.json().catch(() => ({ error: phase0Res.statusText }));
                throw new Error(`Phase0 失敗: ${err.error || phase0Res.statusText}`);
              }
              let phase0Count = 0;
              await consumeStream(phase0Res.body.getReader(), (obj: unknown) => {
                const o = obj as { type?: string; done?: number; total?: number; count?: number; error?: string };
                if (o.type === 'progress') send({ ...o, job: 'phase0', round, roundTotal: totalRounds });
                if (o.type === 'done') phase0Count = o.count ?? 0;
                if (o.type === 'error') throw new Error(o.error);
              });
              return phase0Count;
            };

            let phase0Count: number;
            if (hasNext && nextWorkIds.length > 0) {
              const [cnt, parallelResult] = await Promise.all([
                runPhase0(),
                fetchCommentsForWorkIds(nextWorkIds, prisma),
              ]);
              phase0Count = cnt;
              if (parallelResult.success === 0 && parallelResult.failed > 0) {
                console.warn(`[bulk-comment-phase012] ラウンド${round}: 並列コメント取得が全て失敗(成功0/失敗${parallelResult.failed})。次ラウンドでフォールバック取得します。`);
              }
            } else {
              phase0Count = await runPhase0();
            }

            // 並列取得失敗時: Phase0が0件なら、コメント未取得をフォールバック取得してからPhase0を再実行
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
                  detail: `ラウンド${round}: 並列取得失敗のためフォールバック取得`,
                });
                const fallbackResult = await fetchCommentsForWorkIds(fallbackIds, prisma, (done, total) => {
                  send({ type: 'progress', job: 'comment', done, total: ROUND_SIZE, round, roundTotal: totalRounds });
                });
                console.log(`[bulk-comment-phase012] フォールバック取得 完了: 成功=${fallbackResult.success}, 失敗=${fallbackResult.failed}`);
                if (fallbackResult.success > 0) {
                  phase0Count = await runPhase0();
                }
              }
            }

            if (phase0Count === 0) throw new Error('Phase0 が0件でした（コメント取得済み・未タグの作品がありません）');

            send({
              type: 'progress',
              job: 'phase0',
              done: (round - 1) * ROUND_SIZE + phase0Count,
              total: count,
              round,
              roundTotal: totalRounds,
            });

            send({
              type: 'progress',
              job: 'phase12',
              done: (round - 1) * ROUND_SIZE,
              total: count,
              round,
              roundTotal: totalRounds,
            });

            const phase12Res = await fetch(
              `${origin}/api/admin/groq-check-batch?count=${phase0Count}`,
              { method: 'POST', headers: { 'x-eronator-admin-token': adminToken } }
            );

            if (!phase12Res.ok || !phase12Res.body) {
              const err = await phase12Res.json().catch(() => ({ error: phase12Res.statusText }));
              throw new Error(`Phase1+2 失敗: ${err.error || phase12Res.statusText}`);
            }

            await consumeStream(phase12Res.body.getReader(), (obj: unknown) => {
              const o = obj as { type?: string; done?: number; total?: number; error?: string };
              if (o.type === 'progress') send({ ...o, job: 'phase12', round, roundTotal: totalRounds });
              if (o.type === 'error') throw new Error(o.error);
            });

            send({
              type: 'progress',
              job: 'phase12',
              done: (round - 1) * ROUND_SIZE + ROUND_SIZE,
              total: count,
              round,
              roundTotal: totalRounds,
              roundDone: round,
            });
          }

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
