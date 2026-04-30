'use client';

/**
 * F@NZA王クイズ プロトタイプ 管理ページ（/quiz-prototype/admin）
 * - 手書き作品のみ（tagSource=human）でプールを構築
 * - 「現在使用中」「それ以外（候補）」の2ペインで、相互に移動できる
 *   - 使用中の作品を「除外」 → プール再構築時に同難度帯の別作品が繰り上がる
 *   - 候補の作品を「復帰」 → プール候補に戻る
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { QuizWork } from '@/quiz-prototype/types';

type TagSourceFilter = 'hand' | 'any';

interface PoolPayload {
  works: QuizWork[];
  extras: QuizWork[];
  excluded: string[];
  tagSourceFilter: TagSourceFilter;
  summary: {
    totalCandidates: number;
    totalSelected: number;
    famousCount: number;
    midCount: number;
    minorCount: number;
  };
}

export default function QuizPrototypeAdminPage() {
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PoolPayload | null>(null);
  const [tagSource, setTagSource] = useState<TagSourceFilter>('hand');
  const [query, setQuery] = useState('');

  const loadPool = useCallback(
    async (refresh = false, source: TagSourceFilter = tagSource) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (refresh) params.set('refresh', '1');
        params.set('tagSource', source);
        const res = await fetch(`/api/quiz-prototype/admin/pool?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.message ?? json.error ?? `HTTP ${res.status}`);
          return;
        }
        setData(json as PoolPayload);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [tagSource],
  );

  useEffect(() => {
    void loadPool(false, tagSource);
  }, [loadPool, tagSource]);

  const mutate = useCallback(
    async (workId: string, action: 'exclude' | 'include') => {
      setBusyId(workId);
      setError(null);
      try {
        const res = await fetch('/api/quiz-prototype/admin/exclude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workId, action }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.message ?? json.error ?? `HTTP ${res.status}`);
          return;
        }
        // キャッシュ破棄込みで再取得
        await loadPool(true, tagSource);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [loadPool, tagSource],
  );

  const usedSorted = useMemo(() => {
    if (!data) return [] as QuizWork[];
    const q = query.trim().toLowerCase();
    const src = [...data.works].sort((a, b) => b.popularityBase - a.popularityBase);
    if (!q) return src;
    return src.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.authorName.toLowerCase().includes(q) ||
        w.workId.toLowerCase().includes(q),
    );
  }, [data, query]);

  const extrasSorted = useMemo(() => {
    if (!data) return [] as QuizWork[];
    const q = query.trim().toLowerCase();
    const src = [...data.extras].sort((a, b) => b.popularityBase - a.popularityBase);
    if (!q) return src;
    return src.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.authorName.toLowerCase().includes(q) ||
        w.workId.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div style={{ minHeight: 'calc(100vh - 42px)', background: '#f5f5f7', color: '#1e293b' }}>
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '20px 20px 28px' }}>
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '0.03em' }}>
              F@NZA王クイズ 管理
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              使用中プールから手動で作品をはじく / 復帰させる
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            <Link
              href="/quiz-prototype"
              style={{ color: 'var(--color-text-muted)', textDecoration: 'underline' }}
            >
              トップ
            </Link>
            <Link
              href="/quiz-prototype/play"
              style={{ color: 'var(--color-text-muted)', textDecoration: 'underline' }}
            >
              プレイ
            </Link>
          </div>
        </header>

        {/* コントロール行 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
              background: '#fff',
            }}
          >
            {(['hand', 'any'] as TagSourceFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTagSource(key)}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  border: 'none',
                  background: tagSource === key ? 'var(--color-primary)' : '#fff',
                  color: tagSource === key ? '#fff' : 'var(--color-text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {key === 'hand' ? '手書き作品のみ' : '全作品'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadPool(true, tagSource)}
            disabled={loading}
            style={primaryBtn(loading)}
          >
            {loading ? '再生成中…' : 'プール再生成'}
          </button>

          <input
            type="text"
            placeholder="タイトル / サークル / workId で絞り込み"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              minWidth: 280,
              background: '#fff',
            }}
          />

          {data && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                color: 'var(--color-text-muted)',
                background: '#fff',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
              }}
            >
              候補合計 {data.summary.totalCandidates} / 使用中 {data.summary.totalSelected}（有名
              {data.summary.famousCount} ・ 中堅{data.summary.midCount} ・ マイナー
              {data.summary.minorCount}） ・ 除外 {data.excluded.length}
            </span>
          )}
        </div>

        {error && (
          <p style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</p>
        )}

        {/* 2ペイン */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}
        >
          <WorksPane
            title="現在使用中の作品"
            subtitle="クイズに出題されます"
            works={usedSorted}
            emptyLabel="使用中の作品がありません。プール再生成を試してください。"
            actionLabel="除外する"
            actionColor="#b91c1c"
            busyId={busyId}
            onAction={(w) => void mutate(w.workId, 'exclude')}
            kind="used"
          />
          <WorksPane
            title="それ以外（候補）"
            subtitle="ここから復帰させると次のプール再生成で繰り上がります"
            works={extrasSorted}
            emptyLabel="候補がありません。"
            actionLabel="使用中へ戻す"
            actionColor="#2563eb"
            busyId={busyId}
            onAction={(w) => void mutate(w.workId, 'include')}
            kind="extras"
            excludedIds={data?.excluded ?? []}
          />
        </div>
      </div>
    </div>
  );
}

/** 作品リストペイン（使用中 / 候補で共有） */
function WorksPane({
  title,
  subtitle,
  works,
  emptyLabel,
  actionLabel,
  actionColor,
  busyId,
  onAction,
  kind,
  excludedIds = [],
}: {
  title: string;
  subtitle: string;
  works: QuizWork[];
  emptyLabel: string;
  actionLabel: string;
  actionColor: string;
  busyId: string | null;
  onAction: (w: QuizWork) => void;
  kind: 'used' | 'extras';
  excludedIds?: string[];
}) {
  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds]);

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
        minHeight: 500,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{works.length} 件</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {works.length === 0 ? (
          <p style={{ padding: 20, margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            {emptyLabel}
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {works.map((w, idx) => {
              const isBusy = busyId === w.workId;
              const isExcluded = excludedSet.has(w.workId);
              return (
                <li
                  key={w.workId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                    background: isBusy ? '#f8fafc' : '#fff',
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 100,
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: '#0b0b0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {w.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.thumbnailUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ fontSize: 10, color: '#aaa' }}>no img</span>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                      <TierBadge tier={w.tier} />
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        pop {w.popularityBase}
                      </span>
                      {w.tagSource && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: w.tagSource === 'HAND' ? '#dcfce7' : w.tagSource === 'AI' ? '#fef3c7' : '#f1f5f9',
                            color: w.tagSource === 'HAND' ? '#166534' : w.tagSource === 'AI' ? '#92400e' : '#64748b',
                            fontWeight: 600,
                          }}
                        >
                          {w.tagSource === 'HAND' ? '手書き' : w.tagSource === 'AI' ? 'AI' : w.tagSource}
                        </span>
                      )}
                      {isExcluded && kind === 'extras' && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: '#fee2e2',
                            color: '#991b1b',
                            fontWeight: 600,
                          }}
                        >
                          手動除外
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {w.title}
                    </p>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {w.authorName}
                    </p>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 10,
                        color: 'var(--color-text-subtle)',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                      }}
                    >
                      {w.workId} ・ 画像{w.sampleImages.length}枚 ・ 派生{w.derivedTags.length}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onAction(w)}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: `1px solid ${actionColor}`,
                      background: '#fff',
                      color: actionColor,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                      opacity: isBusy ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {actionLabel}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: QuizWork['tier'] }) {
  const cfg =
    tier === 'famous'
      ? { label: '有名', bg: '#fef9c3', fg: '#854d0e' }
      : tier === 'mid'
        ? { label: '中堅', bg: '#dbeafe', fg: '#1e3a8a' }
        : { label: 'マイナー', bg: '#ede9fe', fg: '#5b21b6' };
  return (
    <span
      style={{
        fontSize: 10,
        padding: '1px 8px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {cfg.label}
    </span>
  );
}

function primaryBtn(disabled: boolean): CSSProperties {
  return {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid var(--color-primary)',
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
