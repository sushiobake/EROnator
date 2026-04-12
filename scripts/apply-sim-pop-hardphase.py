# -*- coding: utf-8 -*-
"""Apply sim minPopularity + hardConfidenceMinByPhase (UTF-8 safe)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    # --- schema.ts ---
    schema_path = ROOT / "src" / "server" / "config" / "schema.ts"
    s = schema_path.read_text(encoding="utf-8")
    old_confirm = """const ConfirmSchema = z.object({
  revealThreshold: z.number().min(0).max(1),
  confidenceConfirmBand: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).refine(
    (val) => val[0] <= val[1],
    { message: 'confidenceConfirmBand[0] must be <= confidenceConfirmBand[1]' }
  ),
  qForcedIndices: z.array(z.number().int().positive()),
  softConfidenceMin: z.number().min(0).max(1),
  hardConfidenceMin: z.number().min(0).max(1),
}).strict();"""
    new_confirm = """const ConfirmSchema = z.object({
  revealThreshold: z.number().min(0).max(1),
  confidenceConfirmBand: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).refine(
    (val) => val[0] <= val[1],
    { message: 'confidenceConfirmBand[0] must be <= confidenceConfirmBand[1]' }
  ),
  qForcedIndices: z.array(z.number().int().positive()),
  softConfidenceMin: z.number().min(0).max(1),
  hardConfidenceMin: z.number().min(0).max(1),
  hardConfidenceMinByPhase: z
    .object({
      enabled: z.boolean(),
      minPopularityBase: z.number().min(0).max(100).optional(),
      phases: z
        .object({
          q20: z.number().min(0).max(1),
          q25: z.number().min(0).max(1),
          q30: z.number().min(0).max(1),
        })
        .strict(),
    })
    .strict()
    .optional(),
}).strict();"""
    if old_confirm not in s:
        raise SystemExit("schema.ts: ConfirmSchema block not found or already patched")
    schema_path.write_text(s.replace(old_confirm, new_confirm, 1), encoding="utf-8")

    # --- engine.ts ---
    eng = ROOT / "src" / "server" / "game" / "engine.ts"
    e = eng.read_text(encoding="utf-8")
    inj = "import { getEffectiveHardConfidenceMin } from '@/server/game/confirmHardMin';\n"
    if inj not in e:
        needle = "} from '@/server/algo/questionSelection';\n"
        if needle not in e:
            raise SystemExit("engine.ts: import anchor not found")
        e = e.replace(needle, needle + inj, 1)
    old_sel = """    const confirmType = selectConfirmType(confidence, hasSoftConfirmData, {
      softConfidenceMin: config.confirm.softConfidenceMin,
      hardConfidenceMin: config.confirm.hardConfidenceMin,
    });"""
    new_sel = """    const top1PopularityForHard =
      top1WorkId != null ? getSimWorkDataMap()?.get(top1WorkId)?.popularityBase ?? null : null;
    const effectiveHardMin = getEffectiveHardConfidenceMin(
      config,
      questionIndex,
      top1PopularityForHard
    );
    const confirmType = selectConfirmType(confidence, hasSoftConfirmData, {
      softConfidenceMin: config.confirm.softConfidenceMin,
      hardConfidenceMin: effectiveHardMin,
    });"""
    if old_sel not in e:
        raise SystemExit("engine.ts: selectConfirmType block not found or already patched")
    eng.write_text(e.replace(old_sel, new_sel, 1), encoding="utf-8")

    # --- simulate route ---
    route = ROOT / "src" / "app" / "api" / "admin" / "simulate" / "route.ts"
    r = route.read_text(encoding="utf-8")
    old_get = """export async function GET(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    const sampleSize = Math.max(0, Number(request.nextUrl.searchParams.get('sampleSize') ?? 0));
    const works = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: { workId: true },
    });
    let workIds = works.map((w) => w.workId);
    if (sampleSize > 0 && sampleSize < workIds.length) {
      const shuffled = [...workIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      workIds = shuffled.slice(0, sampleSize);
    }
    return NextResponse.json({ workIds });
  } catch (error) {"""
    new_get = """export async function GET(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    const sampleSize = Math.max(0, Number(request.nextUrl.searchParams.get('sampleSize') ?? 0));
    const minPopularity = Math.max(
      0,
      Math.min(100, Math.floor(Number(request.nextUrl.searchParams.get('minPopularity') ?? '0') || 0))
    );
    const baseWhere = {
      gameRegistered: true,
      needsReview: false,
      ...(minPopularity > 0 ? { popularityBase: { gte: minPopularity } } : {}),
    } as const;
    const totalFiltered = await prisma.work.count({ where: baseWhere });
    const works = await prisma.work.findMany({
      where: baseWhere,
      select: { workId: true },
    });
    let workIds = works.map((w) => w.workId);
    if (sampleSize > 0 && sampleSize < workIds.length) {
      const shuffled = [...workIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      workIds = shuffled.slice(0, sampleSize);
    }
    return NextResponse.json({ workIds, totalFiltered, minPopularity });
  } catch (error) {"""
    if old_get not in r:
        raise SystemExit("route.ts: GET block not found or already patched")
    r = r.replace(old_get, new_get, 1)

    old_put = """    const {
      workIds,
      ambiguityLevel = 2,
      noiseRate = 0,
      noiseRates,
      aiGateChoice = 'BOTH',
      trialsPerWork = 1,
      sampleSize = 0,
      parallelCount = 20,
      includePerf = false,
      totalTrials: totalTrialsParam,
      doneOffset = 0,
    } = body;

    const level = ambiguityLevel != null ? Math.max(1, Math.min(10, Number(ambiguityLevel))) : 2;"""
    new_put = """    const {
      workIds,
      ambiguityLevel = 2,
      noiseRate = 0,
      noiseRates,
      aiGateChoice = 'BOTH',
      trialsPerWork = 1,
      sampleSize = 0,
      parallelCount = 20,
      includePerf = false,
      totalTrials: totalTrialsParam,
      doneOffset = 0,
      minPopularity: minPopularityRaw = 0,
    } = body;

    const minPopularity = Math.max(0, Math.min(100, Math.floor(Number(minPopularityRaw) || 0)));

    const level = ambiguityLevel != null ? Math.max(1, Math.min(10, Number(ambiguityLevel))) : 2;"""
    if old_put not in r:
        raise SystemExit("route.ts: PUT destructure not found or already patched")
    r = r.replace(old_put, new_put, 1)

    old_t = """    // 対象作品を取得（未指定時はゲーム登録済みのみ）
    let targetWorkIds: string[];
    if (workIds && workIds.length > 0) {
      targetWorkIds = workIds;
    } else {
      const works = await prisma.work.findMany({
        where: { gameRegistered: true, needsReview: false },
        select: { workId: true },
      });
      targetWorkIds = works.map(w => w.workId);
    }"""
    new_t = """    // 対象作品を取得（未指定時はゲーム登録済みのみ。minPopularity は人気度 popularityBase の下限）
    let targetWorkIds: string[];
    if (workIds && workIds.length > 0) {
      targetWorkIds = workIds;
    } else {
      const works = await prisma.work.findMany({
        where: {
          gameRegistered: true,
          needsReview: false,
          ...(minPopularity > 0 ? { popularityBase: { gte: minPopularity } } : {}),
        },
        select: { workId: true },
      });
      targetWorkIds = works.map(w => w.workId);
    }"""
    if old_t not in r:
        raise SystemExit("route.ts: targetWorkIds block not found")
    r = r.replace(old_t, new_t, 1)

    old_m = """    const workDetailMap = new Map(allWorks.map(w => [w.workId, w]));

    // 行列 + タグキャッシュから workId→タグ配列を構築（DB 不要）"""
    new_m = """    const workDetailMap = new Map(allWorks.map(w => [w.workId, w]));

    if (minPopularity > 0 && workIds && workIds.length > 0) {
      const popById = new Map(allWorks.map(w => [w.workId, w.popularityBase ?? 0]));
      targetWorkIds = targetWorkIds.filter((id) => (popById.get(id) ?? 0) >= minPopularity);
    }

    // 行列 + タグキャッシュから workId→タグ配列を構築（DB 不要）"""
    if old_m not in r:
        raise SystemExit("route.ts: workDetailMap anchor not found")
    r = r.replace(old_m, new_m, 1)

    old_meta = """        ambiguityLevel: level,
        aiGateChoice,
        trialsPerWork,
        durationSeconds,
      },
    });"""
    if old_meta not in r:
        raise SystemExit("route.ts: metadata block not found")
    r = r.replace(
        old_meta,
        """        ambiguityLevel: level,
        aiGateChoice,
        trialsPerWork,
        durationSeconds,
        minPopularity,
      },
    });""",
        1,
    )

    route.write_text(r, encoding="utf-8")

    # --- mvpConfig.json ---
    cfgp = ROOT / "config" / "mvpConfig.json"
    cfg = cfgp.read_text(encoding="utf-8")
    needle_json = '    "hardConfidenceMin": 0.6\n  },\n  "algo"'
    if needle_json not in cfg:
        raise SystemExit("mvpConfig.json: anchor not found or already patched")
    cfgp.write_text(
        cfg.replace(
            needle_json,
            '''    "hardConfidenceMin": 0.6,
    "hardConfidenceMinByPhase": {
      "enabled": true,
      "minPopularityBase": 50,
      "phases": {
        "q20": 0.85,
        "q25": 0.75,
        "q30": 0.65
      }
    }
  },
  "algo"''',
            1,
        ),
        encoding="utf-8",
    )

    # --- simulationWorkerRunner ---
    runner = ROOT / "src" / "server" / "simulation" / "simulationWorkerRunner.ts"
    rr = runner.read_text(encoding="utf-8")
    old_deps = """  const configDeps = [
    path.resolve(process.cwd(), 'src/server/config/schema.ts'),
    path.resolve(process.cwd(), 'src/server/config/loader.ts'),
  ];"""
    new_deps = """  const configDeps = [
    path.resolve(process.cwd(), 'src/server/config/schema.ts'),
    path.resolve(process.cwd(), 'src/server/config/loader.ts'),
    path.resolve(process.cwd(), 'src/server/game/engine.ts'),
    path.resolve(process.cwd(), 'src/server/game/confirmHardMin.ts'),
  ];"""
    if old_deps not in rr:
        raise SystemExit("simulationWorkerRunner: deps not found or already patched")
    runner.write_text(rr.replace(old_deps, new_deps, 1), encoding="utf-8")

    # --- page.tsx ---
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
            raise SystemExit("page.tsx: simAmbiguityLevel line not found")
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
            raise SystemExit("page.tsx: simResultModal anchor not found")
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
                        chunkTimings.push({ chunk: batchLevels.indexOf(ambLevel) + 1, doneCount, elapsedMs: Date.now() - simStartTime });
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
                      }
                    }"""
    if old_fetch not in p:
        raise SystemExit("page.tsx: batch fetch block not found or already patched")
    p = p.replace(old_fetch, new_fetch, 1)

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

    # UI: popularity input + checkboxes after sample size row
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

    # Result list: show ambiguity level when present
    row_old = """                        {r.outcome} ({r.questionCount}問)
                        {(r as { errorMessage?: string }).errorMessage && ("""
    row_new = """                        {r.outcome} ({r.questionCount}問)
                        {(r as { ambiguityLevel?: number }).ambiguityLevel != null && (
                          <span style={{ color: '#555', marginLeft: '0.25rem' }}>L{(r as { ambiguityLevel?: number }).ambiguityLevel}</span>
                        )}
                        {(r as { errorMessage?: string }).errorMessage && ("""
    if "ambiguityLevel" not in p or "L{(r as" not in p:
        if row_old in p and "L{(r as" not in p:
            p = p.replace(row_old, row_new, 1)

    page.write_text(p, encoding="utf-8")
    print("OK: schema, engine, route, mvpConfig, runner, page.tsx")


if __name__ == "__main__":
    main()
