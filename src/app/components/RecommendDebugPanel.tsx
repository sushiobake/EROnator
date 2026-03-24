/**
 * 推薦モード用デバッグパネル（ローカル専用）
 * エロネイター本編の DebugPanel と同じ形
 */

'use client';

import { useMediaQuery } from './useMediaQuery';

export type RecommendDebugPhase = 'q4' | 'results';

export type RecommendDebugDataQ4 = {
  phase: 'q4';
  selectedFamous: Array<{ tagKey: string; displayName: string; weight: number; important: boolean }>;
  unknownTagsWithCount: Array<{ tagKey: string; displayName: string; count: number }>;
};

/** 1作品分の計算内訳（API debug と同期） */
export type RecommendScoringFormulaDebug = {
  workPopularityBase: number;
  targetPop: number;
  maxPop: number;
  distanceToTarget: number;
  popAlign: number;
  tagMatchRatio: number;
  weightedMatchSum: number | null;
  maxPossibleWeight: number | null;
  matchedTagCount: number;
  totalSelectedTags: number;
  base: number;
  tagMultiplier: number;
  popMultiplier: number;
  tagPortion: number;
  popPortion: number;
  sumBeforeClamp: number;
  totalAfterClamp: number;
  matchRateRounded: number;
};

export type RecommendScoringContextDebug = {
  popularityChoice: string;
  popularityChoiceLabel: string;
  useNewScoring: boolean;
  maxPossibleWeight: number | null;
  formulaLine: string;
};

export type RecommendDebugMatchedTag = {
  tagKey: string;
  displayName: string;
  weight: number;
  source: string;
};

export type RecommendDebugDataResults = {
  phase: 'results';
  tagsWithWeights: Array<{ tagKey: string; displayName: string; weight: number; source: string }>;
  works: Array<{
    workId: string;
    title: string;
    matchRate: number;
    score: number;
    tags: Array<{ tagKey: string; displayName: string }>;
    matchedTags?: RecommendDebugMatchedTag[];
    unmatchedSelected?: RecommendDebugMatchedTag[];
    formula?: RecommendScoringFormulaDebug;
  }>;
  scoringContext?: RecommendScoringContextDebug;
};

export type RecommendDebugData = RecommendDebugDataQ4 | RecommendDebugDataResults;

interface RecommendDebugPanelProps {
  debug: RecommendDebugData | null;
  open: boolean;
  onToggle: () => void;
  /** デバッグ用: 結果表示画面へ強制遷移 */
  onForceNavigateToResults?: () => void;
}

/** 重みを色で区別（ランク5〜1・有名無名の重みをまとめて段階表示） */
function weightChipStyle(weight: number): { background: string; color: string; border: string } {
  if (weight >= 4.5) return { background: '#1b5e20', color: '#fff', border: '1px solid #0d3d14' };
  if (weight >= 3.5) return { background: '#2e7d32', color: '#fff', border: '1px solid #1b5e20' };
  if (weight >= 2.75) return { background: '#1565c0', color: '#fff', border: '1px solid #0d47a1' };
  if (weight >= 2.25) return { background: '#6a1b9a', color: '#fff', border: '1px solid #4a148c' };
  if (weight >= 1.25) return { background: '#00838f', color: '#fff', border: '1px solid #006064' };
  return { background: '#eceff1', color: '#37474f', border: '1px solid #b0bec5' };
}

function WeightChip({ weight, label }: { weight: number; label?: string }) {
  const s = weightChipStyle(weight);
  return (
    <span
      style={{
        ...s,
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '9px',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        marginRight: '4px',
      }}
      title={label ?? `重み ${weight}`}
    >
      w={weight}
    </span>
  );
}

function fmt(n: number, digits = 4): string {
  if (Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

export function RecommendDebugPanel({ debug, open, onToggle, onForceNavigateToResults }: RecommendDebugPanelProps) {
  const isMobile = useMediaQuery(768);

  const topStyle = { top: '20px', left: '20px', width: '640px', maxWidth: 'calc(100vw - 40px)' };

  if (isMobile) return null;

  if (!debug) {
    return (
      <div
        style={{
          position: 'fixed',
          ...topStyle,
          zIndex: 10001,
          backgroundColor: '#fff',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: '#ffc107',
            color: '#000',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={onToggle}
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>推薦デバッグ（データなし）</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{open ? '−' : '+'}</span>
        </div>
        {open && (
          <div style={{ padding: '12px' }}>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
              質問4以降でデバッグ情報が表示されます。
            </p>
            {onForceNavigateToResults && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={onForceNavigateToResults}
                  style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  結果表示へ
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const title = debug.phase === 'q4' ? '推薦デバッグ（質問4）' : '推薦デバッグ（結果）';

  return (
    <div
      style={{
        position: 'fixed',
        ...topStyle,
        zIndex: 10001,
        backgroundColor: '#fff',
        border: '2px solid #0070f3',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '10px 12px',
          backgroundColor: '#0070f3',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{title}</span>
        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div style={{ padding: '6px 8px', overflow: 'auto', minHeight: 0, flex: 1, fontSize: '10px' }}>
          {onForceNavigateToResults && debug.phase !== 'results' && (
            <div style={{ marginBottom: '8px', padding: '6px 8px', backgroundColor: '#e7f3ff', borderRadius: '4px', border: '1px solid #0070f3' }}>
              <button
                type="button"
                onClick={onForceNavigateToResults}
                style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                結果表示へ
              </button>
            </div>
          )}
          {debug.phase === 'q4' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  質問3までに選ばれた有名タグと重み
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タグ</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>重み</th>
                      <th style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd', fontSize: '10px' }}>重要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.selectedFamous.map((t, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.displayName}</td>
                        <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd' }}>{t.weight}</td>
                        <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{t.important ? '★' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  後半タグ候補（未表示有名＋無名を関連度降順・最大100）
                </h3>
                <p style={{ margin: '0 0 6px 0', fontSize: '10px', color: '#555', lineHeight: 1.35 }}>
                  関連度＝前半整理タグを1つ以上持つ作品のうち、そのタグが付いている作品数。
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>#</th>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タグ</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>関連度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.unknownTagsWithCount.map((t, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd' }}>{i + 1}</td>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.displayName}</td>
                        <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd' }}>{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {debug.phase === 'results' && (
            <>
              {debug.scoringContext && (
                <div
                  style={{
                    marginBottom: '10px',
                    padding: '8px 10px',
                    background: '#e8f5e9',
                    border: '1px solid #a5d6a7',
                    borderRadius: '6px',
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '4px', color: '#1b5e20' }}>スコア全体の前提</div>
                  <div>
                    <strong>有名度の答え:</strong> {debug.scoringContext.popularityChoiceLabel}{' '}
                    <span style={{ color: '#666' }}>({debug.scoringContext.popularityChoice})</span>
                  </div>
                  <div>
                    <strong>タグスコア方式:</strong> {debug.scoringContext.useNewScoring ? '重み付き（順位 or 有名/無名）' : 'レガシー（件数比率）'}
                    {debug.scoringContext.maxPossibleWeight != null && (
                      <span style={{ marginLeft: '6px', color: '#555' }}>
                        ／ 選択タグの重み合計 = <strong>{debug.scoringContext.maxPossibleWeight}</strong>
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: '4px', fontFamily: 'ui-monospace, monospace', fontSize: '9px', color: '#333', wordBreak: 'break-word' }}>
                    {debug.scoringContext.formulaLine}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  選んだタグと重み（すべて）
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タグ</th>
                      <th style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd', fontSize: '10px' }}>重み</th>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>種別</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.tagsWithWeights.map((t, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.displayName}</td>
                        <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>
                          <WeightChip weight={t.weight} />
                        </td>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  結果トップ10（マッチタグ・計算内訳）
                </h3>
                {debug.works.map((w, wi) => {
                  const f = w.formula;
                  return (
                    <div
                      key={wi}
                      style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e0e0e0' }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
                        {wi + 1}. {w.title}
                      </div>
                      <div style={{ marginBottom: '6px', color: '#0070f3', fontWeight: 600 }}>
                        好みマッチ度: <strong>{w.matchRate}</strong>（表示）／ 並び用スコア: {fmt(w.score, 6)}
                      </div>

                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '3px', color: '#2e7d32' }}>▼ この作品にマッチした選択タグ</div>
                        {(w.matchedTags?.length ?? 0) > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {w.matchedTags!.map((t, ti) => (
                              <div key={ti} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                <WeightChip weight={t.weight} />
                                <span style={{ fontWeight: 600 }}>{t.displayName}</span>
                                <span style={{ color: '#888', fontSize: '9px' }}>({t.source})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#999', fontStyle: 'italic' }}>なし（重み合計への寄与なし）</span>
                        )}
                      </div>

                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '3px', color: '#c62828' }}>▼ 選択したがこの作品に無いタグ</div>
                        {(w.unmatchedSelected?.length ?? 0) > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {w.unmatchedSelected!.map((t, ti) => (
                              <div key={ti} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                <WeightChip weight={t.weight} />
                                <span>{t.displayName}</span>
                                <span style={{ color: '#888', fontSize: '9px' }}>({t.source})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#2e7d32', fontSize: '9px' }}>なし（選択タグはすべてこの作品に付与あり）</span>
                        )}
                      </div>

                      {f && (
                        <div
                          style={{
                            marginTop: '6px',
                            padding: '6px 8px',
                            background: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '9px',
                            lineHeight: 1.5,
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: '4px', color: '#333' }}>計算の内訳</div>
                          <div>
                            <strong>① tagMatchRatio</strong> ={' '}
                            {f.weightedMatchSum != null && f.maxPossibleWeight != null ? (
                              <>
                                重み合計(マッチ) <strong>{fmt(f.weightedMatchSum, 2)}</strong> ÷ 重み合計(全選択){' '}
                                <strong>{f.maxPossibleWeight}</strong> = <strong>{fmt(f.tagMatchRatio, 4)}</strong>
                              </>
                            ) : (
                              <>
                                一致数 <strong>{f.matchedTagCount}</strong> ÷ 選択数 <strong>{f.totalSelectedTags}</strong> ={' '}
                                <strong>{fmt(f.tagMatchRatio, 4)}</strong> <span style={{ color: '#888' }}>（レガシー）</span>
                              </>
                            )}
                          </div>
                          <div>
                            <strong>② popAlign</strong> = 1 − |作品pop <strong>{fmt(f.workPopularityBase, 2)}</strong> − target{' '}
                            <strong>{fmt(f.targetPop, 2)}</strong>| ÷ maxPop <strong>{fmt(f.maxPop, 2)}</strong>
                            <br />
                            <span style={{ paddingLeft: '8px' }}>
                              = 1 − {fmt(f.distanceToTarget, 2)} ÷ {fmt(f.maxPop, 2)} = <strong>{fmt(f.popAlign, 4)}</strong>
                            </span>
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <strong>③ 合成</strong> {f.base} + ({fmt(f.tagMatchRatio, 4)} × {f.tagMultiplier}) + (
                            {fmt(f.popAlign, 4)} × {f.popMultiplier})
                            <br />
                            <span style={{ paddingLeft: '8px' }}>
                              = {f.base} + <strong>{fmt(f.tagPortion, 4)}</strong> + <strong>{fmt(f.popPortion, 4)}</strong> ={' '}
                              <strong>{fmt(f.sumBeforeClamp, 4)}</strong>
                            </span>
                            <br />
                            <span style={{ paddingLeft: '8px', color: '#555' }}>
                              → clamp(50, 100, …) = <strong>{fmt(f.totalAfterClamp, 4)}</strong> → 表示{' '}
                              <strong>{f.matchRateRounded}</strong>
                            </span>
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: '4px', fontSize: '9px', color: '#666' }}>
                        作品の全タグ: {w.tags.map(t => t.displayName).join(', ') || '（なし）'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
