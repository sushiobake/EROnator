# -*- coding: utf-8 -*-
"""One-off patch for ProgressPanel optimize job (UTF-8 safe)."""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/app/admin/components/ProgressPanel.tsx"
text = p.read_text(encoding="utf-8")

old_labels = """const JOB_LABELS: Record<JobType, string> = {
  comment: 'コメント取得',
  phase0: 'Phase0（タグ付け）',
  phase12: 'Phase1+2（チェック）',
  simulate: 'シミュレーション',
};"""
new_labels = """const JOB_LABELS: Record<JobType, string> = {
  comment: 'コメント取得',
  phase0: 'Phase0（タグ付け）',
  phase12: 'Phase1+2（チェック）',
  simulate: 'シミュレーション',
  optimize: '閾値最適化',
};"""

old_short = """const JOB_SHORT: Record<JobType, string> = {
  comment: 'コメント',
  phase0: 'P0（タグ付け）',
  phase12: 'P1+2（チェック）',
  simulate: 'シミュ',
};"""
new_short = """const JOB_SHORT: Record<JobType, string> = {
  comment: 'コメント',
  phase0: 'P0（タグ付け）',
  phase12: 'P1+2（チェック）',
  simulate: 'シミュ',
  optimize: '閾値OPT',
};"""

text = text.replace(old_labels, new_labels, 1)
text = text.replace(old_short, new_short, 1)

text = text.replace(
    "const isSimRunning = (progress.simulate?.total ?? 0) > 0;\n  const isRunning = isBulkRunning || isSimRunning;",
    "const isSimRunning = (progress.simulate?.total ?? 0) > 0;\n  const isOptimizeRunning = (progress.optimize?.total ?? 0) > 0;\n  const isRunning = isBulkRunning || isSimRunning || isOptimizeRunning;",
    1,
)

text = text.replace(
    "const st = progress.comment?.startTime || progress.phase0?.startTime || progress.phase12?.startTime || progress.simulate?.startTime || Date.now();",
    "const st = progress.comment?.startTime || progress.phase0?.startTime || progress.phase12?.startTime || progress.simulate?.startTime || progress.optimize?.startTime || Date.now();",
    1,
)

text = text.replace(
    "}, [isRunning, progress.comment?.startTime, progress.phase0?.startTime, progress.phase12?.startTime, progress.simulate?.startTime]);",
    "}, [isRunning, progress.comment?.startTime, progress.phase0?.startTime, progress.phase12?.startTime, progress.simulate?.startTime, progress.optimize?.startTime]);",
    1,
)

old_clear = """    const clearAllProgress = () => {
      setProgress('comment', null);
      setProgress('phase0', null);
      setProgress('phase12', null);
    };"""
new_clear = """    const clearAllProgress = () => {
      setProgress('comment', null);
      setProgress('phase0', null);
      setProgress('phase12', null);
      setProgress('optimize', null);
    };"""
text = text.replace(old_clear, new_clear, 1)

needle = """        const simProgress = data.simProgress as { done: number; total: number; startedAt: string } | null;

        if (status === 'running' && data.progress) {"""
insert = """        const simProgress = data.simProgress as { done: number; total: number; startedAt: string } | null;
        const optimizeProgress = data.optimizeProgress as {
          status: string;
          simulationsDone: number;
          simulationsTotal: number;
          paramSetsDone: number;
          paramSetsTotal: number;
          pipelineStep?: string;
          currentParamSetId: string | null;
          startedAt: string;
        } | null;

        if (optimizeProgress && optimizeProgress.status === 'running') {
          lastServerDataRef.current = Date.now();
          const phaseStr = [optimizeProgress.pipelineStep, optimizeProgress.currentParamSetId].filter(Boolean).join(' ');
          setProgress('optimize', {
            done: optimizeProgress.simulationsDone,
            total: Math.max(1, optimizeProgress.simulationsTotal),
            phase: `ParamSet ${optimizeProgress.paramSetsDone}/${optimizeProgress.paramSetsTotal} ${phaseStr}`,
            startTime: new Date(optimizeProgress.startedAt).getTime(),
          });
          schedulePoll(POLL_RUNNING_MS);
        } else if (status === 'running' && data.progress) {"""
text = text.replace(needle, insert, 1)

needle2 = """            {/* Simulate section */}
            {isSimRunning && progress.simulate && (
              <div style={{ padding: '8px 8px 10px', borderBottom: '1px solid #eee', background: '#fff8e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>
                    🎮 シミュ実行中 {fmt(elapsedSec)}
                  </span>"""
insert2 = """            {/* Optimize sweep section */}
            {isOptimizeRunning && progress.optimize && (
              <div style={{ padding: '8px 8px 10px', borderBottom: '1px solid #eee', background: '#e8f5e9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>
                    📊 閾値最適化 {fmt(elapsedSec)}
                  </span>
                  <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>
                    {progress.optimize.done ?? 0}/{progress.optimize.total}
                  </span>
                </div>
                <ProgressBar value={progress.optimize.done ?? 0} max={progress.optimize.total} color="#43a047" />
                {progress.optimize.phase && (
                  <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{progress.optimize.phase}</div>
                )}
              </div>
            )}

            {/* Simulate section */}
            {isSimRunning && progress.simulate && (
              <div style={{ padding: '8px 8px 10px', borderBottom: '1px solid #eee', background: '#fff8e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>
                    🎮 シミュ実行中 {fmt(elapsedSec)}
                  </span>"""
text = text.replace(needle2, insert2, 1)

p.write_text(text, encoding="utf-8")
print("patched", p)
