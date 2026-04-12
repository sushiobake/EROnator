/**
 * 閾値最適化スイープのオーケストレーション
 */
import * as fs from 'fs/promises';
import path from 'path';
import { getMvpConfig } from '@/server/config/loader';
import { runSimulationInWorker, defaultParallelCount } from '@/server/simulation/simulationWorkerRunner';
import type { WorkerResultItem } from '@/server/simulation/simulationWorkerRunner';
import { buildSharedBatchContextForSimulation } from '@/server/simulation/sharedContextBuilder';
import { applyParamSetToConfig } from '@/server/simulation/applyParamSetConfig';
import {
  generateEarlyExitV2ParamSets,
  generatePhase1ParamSets,
  generateV3ComprehensiveParamSets,
  getBaselineParamSet,
  getParamSetsByIds,
} from '@/server/simulation/paramSetGenerator';
import {
  buildParamSetLevelResult,
  buildScoreCard,
  rankScoreCards,
  type TaggedSimResult,
} from '@/server/simulation/scoreCalculator';
import type { SimulationResult, SimulationStep } from '@/server/simulation/simulationRunner';
import type {
  ParamSet,
  PipelineResult,
  ScoreCard,
  SweepProgress,
  SweepRequest,
  SweepResult,
} from '@/types/thresholdOptimizer';
import { setOptimizeProgress } from '@/server/bulk/progressStore';

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sampleWorkIds(allIds: string[], sampleSize: number): string[] {
  const copy = [...allIds];
  if (sampleSize <= 0 || sampleSize >= copy.length) {
    shuffleInPlace(copy);
    return copy;
  }
  shuffleInPlace(copy);
  return copy.slice(0, sampleSize);
}

function workerItemToTaggedSim(w: WorkerResultItem, amb: number): TaggedSimResult {
  const base: SimulationResult = {
    success: w.success,
    targetWorkId: w.workId,
    targetWorkTitle: w.title,
    finalWorkId: null,
    finalWorkTitle: null,
    questionCount: w.questionCount,
    steps: (w.steps ?? []) as SimulationStep[],
    outcome: w.outcome as SimulationResult['outcome'],
    diagnostic: w.diagnostic as SimulationResult['diagnostic'],
    analysisData: w.analysisData as SimulationResult['analysisData'],
    workDetails: w.workDetails as SimulationResult['workDetails'],
    errorMessage: w.errorMessage,
  };
  return {
    ...base,
    ambiguityLevel: amb,
    trialIndex: w.trial ?? 0,
  };
}

function updateBaselineStats(
  stats: Map<string, { successCount: number; totalTrials: number }>,
  results: TaggedSimResult[],
  ambiguityLevel: number
): void {
  for (const r of results) {
    const key = `${r.targetWorkId}_${ambiguityLevel}`;
    const cur = stats.get(key) ?? { successCount: 0, totalTrials: 0 };
    cur.totalTrials++;
    if (r.success) cur.successCount++;
    stats.set(key, cur);
  }
}

export async function runSweep(
  request: SweepRequest,
  onProgress?: (p: SweepProgress) => void,
  sweepOpts?: { progressPipelineStep?: 'phase1' | 'phase2' | 'phase3' }
): Promise<SweepResult> {
  const sweepId = `sweep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const progressStep = sweepOpts?.progressPipelineStep ?? 'phase1';

  try {
  const baseConfig = getMvpConfig();
  const {
    sharedContext,
    workTagMatrixData,
    tagCacheData,
    simWorkDataEntries,
  } = await buildSharedBatchContextForSimulation();

  const allWorkIds = sharedContext.allWorks.map((w) => w.workId);
  const nSample =
    request.expandedSampleSize != null && request.phase === 2
      ? request.expandedSampleSize
      : request.sampleSize;
  const workIds = sampleWorkIds(allWorkIds, nSample);

  const tasks: Array<{ targetWorkId: string; trial: number }> = [];
  for (const wid of workIds) {
    for (let trial = 0; trial < request.trialsPerWork; trial++) {
      tasks.push({ targetWorkId: wid, trial });
    }
  }

  let paramSets: ParamSet[];
  if (request.useV3ParamSets) {
    const allV3 = generateV3ComprehensiveParamSets();
    if (request.phase === 2 && request.paramSetIds && request.paramSetIds.length > 0) {
      paramSets = getParamSetsByIds(allV3, request.paramSetIds);
    } else {
      paramSets = allV3;
    }
  } else if (request.useV2ParamSets) {
    paramSets = generateEarlyExitV2ParamSets();
  } else if (request.phase === 2 && request.paramSetIds && request.paramSetIds.length > 0) {
    paramSets = getParamSetsByIds(generatePhase1ParamSets(), request.paramSetIds);
  } else {
    paramSets = generatePhase1ParamSets();
  }

  const baselineParamSet = getBaselineParamSet();
  const parallel = defaultParallelCount(request.parallelCount);

  const ambiguityLevels = request.ambiguityLevels.map((a) => Math.max(1, Math.min(10, Math.round(a))));

  const simsPerConfig = tasks.length * ambiguityLevels.length;
  const totalParamSets = 1 + paramSets.length;
  const simulationsTotal = totalParamSets * simsPerConfig;

  let simulationsDone = 0;
  let paramSetsDone = 0;

  const report = (currentParamSetId: string | null, step: 'phase1' | 'phase2' | 'phase3' = 'phase1') => {
    const elapsed = (Date.now() - t0) / 1000;
    const rate = simulationsDone / Math.max(elapsed, 1);
    const remain = simulationsTotal - simulationsDone;
    const eta = rate > 0 ? remain / rate : null;
    const prog: SweepProgress = {
      sweepId,
      phase: request.phase,
      status: 'running',
      paramSetsDone,
      paramSetsTotal: totalParamSets,
      simulationsDone,
      simulationsTotal,
      currentParamSetId,
      elapsedSeconds: elapsed,
      estimatedRemainingSeconds: eta,
    };
    setOptimizeProgress({
      sweepId,
      phase: request.phase,
      status: 'running',
      pipelineStep: step,
      paramSetsDone,
      paramSetsTotal: totalParamSets,
      simulationsDone,
      simulationsTotal,
      currentParamSetId,
      startedAt,
      elapsedSeconds: elapsed,
      estimatedRemainingSeconds: eta,
    });
    onProgress?.(prog);
  };

  report(null, progressStep);

  const baselineStats = new Map<string, { successCount: number; totalTrials: number }>();
  const baselineResultsByAmb = new Map<number, TaggedSimResult[]>();

  for (const amb of ambiguityLevels) {
    const cfg = applyParamSetToConfig(baseConfig, baselineParamSet);
    const { results } = await runSimulationInWorker({
      tasks,
      level: amb,
      aiGateChoice: request.aiGateChoice,
      includePerf: false,
      parallel,
      sharedContext,
      workTagMatrixData,
      tagCacheData,
      simWorkDataEntries,
      configOverride: cfg,
      onProgress: () => {
        simulationsDone++;
        report(baselineParamSet.id, progressStep);
      },
    });
    const tagged = results.map((r) => workerItemToTaggedSim(r, amb));
    baselineResultsByAmb.set(amb, tagged);
    updateBaselineStats(baselineStats, tagged, amb);
  }
  paramSetsDone++;

  const scoreCards: ScoreCard[] = [];

  for (const ps of paramSets) {
    report(ps.id, progressStep);
    const levelResults = [];
    for (const amb of ambiguityLevels) {
      const cfg = applyParamSetToConfig(baseConfig, ps);
      const { results } = await runSimulationInWorker({
        tasks,
        level: amb,
        aiGateChoice: request.aiGateChoice,
        includePerf: false,
        parallel,
        sharedContext,
        workTagMatrixData,
        tagCacheData,
        simWorkDataEntries,
        configOverride: cfg,
        onProgress: () => {
          simulationsDone++;
          report(ps.id, progressStep);
        },
      });
      const tagged = results.map((r) => workerItemToTaggedSim(r, amb));
      levelResults.push(
        buildParamSetLevelResult({
          paramSetId: ps.id,
          ambiguityLevel: amb,
          results: tagged,
          baselineStats,
        })
      );
    }
    scoreCards.push(buildScoreCard({ paramSet: ps, levelResults }));
    paramSetsDone++;
  }

  const baselineLevelResults = ambiguityLevels.map((amb) =>
    buildParamSetLevelResult({
      paramSetId: baselineParamSet.id,
      ambiguityLevel: amb,
      results: baselineResultsByAmb.get(amb) ?? [],
      baselineStats: new Map(),
    })
  );
  const baselineScoreCard = buildScoreCard({
    paramSet: baselineParamSet,
    levelResults: baselineLevelResults,
  });

  const ranked = rankScoreCards(scoreCards);
  const recommendedForPhase2 =
    request.phase === 1 ? ranked.slice(0, request.autoPhase2TopN ?? 5).map((c) => c.paramSetId) : undefined;

  const completedAt = new Date().toISOString();
  const durationSeconds = Math.round((Date.now() - t0) / 1000);

  const sweepResult: SweepResult = {
    sweepId,
    phase: request.phase,
    startedAt,
    completedAt,
    durationSeconds,
    sampleSize: workIds.length,
    ambiguityLevels,
    trialsPerWork: request.trialsPerWork,
    totalSimulations: simulationsDone,
    paramSetCount: paramSets.length,
    scoreCards: ranked,
    baselineScoreCard,
    recommendedForPhase2,
  };

  const outDir = path.join(process.cwd(), 'data', 'threshold-optimize-results');
  await fs.mkdir(outDir, { recursive: true });
  const resultPath = path.join(outDir, `${sweepId}.json`);
  await fs.writeFile(resultPath, JSON.stringify(sweepResult, null, 2), 'utf-8');

  setOptimizeProgress({
    sweepId,
    phase: request.phase,
    status: 'completed',
    pipelineStep: 'done',
    paramSetsDone: totalParamSets,
    paramSetsTotal: totalParamSets,
    simulationsDone,
    simulationsTotal,
    currentParamSetId: null,
    startedAt,
    elapsedSeconds: durationSeconds,
    estimatedRemainingSeconds: 0,
    resultPath: `data/threshold-optimize-results/${path.basename(resultPath)}`,
  });

  onProgress?.({
    sweepId,
    phase: request.phase,
    status: 'completed',
    paramSetsDone: totalParamSets,
    paramSetsTotal: totalParamSets,
    simulationsDone,
    simulationsTotal,
    currentParamSetId: null,
    elapsedSeconds: durationSeconds,
    estimatedRemainingSeconds: 0,
    resultPath: `data/threshold-optimize-results/${path.basename(resultPath)}`,
  });

  return sweepResult;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setOptimizeProgress({
      sweepId,
      phase: request.phase,
      status: 'error',
      paramSetsDone: 0,
      paramSetsTotal: 0,
      simulationsDone: 0,
      simulationsTotal: 0,
      currentParamSetId: null,
      startedAt,
      errorMessage: msg,
    });
    throw e;
  }
}

export async function runFullOptimizationPipeline(
  opts: {
    aiGateChoice?: string;
    ambiguityLevels?: number[];
    parallelCount?: number;
    phase1SampleSize?: number;
    phase2SampleSize?: number;
    phase3SampleSize?: number;
    trialsPhase1?: number;
    trialsPhase2?: number;
    phase2TopN?: number;
  },
  onProgress?: (p: SweepProgress) => void
): Promise<PipelineResult> {
  const pipelineId = `pipeline-${Date.now()}`;
  const t0 = Date.now();
  const aiGate = opts.aiGateChoice ?? 'BOTH';
  const amb = opts.ambiguityLevels ?? [1, 3, 5];
  const pc = opts.parallelCount;

  const p1 = await runSweep(
    {
      phase: 1,
      sampleSize: opts.phase1SampleSize ?? 100,
      ambiguityLevels: amb,
      aiGateChoice: aiGate,
      trialsPerWork: opts.trialsPhase1 ?? 3,
      parallelCount: pc ?? 4,
      autoPhase2TopN: opts.phase2TopN ?? 5,
    },
    onProgress,
    { progressPipelineStep: 'phase1' }
  );

  const top = (p1.recommendedForPhase2 ?? []).slice(0, opts.phase2TopN ?? 5);
  if (top.length === 0) {
    const completedAt = new Date().toISOString();
    return {
      pipelineId,
      startedAt: p1.startedAt,
      completedAt,
      durationSeconds: Math.round((Date.now() - t0) / 1000),
      phase1: p1,
      winnerParamSetId: null,
      winnerScore: null,
    };
  }

  setOptimizeProgress({
    sweepId: p1.sweepId,
    phase: 2,
    status: 'running',
    pipelineStep: 'phase2',
    paramSetsDone: 0,
    paramSetsTotal: top.length,
    simulationsDone: 0,
    simulationsTotal: 0,
    currentParamSetId: null,
    elapsedSeconds: (Date.now() - t0) / 1000,
    estimatedRemainingSeconds: null,
    startedAt: p1.startedAt,
  });

  const p2 = await runSweep(
    {
      phase: 2,
      sampleSize: opts.phase2SampleSize ?? 200,
      expandedSampleSize: opts.phase2SampleSize ?? 200,
      ambiguityLevels: amb,
      aiGateChoice: aiGate,
      trialsPerWork: opts.trialsPhase2 ?? 5,
      parallelCount: pc ?? 4,
      paramSetIds: top,
    },
    onProgress,
    { progressPipelineStep: 'phase2' }
  );

  const winner = p2.scoreCards[0];
  const winnerId = winner?.paramSetId ?? null;

  let p3: SweepResult | undefined;
  if (winnerId) {
    p3 = await runSweep(
      {
        phase: 2,
        sampleSize: opts.phase3SampleSize ?? 500,
        expandedSampleSize: opts.phase3SampleSize ?? 500,
        ambiguityLevels: amb,
        aiGateChoice: aiGate,
        trialsPerWork: opts.trialsPhase2 ?? 5,
        parallelCount: pc ?? 4,
        paramSetIds: [winnerId],
      },
      onProgress,
      { progressPipelineStep: 'phase3' }
    );
  }

  const completedAt = new Date().toISOString();
  const pipelineResult: PipelineResult = {
    pipelineId,
    startedAt: p1.startedAt,
    completedAt,
    durationSeconds: Math.round((Date.now() - t0) / 1000),
    phase1: p1,
    phase2: p2,
    phase3: p3,
    winnerParamSetId: p3?.scoreCards[0]?.paramSetId ?? p2.scoreCards[0]?.paramSetId ?? null,
    winnerScore: p3?.scoreCards[0]?.totalScore ?? p2.scoreCards[0]?.totalScore ?? null,
  };

  const outDir = path.join(process.cwd(), 'data', 'threshold-optimize-results');
  await fs.mkdir(outDir, { recursive: true });
  const pipelinePath = path.join(outDir, `${pipelineId}.json`);
  await fs.writeFile(pipelinePath, JSON.stringify(pipelineResult, null, 2), 'utf-8');

  setOptimizeProgress({
    sweepId: p3?.sweepId ?? p2.sweepId,
    phase: 2,
    status: 'completed',
    pipelineStep: 'done',
    paramSetsDone: 0,
    paramSetsTotal: 0,
    simulationsDone: 0,
    simulationsTotal: 0,
    currentParamSetId: pipelineResult.winnerParamSetId,
    startedAt: p1.startedAt,
    resultPath: p3
      ? `data/threshold-optimize-results/${p3.sweepId}.json`
      : `data/threshold-optimize-results/${p2.sweepId}.json`,
    pipelineResultPath: `data/threshold-optimize-results/${path.basename(pipelinePath)}`,
  });

  return pipelineResult;
}

/**
 * V3 包括パイプライン: Phase1（45PS+BL・25w×2t・amb 1,3,5）
 * → Phase2（上位8・60w×3t・amb 1–5）→ Phase3（上位3・100w×4t・amb 1–5）
 */
export async function runV3ComprehensivePipeline(
  opts: { aiGateChoice?: string; parallelCount?: number },
  onProgress?: (p: SweepProgress) => void
): Promise<PipelineResult> {
  const pipelineId = `pipeline-v3-${Date.now()}`;
  const t0 = Date.now();
  const aiGate = opts.aiGateChoice ?? 'BOTH';
  const pc = opts.parallelCount;

  const p1 = await runSweep(
    {
      phase: 1,
      sampleSize: 25,
      ambiguityLevels: [1, 3, 5],
      aiGateChoice: aiGate,
      trialsPerWork: 2,
      parallelCount: pc ?? 4,
      autoPhase2TopN: 8,
      useV3ParamSets: true,
    },
    onProgress,
    { progressPipelineStep: 'phase1' }
  );

  const top8 = (p1.recommendedForPhase2 ?? []).slice(0, 8);
  if (top8.length === 0) {
    const completedAt = new Date().toISOString();
    return {
      pipelineId,
      startedAt: p1.startedAt,
      completedAt,
      durationSeconds: Math.round((Date.now() - t0) / 1000),
      phase1: p1,
      winnerParamSetId: null,
      winnerScore: null,
    };
  }

  setOptimizeProgress({
    sweepId: p1.sweepId,
    phase: 2,
    status: 'running',
    pipelineStep: 'phase2',
    paramSetsDone: 0,
    paramSetsTotal: top8.length,
    simulationsDone: 0,
    simulationsTotal: 0,
    currentParamSetId: null,
    elapsedSeconds: (Date.now() - t0) / 1000,
    estimatedRemainingSeconds: null,
    startedAt: p1.startedAt,
  });

  const p2 = await runSweep(
    {
      phase: 2,
      sampleSize: 60,
      expandedSampleSize: 60,
      ambiguityLevels: [1, 2, 3, 4, 5],
      aiGateChoice: aiGate,
      trialsPerWork: 3,
      parallelCount: pc ?? 4,
      paramSetIds: top8,
      useV3ParamSets: true,
    },
    onProgress,
    { progressPipelineStep: 'phase2' }
  );

  const top3 = p2.scoreCards.slice(0, 3).map((c) => c.paramSetId);

  let p3: SweepResult | undefined;
  if (top3.length > 0) {
    setOptimizeProgress({
      sweepId: p2.sweepId,
      phase: 2,
      status: 'running',
      pipelineStep: 'phase3',
      paramSetsDone: 0,
      paramSetsTotal: top3.length,
      simulationsDone: 0,
      simulationsTotal: 0,
      currentParamSetId: null,
      elapsedSeconds: (Date.now() - t0) / 1000,
      estimatedRemainingSeconds: null,
      startedAt: p1.startedAt,
    });

    p3 = await runSweep(
      {
        phase: 2,
        sampleSize: 100,
        expandedSampleSize: 100,
        ambiguityLevels: [1, 2, 3, 4, 5],
        aiGateChoice: aiGate,
        trialsPerWork: 4,
        parallelCount: pc ?? 4,
        paramSetIds: top3,
        useV3ParamSets: true,
      },
      onProgress,
      { progressPipelineStep: 'phase3' }
    );
  }

  const completedAt = new Date().toISOString();
  const pipelineResult: PipelineResult = {
    pipelineId,
    startedAt: p1.startedAt,
    completedAt,
    durationSeconds: Math.round((Date.now() - t0) / 1000),
    phase1: p1,
    phase2: p2,
    phase3: p3,
    winnerParamSetId: p3?.scoreCards[0]?.paramSetId ?? p2.scoreCards[0]?.paramSetId ?? null,
    winnerScore: p3?.scoreCards[0]?.totalScore ?? p2.scoreCards[0]?.totalScore ?? null,
  };

  const outDir = path.join(process.cwd(), 'data', 'threshold-optimize-results');
  await fs.mkdir(outDir, { recursive: true });
  const pipelinePath = path.join(outDir, `${pipelineId}.json`);
  await fs.writeFile(pipelinePath, JSON.stringify(pipelineResult, null, 2), 'utf-8');

  setOptimizeProgress({
    sweepId: p3?.sweepId ?? p2.sweepId,
    phase: 2,
    status: 'completed',
    pipelineStep: 'done',
    paramSetsDone: 0,
    paramSetsTotal: 0,
    simulationsDone: 0,
    simulationsTotal: 0,
    currentParamSetId: pipelineResult.winnerParamSetId,
    startedAt: p1.startedAt,
    resultPath: p3
      ? `data/threshold-optimize-results/${p3.sweepId}.json`
      : `data/threshold-optimize-results/${p2.sweepId}.json`,
    pipelineResultPath: `data/threshold-optimize-results/${path.basename(pipelinePath)}`,
  });

  return pipelineResult;
}
