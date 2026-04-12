# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
p = page.read_text(encoding="utf-8")

s1 = "  const [simAmbiguityLevel, setSimAmbiguityLevel] = useState<number>(2);\n"
s1b = (
    "  const [simAmbiguityLevel, setSimAmbiguityLevel] = useState<number>(2);\n"
    "  const [simMinPopularity, setSimMinPopularity] = useState(0);\n"
    "  const [simBatchAmbiguityLevels, setSimBatchAmbiguityLevels] = useState<number[]>([2]);\n"
    "  const [simLastTotalFiltered, setSimLastTotalFiltered] = useState<number | null>(null);\n"
)
if "simMinPopularity" not in p:
    if s1 not in p:
        raise SystemExit("simAmbiguityLevel line not found")
    p = p.replace(s1, s1b, 1)

toggle_block = """
  const toggleSimBatchLevel = (n: number) => {
    setSimBatchAmbiguityLevels((prev) => {
      if (prev.includes(n)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== n).sort((a, b) => a - b);
      }
      return [...prev, n].sort((a, b) => a - b);
    });
  };

"""
anchor_modal = "  } | null>(null);\n\n  const simEarlyExitOkInline"
if "toggleSimBatchLevel" not in p:
    if anchor_modal not in p:
        raise SystemExit("simResultModal anchor not found")
    p = p.replace(anchor_modal, "  } | null>(null);" + toggle_block + "\n  const simEarlyExitOkInline", 1)

old_meta_type = """      ambiguityLevel?: number;
      aiGateChoice: string;
      trialsPerWork: number;
    };"""
new_meta_type = """      ambiguityLevel?: number;
      ambiguityLevels?: number[];
      minPopularity?: number;
      aiGateChoice: string;
      trialsPerWork: number;
    };"""
if "ambiguityLevels" not in p and old_meta_type in p:
    p = p.replace(old_meta_type, new_meta_type, 1)

old_fetch = """                    const idsRes = await fetch(`/api/admin/simulate?sampleSize=${simSampleSize || 0}`, {
                      headers: { 'x-eronator-admin-token': adminToken },
                    });
                    if (!idsRes.ok) throw new Error('サンプル取得に失敗しました');
                    const { workIds } = (await idsRes.json()) as { workIds: string[] };
                    const totalTrials = workIds.length * simTrialsPerWork;
                    setProgress('simulate', { done: 0, total: totalTrials, phase: '実行中', startTime: simStartTime });
                    const CHUNK_SIZE = 100;
                    const allResults: Array<{ workId: string; title: string; success: boolean; questionCount: number; outcome: string; steps?: unknown; workDetails?: unknown; diagnostic?: unknown; analysisData?: { wasNoisyCount: number; firstNoisyStepIndex: number; noisyStepIndices: number[]; correctRank: number; top1Confidence: number; totalQuestions?: number; noisyRatio?: number }; errorMessage?: string; perfSummary?: Record<string, number> }> = [];
                    let doneCount = 0;
                    let totalWorksInDb = 0;
                    const chunkTimings: Array<{ chunk: number; doneCount: number; elapsedMs: number }> = [];

                    if (simUseSingleRequest) {
                      setProgress('simulate', { done: 0, total: totalTrials, phase: '実行中（1回送信）', startTime: simStartTime });
                      const response = await fetch('/api/admin/simulate', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                        body: JSON.stringify({
                          workIds,
                          ambiguityLevel: simAmbiguityLevel,
                          aiGateChoice: simAiGateChoice,
                          trialsPerWork: simTrialsPerWork,
                          includePerf: true,
                          parallelCount: 20,
                          totalTrials,
                          doneOffset: 0,
                        }),
                      });
                      if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error || 'Batch simulation failed');
                      }
                      const data = (await response.json()) as { results: typeof allResults; metadata?: { totalWorksInDb?: number } };
                      allResults.push(...data.results);
                      if (data.metadata?.totalWorksInDb) totalWorksInDb = data.metadata.totalWorksInDb;
                      doneCount = data.results.length;
                      chunkTimings.push({ chunk: 1, doneCount, elapsedMs: Date.now() - simStartTime });
                    } else {
                      for (let i = 0; i < workIds.length; i += CHUNK_SIZE) {
                        const chunkStart = Date.now();
                        const chunk = workIds.slice(i, i + CHUNK_SIZE);
                        const doneOffset = i * simTrialsPerWork;
                        const response = await fetch('/api/admin/simulate', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                          body: JSON.stringify({
                            workIds: chunk,
                            ambiguityLevel: simAmbiguityLevel,
                            aiGateChoice: simAiGateChoice,
                            trialsPerWork: simTrialsPerWork,
                            includePerf: true,
                            parallelCount: 20,
                            totalTrials,
                            doneOffset,
                          }),
                        });
                        if (!response.ok) {
                          const err = await response.json();
                          throw new Error(err.error || 'Batch simulation failed');
                        }
                        const data = (await response.json()) as { results: typeof allResults; metadata?: { totalWorksInDb?: number } };
                        allResults.push(...data.results);
                        if (data.metadata?.totalWorksInDb) totalWorksInDb = data.metadata.totalWorksInDb;
                        doneCount += data.results.length;
                        chunkTimings.push({ chunk: Math.floor(i / CHUNK_SIZE) + 1, doneCount, elapsedMs: Date.now() - chunkStart });
                        const elapsedTotal = Date.now() - simStartTime;
                        const avgMsPerItem = elapsedTotal / doneCount;
                        const remainItems = totalTrials - doneCount;
                        const etaSec = Math.round((avgMsPerItem * remainItems) / 1000);
                        const lastChunkSec = ((Date.now() - chunkStart) / 1000).toFixed(1);
                        setProgress('simulate', {
                          done: doneCount,
                          total: totalTrials,
                          phase: `実行中 | 直近${lastChunkSec}s | 残り約${etaSec}s`,
                          startTime: simStartTime,
                        });
                      }
                    }"""

new_fetch = """                    const idsRes = await fetch(`/api/admin/simulate?sampleSize=${simSampleSize || 0}&minPopularity=${simMinPopularity}`, {
                      headers: { 'x-eronator-admin-token': adminToken },
                    });
                    if (!idsRes.ok) throw new Error('サンプル取得に失敗しました');
                    const idsJson = (await idsRes.json()) as { workIds: string[]; totalFiltered?: number };
                    const { workIds } = idsJson;
                    if (typeof idsJson.totalFiltered === 'number') {
                      setSimLastTotalFiltered(idsJson.totalFiltered);
                    }
                    const batchLevels = (simBatchAmbiguityLevels.length > 0
                      ? [...new Set(simBatchAmbiguityLevels)].sort((a, b) => a - b)
                      : [simAmbiguityLevel]);
                    const trialsPerLevel = workIds.length * simTrialsPerWork;
                    const totalTrials = trialsPerLevel * batchLevels.length;
                    setProgress('simulate', { done: 0, total: totalTrials, phase: '実行中', startTime: simStartTime });
                    const CHUNK_SIZE = 100;
                    const allResults: Array<{ workId: string; title: string; success: boolean; questionCount: number; outcome: string; ambiguityLevel?: number; steps?: unknown; workDetails?: unknown; diagnostic?: unknown; analysisData?: { wasNoisyCount: number; firstNoisyStepIndex: number; noisyStepIndices: number[]; correctRank: number; top1Confidence: number; totalQuestions?: number; noisyRatio?: number }; errorMessage?: string; perfSummary?: Record<string, number> }> = [];
                    let doneCount = 0;
                    let totalWorksInDb = 0;
                    const chunkTimings: Array<{ chunk: number; doneCount: number; elapsedMs: number }> = [];

                    let levelBaseOffset = 0;
                    let levelIndex = 0;
                    for (const ambLevel of batchLevels) {
                      if (simUseSingleRequest) {
                        setProgress('simulate', { done: doneCount, total: totalTrials, phase: `実行中（1回送信） L${ambLevel}`, startTime: simStartTime });
                        const response = await fetch('/api/admin/simulate', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                          body: JSON.stringify({
                            workIds,
                            ambiguityLevel: ambLevel,
                            aiGateChoice: simAiGateChoice,
                            trialsPerWork: simTrialsPerWork,
                            includePerf: true,
                            parallelCount: 20,
                            minPopularity: simMinPopularity,
                            totalTrials: trialsPerLevel,
                            doneOffset: levelBaseOffset,
                          }),
                        });
                        if (!response.ok) {
                          const err = await response.json();
                          throw new Error(err.error || 'Batch simulation failed');
                        }
                        const data = (await response.json()) as { results: typeof allResults; metadata?: { totalWorksInDb?: number } };
                        allResults.push(...data.results.map((r) => ({ ...r, ambiguityLevel: ambLevel })));
                        if (data.metadata?.totalWorksInDb) totalWorksInDb = data.metadata.totalWorksInDb;
                        doneCount += data.results.length;
                        levelBaseOffset += data.results.length;
                        levelIndex += 1;
                        chunkTimings.push({ chunk: levelIndex, doneCount, elapsedMs: Date.now() - simStartTime });
                      } else {
                        for (let i = 0; i < workIds.length; i += CHUNK_SIZE) {
                          const chunkStart = Date.now();
                          const chunk = workIds.slice(i, i + CHUNK_SIZE);
                          const doneOffset = levelBaseOffset + i * simTrialsPerWork;
                          const response = await fetch('/api/admin/simulate', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                            body: JSON.stringify({
                              workIds: chunk,
                              ambiguityLevel: ambLevel,
                              aiGateChoice: simAiGateChoice,
                              trialsPerWork: simTrialsPerWork,
                              includePerf: true,
                              parallelCount: 20,
                              minPopularity: simMinPopularity,
                              totalTrials,
                              doneOffset,
                            }),
                          });
                          if (!response.ok) {
                            const err = await response.json();
                            throw new Error(err.error || 'Batch simulation failed');
                          }
                          const data = (await response.json()) as { results: typeof allResults; metadata?: { totalWorksInDb?: number } };
                          allResults.push(...data.results.map((r) => ({ ...r, ambiguityLevel: ambLevel })));
                          if (data.metadata?.totalWorksInDb) totalWorksInDb = data.metadata.totalWorksInDb;
                          doneCount += data.results.length;
                          chunkTimings.push({ chunk: Math.floor(i / CHUNK_SIZE) + 1, doneCount, elapsedMs: Date.now() - chunkStart });
                          const elapsedTotal = Date.now() - simStartTime;
                          const avgMsPerItem = elapsedTotal / Math.max(1, doneCount);
                          const remainItems = totalTrials - doneCount;
                          const etaSec = Math.round((avgMsPerItem * remainItems) / 1000);
                          const lastChunkSec = ((Date.now() - chunkStart) / 1000).toFixed(1);
                          setProgress('simulate', {
                            done: doneCount,
                            total: totalTrials,
                            phase: `実行中 L${ambLevel} | 直近${lastChunkSec}s | 残り約${etaSec}s`,
                            startTime: simStartTime,
                          });
                        }
                        levelBaseOffset += trialsPerLevel;
                        levelIndex += 1;
                      }
                    }"""

if "batchLevels" not in p and old_fetch in p:
    p = p.replace(old_fetch, new_fetch, 1)
elif "batchLevels" in p:
    print("batch block already present, skip")
else:
    raise SystemExit("old_fetch block not found")

old_setmeta = """                        ambiguityLevel: simAmbiguityLevel,
                        aiGateChoice: simAiGateChoice,
                        trialsPerWork: simTrialsPerWork,
                        durationSeconds,
                      },
                    } as Parameters<typeof setSimBatchResult>[0]);"""
new_setmeta = """                        ambiguityLevel: batchLevels.length === 1 ? batchLevels[0] : undefined,
                        ambiguityLevels: batchLevels,
                        minPopularity: simMinPopularity,
                        aiGateChoice: simAiGateChoice,
                        trialsPerWork: simTrialsPerWork,
                        durationSeconds,
                      },
                    } as Parameters<typeof setSimBatchResult>[0]);"""
if "ambiguityLevels:" not in p and old_setmeta in p:
    p = p.replace(old_setmeta, new_setmeta, 1)

ui_old = """                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>（0=全件）</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>曖昧さレベル 1-10</label>"""
ui_new = """                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>（0=全件）</span>
                {simLastTotalFiltered != null && (
                  <span style={{ fontSize: '0.8rem', color: '#333', marginLeft: '0.5rem' }}>
                    人気度{simMinPopularity}以上: {simLastTotalFiltered.toLocaleString()}件
                  </span>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>人気度下限（popularityBase）</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={simMinPopularity}
                  onChange={(e) => setSimMinPopularity(Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))))}
                  style={{ width: '72px', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>（0=制限なし）</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>バッチ曖昧さ（複数可 1–5）</label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map((lv) => (
                    <label key={lv} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={simBatchAmbiguityLevels.includes(lv)}
                        onChange={() => toggleSimBatchLevel(lv)}
                      />
                      {lv}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>曖昧さレベル 1-10</label>"""
if "バッチ曖昧さ" not in p and ui_old in p:
    p = p.replace(ui_old, ui_new, 1)

row_old = """                        {r.outcome} ({r.questionCount}問)
                        {(r as { errorMessage?: string }).errorMessage && ("""
marker = "L${(r as { ambiguityLevel?: number }).ambiguityLevel}"
if marker not in p and row_old in p:
    row_new = """                        {r.outcome} ({r.questionCount}問)
                        {(r as { ambiguityLevel?: number }).ambiguityLevel != null && (
                          <span style={{ color: '#555', marginLeft: '0.25rem' }}>L{(r as { ambiguityLevel?: number }).ambiguityLevel}</span>
                        )}
                        {(r as { errorMessage?: string }).errorMessage && ("""
    p = p.replace(row_old, row_new, 1)

page.write_text(p, encoding="utf-8")
print("page.tsx ok")
