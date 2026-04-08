# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/app/admin/components/ProgressPanel.tsx"
text = p.read_text(encoding="utf-8")
old = """        if (optimizeProgress && optimizeProgress.status === 'running') {
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
new = """        if (optimizeProgress && optimizeProgress.status === 'running') {
          lastServerDataRef.current = Date.now();
          const phaseStr = [optimizeProgress.pipelineStep, optimizeProgress.currentParamSetId].filter(Boolean).join(' ');
          setProgress('optimize', {
            done: optimizeProgress.simulationsDone,
            total: Math.max(1, optimizeProgress.simulationsTotal),
            phase: `ParamSet ${optimizeProgress.paramSetsDone}/${optimizeProgress.paramSetsTotal} ${phaseStr}`,
            startTime: new Date(optimizeProgress.startedAt).getTime(),
          });
          schedulePoll(POLL_RUNNING_MS);
        } else if (optimizeProgress && optimizeProgress.status === 'completed') {
          lastServerDataRef.current = Date.now();
          const opx = optimizeProgress as { resultPath?: string; pipelineResultPath?: string; simulationsTotal?: number };
          const pathMsg = opx.pipelineResultPath ?? opx.resultPath ?? '';
          setProgress('optimize', {
            done: Math.max(1, opx.simulationsTotal ?? 1),
            total: Math.max(1, opx.simulationsTotal ?? 1),
            phase: pathMsg ? `完了 ${pathMsg}` : '完了',
            startTime: new Date(optimizeProgress.startedAt).getTime(),
          });
          schedulePoll(POLL_IDLE_MS);
        } else if (status === 'running' && data.progress) {"""
if old not in text:
    raise SystemExit('anchor not found')
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print('ok')
