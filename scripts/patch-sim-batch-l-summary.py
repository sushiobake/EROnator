# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
t = p.read_text(encoding="utf-8")

old = """              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0066cc' }}>
                    {(simBatchResult.successRate * 100).toFixed(1)}%
                  </div>
                  <div style={{ color: '#666' }}>成功率</div>
                </div>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {simBatchResult.successCount}/{simBatchResult.totalTrials}
                  </div>
                  <div style={{ color: '#666' }}>成功/総数</div>
                </div>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {simBatchResult.avgQuestions.toFixed(1)}
                  </div>
                  <div style={{ color: '#666' }}>平均質問数</div>
                </div>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c62828' }}>
                    {simBatchResult.results.filter(r => !r.success).length}
                  </div>
                  <div style={{ color: '#666' }}>失敗数</div>
                </div>
              </div>"""

new = """              <div style={{ display: 'flex', gap: '1rem', alignItems: 'stretch', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 360px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', minWidth: 0 }}>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0066cc' }}>
                    {(simBatchResult.successRate * 100).toFixed(1)}%
                  </div>
                  <div style={{ color: '#666' }}>成功率</div>
                </div>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {simBatchResult.successCount}/{simBatchResult.totalTrials}
                  </div>
                  <div style={{ color: '#666' }}>成功/総数</div>
                </div>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {simBatchResult.avgQuestions.toFixed(1)}
                  </div>
                  <div style={{ color: '#666' }}>平均質問数</div>
                </div>
                <div style={{ 
                  background: '#fff', 
                  padding: '1rem', 
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c62828' }}>
                    {simBatchResult.results.filter(r => !r.success).length}
                  </div>
                  <div style={{ color: '#666' }}>失敗数</div>
                </div>
                </div>
                <div style={{ flex: '0 1 200px', fontSize: '0.72rem', lineHeight: 1.45, color: '#333', background: '#fff', padding: '0.55rem 0.65rem', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                  {(() => {
                    const rows = simBatchResult.results;
                    const byL = new Map<number, typeof rows>();
                    for (const r of rows) {
                      const L = (r as { ambiguityLevel?: number }).ambiguityLevel;
                      if (typeof L !== 'number') continue;
                      if (!byL.has(L)) byL.set(L, []);
                      byL.get(L)!.push(r);
                    }
                    const keys = [...byL.keys()].sort((a, b) => a - b);
                    if (keys.length === 0) {
                      return <span style={{ color: '#888' }}>（L別データなし）</span>;
                    }
                    return (
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem', fontSize: '0.75rem', color: '#555' }}>曖昧さ別</div>
                        {keys.map((lv) => {
                          const arr = byL.get(lv)!;
                          const ok = arr.filter((x) => x.success).length;
                          const n = arr.length;
                          const rate = n > 0 ? Math.round((ok / n) * 1000) / 10 : 0;
                          const avgQ = n > 0 ? Math.round((arr.reduce((s, x) => s + x.questionCount, 0) / n) * 10) / 10 : 0;
                          const fail = n - ok;
                          return (
                            <div key={lv} style={{ marginBottom: '0.15rem' }}>
                              <strong>L{lv}</strong>{' '}
                              <span style={{ color: '#0066cc' }}>{rate}%</span>
                              {' '}{ok}/{n}
                              {fail > 0 ? <span style={{ color: '#c62828' }}> 失敗{fail}</span> : null}
                              {' '}問{avgQ}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>"""

if old not in t:
    raise SystemExit("target block not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("ok")
