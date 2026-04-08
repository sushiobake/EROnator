/**
 * Worker Thread でシミュレーションバッチを実行（simulate API と閾値最適化で共用）
 */
import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { cpus } from 'os';
import { execSync } from 'child_process';
import type { SimWorkData } from '@/server/game/engine';
import { getWorkTagMatrix } from '@/server/game/workTagMatrixLoader';
import type { CachedTag } from '@/server/game/tagCacheLoader';
import { getMvpConfig } from '@/server/config/loader';
import type { SharedBatchContext } from '@/server/simulation/simulationRunner';

export interface WorkerResultItem {
  workId: string;
  /** バッチ内の試行インデックス（0-based） */
  trial?: number;
  title: string;
  success: boolean;
  questionCount: number;
  outcome: string;
  steps?: unknown;
  workDetails?: unknown;
  diagnostic?: unknown;
  analysisData?: unknown;
  errorMessage?: string;
  perfSummary?: Record<string, number>;
}

function ensureWorkerBundle(): void {
  const bundlePath = path.resolve(process.cwd(), 'dist/simulationWorker.js');
  const srcPath = path.resolve(process.cwd(), 'src/server/simulation/simulationWorker.ts');
  const configDeps = [
    path.resolve(process.cwd(), 'src/server/config/schema.ts'),
    path.resolve(process.cwd(), 'src/server/config/loader.ts'),
  ];
  try {
    const srcStat = fs.statSync(srcPath);
    const depMtime = Math.max(
      srcStat.mtimeMs,
      ...configDeps.map((p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0))
    );
    let needsBuild = !fs.existsSync(bundlePath);
    if (!needsBuild) {
      const bundleStat = fs.statSync(bundlePath);
      needsBuild = depMtime > bundleStat.mtimeMs;
    }
    if (needsBuild) {
      const distDir = path.resolve(process.cwd(), 'dist');
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
      execSync(
        'npx esbuild src/server/simulation/simulationWorker.ts --bundle --platform=node --target=node18 --outfile=dist/simulationWorker.js --format=cjs --alias:@/server/db/client=./src/server/simulation/prismaStub.ts',
        { cwd: process.cwd(), stdio: 'pipe' }
      );
      console.log('[Sim] Worker bundle rebuilt');
    }
  } catch (e) {
    console.warn('[Sim] Failed to build worker bundle, falling back to tsx:', e);
  }
}

export type MvpConfig = ReturnType<typeof getMvpConfig>;

export async function runSimulationInWorker(opts: {
  tasks: Array<{ targetWorkId: string; trial: number }>;
  level: number;
  aiGateChoice: string;
  includePerf: boolean;
  parallel: number;
  sharedContext: SharedBatchContext;
  workTagMatrixData: ReturnType<typeof getWorkTagMatrix>;
  tagCacheData: CachedTag[];
  simWorkDataEntries: [string, SimWorkData][];
  onProgress?: (done: number, total: number) => void;
  /** 指定時は getMvpConfig() の代わりに Worker 内で使用（閾値最適化スイープ用） */
  configOverride?: MvpConfig;
}): Promise<{ results: WorkerResultItem[]; totalWorksInDb: number }> {
  ensureWorkerBundle();
  const workerPathJs = path.resolve(process.cwd(), 'dist/simulationWorker.js');
  const workerPathTs = path.resolve(process.cwd(), 'src/server/simulation/simulationWorker.ts');
  const useBundle = fs.existsSync(workerPathJs);
  const workerPath = useBundle ? workerPathJs : workerPathTs;
  const workerCount = Math.min(opts.parallel, opts.tasks.length);
  if (workerCount === 0) return { results: [], totalWorksInDb: opts.sharedContext.allWorks.length };

  const sharedPayload = JSON.stringify({
    sharedContextSerialized: {
      allWorks: opts.sharedContext.allWorks,
      workTitleEntries: Array.from(opts.sharedContext.workTitleMap.entries()),
      workDetailEntries: Array.from(opts.sharedContext.workDetailMap.entries()),
      workTagEntries: Array.from(opts.sharedContext.workTagMap.entries()),
    },
    workTagMatrixData: opts.workTagMatrixData,
    tagCacheData: opts.tagCacheData,
    simWorkDataEntries: opts.simWorkDataEntries,
  });
  const encoder = new TextEncoder();
  const bytes = encoder.encode(sharedPayload);
  const sharedBuffer = new SharedArrayBuffer(bytes.byteLength);
  new Uint8Array(sharedBuffer).set(bytes);
  console.log(`[Sim] Shared data in memory: ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB (SharedArrayBuffer)`);

  const taskIndexBuffer = new SharedArrayBuffer(4);
  new Int32Array(taskIndexBuffer)[0] = 0;

  let totalDone = 0;
  const totalTasks = opts.tasks.length;

  const configOverrideJson = opts.configOverride ? JSON.stringify(opts.configOverride) : undefined;

  const sharedWorkerData = {
    tasks: opts.tasks,
    level: opts.level,
    aiGateChoice: opts.aiGateChoice,
    includePerf: opts.includePerf,
    sharedBuffer,
    taskIndexBuffer,
    configOverrideJson,
  };

  function spawnWorker(): Promise<WorkerResultItem[]> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        ...(useBundle ? {} : { execArgv: ['--require', 'tsx/cjs'] }),
        workerData: sharedWorkerData,
      });

      let workerResults: WorkerResultItem[] = [];

      worker.on('message', (msg: { type: string; results?: WorkerResultItem[]; done?: number; total?: number; message?: string }) => {
        if (msg.type === 'done') {
          workerResults = msg.results ?? [];
        } else if (msg.type === 'progress' && msg.done != null) {
          totalDone++;
          opts.onProgress?.(totalDone, totalTasks);
        } else if (msg.type === 'error') {
          reject(new Error(msg.message ?? 'Worker error'));
        }
      });

      worker.on('error', reject);

      worker.on('exit', (code) => {
        if (workerResults.length > 0 || code === 0) {
          resolve(workerResults);
        } else {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  console.log(`[Sim] Spawning ${workerCount} workers for ${totalTasks} tasks (dynamic queue, bundle=${useBundle})`);
  const workerPromises = Array.from({ length: workerCount }, () => spawnWorker());

  const allResults = await Promise.all(workerPromises);
  return { results: allResults.flat(), totalWorksInDb: opts.sharedContext.allWorks.length };
}

/** CPU に依存しない既定並列（閾値最適化・環境差で失敗しないよう控えめ） */
export function defaultParallelCount(requested?: number): number {
  const numCpus = cpus().length;
  const safe = Math.max(1, Math.min(4, numCpus - 1));
  if (requested != null && Number.isFinite(requested) && requested > 0) {
    return Math.max(1, Math.min(numCpus, Math.floor(requested)));
  }
  return safe;
}
