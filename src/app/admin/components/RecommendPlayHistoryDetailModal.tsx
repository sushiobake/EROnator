'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

export type RecommendPlayHistoryAdminRow = {
  id: string;
  recommendSessionId: string;
  sessionStartedAt: string | null;
  clickedFanza: boolean;
  clickedFanzaWorkId?: string | null;
  detailJson: unknown;
  topWorkId: string | null;
  topWorkTitle: string | null;
  createdAt: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}分${s}秒` : `${m}分`;
}

/** 一覧セル用：最終5タグの短い要約 */
export function formatRecommendFinalFiveSummary(detailJson: unknown): string {
  const d = asRecord(detailJson);
  const rf = d?.rankedFinal;
  if (!Array.isArray(rf) || rf.length === 0) return '—';
  const sorted = [...rf].sort(
    (a, b) =>
      Number((a as Record<string, unknown>).rank ?? 0) - Number((b as Record<string, unknown>).rank ?? 0)
  );
  return sorted
    .map((x) => {
      const o = x as Record<string, unknown>;
      const rank = o.rank;
      const name = String(o.displayName ?? o.tagKey ?? '?');
      return `${rank}位:${name}`;
    })
    .join(' · ');
}

const POPULARITY_JA: Record<string, string> = {
  famous: 'やっぱり有名作品',
  hidden: '隠れた名作',
  middle: '中間くらい',
};

const STEP_HINT: Record<string, string> = {
  initial: '人気帯・カテゴリ優先',
  aiGate: 'AIゲート',
  sort1: '有名タグ並べ替え',
  sort2: '後半タグ並べ替え',
  thinking: '考え中',
  results: '結果一覧',
  s4: '後半1/5',
  s5: '後半2/5',
  s6: '後半3/5',
  s7: '後半4/5',
  s8: '後半5/5',
};

function buildStepDwellings(
  detail: Record<string, unknown>
): Array<{ step: string; durationMs: number }> {
  const raw = detail.stepTransitions;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const pairs = raw
    .map((x) => {
      const o = x as Record<string, unknown>;
      const step = String(o.step ?? '');
      const at = Number(o.at);
      return { step, at: Number.isFinite(at) ? at : NaN };
    })
    .filter((x) => x.step && Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at);
  const endedAt = detail.endedAt ? new Date(String(detail.endedAt)).getTime() : NaN;
  const endMs = Number.isFinite(endedAt) ? endedAt : pairs.length ? pairs[pairs.length - 1].at : NaN;
  const out: Array<{ step: string; durationMs: number }> = [];
  for (let i = 0; i < pairs.length; i++) {
    const nextAt = i + 1 < pairs.length ? pairs[i + 1].at : endMs;
    const durationMs = Number.isFinite(nextAt) ? Math.max(0, nextAt - pairs[i].at) : 0;
    out.push({ step: pairs[i].step, durationMs });
  }
  return out;
}

const cellDense: CSSProperties = {
  padding: '2px 6px',
  fontSize: '0.72rem',
  lineHeight: 1.35,
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'top',
};

const thDense: CSSProperties = {
  ...cellDense,
  background: '#f3f4f6',
  fontWeight: 600,
  color: '#374151',
  borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap',
};

function Section({ title, children, dense }: { title: string; children: React.ReactNode; dense?: boolean }) {
  return (
    <section style={{ marginBottom: dense ? '0.45rem' : '0.55rem' }}>
      <h3
        style={{
          margin: '0 0 0.25rem',
          fontSize: '0.82rem',
          color: '#1f2937',
          fontWeight: 700,
          borderLeft: '3px solid #7c3aed',
          paddingLeft: 6,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export function RecommendPlayHistoryDetailModal({
  row,
  onClose,
}: {
  row: RecommendPlayHistoryAdminRow;
  onClose: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const detail = useMemo(() => asRecord(row.detailJson) ?? {}, [row.detailJson]);
  const dwell = useMemo(() => buildStepDwellings(detail), [detail]);

  const rankedFinal = Array.isArray(detail.rankedFinal) ? detail.rankedFinal : [];
  const rankedFamous = Array.isArray(detail.rankedFamous) ? detail.rankedFamous : [];
  const selectedFamous = Array.isArray(detail.selectedFamous) ? detail.selectedFamous : [];
  const selectedUnknown = Array.isArray(detail.selectedUnknown) ? detail.selectedUnknown : [];
  const recommendedWorks = Array.isArray(detail.recommendedWorks) ? detail.recommendedWorks : [];

  const sort1 = asRecord(detail.sort1Ranks);
  const sort2 = asRecord(detail.sort2Ranks);
  const sort1Entries = sort1
    ? Object.entries(sort1).sort((a, b) => Number(a[1]) - Number(b[1]))
    : [];
  const sort2Entries = sort2
    ? Object.entries(sort2).sort((a, b) => Number(a[1]) - Number(b[1]))
    : [];

  const totalMatched = detail.totalMatched;
  const popularityChoice = String(detail.popularityChoice ?? '');
  const priorityOrder = Array.isArray(detail.priorityOrder) ? detail.priorityOrder : [];
  const aiGateChoice = detail.aiGateChoice;
  const isMobile = detail.isMobile;

  const clickedWid = row.clickedFanzaWorkId ?? null;

  const rawJson =
    row.detailJson != null && typeof row.detailJson === 'object'
      ? JSON.stringify(row.detailJson, null, 2)
      : String(row.detailJson ?? '');

  const rankedFinalSorted = [...rankedFinal].sort(
    (a, b) =>
      Number((a as Record<string, unknown>).rank ?? 0) - Number((b as Record<string, unknown>).rank ?? 0)
  );

  const displayNameByTagKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of [...rankedFinal, ...rankedFamous, ...selectedFamous, ...selectedUnknown]) {
      const o = x as Record<string, unknown>;
      const k = String(o.tagKey ?? '');
      const n = String(o.displayName ?? '');
      if (k && n && !m.has(k)) m.set(k, n);
    }
    return m;
  }, [rankedFinal, rankedFamous, selectedFamous, selectedUnknown]);

  const sortRowsMax = Math.max(sort1Entries.length, sort2Entries.length, 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '10px',
          width: '96vw',
          maxWidth: '980px',
          height: '92vh',
          maxHeight: '900px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: '1rem' }}>推薦プレイ詳細</strong>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.3rem 0.75rem',
              background: '#4b5563',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.88rem',
            }}
          >
            閉じる
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: '0.5rem 0.65rem 0.65rem' }}>
          {/* メタ：極小テーブル */}
          <Section title="メタ・セッション" dense>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellDense, width: '22%', color: '#6b7280' }}>sessionId</td>
                  <td
                    colSpan={3}
                    style={{
                      ...cellDense,
                      wordBreak: 'break-all',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.68rem',
                    }}
                  >
                    {row.recommendSessionId}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellDense, color: '#6b7280' }}>記録日時</td>
                  <td style={cellDense}>{row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}</td>
                  <td style={{ ...cellDense, width: '18%', color: '#6b7280' }}>推薦開始</td>
                  <td style={cellDense}>
                    {row.sessionStartedAt ? new Date(row.sessionStartedAt).toLocaleString('ja-JP') : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellDense, color: '#6b7280' }}>総滞在</td>
                  <td style={cellDense}>
                    {typeof detail.totalDurationMs === 'number' ? formatMs(detail.totalDurationMs) : '—'}
                  </td>
                  <td style={{ ...cellDense, color: '#6b7280' }}>母集団</td>
                  <td style={cellDense}>{totalMatched != null ? String(totalMatched) : '—'}</td>
                </tr>
                <tr>
                  <td style={{ ...cellDense, color: '#6b7280' }}>端末</td>
                  <td style={cellDense}>{isMobile === true ? 'モバイル' : isMobile === false ? 'PC' : '—'}</td>
                  <td style={{ ...cellDense, color: '#6b7280' }}>FANZA</td>
                  <td style={cellDense}>
                    {row.clickedFanza
                      ? clickedWid
                        ? `あり · ${clickedWid}`
                        : 'あり（ID不明・旧）'
                      : 'なし'}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellDense, color: '#6b7280' }}>API1位</td>
                  <td colSpan={3} style={cellDense}>
                    {row.topWorkTitle ?? row.topWorkId ?? '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* 初期回答：1テーブル */}
          <Section title="初期の答え" dense>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellDense, width: '22%', color: '#6b7280' }}>人気の好み</td>
                  <td style={cellDense}>{(POPULARITY_JA[popularityChoice] ?? popularityChoice) || '—'}</td>
                </tr>
                <tr>
                  <td style={{ ...cellDense, color: '#6b7280' }}>カテゴリ優先</td>
                  <td style={cellDense}>
                    {priorityOrder.length > 0 ? priorityOrder.map((x) => String(x)).join(' → ') : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ ...cellDense, color: '#6b7280' }}>AIゲート</td>
                  <td style={cellDense}>
                    {aiGateChoice != null && aiGateChoice !== '' ? String(aiGateChoice) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ステップ滞在：コンパクト（略号＋ツールチップ） */}
          {dwell.length > 0 ? (
            <Section title="画面ステップごとの滞在（概算）" dense>
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.65rem', color: '#9ca3af', lineHeight: 1.3 }}>
                遷移時刻の差分。末尾は結果画面まで含む。
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thDense, textAlign: 'left', width: '28%' }}>step</th>
                    <th style={{ ...thDense, textAlign: 'right', width: '14%' }}>滞在</th>
                    <th style={{ ...thDense, textAlign: 'left' }}>メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {dwell.map((d, i) => (
                    <tr key={`${d.step}-${i}`}>
                      <td
                        style={{ ...cellDense, fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem' }}
                        title={STEP_HINT[d.step] ?? ''}
                      >
                        {d.step}
                      </td>
                      <td style={{ ...cellDense, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {formatMs(d.durationMs)}
                      </td>
                      <td style={{ ...cellDense, color: '#6b7280', fontSize: '0.68rem' }}>
                        {STEP_HINT[d.step] ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {/* タグ系：両方あるときだけ横並び */}
          {(rankedFamous.length > 0 || selectedFamous.length > 0 || selectedUnknown.length > 0) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  rankedFamous.length > 0 && (selectedFamous.length > 0 || selectedUnknown.length > 0)
                    ? 'minmax(0,1fr) minmax(0,1fr)'
                    : 'minmax(0,1fr)',
                gap: '0.35rem 0.6rem',
                marginBottom: '0.45rem',
              }}
            >
              {rankedFamous.length > 0 ? (
                <Section title="有名タグ（順位付け）" dense>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thDense, textAlign: 'center', width: '2rem' }}>#</th>
                        <th style={{ ...thDense, textAlign: 'left' }}>タグ</th>
                        <th style={{ ...thDense, textAlign: 'left', width: '30%' }}>カテゴリ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...rankedFamous]
                        .sort(
                          (a, b) =>
                            Number((a as Record<string, unknown>).rank ?? 0) -
                            Number((b as Record<string, unknown>).rank ?? 0)
                        )
                        .map((x, i) => {
                          const o = x as Record<string, unknown>;
                          return (
                            <tr key={i}>
                              <td style={{ ...cellDense, textAlign: 'center' }}>{String(o.rank ?? '')}</td>
                              <td style={cellDense}>{String(o.displayName ?? o.tagKey ?? '?')}</td>
                              <td style={{ ...cellDense, color: '#6b7280', fontSize: '0.68rem' }}>
                                {o.category != null ? String(o.category) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </Section>
              ) : null}
              {selectedFamous.length > 0 || selectedUnknown.length > 0 ? (
                <Section title="画面で選択したタグ" dense>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {selectedFamous.length > 0 ? (
                        <tr>
                          <td style={{ ...cellDense, width: '28%', color: '#6b7280', whiteSpace: 'nowrap' }}>有名</td>
                          <td style={cellDense}>
                            {selectedFamous.map((x, i) => {
                              const o = x as Record<string, unknown>;
                              const imp = o.important ? '★' : '';
                              return (
                                <span key={i} style={{ marginRight: 6, fontSize: '0.72rem' }}>
                                  {imp}
                                  {String(o.displayName ?? o.tagKey ?? '?')}
                                </span>
                              );
                            })}
                          </td>
                        </tr>
                      ) : null}
                      {selectedUnknown.length > 0 ? (
                        <tr>
                          <td style={{ ...cellDense, color: '#6b7280' }}>後半</td>
                          <td style={cellDense}>
                            {selectedUnknown.map((x, i) => {
                              const o = x as Record<string, unknown>;
                              const imp = o.important ? '★' : '';
                              return (
                                <span key={i} style={{ marginRight: 6, fontSize: '0.72rem' }}>
                                  {imp}
                                  {String(o.displayName ?? o.tagKey ?? '?')}
                                </span>
                              );
                            })}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </Section>
              ) : null}
            </div>
          )}

          {/* 並べ替え1・2：横並びミニ表 */}
          {sortRowsMax > 0 ? (
            <Section title="並べ替え（最終順）" dense>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th colSpan={2} style={{ ...thDense, textAlign: 'left', background: '#ede9fe', color: '#5b21b6' }}>
                        sort1 · 有名
                      </th>
                    </tr>
                    <tr>
                      <th style={{ ...thDense, width: '2rem' }}>#</th>
                      <th style={{ ...thDense, textAlign: 'left' }}>tagKey / 表示名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sort1Entries.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ ...cellDense, color: '#9ca3af' }}>
                          なし
                        </td>
                      </tr>
                    ) : (
                      sort1Entries.map(([tagKey, rank]) => (
                        <tr key={tagKey}>
                          <td style={{ ...cellDense, textAlign: 'center' }}>{String(rank)}</td>
                          <td style={cellDense}>
                            <code style={{ fontSize: '0.65rem' }}>{tagKey}</code>
                            {displayNameByTagKey.has(tagKey) ? (
                              <span style={{ color: '#6b7280', fontSize: '0.68rem' }}>
                                {' '}
                                · {displayNameByTagKey.get(tagKey)}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th colSpan={2} style={{ ...thDense, textAlign: 'left', background: '#ede9fe', color: '#5b21b6' }}>
                        sort2 · 後半
                      </th>
                    </tr>
                    <tr>
                      <th style={{ ...thDense, width: '2rem' }}>#</th>
                      <th style={{ ...thDense, textAlign: 'left' }}>tagKey / 表示名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sort2Entries.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ ...cellDense, color: '#9ca3af' }}>
                          なし
                        </td>
                      </tr>
                    ) : (
                      sort2Entries.map(([tagKey, rank]) => (
                        <tr key={tagKey}>
                          <td style={{ ...cellDense, textAlign: 'center' }}>{String(rank)}</td>
                          <td style={cellDense}>
                            <code style={{ fontSize: '0.65rem' }}>{tagKey}</code>
                            {displayNameByTagKey.has(tagKey) ? (
                              <span style={{ color: '#6b7280', fontSize: '0.68rem' }}>
                                {' '}
                                · {displayNameByTagKey.get(tagKey)}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          {/* 最終5：1行ヘッダ表 */}
          {rankedFinalSorted.length > 0 ? (
            <Section title="最終5タグ（スコア用）" dense>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <th key={n} style={{ ...thDense, textAlign: 'center', fontSize: '0.7rem' }}>
                        {n}位
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const o = rankedFinalSorted.find(
                        (x) => Number((x as Record<string, unknown>).rank) === n
                      ) as Record<string, unknown> | undefined;
                      return (
                        <td key={n} style={{ ...cellDense, textAlign: 'center', fontSize: '0.72rem' }}>
                          {o ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{String(o.displayName ?? o.tagKey ?? '?')}</div>
                              {o.category ? (
                                <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>{String(o.category)}</div>
                              ) : null}
                            </>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </Section>
          ) : null}

          {recommendedWorks.length > 0 ? (
            <Section title="推薦作品（10件）" dense>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ ...thDense, textAlign: 'center', width: '2rem' }}>#</th>
                      <th style={{ ...thDense, textAlign: 'left' }}>タイトル</th>
                      <th style={{ ...thDense, textAlign: 'left', width: '22%' }}>サークル</th>
                      <th style={{ ...thDense, textAlign: 'right', width: '3.5rem' }}>好み%</th>
                      <th style={{ ...thDense, textAlign: 'center', width: '3rem' }}>FANZA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendedWorks.map((x, i) => {
                      const w = x as Record<string, unknown>;
                      const workId = String(w.workId ?? '');
                      const isClick = Boolean(clickedWid && workId && clickedWid === workId);
                      const url = w.productUrl != null && String(w.productUrl).trim() ? String(w.productUrl) : '';
                      return (
                        <tr
                          key={workId || i}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            background: isClick ? '#ecfdf5' : undefined,
                          }}
                        >
                          <td style={{ ...cellDense, textAlign: 'center' }}>{i + 1}</td>
                          <td style={{ ...cellDense, maxWidth: 0 }}>
                            <span style={{ fontSize: '0.74rem' }}>{w.title != null ? String(w.title) : '—'}</span>
                            {isClick ? (
                              <span style={{ marginLeft: 4, fontSize: '0.65rem', color: '#047857', fontWeight: 700 }}>
                                クリック
                              </span>
                            ) : null}
                          </td>
                          <td style={{ ...cellDense, fontSize: '0.7rem' }}>
                            {w.authorName != null ? String(w.authorName) : '—'}
                          </td>
                          <td style={{ ...cellDense, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {typeof w.matchRate === 'number' ? `${w.matchRate.toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ ...cellDense, textAlign: 'center' }}>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: '#2563eb' }}>
                                開く
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          <div style={{ marginTop: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              style={{
                padding: '0.22rem 0.5rem',
                fontSize: '0.72rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {showRaw ? '生JSONを隠す' : '生JSON'}
            </button>
            {showRaw ? (
              <pre
                style={{
                  marginTop: 6,
                  padding: '0.5rem',
                  background: '#fafafa',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: '0.65rem',
                  overflow: 'auto',
                  maxHeight: 220,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {rawJson}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
