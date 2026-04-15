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

interface BulkUnconfirmedJson {
  success: boolean;
  error?: string;
  done?: boolean;
  nextCursor?: string | null;
  updated?: number;
  confirmed?: number;
  skipped?: number;
  lowOnly?: number;
  fetchedInBatch?: number;
  kanjiExamined?: number;
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
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);
  const [lastAutoUndoEntries, setLastAutoUndoEntries] = useState<
    Array<{ workId: string; titleReadingInitial: string | null }> | null
  >(null);
  const [revertingAuto, setRevertingAuto] = useState(false);
  const [autoMarkByWorkId, setAutoMarkByWorkId] = useState<
    Record<string, { confidence: 'high' | 'medium' | 'low' | 'skipped'; suggestionHiragana?: string }> | null
  >(null);
  const [expandedTitleWorkId, setExpandedTitleWorkId] = useState<string | null>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  const [bulkAllRunning, setBulkAllRunning] = useState(false);
  const [bulkAllMessage, setBulkAllMessage] = useState<string | null>(null);

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
    setAutoMarkByWorkId(null);
  }, [page, includeUnconfirmed, includeConfirmed]);

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

  const handleAutoFillPage = async () => {
    if (!adminToken || works.length === 0) return;
    setAutoFilling(true);
    setAutoFillMessage(null);
    try {
      const res = await fetch('/api/admin/title-reading-initial/auto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ workIds: works.map((w) => w.workId) }),
      });
      const data = await res.json();
      if (data.success) {
        setLastAutoUndoEntries(Array.isArray(data.undoEntries) ? data.undoEntries : null);
        const rows = Array.isArray(data.results) ? data.results : [];
        const hint: Record<
          string,
          { confidence: 'high' | 'medium' | 'low' | 'skipped'; suggestionHiragana?: string }
        > = {};
        for (const r of rows) {
          if (!r?.workId) continue;
          const conf = r.confidence as string | undefined;
          if (r.applied && (conf === 'high' || conf === 'medium')) {
            hint[r.workId] = { confidence: conf };
            continue;
          }
          if (!r.applied && conf === 'low') {
            const sug = typeof r.suggestedTitleReadingInitial === 'string' ? r.suggestedTitleReadingInitial.trim() : '';
            const parts = sug.split(',').map((p: string) => p.trim()).filter(Boolean);
            const toHira = (one: string): string | undefined => {
              if (one.length !== 1) return undefined;
              const code = one.codePointAt(0) ?? 0;
              if (code >= 0x30a1 && code <= 0x30f6) return String.fromCodePoint(code - 0x60);
              if (code >= 0x3041 && code <= 0x3096) return one;
              return undefined;
            };
            let hira: string | undefined;
            if (parts.length === 2) {
              const a = toHira(parts[0] ?? '');
              const b = toHira(parts[1] ?? '');
              if (a && b) hira = `${a},${b}`;
            } else if (parts.length === 1) {
              hira = toHira(parts[0] ?? '');
            }
            hint[r.workId] = { confidence: 'low', suggestionHiragana: hira };
            continue;
          }
          if (!r.applied && (conf === 'skipped' || conf === 'unchanged')) {
            hint[r.workId] = { confidence: 'skipped' };
          }
        }
        setAutoMarkByWorkId(Object.keys(hint).length ? hint : null);
        const hi = rows.filter((r: { applied?: boolean; confidence?: string }) => r.applied && r.confidence === 'high').length;
        const md = rows.filter((r: { applied?: boolean; confidence?: string }) => r.applied && r.confidence === 'medium').length;
        const lo = rows.filter((r: { applied?: boolean; confidence?: string }) => !r.applied && r.confidence === 'low').length;
        setAutoFillMessage(
          `自動反映: ${data.updated ?? 0}件（高信頼 ${hi} / 要確認 ${md}、候補のみ ${data.lowCandidates ?? lo}、スキップ ${data.skipped ?? 0}）。薄緑＝高信頼、黄＝要確認、赤系＝候補のみ（DB未更新）またはスキップ（要手動確認）。直前の自動だけ「取り消し」できます。`
        );
        void fetchWorks();
      } else {
        setAutoFillMessage(typeof data.error === 'string' ? data.error : '自動判定に失敗しました');
      }
    } catch (e) {
      console.error(e);
      setAutoFillMessage('自動判定に失敗しました');
    } finally {
      setAutoFilling(false);
    }
  };

  const handleRevertLastAuto = async () => {
    if (!adminToken || !lastAutoUndoEntries?.length) return;
    setRevertingAuto(true);
    try {
      const res = await fetch('/api/admin/title-reading-initial/auto/revert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ entries: lastAutoUndoEntries }),
      });
      const data = await res.json();
      if (data.success) {
        setLastAutoUndoEntries(null);
        setAutoMarkByWorkId(null);
        setAutoFillMessage(`直前の自動判定を ${data.restored ?? 0} 件戻しました。`);
        void fetchWorks();
      } else {
        setAutoFillMessage(typeof data.error === 'string' ? data.error : '取り消しに失敗しました');
      }
    } catch (err) {
      console.error(err);
      setAutoFillMessage('取り消しに失敗しました');
    } finally {
      setRevertingAuto(false);
    }
  };

  const handleBulkAllUnconfirmed = async () => {
    if (!adminToken || bulkAllRunning) return;
    setBulkAllRunning(true);
    setBulkAllMessage(null);
    setAutoMarkByWorkId(null);
    let cursor: string | null = null;
    let sumUpdated = 0;
    let sumConfirmed = 0;
    let sumSkipped = 0;
    let sumLow = 0;
    let batches = 0;
    try {
      for (;;) {
        const res: Response = await fetch('/api/admin/title-reading-initial/auto/bulk-unconfirmed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-eronator-admin-token': adminToken,
          },
          body: JSON.stringify({ cursor: cursor ?? undefined, confirmNonRed: true }),
        });
        const data = (await res.json()) as BulkUnconfirmedJson;
        if (!data.success) {
          setBulkAllMessage(typeof data.error === 'string' ? data.error : '一括自動判定に失敗しました');
          break;
        }
        batches += 1;
        sumUpdated += data.updated ?? 0;
        sumConfirmed += data.confirmed ?? 0;
        sumSkipped += data.skipped ?? 0;
        sumLow += data.lowOnly ?? 0;
        setBulkAllMessage(
          `一括進行中… バッチ${batches}（当バッチ: 更新${data.updated ?? 0}・確認済み化${data.confirmed ?? 0}・候補のみ${data.lowOnly ?? 0}・スキップ${data.skipped ?? 0} / 累計更新${sumUpdated}）`
        );
        if (data.done) {
          setBulkAllMessage(
            `一括完了。DB更新${sumUpdated}件（うち確認済み化${sumConfirmed}件）。候補のみ（赤）${sumLow}件、スキップ（赤）${sumSkipped}件は未確認のまま残しています。`
          );
          break;
        }
        const next: string | null = typeof data.nextCursor === 'string' ? data.nextCursor : null;
        if (!next) {
          setBulkAllMessage(`一括完了。DB更新${sumUpdated}件。`);
          break;
        }
        cursor = next;
      }
      void fetchWorks();
    } catch (e) {
      console.error(e);
      setBulkAllMessage('一括自動判定に失敗しました');
    } finally {
      setBulkAllRunning(false);
    }
  };

  return (
    <section style={{ marginBottom: '0.75rem' }}>
      <h2 style={{ marginBottom: '0.35rem', fontSize: '1.1rem', fontWeight: 600 }}>作品頭文字</h2>
      <p style={{ color: '#666', marginBottom: '0.35rem' }}>
        漢字始まりの作品のみ表示。<strong>未確認</strong>＝ゲーム使用の作品のみ。<strong>確認済み</strong>＝従来どおり（コメント取得済み or ゲーム使用 or タグ済み）の確認済み。頭文字を確認・編集し、確認済みにすると一覧から非表示になります。
      </p>
      <div
        style={{
          margin: '0 0 0.55rem',
          padding: '0.55rem 0.75rem',
          backgroundColor: '#ede9fe',
          border: '1px solid #c4b5fd',
          borderRadius: '6px',
        }}
      >
        <div style={{ fontSize: '0.78rem', color: '#5b21b6', marginBottom: '0.45rem', lineHeight: 1.45 }}>
          <strong>DB 全件一括</strong>：未確認かつ漢字始まりの作品を <strong>workId 順にすべて</strong>自動判定します（この一覧のページングとは無関係）。反映できた行は確認済みにし、<strong>赤（候補のみ・スキップ）</strong>は未確認のまま残します。
        </div>
        <button
          type="button"
          data-admin-bulk-title-reading="1"
          onClick={() => void handleBulkAllUnconfirmed()}
          disabled={
            !adminToken ||
            bulkAllRunning ||
            loading ||
            autoFilling ||
            confirming ||
            revertingAuto
          }
          style={{
            width: '100%',
            maxWidth: '640px',
            display: 'block',
            padding: '0.55rem 0.85rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            backgroundColor:
              !adminToken || bulkAllRunning || loading || autoFilling || confirming || revertingAuto
                ? '#ccc'
                : '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor:
              !adminToken || bulkAllRunning || loading || autoFilling || confirming || revertingAuto
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {bulkAllRunning
            ? '一括自動判定中…'
            : '未確認（漢字）をすべて自動判定（赤以外は確認済み）'}
        </button>
      </div>
      <p
        style={{
          fontSize: '0.72rem',
          lineHeight: 1.45,
          color: '#555',
          margin: '0 0 0.45rem',
          padding: '0.35rem 0.45rem',
          backgroundColor: '#f4f4f5',
          borderRadius: '4px',
          border: '1px solid #e4e4e7',
        }}
      >
        <strong>自動判定の目安（Sudachi）</strong>
        ：<strong>薄緑</strong>＝高信頼（先頭が短い一般名詞など、読みが素直に付いた場合）。
        <strong>黄</strong>＝要確認（動詞始まり／漢字2字以上の普通名詞の塊＝分かちや当て字の取り違えがあり得る）。
        <strong>赤系</strong>＝候補のみ（固有名詞・人名の姓・名・地名など、機械では断定せず DB には自動で書きません。候補のひらがなを目安に手で確定してください）。
        <strong>赤系（スキップ）</strong>＝自動では反映しません（正規化後が1文字のみ・読み取れない・漢字始まりでない等）。手元で確認してください。
        先頭が<strong>括弧</strong>（【】『』「」・丸括弧・角括弧・山括弧 等、正規化で先頭から外すのと同じ種類）のとき、内側をサブ頭文字（カンマの2番目）として推定します。
        <strong>全件一括</strong>は画面上部の<strong>紫枠のボタン</strong>から実行します（DB 上の未確認かつ漢字始まりを workId 順に走査、大量件はクライアントがバッチを連続 POST）。反映できた行は確認済みにし、候補のみ・スキップ（赤）は未確認のまま残します。
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
          onClick={() => void handleAutoFillPage()}
          disabled={works.length === 0 || autoFilling || loading}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.9rem',
            backgroundColor: works.length === 0 || autoFilling || loading ? '#ccc' : '#0d9488',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: works.length === 0 || autoFilling || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {autoFilling ? '自動判定中...' : `表示中${works.length}件を自動判定・上書き`}
        </button>
        <button
          type="button"
          onClick={() => void handleRevertLastAuto()}
          disabled={!lastAutoUndoEntries?.length || revertingAuto || loading}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.9rem',
            backgroundColor: !lastAutoUndoEntries?.length || revertingAuto || loading ? '#ccc' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !lastAutoUndoEntries?.length || revertingAuto || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {revertingAuto ? '戻しています...' : '直前の自動を取り消し'}
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
      {autoFillMessage && (
        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#333' }}>{autoFillMessage}</p>
      )}
      {bulkAllMessage && (
        <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#4c1d95' }}>{bulkAllMessage}</p>
      )}

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
              const mark = autoMarkByWorkId?.[w.workId];
              const conf = mark?.confidence;
              const lowSug = mark?.suggestionHiragana;
              const bg =
                conf === 'high'
                  ? '#e8f5e9'
                  : conf === 'medium'
                    ? '#fff8dc'
                    : conf === 'low'
                      ? '#ffe8e8'
                      : conf === 'skipped'
                        ? '#fecaca'
                        : undefined;
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
                    backgroundColor: bg,
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
                        {lowSug ? (
                          <span style={{ color: '#b45309', fontSize: '0.68rem', marginLeft: '0.05rem', whiteSpace: 'nowrap' }}>
                            候補:{lowSug}
                          </span>
                        ) : null}
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
