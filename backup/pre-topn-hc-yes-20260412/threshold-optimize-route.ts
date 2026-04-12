/**
 * 閾値最適化シミュレーション API（長時間ジョブは非同期起動・進捗は bulk-job-status）
 */
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import path from 'path';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import type { SweepRequest } from '@/types/thresholdOptimizer';
import { runSweep, runFullOptimizationPipeline, runV3ComprehensivePipeline } from '@/server/simulation/thresholdOptimizer';

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const fullAuto = body.fullAutoPipeline === true;
  const earlyExitV2 = body.earlyExitV2 === true;
  const comprehensiveV3 = body.comprehensiveV3 === true;

  void (async () => {
    try {
      if (comprehensiveV3) {
        const pc =
          body.parallelCount != null && !Number.isNaN(Number(body.parallelCount))
            ? Number(body.parallelCount)
            : undefined;
        await runV3ComprehensivePipeline(
          {
            aiGateChoice: (body.aiGateChoice as string) ?? 'BOTH',
            parallelCount: pc,
          },
          undefined
        );
      } else if (earlyExitV2) {
        const pc =
          body.parallelCount != null && !Number.isNaN(Number(body.parallelCount))
            ? Number(body.parallelCount)
            : 4;
        await runSweep(
          {
            phase: 1,
            sampleSize: Math.max(0, Number(body.sampleSize) || 50),
            ambiguityLevels: Array.isArray(body.ambiguityLevels)
              ? (body.ambiguityLevels as number[])
              : [1, 3, 5],
            aiGateChoice: (body.aiGateChoice as string) ?? 'BOTH',
            trialsPerWork: Math.max(1, Number(body.trialsPerWork) || 3),
            parallelCount: pc,
            useV2ParamSets: true,
          },
          undefined
        );
      } else if (fullAuto) {
        await runFullOptimizationPipeline(
          {
            aiGateChoice: (body.aiGateChoice as string) ?? 'BOTH',
            ambiguityLevels: (body.ambiguityLevels as number[]) ?? [1, 3, 5],
            parallelCount: body.parallelCount as number | undefined,
            phase1SampleSize: (body.phase1SampleSize as number) ?? 100,
            phase2SampleSize: (body.phase2SampleSize as number) ?? 200,
            phase3SampleSize: (body.phase3SampleSize as number) ?? 500,
            trialsPhase1: (body.trialsPhase1 as number) ?? 3,
            trialsPhase2: (body.trialsPhase2 as number) ?? 5,
            phase2TopN: (body.phase2TopN as number) ?? 5,
          },
          undefined
        );
      } else {
        const sweep: SweepRequest = {
          phase: (body.phase === 2 ? 2 : 1) as 1 | 2,
          sampleSize: Math.max(0, Number(body.sampleSize) || 100),
          ambiguityLevels: Array.isArray(body.ambiguityLevels)
            ? (body.ambiguityLevels as number[])
            : [1, 3, 5],
          aiGateChoice: (body.aiGateChoice as string) ?? 'BOTH',
          trialsPerWork: Math.max(1, Number(body.trialsPerWork) || 3),
          parallelCount: body.parallelCount != null ? Number(body.parallelCount) : 4,
          paramSetIds: body.paramSetIds as string[] | undefined,
          expandedSampleSize: body.expandedSampleSize != null ? Number(body.expandedSampleSize) : undefined,
          autoPhase2TopN: body.autoPhase2TopN != null ? Number(body.autoPhase2TopN) : 5,
        };
        await runSweep(sweep, undefined);
      }
    } catch (e) {
      console.error('[threshold-optimize]', e);
    }
  })();

  return NextResponse.json({
    ok: true,
    message: comprehensiveV3
      ? 'V3 comprehensive pipeline started (phase1: 45 PS + baseline -> phase2: top-8 -> phase3: top-3, ~5.5h). Poll GET /api/admin/bulk-job-status for optimizeProgress.'
      : earlyExitV2
        ? 'Early-exit v2 sweep started (50 works, 9 param sets + baseline). Poll GET /api/admin/bulk-job-status for optimizeProgress.'
        : fullAuto
          ? 'Full pipeline started (phase1 100 -> phase2 200 -> phase3 500). Poll GET /api/admin/bulk-job-status for optimizeProgress.'
          : 'Sweep started. Poll GET /api/admin/bulk-job-status for optimizeProgress.',
  });
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sweepId = searchParams.get('sweepId');
  const list = searchParams.get('list');

  const dir = path.join(process.cwd(), 'data', 'threshold-optimize-results');

  if (list === '1') {
    try {
      const names = await fs.readdir(dir);
      const jsons = names.filter((n) => n.endsWith('.json')).sort().reverse();
      return NextResponse.json({ files: jsons.slice(0, 50) });
    } catch {
      return NextResponse.json({ files: [] });
    }
  }

  if (sweepId) {
    const safe = path.basename(sweepId);
    if (safe !== sweepId || !safe.endsWith('.json')) {
      return NextResponse.json({ error: 'Invalid sweepId' }, { status: 400 });
    }
    try {
      const raw = await fs.readFile(path.join(dir, safe), 'utf-8');
      return NextResponse.json(JSON.parse(raw) as unknown);
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: 'Use ?list=1 or ?sweepId=file.json' }, { status: 400 });
}
