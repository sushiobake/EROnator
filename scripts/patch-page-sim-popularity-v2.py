# -*- coding: utf-8 -*-
"""Sim UI: max popularity, live count, remove 1-10 slider, single ambiguity from checkboxes."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
t = p.read_text(encoding="utf-8")

# 1) Remove simAmbiguityLevel state line
old_state = "  const [simAmbiguityLevel, setSimAmbiguityLevel] = useState<number>(2);\n"
if old_state in t:
    t = t.replace(old_state, "", 1)

# 2) Add simMaxPopularity after simMinPopularity
needle = "  const [simMinPopularity, setSimMinPopularity] = useState(0);\n"
if needle in t and "simMaxPopularity" not in t:
    t = t.replace(needle, needle + "  const [simMaxPopularity, setSimMaxPopularity] = useState(100);\n", 1)

# 3) After toggleSimBatchLevel closing `};` block + blank lines, insert useMemo + useEffect
anchor = """  const toggleSimBatchLevel = (n: number) => {
    setSimBatchAmbiguityLevels((prev) => {
      if (prev.includes(n)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== n).sort((a, b) => a - b);
      }
      return [...prev, n].sort((a, b) => a - b);
    });
  };


  const simEarlyExitOkInline"""
insert = """  const toggleSimBatchLevel = (n: number) => {
    setSimBatchAmbiguityLevels((prev) => {
      if (prev.includes(n)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== n).sort((a, b) => a - b);
      }
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  const simSortedAmbiguityLevels = useMemo(
    () => [...new Set(simBatchAmbiguityLevels)].sort((a, b) => a - b),
    [simBatchAmbiguityLevels]
  );
  const simSingleAmbiguityLevel = simSortedAmbiguityLevels[0] ?? 2;

  useEffect(() => {
    if (!adminToken) return;
    const lo = Math.min(simMinPopularity, simMaxPopularity);
    const hi = Math.max(simMinPopularity, simMaxPopularity);
    const ac = new AbortController();
    const tid = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/simulate?sampleSize=0&minPopularity=${lo}&maxPopularity=${hi}`,
            { headers: { 'x-eronator-admin-token': adminToken }, signal: ac.signal }
          );
          if (!res.ok) return;
          const j = (await res.json()) as { totalFiltered?: number };
          if (typeof j.totalFiltered === 'number') setSimLastTotalFiltered(j.totalFiltered);
        } catch {
          /* aborted or network */
        }
      })();
    }, 400);
    return () => {
      ac.abort();
      window.clearTimeout(tid);
    };
  }, [simMinPopularity, simMaxPopularity, adminToken]);

  const simEarlyExitOkInline"""
if "simSortedAmbiguityLevels" not in t and anchor in t:
    t = t.replace(anchor, insert, 1)

# 4) metadata type on simBatchResult
old_meta = """    metadata?: {
      timestamp: string;
      totalWorksInDb: number;
      sampleSize: number;
      ambiguityLevel?: number;
      aiGateChoice: string;
      trialsPerWork: number;
    };"""
new_meta = """    metadata?: {
      timestamp: string;
      totalWorksInDb: number;
      sampleSize: number;
      ambiguityLevel?: number;
      ambiguityLevels?: number[];
      minPopularity?: number;
      maxPopularity?: number;
      aiGateChoice: string;
      trialsPerWork: number;
      durationSeconds?: number;
    };"""
if old_meta in t:
    t = t.replace(old_meta, new_meta, 1)

# 5) Sample row: remove inline totalFiltered span (moved to popularity block)
old_sample_span = """                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>（0=全件）</span>
                {simLastTotalFiltered != null && (
                  <span style={{ fontSize: '0.8rem', color: '#333', marginLeft: '0.5rem' }}>
                    人気度{simMinPopularity}以上: {simLastTotalFiltered.toLocaleString()}件
                  </span>
                )}
              </div>"""
new_sample_span = """                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>（0=全件）</span>
              </div>"""
if old_sample_span in t:
    t = t.replace(old_sample_span, new_sample_span, 1)

# 6) Popularity min block + add max + count + ETA; remove slider block
old_pop_slider = """              <div>
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
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>曖昧さレベル 1-10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={simAmbiguityLevel}
                  onChange={(e) => setSimAmbiguityLevel(Number(e.target.value))}
                  style={{ width: '120px', verticalAlign: 'middle' }}
                />
                <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>{simAmbiguityLevel}</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>AIゲート</label>"""

new_pop_slider = """              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
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
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>人気度上限</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={simMaxPopularity}
                    onChange={(e) => setSimMaxPopularity(Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))))}
                    style={{ width: '72px', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>（100=上限なし）</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#333', maxWidth: '22rem' }}>
                  {simLastTotalFiltered != null ? (
                    <>
                      <strong>該当 {simLastTotalFiltered.toLocaleString()} 件</strong>
                      <span style={{ color: '#666', marginLeft: '0.35rem' }}>
                        （{Math.min(simMinPopularity, simMaxPopularity)}〜{Math.max(simMinPopularity, simMaxPopularity)}）
                      </span>
                      <div style={{ marginTop: '0.25rem', color: '#555' }}>
                        バッチ試行おおよそ{' '}
                        {(simSampleSize > 0
                          ? Math.min(simSampleSize, simLastTotalFiltered)
                          : simLastTotalFiltered) *
                          simTrialsPerWork *
                          simSortedAmbiguityLevels.length}
                        回（サンプル{simSampleSize > 0 ? `${simSampleSize}件上限` : '全件'}×試行{simTrialsPerWork}×曖昧さ{simSortedAmbiguityLevels.length}種）
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#888' }}>人気度を変えると件数を取得します…</span>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>バッチ曖昧さ（複数可 1–5・単発シミュもこの最小レベルを使用）</label>
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
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>AIゲート</label>"""

if "人気度上限" not in t and old_pop_slider in t:
    t = t.replace(old_pop_slider, new_pop_slider, 1)
elif "人気度上限" in t:
    print("popularity UI already patched")
else:
    raise SystemExit("old_pop_slider block not found")

# 7) ids fetch URL
old_ids = "`/api/admin/simulate?sampleSize=${simSampleSize || 0}&minPopularity=${simMinPopularity}`,"
new_ids = "`/api/admin/simulate?sampleSize=${simSampleSize || 0}&minPopularity=${Math.min(simMinPopularity, simMaxPopularity)}&maxPopularity=${Math.max(simMinPopularity, simMaxPopularity)}`,"
if old_ids in t:
    t = t.replace(old_ids, new_ids, 1)

# 8) batchLevels line
old_bl = """                    const batchLevels = (simBatchAmbiguityLevels.length > 0
                      ? [...new Set(simBatchAmbiguityLevels)].sort((a, b) => a - b)
                      : [simAmbiguityLevel]);"""
new_bl = "                    const batchLevels = [...new Set(simBatchAmbiguityLevels)].sort((a, b) => a - b);"
if old_bl in t:
    t = t.replace(old_bl, new_bl, 1)

# 9) PUT bodies minPopularity add maxPopularity twice
t = t.replace(
    "minPopularity: simMinPopularity,\n                            totalTrials: trialsPerLevel,",
    "minPopularity: simMinPopularity,\n                            maxPopularity: simMaxPopularity,\n                            totalTrials: trialsPerLevel,",
    1,
)
t = t.replace(
    "minPopularity: simMinPopularity,\n                              totalTrials,",
    "minPopularity: simMinPopularity,\n                              maxPopularity: simMaxPopularity,\n                              totalTrials,",
    1,
)

# 10) setSimBatchResult metadata
old_sb = """                      metadata: {
                        timestamp: new Date().toISOString(),
                        sampleSize: workIds.length,
                        totalWorksInDb: totalWorksInDb || (simWorksStats?.gameRegisteredCount ?? 0),
                        ambiguityLevel: simAmbiguityLevel,
                        aiGateChoice: simAiGateChoice,
                        trialsPerWork: simTrialsPerWork,
                        durationSeconds,
                      },
                    } as Parameters<typeof setSimBatchResult>[0]);"""
new_sb = """                      metadata: {
                        timestamp: new Date().toISOString(),
                        sampleSize: workIds.length,
                        totalWorksInDb: totalWorksInDb || (simWorksStats?.gameRegisteredCount ?? 0),
                        ambiguityLevel: batchLevels.length === 1 ? batchLevels[0] : undefined,
                        ambiguityLevels: batchLevels,
                        minPopularity: Math.min(simMinPopularity, simMaxPopularity),
                        maxPopularity: Math.max(simMinPopularity, simMaxPopularity),
                        aiGateChoice: simAiGateChoice,
                        trialsPerWork: simTrialsPerWork,
                        durationSeconds,
                      },
                    } as Parameters<typeof setSimBatchResult>[0]);"""
if old_sb in t:
    t = t.replace(old_sb, new_sb, 1)

# 11) POST retry ambiguityLevel
t = t.replace("ambiguityLevel: simAmbiguityLevel,", "ambiguityLevel: simSingleAmbiguityLevel,", 2)

p.write_text(t, encoding="utf-8")
print("page.tsx ok")
