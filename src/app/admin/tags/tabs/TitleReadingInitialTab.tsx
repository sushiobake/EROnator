/**
 * 作品頭文字チェック・編集タブ
 * 漢字始まりの作品のみ表示。50音順、1000件/ページ。
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WorkRow {
  workId: string;
  title: string;
  titleReadingInitial: string;
  titleReadingInitialConfirmed: boolean;
}

interface Props {
  adminToken: string;
}

/** カタカナ1文字をひらがなに変換（表示用） */
function katakanaToHiragana(c: string): string {
  if (!c || c.length === 0) return c;
  const code = c.codePointAt(0) ?? 0;
  if (code >= 0x30a1 && code <= 0x30f6) {
    return String.fromCodePoint(code - 0x60);
  }
  if (c === 'ー' || code === 0x30fc) return 'ー';
  return c;
}

/** ひらがな1文字をカタカナに変換（保存用） */
function hiraganaToKatakana(c: string): string {
  if (!c || c.length === 0) return c;
  const code = c.codePointAt(0) ?? 0;
  if (code >= 0x3041 && code <= 0x3096) {
    return String.fromCodePoint(code + 0x60);
  }
  if (c === 'ー' || code === 0x30fc) return 'ー';
  return c;
}

export default function TitleReadingInitialTab({ adminToken }: Props) {
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(true);
  const [includeConfirmed, setIncludeConfirmed] = useState(false);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [editMainValue, setEditMainValue] = useState('');
  const [editSubValue, setEditSubValue] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [expandedTitleWorkId, setExpandedTitleWorkId] = useState<string | null>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  const fetchWorks = useCallback(async () => {
    if (!adminToken) {
      setWorks([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(includeUnconfirmed && { includeUnconfirmed: '1' }),
        ...(includeConfirmed && { includeConfirmed: '1' }),
      });
      const res = await fetch(`/api/admin/title-reading-initial?${params}`, {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.success) {
        setWorks(data.works ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } else {
        setWorks([]);
      }
    } catch (e) {
      console.error(e);
      setWorks([]);
    } finally {
      setLoading(false);
    }
  }, [adminToken, page, includeUnconfirmed, includeConfirmed]);

  useEffect(() => {
    void fetchWorks();
  }, [fetchWorks]);

  useEffect(() => {
    if (!expandedTitleWorkId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedTitleWorkId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedTitleWorkId]);

  const parseInitials = (raw: string): { main: string; sub: string } => {
    const parts = (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
    return { main: parts[0] ?? '', sub: parts[1] ?? '' };
  };

  const handleEdit = (w: WorkRow) => {
    setEditingWorkId(w.workId);
    const { main, sub } = parseInitials(w.titleReadingInitial || '');
    setEditMainValue(main);
    setEditSubValue(sub);
  };

  const handleSaveEdit = async () => {
    if (!editingWorkId || !adminToken) return;
    const mainRaw = editMainValue.trim().slice(0, 1);
    if (!mainRaw) {
      setEditingWorkId(null);
      return;
    }
    const main = /[ぁ-んー]/.test(mainRaw) ? hiraganaToKatakana(mainRaw) : mainRaw;
    const subRaw = editSubValue.trim().slice(0, 1);
    const sub = subRaw ? (/[ぁ-んー]/.test(subRaw) ? hiraganaToKatakana(subRaw) : subRaw) : '';
    const toSave = sub ? `${main},${sub}` : main;
    try {
      const res = await fetch('/api/admin/title-reading-initial', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          workId: editingWorkId,
          titleReadingInitial: toSave,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWorks((prev) =>
          prev.map((w) =>
            w.workId === editingWorkId ? { ...w, titleReadingInitial: toSave } : w
          )
        );
        setEditingWorkId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkConfirm = async () => {
    if (!adminToken || works.length === 0) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/admin/title-reading-initial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ workIds: works.map((w) => w.workId) }),
      });
      const data = await res.json();
      if (data.success) {
        void fetchWorks();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section style={{ marginBottom: '0.75rem' }}>
      <h2 style={{ marginBottom: '0.35rem', fontSize: '1.1rem', fontWeight: 600 }}>作品頭文字</h2>
      <p style={{ color: '#666', marginBottom: '0.35rem' }}>
        漢字始まりの作品のみ表示（コメント取得済み or ゲーム使用 or タグ済み）。頭文字を確認・編集し、確認済みにすると一覧から非表示になります。
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeUnconfirmed}
            onChange={(e) => {
              setIncludeUnconfirmed(e.target.checked);
              setPage(1);
            }}
          />
          <span>未確認</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeConfirmed}
            onChange={(e) => {
              setIncludeConfirmed(e.target.checked);
              setPage(1);
            }}
          />
          <span>確認済み</span>
        </label>
        <button
          type="button"
          onClick={() => void fetchWorks()}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
        >
          50音順に並べる
        </button>
        <button
          type="button"
          onClick={() => void handleBulkConfirm()}
          disabled={works.length === 0 || confirming}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.9rem',
            backgroundColor: works.length === 0 || confirming ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: works.length === 0 || confirming ? 'not-allowed' : 'pointer',
          }}
        >
          {confirming ? '処理中...' : `この${works.length}件をまとめて確認済み`}
        </button>
      </div>

      {!adminToken ? (
        <p style={{ color: '#666' }}>アクセス認証（管理トークン）を入力してください。</p>
      ) : loading ? (
        <p>読み込み中...</p>
      ) : works.length === 0 ? (
        <p style={{ color: '#666' }}>表示する作品がありません。</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '0.4rem 0.8rem' }}
            >
              前へ
            </button>
            <span style={{ fontSize: '0.9rem' }}>
              ページ {page} / {totalPages}（全{total}件）
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '0.4rem 0.8rem' }}
            >
              次へ
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gridTemplateRows: 'repeat(20, auto)',
              gridAutoFlow: 'column',
              gap: '0.2rem',
              marginBottom: '0.35rem',
            }}
          >
            {works.map((w) => {
              const { main, sub } = parseInitials(w.titleReadingInitial);
              const isEditing = editingWorkId === w.workId;
              return (
                <div
                  key={w.workId}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '0.1rem 0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.15rem',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.05rem' }}
                    onClick={() => !isEditing && handleEdit(w)}
                  >
                    {isEditing ? (
                      <div
                        ref={editContainerRef}
                        onBlur={(e) => {
                          const related = e.relatedTarget as Node | null;
                          if (related && editContainerRef.current?.contains(related)) return;
                          handleSaveEdit();
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.05rem' }}
                      >
                        <input
                          type="text"
                          value={editMainValue}
                          onChange={(e) => setEditMainValue(e.target.value.slice(0, 1))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') {
                              setEditingWorkId(null);
                              const { main: m, sub: s } = parseInitials(w.titleReadingInitial);
                              setEditMainValue(m);
                              setEditSubValue(s);
                            }
                          }}
                          autoFocus
                          style={{ width: '2em', padding: '0.1rem', fontSize: '0.85rem' }}
                        />
                        <span style={{ color: '#999', fontSize: '0.8rem' }}> </span>
                        <span style={{ color: '#999', fontSize: '0.8rem' }}>(</span>
                        <input
                          type="text"
                          value={editSubValue}
                          onChange={(e) => setEditSubValue(e.target.value.slice(0, 1))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') {
                              setEditingWorkId(null);
                              const { main: m, sub: s } = parseInitials(w.titleReadingInitial);
                              setEditMainValue(m);
                              setEditSubValue(s);
                            }
                          }}
                          placeholder=" "
                          style={{ width: '1.5em', padding: '0.1rem', fontSize: '0.85rem' }}
                        />
                        <span style={{ color: '#999', fontSize: '0.8rem' }}>)</span>
                      </div>
                    ) : (
                      <>
                        <span
                          style={{
                            cursor: 'pointer',
                            padding: '0.1rem 0.05rem',
                            borderRadius: '4px',
                            display: 'inline-block',
                            minWidth: '1.2em',
                            fontSize: '0.85rem',
                          }}
                          title="クリックで編集"
                        >
                          {main ? katakanaToHiragana(main) : '未設定'}
                        </span>
                        <span style={{ color: '#999', fontSize: '0.8rem' }}> </span>
                        <span
                          style={{
                            cursor: 'pointer',
                            padding: '0.1rem 0.05rem',
                            borderRadius: '4px',
                            display: 'inline-block',
                            minWidth: '1.2em',
                            fontSize: '0.85rem',
                            color: sub ? undefined : '#bbb',
                          }}
                          title="クリックで編集（サブ頭文字）"
                        >
                          ({sub ? katakanaToHiragana(sub) : ' '})
                        </span>
                      </>
                    )}
                  </div>
                  <span style={{ color: '#999', fontSize: '0.8rem' }}>｜</span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedTitleWorkId((id) => (id === w.workId ? null : w.workId));
                    }}
                    style={{
                      fontSize: '0.8rem',
                      color: '#333',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      flex: 1,
                      minWidth: 0,
                    }}
                    title="クリックで全文表示"
                  >
                    {(w.title ?? '').slice(0, 10)}
                    {(w.title ?? '').length > 10 && '…'}
                  </div>
                </div>
              );
            })}
          </div>

          {expandedTitleWorkId && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onClick={() => setExpandedTitleWorkId(null)}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '1rem 1.25rem',
                  maxWidth: '90%',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {works.find((w) => w.workId === expandedTitleWorkId)?.title ?? ''}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '0.4rem 0.8rem' }}
            >
              前へ
            </button>
            <span style={{ fontSize: '0.9rem' }}>
              ページ {page} / {totalPages}（全{total}件）
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '0.4rem 0.8rem' }}
            >
              次へ
            </button>
          </div>
        </>
      )}
    </section>
  );
}
