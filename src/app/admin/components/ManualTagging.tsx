'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RANK_CHIP } from '../constants/rankColors';

type FilterType = 'checked' | 'pending' | 'untagged' | 'legacy_ai' | 'needs_review';

interface WorkListItem {
  workId: string;
  title: string;
  authorName: string;
  needsReview: boolean;
  tagSource: 'human' | 'ai' | 'untagged';
  aiAnalyzed: boolean;
  humanChecked: boolean;
}

interface WorkDetail {
  workId: string;
  title: string;
  authorName: string;
  commentText: string | null;
  needsReview: boolean;
  tagSource: string;
  aiAnalyzed: boolean;
  humanChecked: boolean;
  officialTags: Array<{ displayName: string; category: string | null }>;
  additionalSTags: Array<{ displayName: string; category: string | null }>;
  aTags: string[];
  bTags: string[];
  cTags: string[];
  characterTags: string[];
}

const PAGE_SIZE = 100;

// タグ＆質問リスト基準で統一（S紫 / 追加S濃い紫 / A緑 / B黄 / C赤 / X青）
const RANK_COLORS = {
  S: RANK_CHIP.S,
  AdditionalS: RANK_CHIP.AdditionalS,
  A: RANK_CHIP.A,
  B: RANK_CHIP.B,
  C: RANK_CHIP.C,
  X: RANK_CHIP.X,
} as const;

export default function ManualTagging() {
  const [filter, setFilter] = useState<FilterType>('checked');
  const [works, setWorks] = useState<WorkListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [formNeedsReview, setFormNeedsReview] = useState(false);
  const [formAiAnalyzed, setFormAiAnalyzed] = useState(false);
  const [formHumanChecked, setFormHumanChecked] = useState(false);
  const [formAdditionalS, setFormAdditionalS] = useState<string[]>([]);
  const [formA, setFormA] = useState<string[]>([]);
  const [formB, setFormB] = useState<string[]>([]);
  const [formC, setFormC] = useState<string[]>([]);
  const [formCharacter, setFormCharacter] = useState<string>('');

  const [allTags, setAllTags] = useState<{ s: string[]; a: string[]; b: string[]; c: string[] } | null>(null);
  const [tabCounts, setTabCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch('/api/admin/manual-tagging/all-tags')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.s) setAllTags({ s: data.s, a: data.a || [], b: data.b || [], c: data.c || [] });
      })
      .catch(() => {});
  }, []);

  const fetchCounts = useCallback(() => {
    fetch('/api/admin/manual-tagging/works/counts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.counts) setTabCounts(data.counts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch(
        `/api/admin/manual-tagging/works?filter=${filter}&limit=${PAGE_SIZE}&offset=0`
      );
      const data = await res.json();
      if (data.success) {
        setWorks(data.works || []);
        setTotal(data.total || 0);
        setCurrentIndex(0);
        setDetail(null);
        setTabCounts((prev) => ({ ...(prev ?? {}), [filter]: data.total ?? 0 }));
      }
    } finally {
      setListLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const currentWorkId = works[currentIndex]?.workId ?? null;

  const fetchDetail = useCallback(async (workId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/manual-tagging/works/${workId}`);
      const data = await res.json();
      if (data.success && data.work) {
        const w = data.work;
        setDetail(w);
        setFormNeedsReview(w.needsReview ?? false);
        setFormAiAnalyzed(w.aiAnalyzed ?? false);
        setFormHumanChecked(w.humanChecked ?? false);
        setFormAdditionalS((w.additionalSTags || []).map((t: { displayName: string }) => t.displayName));
        setFormA(w.aTags || []);
        setFormB(w.bTags || []);
        setFormC(w.cTags || []);
        setFormCharacter((w.characterTags || [])[0] || '');
        setDirty(false);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentWorkId) fetchDetail(currentWorkId);
    else setDetail(null);
  }, [currentWorkId, fetchDetail]);

  const saveCurrent = useCallback(async () => {
    if (!detail || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/manual-tagging/works/${detail.workId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          needsReview: formNeedsReview,
          aiAnalyzed: formAiAnalyzed,
          humanChecked: formHumanChecked,
          additionalSTags: formAdditionalS,
          aTags: formA,
          bTags: formB,
          cTags: formC,
          characterTags: formCharacter ? [formCharacter] : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDirty(false);
        // リスト再取得はしない（fetchList が setCurrentIndex(0) と setDetail(null) で
        // Next で進めた表示を上書きして「作品が表示されない」バグの原因になるため）。
        // 現在作品の tagSource だけ楽観更新して [人力] バッジを反映する。
        setWorks((prev) =>
          prev.map((w) =>
            w.workId === detail.workId
              ? { ...w, tagSource: 'human' as const, aiAnalyzed: formAiAnalyzed, humanChecked: formHumanChecked, needsReview: formNeedsReview }
              : w
          )
        );
        fetchCounts();
      } else {
        alert(data.error || '保存に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  }, [detail, dirty, formNeedsReview, formAiAnalyzed, formHumanChecked, formAdditionalS, formA, formB, formC, formCharacter, fetchCounts]);

  const goPrev = () => {
    if (dirty) saveCurrent().then(() => setCurrentIndex((i) => Math.max(0, i - 1)));
    else setCurrentIndex((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    if (dirty) saveCurrent().then(() => setCurrentIndex((i) => Math.min(works.length - 1, i + 1)));
    else setCurrentIndex((i) => Math.min(works.length - 1, i + 1));
  };

  const filterLabels: { value: FilterType; label: string }[] = [
    { value: 'checked', label: '★チェック済み(作品)' },
    { value: 'pending', label: '★チェック待ち(作品)' },
    { value: 'untagged', label: '★未タグ(作品)' },
    { value: 'legacy_ai', label: '★旧AIタグ(作品)' },
    { value: 'needs_review', label: '要注意⚠️' },
  ];

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>人力タグ付け</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        チェック済み＝人間が承認した作品。チェック待ち＝AI分析済みで未承認。未タグ＝準有名タグなし。旧AIタグ＝従来AIでタグあり。要注意⚠️＝隔離（ゲームに使用しない）。括弧内は作品数。
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {filterLabels.map(({ value, label }) => {
          const count = filter === value ? total : tabCounts?.[value];
          const countStr = count != null ? ` (${count})` : '';
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: filter === value ? '#0070f3' : '#eee',
                color: filter === value ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {label}{countStr}
            </button>
          );
        })}
      </div>

      {listLoading && <p>一覧読み込み中...</p>}
      {!listLoading && works.length === 0 && <p>該当する作品がありません。</p>}
      {!listLoading && works.length > 0 && (
        <>
          <p style={{ marginBottom: '0.5rem' }}>
            {currentIndex + 1} / {works.length} 件（総数: {total}）
            {works[currentIndex] && (
              <span style={{ marginLeft: '1rem', fontSize: '0.85rem' }}>
                [AI分析: {works[currentIndex].aiAnalyzed ? '✓' : '－'} / 人間チェック: {works[currentIndex].humanChecked ? '✓' : '－'}]
              </span>
            )}
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0 || saving}
              style={{ padding: '0.5rem 1rem', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer' }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => saveCurrent()}
              disabled={!dirty || saving}
              style={{
                padding: '0.5rem 1rem',
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                backgroundColor: dirty ? '#28a745' : '#ccc',
                color: dirty ? 'white' : '#666',
                border: 'none',
                borderRadius: '4px',
              }}
              title={dirty ? '変更を保存（その場に留まる）' : '変更がありません'}
            >
              保存
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex >= works.length - 1 || saving}
              style={{ padding: '0.5rem 1rem', cursor: currentIndex >= works.length - 1 ? 'not-allowed' : 'pointer' }}
            >
              Next →
            </button>
            {saving && <span style={{ color: '#666' }}>保存中...</span>}
          </div>

          {detailLoading && <p>作品読み込み中...</p>}
          {!detailLoading && detail && (
            <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(340px, 1fr) minmax(300px, 340px)', gap: '1rem', alignItems: 'start', minHeight: '400px' }}>
              {/* 左: ⚠️ + AI分析/人間チェック + タイトル */}
              <div style={{ width: '180px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={formNeedsReview}
                    onChange={(e) => { setFormNeedsReview(e.target.checked); setDirty(true); }}
                  />
                  <span title="要注意">⚠️</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={formAiAnalyzed}
                    onChange={(e) => { setFormAiAnalyzed(e.target.checked); setDirty(true); }}
                  />
                  <span>AI分析</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={formHumanChecked}
                    onChange={(e) => { setFormHumanChecked(e.target.checked); setDirty(true); }}
                  />
                  <span>人間チェック</span>
                </label>
                <div style={{ fontSize: '0.9rem', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {detail.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                  {detail.authorName}
                </div>
              </div>

              {/* 中央: コメント全文（幅を確保して縦長になりすぎない） */}
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '0.75rem', background: '#fafafa', maxHeight: '70vh', overflowY: 'auto', minWidth: 0 }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem' }}>
                  {detail.commentText || '（コメントなし）'}
                </div>
              </div>

              {/* 右: タグ入力 */}
              <div style={{ minWidth: '300px', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <TagSection
                  label="既存S"
                  items={detail.officialTags.map((t) => t.displayName)}
                  readOnly
                  rankColor={RANK_COLORS.S}
                  gridColumns={4}
                />
                <UnifiedTagInput
                  formAdditionalS={formAdditionalS}
                  formA={formA}
                  formB={formB}
                  formC={formC}
                  existingOfficialSet={new Set(detail.officialTags.map((t) => t.displayName.toLowerCase()))}
                  onAdditionalS={(v) => { setFormAdditionalS(v); setDirty(true); }}
                  onA={(v) => { setFormA(v); setDirty(true); }}
                  onB={(v) => { setFormB(v); setDirty(true); }}
                  onC={(v) => { setFormC(v); setDirty(true); }}
                />
                <TagSection
                  label="キャラ"
                  items={formCharacter ? [formCharacter] : []}
                  onChange={(items) => { setFormCharacter(items[0] || ''); setDirty(true); }}
                  maxItems={1}
                  singleLine
                  rankColor={RANK_COLORS.X}
                />
              </div>
            </div>
          )}

          {/* すべてのタグ（参考用・マスター一覧） */}
          {allTags && (
            <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#fafafa', borderRadius: '4px', fontSize: '0.75rem', color: '#333' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>すべてのタグ（参考）</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ padding: '0.2rem 0.35rem', background: RANK_COLORS.S.bg, borderRadius: '3px', borderLeft: `3px solid ${RANK_COLORS.S.border}` }}><strong>S:</strong> {allTags.s.map((t) => <span key={`s-${t}`} style={{ marginRight: '0.35rem' }}>{t}</span>)}</div>
                <div style={{ padding: '0.2rem 0.35rem', background: RANK_COLORS.A.bg, borderRadius: '3px', borderLeft: `3px solid ${RANK_COLORS.A.border}` }}><strong>A:</strong> {allTags.a.map((t) => <span key={`a-${t}`} style={{ marginRight: '0.35rem' }}>{t}</span>)}</div>
                <div style={{ padding: '0.2rem 0.35rem', background: RANK_COLORS.B.bg, borderRadius: '3px', borderLeft: `3px solid ${RANK_COLORS.B.border}` }}><strong>B:</strong> {allTags.b.map((t) => <span key={`b-${t}`} style={{ marginRight: '0.35rem' }}>{t}</span>)}</div>
                <div style={{ padding: '0.2rem 0.35rem', background: RANK_COLORS.C.bg, borderRadius: '3px', borderLeft: `3px solid ${RANK_COLORS.C.border}` }}><strong>C:</strong> {allTags.c.map((t) => <span key={`c-${t}`} style={{ marginRight: '0.35rem' }}>{t}</span>)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

type RankType = 'S' | 'A' | 'B' | 'C';

function UnifiedTagInput({
  formAdditionalS,
  formA,
  formB,
  formC,
  existingOfficialSet,
  onAdditionalS,
  onA,
  onB,
  onC,
}: {
  formAdditionalS: string[];
  formA: string[];
  formB: string[];
  formC: string[];
  existingOfficialSet: Set<string>;
  onAdditionalS: (v: string[]) => void;
  onA: (v: string[]) => void;
  onB: (v: string[]) => void;
  onC: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ displayName: string; rank: RankType }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingNew, setPendingNew] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/manual-tagging/autocomplete?type=all&q=${encodeURIComponent(input.trim())}&limit=30`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setSuggestions(data.items.map((x: { displayName: string; rank: string }) => ({ displayName: x.displayName, rank: x.rank as RankType })));
      } else {
        setSuggestions([]);
      }
      debounceRef.current = null;
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const alreadyIn = (name: string, rank: RankType): boolean => {
    const n = name.trim().toLowerCase();
    if (rank === 'S') return existingOfficialSet.has(n) || formAdditionalS.map((x) => x.toLowerCase()).includes(n);
    if (rank === 'A') return formA.map((x) => x.toLowerCase()).includes(n);
    if (rank === 'B') return formB.map((x) => x.toLowerCase()).includes(n);
    if (rank === 'C') return formC.map((x) => x.toLowerCase()).includes(n);
    return false;
  };

  const addByRank = (displayName: string, rank: RankType) => {
    const n = displayName.trim();
    if (!n) return;
    if (alreadyIn(n, rank)) return;
    if (rank === 'S') onAdditionalS([...formAdditionalS, n]);
    else if (rank === 'A') onA([...formA, n]);
    else if (rank === 'B') onB([...formB, n]);
    else if (rank === 'C') onC([...formC, n]);
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setPendingNew(null);
  };

  const removeFrom = (rank: 'S' | 'A' | 'B' | 'C', index: number) => {
    if (rank === 'S') onAdditionalS(formAdditionalS.filter((_, i) => i !== index));
    else if (rank === 'A') onA(formA.filter((_, i) => i !== index));
    else if (rank === 'B') onB(formB.filter((_, i) => i !== index));
    else onC(formC.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Enter: 入力した文字をそのまま新規タグとして追加（候補と別にしたいとき用）
        const t = input.trim();
        if (t) setPendingNew(t);
        return;
      }
      if (pendingNew) return; // ランク選択中はEnterで追加しない
      if (suggestions.length > 0) {
        addByRank(suggestions[0].displayName, suggestions[0].rank);
        return;
      }
      const t = input.trim();
      if (t) setPendingNew(t);
    }
  };

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.9rem' }}>タグ追加（S/A/B/C 共通）</div>
      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); setPendingNew(null); }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => input.trim() && setShowSuggestions(true)}
          placeholder="入力でS/A/B/Cから予測"
          style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.9rem', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
          Enter=候補の先頭 / Shift+Enter=入力した文字で新規追加
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              left: 0,
              top: '100%',
              margin: 0,
              padding: 0,
              listStyle: 'none',
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 10,
              maxHeight: '220px',
              overflowY: 'auto',
              minWidth: '200px',
            }}
          >
            {suggestions.map((s) => (
              <li
                key={`${s.displayName}-${s.rank}`}
                onMouseDown={() => addByRank(s.displayName, s.rank)}
                style={{
                  padding: '0.35rem 0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  backgroundColor: alreadyIn(s.displayName, s.rank) ? '#eee' : 'white',
                }}
              >
                {s.displayName} <span style={{ color: '#666', fontSize: '0.8rem' }}>({s.rank})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {pendingNew && (
        <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          新規「{pendingNew}」をランクで追加:
          {(['A', 'B', 'C'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onMouseDown={() => { addByRank(pendingNew, r); setInput(''); }}
              style={{ marginLeft: '0.35rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}
            >
              {r}
            </button>
          ))}
          <button type="button" onMouseDown={() => { setPendingNew(null); }} style={{ marginLeft: '0.35rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>キャンセル</button>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
        <ChipList label="追加S" items={formAdditionalS} onRemove={(i) => removeFrom('S', i)} rankColor={RANK_COLORS.AdditionalS} />
        <ChipList label="A" items={formA} onRemove={(i) => removeFrom('A', i)} rankColor={RANK_COLORS.A} />
        <ChipList label="B" items={formB} onRemove={(i) => removeFrom('B', i)} rankColor={RANK_COLORS.B} />
        <ChipList label="C" items={formC} onRemove={(i) => removeFrom('C', i)} rankColor={RANK_COLORS.C} />
      </div>
    </div>
  );
}

function ChipList({ label, items, onRemove, rankColor }: { label: string; items: string[]; onRemove: (index: number) => void; rankColor?: { bg: string; border: string } }) {
  const bg = rankColor?.bg ?? '#eee';
  return (
    <div>
      <span style={{ fontWeight: 'bold', marginRight: '0.25rem' }}>{label}:</span>
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          style={{
            padding: '0.15rem 0.35rem',
            background: bg,
            borderRadius: '4px',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            marginRight: '0.25rem',
            marginBottom: '0.2rem',
            border: rankColor ? `1px solid ${rankColor.border}` : '1px solid #ddd',
          }}
        >
          {item}
          <button type="button" onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }} aria-label="削除">×</button>
        </span>
      ))}
    </div>
  );
}

function TagSection({
  label,
  items,
  onChange,
  readOnly,
  autocompleteType,
  maxItems = 20,
  singleLine,
  rankColor,
  gridColumns,
}: {
  label: string;
  items: string[];
  onChange?: (items: string[]) => void;
  readOnly?: boolean;
  autocompleteType?: 'official' | 'derived' | 'structural';
  maxItems?: number;
  singleLine?: boolean;
  rankColor?: { bg: string; border: string };
  /** 既存Sなど、1行に並べず N 個ずつで改行したいとき（例: 4） */
  gridColumns?: number;
}) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autocompleteType || !input.trim()) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/manual-tagging/autocomplete?type=${autocompleteType}&q=${encodeURIComponent(input.trim())}&limit=20`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        if (autocompleteType === 'derived') {
          setSuggestions(data.items.map((x: { displayName: string; rank?: string }) => x.displayName));
        } else {
          setSuggestions(data.items);
        }
      } else {
        setSuggestions([]);
      }
      debounceRef.current = null;
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, autocompleteType]);

  const addItem = (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (readOnly || !onChange) return;
    if (singleLine && items.length >= 1) return;
    if (!singleLine && items.length >= maxItems) return;
    if (items.map((x) => x.toLowerCase()).includes(n.toLowerCase())) return;
    onChange(singleLine ? [n] : [...items, n]);
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const removeItem = (index: number) => {
    if (readOnly || !onChange) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const itemsContainerStyle: React.CSSProperties = gridColumns
    ? { display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, auto)`, gap: '0.25rem', alignItems: 'center', justifyContent: 'start' }
    : { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' };

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.9rem' }}>{label}</div>
      <div style={itemsContainerStyle}>
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            style={{
              padding: '0.2rem 0.5rem',
              background: rankColor ? rankColor.bg : (readOnly ? '#eee' : '#e3f2fd'),
              borderRadius: '4px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              ...(rankColor && { border: `1px solid ${rankColor.border}` }),
            }}
          >
            {item}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1rem', lineHeight: 1 }}
                aria-label="削除"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!readOnly && (singleLine ? items.length < 1 : items.length < maxItems) && (
          <span style={{ position: 'relative' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestions.length > 0) addItem(suggestions[0]);
                  else if (input.trim()) addItem(input.trim());
                }
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => input.trim() && setShowSuggestions(true)}
              placeholder={singleLine ? '1件' : '追加'}
              style={{ width: singleLine ? '120px' : '80px', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '100%',
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  background: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 10,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  minWidth: '140px',
                }}
              >
                {suggestions.slice(0, 15).map((s) => (
                  <li
                    key={s}
                    onMouseDown={() => addItem(s)}
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
