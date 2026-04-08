/**
 * Worker Thread: シミュレーションをメインスレッドから分離して実行
 *
 * 共有データは SharedArrayBuffer 経由で受け取る（ファイル I/O ゼロ）。
 * parentPort.postMessage で進捗・結果を返す。
 * (config/schema または engine 変更時は本ファイルを touch して dist/simulationWorker.js を再ビルドすること)
 */

import { parentPort, workerData } from 'worker_threads';
import { setWorkTagMatrixDirect } from '../game/workTagMatrixLoader';
import { setTagCacheDirect, type CachedTag } from '../game/tagCacheLoader';
import { setSimWorkDataMap, type SimWorkData } from '../game/engine';
import { getMvpConfig } from '../config/loader';
import { runSimulation, type SharedBatchContext } from './simulationRunner';

interface WorkerInput {
  tasks: Array<{ targetWorkId: string; trial: number }>;
  level: number;
  aiGateChoice: string;
  includePerf: boolean;
  sharedBuffer: SharedArrayBuffer;
  taskIndexBuffer: SharedArrayBuffer;
}

type WorkDetail = SharedBatchContext['workDetailMap'] extends Map<string, infer V> ? V : never;
type WorkTagEntry = SharedBatchContext['workTagMap'] extends Map<string, infer V> ? V : never;

interface SharedData {
  sharedContextSerialized: {
    allWorks: SharedBatchContext['allWorks'];
    workTitleEntries: [string, string][];
    workDetailEntries: [string, WorkDetail][];
    workTagEntries: [string, WorkTagEntry][];
  };
  workTagMatrixData: {
    version?: number;
    generatedAt?: string;
    workCount?: number;
    totalWorkTags?: number;
    workTagMap: Record<string, Array<{ tagKey: string; derivedConfidence: number | null }>>;
  } | null;
  tagCacheData: CachedTag[];
  simWorkDataEntries: [string, SimWorkData][];
}

async function main() {
  const input = workerData as WorkerInput;

  const bytes = new Uint8Array(input.sharedBuffer);
  const jsonStr = new TextDecoder().decode(bytes);
  const shared: SharedData = JSON.parse(jsonStr);

  if (shared.workTagMatrixData) {
    setWorkTagMatrixDirect(shared.workTagMatrixData);
  }
  if (shared.tagCacheData.length > 0) {
    setTagCacheDirect(shared.tagCacheData);
  }
  setSimWorkDataMap(new Map(shared.simWorkDataEntries));

  const sharedContext: SharedBatchContext = {
    allWorks: shared.sharedContextSerialized.allWorks,
    workTitleMap: new Map(shared.sharedContextSerialized.workTitleEntries),
    workDetailMap: new Map(shared.sharedContextSerialized.workDetailEntries),
    workTagMap: new Map(shared.sharedContextSerialized.workTagEntries),
  };

  const config = getMvpConfig();
  const { tasks, level, aiGateChoice, includePerf, taskIndexBuffer } = input;
  const taskIndexView = new Int32Array(taskIndexBuffer);

  const results: Array<{
    workId: string;
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
  }> = [];

  // 動的タスクキュー: Atomics.add で次タスクを取得（早く終わった Worker が次のタスクを拾う）
  while (true) {
    const index = Atomics.add(taskIndexView, 0, 1);
    if (index >= tasks.length) break;

    const { targetWorkId } = tasks[index];
    try {
      const simResult = await runSimulation(targetWorkId, level, aiGateChoice, config, sharedContext, includePerf);
      if (simResult) {
        results.push({
          workId: simResult.targetWorkId,
          title: simResult.targetWorkTitle,
          success: simResult.success,
          questionCount: simResult.questionCount,
          outcome: simResult.outcome,
          steps: simResult.steps,
          workDetails: simResult.workDetails,
          diagnostic: simResult.diagnostic,
          analysisData: simResult.analysisData,
          errorMessage: simResult.errorMessage,
          perfSummary: simResult.perfSummary,
        });
      }
    } catch {
      results.push({
        workId: targetWorkId,
        title: '',
        success: false,
        questionCount: 0,
        outcome: 'ERROR',
        errorMessage: 'Worker simulation error',
      });
    }
    parentPort?.postMessage({ type: 'progress', done: index + 1, total: tasks.length });
  }

  parentPort?.postMessage({ type: 'done', results, totalWorksInDb: sharedContext.allWorks.length });
}

main().catch(err => {
  parentPort?.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
});
