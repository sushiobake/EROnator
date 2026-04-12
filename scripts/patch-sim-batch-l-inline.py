# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
t = p.read_text(encoding="utf-8")

old = """              {(() => {
                const rows = simBatchResult.results;
                const byL = new Map<number, typeof rows>();
                for (const r of rows) {
                  const L = (r as { ambiguityLevel?: number }).ambiguityLevel;
                  if (typeof L !== 'number') continue;
                  if (!byL.has(L)) byL.set(L, []);
                  byL.get(L)!.push(r);
                }
                const levelKeys = [...byL.keys()].sort((a, b) => a - b);
                const lFooterStyle: import('react').CSSProperties = {
                  fontSize: '0.68rem',
                  lineHeight: 1.5,
                  color: '#444',
                  marginTop: '0.45rem',
                  textAlign: 'center',
                };
                const lLine = (lv: number, body: import('react').ReactNode) => (
                  <div key={lv} style={{ marginTop: '0.08rem' }}>L{lv} {body}</div>
                );
                return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  background: '#fff',
                  padding: '1rem',
                  borderRadius: '4px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0066cc' }}>
                    {(simBatchResult.successRate * 100).toFixed(1)}%
                  </div>
                  <div style={{ color: '#666' }}>成功率</div>
                  <div style={lFooterStyle}>
                    {levelKeys.length === 0
                      ? <span style={{ color: '#aaa' }}>（L別なし）</span>
                      : levelKeys.map((lv) => {
                          const arr = byL.get(lv)!;
                          const ok = arr.filter((x) => x.success).length;
                          const n = arr.length;
                          const pct = n > 0 ? ((ok / n) * 100).toFixed(1) : '0.0';
                          return lLine(lv, <span style={{ color: '#0066cc', fontWeight: 600 }}>{pct}%</span>);
                        })}
                  </div>
                </div>
                <div style={{
                  background: '#fff',
                  padding: '1rem',
                  borderRadius: '4px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {simBatchResult.successCount}/{simBatchResult.totalTrials}
                  </div>
                  <div style={{ color: '#666' }}>成功/総数</div>
                  <div style={lFooterStyle}>
                    {levelKeys.length === 0
                      ? <span style={{ color: '#aaa' }}>（L別なし）</span>
                      : levelKeys.map((lv) => {
                          const arr = byL.get(lv)!;
                          const ok = arr.filter((x) => x.success).length;
                          const n = arr.length;
                          return lLine(lv, <span style={{ fontWeight: 600 }}>{ok}/{n}</span>);
                        })}
                  </div>
                </div>
                <div style={{
                  background: '#fff',
                  padding: '1rem',
                  borderRadius: '4px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {simBatchResult.avgQuestions.toFixed(1)}
                  </div>
                  <div style={{ color: '#666' }}>平均質問数</div>
                  <div style={lFooterStyle}>
                    {levelKeys.length === 0
                      ? <span style={{ color: '#aaa' }}>（L別なし）</span>
                      : levelKeys.map((lv) => {
                          const arr = byL.get(lv)!;
                          const n = arr.length;
                          const avgQ = n > 0 ? Math.round((arr.reduce((s, x) => s + x.questionCount, 0) / n) * 10) / 10 : 0;
                          return lLine(lv, <span style={{ fontWeight: 600 }}>{avgQ}</span>);
                        })}
                  </div>
                </div>
                <div style={{
                  background: '#fff',
                  padding: '1rem',
                  borderRadius: '4px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c62828' }}>
                    {simBatchResult.results.filter(r => !r.success).length}
                  </div>
                  <div style={{ color: '#666' }}>失敗数</div>
                  <div style={lFooterStyle}>
                    {levelKeys.length === 0
                      ? <span style={{ color: '#aaa' }}>（L別なし）</span>
                      : levelKeys.map((lv) => {
                          const arr = byL.get(lv)!;
                          const fail = arr.filter((x) => !x.success).length;
                          return lLine(lv, <span style={{ color: fail > 0 ? '#c62828' : '#333', fontWeight: 600 }}>{fail}</span>);
                        })}
                  </div>
                </div>
              </div>
                );
              })()}"""

new = """              {(() => {
                const rows = simBatchResult.results;
                const byL = new Map<number, typeof rows>();
                for (const r of rows) {
                  const L = (r as { ambiguityLevel?: number }).ambiguityLevel;
                  if (typeof L !== 'number') continue;
                  if (!byL.has(L)) byL.set(L, []);
                  byL.get(L)!.push(r);
                }
                const levelKeys = [...byL.keys()].sort((a, b) => a - b);
                const lRowStyle: import('react').CSSProperties = {
                  fontSize: '0.64rem',
                  lineHeight: 1.25,
                  color: '#444',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.2rem 0.4rem',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flex: '1 1 0',
                  minWidth: 0,
                  textAlign: 'right',
                };
                return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  background: '#fff',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  minWidth: 0,
                }}>
                  <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0066cc', lineHeight: 1.1 }}>
                      {(simBatchResult.successRate * 100).toFixed(1)}%
                    </div>
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>成功率</div>
                  </div>
                  <div style={lRowStyle}>
                    {levelKeys.length === 0 ? (
                      <span style={{ color: '#aaa' }}>（L別なし）</span>
                    ) : (
                      levelKeys.map((lv) => {
                        const arr = byL.get(lv)!;
                        const ok = arr.filter((x) => x.success).length;
                        const n = arr.length;
                        const pct = n > 0 ? ((ok / n) * 100).toFixed(1) : '0.0';
                        return (
                          <span key={lv} style={{ whiteSpace: 'nowrap' }}>
                            L{lv}{' '}
                            <span style={{ color: '#0066cc', fontWeight: 600 }}>{pct}%</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div style={{
                  background: '#fff',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  minWidth: 0,
                }}>
                  <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1.1 }}>
                      {simBatchResult.successCount}/{simBatchResult.totalTrials}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>成功/総数</div>
                  </div>
                  <div style={lRowStyle}>
                    {levelKeys.length === 0 ? (
                      <span style={{ color: '#aaa' }}>（L別なし）</span>
                    ) : (
                      levelKeys.map((lv) => {
                        const arr = byL.get(lv)!;
                        const ok = arr.filter((x) => x.success).length;
                        const n = arr.length;
                        return (
                          <span key={lv} style={{ whiteSpace: 'nowrap' }}>
                            L{lv}{' '}
                            <span style={{ fontWeight: 600 }}>{ok}/{n}</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div style={{
                  background: '#fff',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  minWidth: 0,
                }}>
                  <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1.1 }}>
                      {simBatchResult.avgQuestions.toFixed(1)}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>平均質問数</div>
                  </div>
                  <div style={lRowStyle}>
                    {levelKeys.length === 0 ? (
                      <span style={{ color: '#aaa' }}>（L別なし）</span>
                    ) : (
                      levelKeys.map((lv) => {
                        const arr = byL.get(lv)!;
                        const n = arr.length;
                        const avgQ = n > 0 ? Math.round((arr.reduce((s, x) => s + x.questionCount, 0) / n) * 10) / 10 : 0;
                        return (
                          <span key={lv} style={{ whiteSpace: 'nowrap' }}>
                            L{lv}{' '}
                            <span style={{ fontWeight: 600 }}>{avgQ}</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
                <div style={{
                  background: '#fff',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '4px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  minWidth: 0,
                }}>
                  <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c62828', lineHeight: 1.1 }}>
                      {simBatchResult.results.filter(r => !r.success).length}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>失敗数</div>
                  </div>
                  <div style={lRowStyle}>
                    {levelKeys.length === 0 ? (
                      <span style={{ color: '#aaa' }}>（L別なし）</span>
                    ) : (
                      levelKeys.map((lv) => {
                        const arr = byL.get(lv)!;
                        const fail = arr.filter((x) => !x.success).length;
                        return (
                          <span key={lv} style={{ whiteSpace: 'nowrap' }}>
                            L{lv}{' '}
                            <span style={{ color: fail > 0 ? '#c62828' : '#333', fontWeight: 600 }}>{fail}</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
                );
              })()}"""

if old not in t:
    raise SystemExit("block not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("ok")
