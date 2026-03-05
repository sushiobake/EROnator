'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RANK_CHIP } from '../constants/rankColors';
import { useAdminProgress } from '../context/AdminProgressContext';

type FilterType = 'tagged' | 'has_issues' | 'pending' | 'needs_human_check' | 'untagged' | 'legacy_ai' | 'needs_review';

const FOLDER_LABELS: Record<FilterType, string> = {
  tagged: 'タグ済',
  has_issues: '問題あり',
  pending: 'チェック待ち',
  needs_human_check: '人間確認',
  untagged: '未タグ',
  legacy_ai: '旧AIタグ',
  needs_review: '要注意⚠️',
};

interface WorkListItem {
  workId: string;
  title: string;
  authorName: string;
  /** タグ済みフォルダに入れた日時（タグ済タブのみAPIから返る。APIがミリ秒で返す場合あり） */
  taggedAt?: string | number | null;
}

interface WorkDetail {
  workId: string;
  title: string;
  authorName: string;
  commentText: string | null;
  manualTaggingFolder: string;
  officialTags: Array<{ displayName: string; category: string | null }>;
  additionalSTags: Array<{ displayName: string; category: string | null }>;
  aTags: string[];
  bTags: string[];
  cTags: string[];
  characterTags: string[];
  /** AIチェック時の追加推奨・削除推奨・新規提案。個別に受け入れる */
  lastCheckTagChanges?: { added: string[]; removed: string[]; newProposal?: string } | null;
  /** Phase1 のチェック判断理由（軸の適切性・各タグ根拠・キャラ） */
  lastCheckReasoning?: Record<string, string> | null;
  /** 最終チェックの完全な出力 JSON */
  lastCheckResultJson?: unknown;
  /** Phase0 のタグ付け理由（タイトルから・各タグ根拠・キャラ） */
  lastTaggingReasoning?: Record<string, string> | null;
}

const PAGE_SIZE = 100;

function formatTaggedAt(value: string | number): string {
  try {
    const ms = typeof value === 'number' ? value : /^\d+$/.test(String(value).trim()) ? Number(value) : NaN;
    const d = Number.isFinite(ms) ? new Date(ms) : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}`;
  } catch {
    return '—';
  }
}

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
  const [filter, setFilter] = useState<FilterType>('tagged');
  const [works, setWorks] = useState<WorkListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [formFolder, setFormFolder] = useState<FilterType>('pending');
  const [formAdditionalS, setFormAdditionalS] = useState<string[]>([]);
  const [formA, setFormA] = useState<string[]>([]);
  const [formB, setFormB] = useState<string[]>([]);
  const [formC, setFormC] = useState<string[]>([]);
  const [formCharacter, setFormCharacter] = useState<string>('');

  const [allTags, setAllTags] = useState<{ s: string[]; a: string[]; b: string[]; c: string[] } | null>(null);
  const [tabCounts, setTabCounts] = useState<Record<string, number> | null>(null);

  // AIタグ付け用バッチ: 今回の対象
  const [batchSize, setBatchSize] = useState<2 | 5 | 10 | 20 | 50 | 100>(10);
  const [batchWorks, setBatchWorks] = useState<Array<{ workId: string; title: string }>>([]);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchSelect, setShowBatchSelect] = useState(false);
  const [copyingForGpt, setCopyingForGpt] = useState(false);
  const [copyingForCheck, setCopyingForCheck] = useState(false);
  const [groqCheckLoading, setGroqCheckLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; workId?: string; result?: string } | null>(null);
  const [batchRuns, setBatchRuns] = useState<Array<{ id: string; batchSize: number; resultsJson: string; createdAt: string }>>([]);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [groqTagLoading, setGroqTagLoading] = useState(false);
  const [tagBatchProgress, setTagBatchProgress] = useState<{ done: number; total: number; workId?: string; tagsAdded?: number } | null>(null);
  const [tagBatchResults, setTagBatchResults] = useState<Array<{ workId: string; title: string; additionalSTags: number; aTags: number; bTags: number; characterName: number }>>([]);
  const [showTagBatchResults, setShowTagBatchResults] = useState(false);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedProgress, setCombinedProgress] = useState<{ phase: string; done: number; total: number; workId?: string; detail?: string } | null>(null);
  const [combinedResult, setCombinedResult] = useState<{ tagged: number; needsHumanCheck: number; hasIssues: number } | null>(null);

  const { setProgress } = useAdminProgress();
  useEffect(() => {
    if (combinedProgress) {
      const isPhase0 = combinedProgress.phase === 'Phase0' || combinedProgress.phase?.startsWith('Phase0');
      const isPhase12 = combinedProgress.phase === 'Phase1+2' || combinedProgress.phase?.includes('Phase1');
      if (isPhase0) {
        setProgress('phase0', { done: combinedProgress.done, total: combinedProgress.total });
        setProgress('phase12', null);
      } else if (isPhase12) {
        setProgress('phase0', null);
        setProgress('phase12', { done: combinedProgress.done, total: combinedProgress.total });
      } else {
        setProgress('phase0', { done: combinedProgress.done, total: combinedProgress.total });
        setProgress('phase12', null);
      }
    } else if (tagBatchProgress) {
      setProgress('phase0', { done: tagBatchProgress.done, total: tagBatchProgress.total });
      setProgress('phase12', null);
    } else if (batchProgress) {
      setProgress('phase0', null);
      setProgress('phase12', { done: batchProgress.done, total: batchProgress.total });
    } else {
      setProgress('phase0', null);
      setProgress('phase12', null);
    }
  }, [combinedProgress, tagBatchProgress, batchProgress, setProgress]);

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
        setTotal(data.total ?? 0);
        // タグ済・要注意は一覧→選択で詳細のため、初期は未選択
        const isListOnlyTab = filter === 'tagged' || filter === 'needs_review';
        setCurrentIndex(isListOnlyTab ? -1 : 0);
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
        const folder = (w.manualTaggingFolder as FilterType);
        setFormFolder(folder && FOLDER_LABELS[folder] ? folder : 'pending');
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
          manualTaggingFolder: formFolder,
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
        if (detail) setDetail((d) => (d ? { ...d, manualTaggingFolder: formFolder } : null));
        fetchCounts();
      } else {
        alert(data.error || '保存に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  }, [detail, dirty, formFolder, formAdditionalS, formA, formB, formC, formCharacter, fetchCounts]);

  const goPrev = () => {
    if (dirty) saveCurrent().then(() => setCurrentIndex((i) => Math.max(0, i - 1)));
    else setCurrentIndex((i) => Math.max(0, i - 1));
  };
  const goNext = () => {
    if (dirty) saveCurrent().then(() => setCurrentIndex((i) => Math.min(works.length - 1, i + 1)));
    else setCurrentIndex((i) => Math.min(works.length - 1, i + 1));
  };

  const setBatchFromHead = useCallback(() => {
    const n = Math.min(batchSize, works.length);
    setBatchWorks(works.slice(0, n).map((w) => ({ workId: w.workId, title: w.title })));
  }, [batchSize, works]);
  const setBatchFromSelection = useCallback(() => {
    const selected = works.filter((w) => batchSelectedIds.has(w.workId));
    setBatchWorks(selected.map((w) => ({ workId: w.workId, title: w.title })));
    setShowBatchSelect(false);
  }, [works, batchSelectedIds]);
  const toggleBatchSelectId = useCallback((workId: string) => {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(workId)) next.delete(workId);
      else next.add(workId);
      return next;
    });
  }, []);

  const copyForGpt = useCallback(async () => {
    if (batchWorks.length === 0) {
      alert('今回の対象がありません。先に「先頭 N 件を今回の対象にする」か「一覧から選択」で対象を決めてください。');
      return;
    }
    setCopyingForGpt(true);
    try {
      const workIdsArg = batchWorks.map((w) => w.workId).join(' ');
      const instruction = `【タグ付け・この指示を渡すだけで最後まで完了させる】

docs/legacy-ai-tagging-instruction.md を読み、以下を順番に全部実行せよ。1つでも抜かしたら未完了。

1. 取得: npx tsx scripts/fetch-works-for-ai.ts ${workIdsArg}
2. タグ付け: 取得した JSON で各作品にタグ付け。docs/legacy-ai-tagging-instruction.md に従う。既存S/A/Bのみ、新規タグ禁止。全作品に characterName（名前があれば、なければ null）、tagReasoning。
3. 貼付: 返した JSON 全文を会話に貼る。
4. 保存: 返した JSON を data/chatgpt-export/tagging-pending.json に保存する（ファイル名は固定）。
5. 反映: npx tsx scripts/apply-tagging.ts を実行する。

4 と 5 をやらないとチェック待ちに並ばない。必ず実行してから終了すること。

【対象 workIds】
${batchWorks.map((w) => w.workId).join('\n')}
`;
      await navigator.clipboard.writeText(instruction);
      alert(`クリップボードにコピーしました（${batchWorks.length}件）。Cursor の別エージェントにそのまま貼り付けてください。`);
    } catch (e) {
      console.error(e);
      alert('コピーに失敗しました。');
    } finally {
      setCopyingForGpt(false);
    }
  }, [batchWorks]);

  const copyForCheck = useCallback(async () => {
    if (batchWorks.length === 0) {
      alert('今回の対象がありません。先に「先頭 N 件を今回の対象にする」か「一覧から選択」で対象を決めてください。');
      return;
    }
    setCopyingForCheck(true);
    try {
      const workIdsArg = batchWorks.map((w) => w.workId).join(' ');
      const instruction = `【タグチェック・この指示を渡すだけで最後まで完了させる】

docs/check-instruction.md を読み、以下を順番に全部実行せよ。1つでも抜かしたら未完了。

【実行時の注意】PowerShell では \`&&\` が使えない。コマンドは必ず1行ずつ実行すること。

0. 初回のみ: npx tsx scripts/init-check-pending.ts（check-pending.json が既にあり中身がある場合は再開なので省略）
1. 取得: npx tsx scripts/fetch-works-for-ai.ts --check --out data/chatgpt-export/check-input.json ${workIdsArg}
2. 増分チェック: check-input.json の works を**10件ずつ**処理。各バッチで: 10件チェック → 10件分JSONを data/chatgpt-export/check-batch-temp.json に保存 → npx tsx scripts/append-check-batch.ts data/chatgpt-export/check-batch-temp.json を実行 → チャットには「Batch N 完了（10件）」とだけ出力（100件のJSON全文は出さない）。全作品に checkReasoning 必須。
3. 全バッチ完了後: npx tsx scripts/apply-check.ts を実行する。

**途中失敗時**: check-pending.json に既に件数があれば、その workId を除外し未処理分だけ続きから 10件ずつ append。init は実行しない。

【対象 workIds】${batchWorks.length > 0 ? '\n' + batchWorks.map((w) => w.workId).join('\n') : ''}
`;
      await navigator.clipboard.writeText(instruction);
      alert(`クリップボードにコピーしました（${batchWorks.length}件）。Cursor の別エージェントにそのまま貼り付けてください。`);
    } catch (e) {
      console.error(e);
      alert('コピーに失敗しました。');
    } finally {
      setCopyingForCheck(false);
    }
  }, [batchWorks]);

  const filterLabels: { value: FilterType; label: string }[] = (
    ['tagged', 'needs_human_check', 'has_issues', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const
  ).map((value) => ({ value, label: FOLDER_LABELS[value] }));

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>タグ付け＆タグチェック</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        <strong>フォルダ</strong>。1作品は必ず1つのフォルダにのみ入ります。作品を「移動」でフォルダを変更できます。括弧内は作品数。
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

      {/* 進行表示: タブ切り替え後も常時表示 */}
      {(combinedLoading || groqTagLoading || groqCheckLoading) && (
        <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: '#e3f2fd', border: '1px solid #2196f3', borderRadius: '6px', fontSize: '0.9rem' }}>
          <strong>実行中</strong>
          {combinedProgress && (
            <span style={{ marginLeft: '0.5rem' }}>
              {combinedProgress.phase}: {combinedProgress.done}/{combinedProgress.total}
              {combinedProgress.workId && ` (${combinedProgress.workId}${combinedProgress.detail ? ` ${combinedProgress.detail}` : ''})`}
            </span>
          )}
          {!combinedProgress && tagBatchProgress && (
            <span style={{ marginLeft: '0.5rem' }}>
              Phase0: {tagBatchProgress.done}/{tagBatchProgress.total} 件
              {tagBatchProgress.workId && ` (${tagBatchProgress.workId}${tagBatchProgress.tagsAdded != null ? ` +${tagBatchProgress.tagsAdded}tags` : ''})`}
            </span>
          )}
          {!combinedProgress && !tagBatchProgress && batchProgress && (
            <span style={{ marginLeft: '0.5rem' }}>
              Phase1+2: {batchProgress.done}/{batchProgress.total} 件
              {batchProgress.workId && ` (${batchProgress.workId}: ${batchProgress.result === 'タグ済' ? '✓' : '問題あり'})`}
            </span>
          )}
        </div>
      )}

      {/* AIタグ付け用バッチ: チェック待ち(pending)・未タグ・旧AIタグの3タブのみ表示。タブごとにコピペボタンを出し分け */}
      {(filter === 'pending' || filter === 'untagged' || filter === 'legacy_ai') && (
      <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '6px', background: '#f9f9f9' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.95rem' }}>AIタグ付け用バッチ</div>
        {filter === 'pending' && (
          <>
            <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              対象を決めたあと「AIにタグチェックさせるためのコピペ」を押すと、指示文＋作品データがクリップボードに入ります。AIに貼り付けてタグチェックを依頼してください。
              {' '}または「Phase1: 振り分けチェック」でチェック待ちの先頭1件を振り分け（タグ済 or 問題あり）できます。
            </p>
            <p style={{ color: '#c00', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              ※ AIが返したあと、下の【反映手順】を実行するとフォルダが振り分けられます。
            </p>
          </>
        )}
        {filter === 'untagged' && (
          <>
            <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              対象を決めたあと「AIにタグ付けさせるためのコピペ」を押すと、指示文＋作品データがクリップボードに入ります。AIに貼り付けてタグ付けを依頼してください。
            </p>
            <p style={{ color: '#c00', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              ※ AIが返したあと、その結果を「チェック待ち」に入れるには、下の【反映手順】を実行してください。
            </p>
          </>
        )}
        {filter === 'legacy_ai' && (
          <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            対象を決めたあと、<strong>タグ付け用</strong>または<strong>タグチェック用</strong>のコピペを押してAIに渡してください。返ってきたら下の【反映手順】で反映します。
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem' }}>件数:</span>
          {([2, 5, 10, 20, 50, 100] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBatchSize(n)}
              style={{
                padding: '0.25rem 0.6rem',
                backgroundColor: batchSize === n ? '#0070f3' : '#eee',
                color: batchSize === n ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {n}件
            </button>
          ))}
          <button
            type="button"
            onClick={setBatchFromHead}
            disabled={listLoading || works.length === 0}
            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: works.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
          >
            先頭{batchSize}件を今回の対象にする
          </button>
          <button
            type="button"
            onClick={() => setShowBatchSelect((b) => !b)}
            style={{ padding: '0.35rem 0.75rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            一覧から選択
          </button>
        </div>
        {showBatchSelect && works.length > 0 && (
          <div style={{ marginBottom: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '0.5rem', background: 'white' }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>チェックした作品を「選択した件を対象にする」で確定</div>
            {works.slice(0, 50).map((w) => (
              <label key={w.workId} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                <input type="checkbox" checked={batchSelectedIds.has(w.workId)} onChange={() => toggleBatchSelectId(w.workId)} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.title}>{w.workId} {w.title}</span>
              </label>
            ))}
            {works.length > 50 && <div style={{ fontSize: '0.75rem', color: '#666' }}>… 他{works.length - 50}件（先頭50件のみ表示）</div>}
            <button type="button" onClick={setBatchFromSelection} style={{ marginTop: '0.35rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>選択した件を対象にする</button>
          </div>
        )}
        {batchWorks.length > 0 && (
          <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <strong>今回の対象: {batchWorks.length}件</strong>
            <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, maxHeight: '80px', overflowY: 'auto' }}>
              {batchWorks.map((w) => (
                <li key={w.workId} style={{ listStyle: 'disc' }} title={w.title}>{w.workId} {w.title.length > 40 ? w.title.slice(0, 40) + '…' : w.title}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {(filter === 'untagged' || filter === 'legacy_ai') && (
            <>
              <button
                type="button"
                onClick={copyForGpt}
                disabled={copyingForGpt || batchWorks.length === 0}
                style={{
                  padding: '0.4rem 0.9rem',
                  backgroundColor: batchWorks.length === 0 ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: batchWorks.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {copyingForGpt ? '取得中…' : 'AIにタグ付けさせるためのコピペ'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (groqTagLoading || total === 0) return;
                  setGroqTagLoading(true);
                  setTagBatchProgress({ done: 0, total: batchSize });
                  try {
                    const res = await fetch(`/api/admin/groq-tag-batch?count=${batchSize}&source=${filter}`, { method: 'POST' });
                    if (!res.ok || !res.body) {
                      const err = await res.json().catch(() => ({ error: res.statusText }));
                      throw new Error(err.error || res.statusText);
                    }
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let finalData: { success?: boolean; count?: number; results?: Array<{ workId: string; title: string; additionalSTags: number; aTags: number; bTags: number; characterName: number }>; error?: string } | null = null;
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      buffer += decoder.decode(value, { stream: true });
                      const lines = buffer.split('\n');
                      buffer = lines.pop() ?? '';
                      for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                          const obj = JSON.parse(line) as { type?: string; done?: number; total?: number; workId?: string; tagsAdded?: number; error?: string; success?: boolean; count?: number; results?: Array<{ workId: string; title: string; additionalSTags: number; aTags: number; bTags: number; characterName: number }> };
                          if (obj.type === 'progress') {
                            setTagBatchProgress({ done: obj.done ?? 0, total: obj.total ?? batchSize, workId: obj.workId, tagsAdded: obj.tagsAdded });
                          } else if (obj.type === 'done') {
                            finalData = { success: obj.success, count: obj.count, results: obj.results };
                          } else if (obj.type === 'error') {
                            throw new Error(obj.error || 'Unknown error');
                          }
                        } catch (parseErr) {
                          if (parseErr instanceof SyntaxError) continue;
                          throw parseErr;
                        }
                      }
                    }
                    setTagBatchProgress(null);
                    if (finalData?.success) {
                      setTagBatchResults(finalData.results ?? []);
                      setShowTagBatchResults(true);
                      alert(`✅ Phase0: ${finalData.count}件をタグ付けし、チェック待ちに入れました`);
                      fetchList();
                      fetchCounts();
                      setFilter('pending');
                    }
                  } catch (e) {
                    setTagBatchProgress(null);
                    alert(`エラー: ${e instanceof Error ? e.message : String(e)}`);
                  } finally {
                    setGroqTagLoading(false);
                  }
                }}
                disabled={groqTagLoading || total === 0}
                style={{
                  padding: '0.4rem 0.9rem',
                  backgroundColor: groqTagLoading || total === 0 ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: groqTagLoading || total === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {groqTagLoading ? 'Phase0実行中…' : `Phase0: タグ付け（${batchSize}件）`}
              </button>
              {tagBatchProgress && (
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {tagBatchProgress.done}/{tagBatchProgress.total} 件
                  {tagBatchProgress.workId && ` (${tagBatchProgress.workId}${tagBatchProgress.tagsAdded != null ? ` +${tagBatchProgress.tagsAdded}tags` : ''})`}
                </span>
              )}
              <button
                type="button"
                onClick={() => { setShowTagBatchResults(true); }}
                disabled={tagBatchResults.length === 0}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', border: '1px solid #666', borderRadius: '4px', background: tagBatchResults.length === 0 ? '#eee' : '#fff', cursor: tagBatchResults.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                Phase0 結果
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (combinedLoading || groqTagLoading || groqCheckLoading || total === 0) return;
                  setCombinedLoading(true);
                  setCombinedProgress({ phase: 'Phase0', done: 0, total: batchSize });
                  setCombinedResult(null);
                  try {
                    const phase0Res = await fetch(`/api/admin/groq-tag-batch?count=${batchSize}&source=${filter}`, { method: 'POST' });
                    if (!phase0Res.ok || !phase0Res.body) {
                      const err = await phase0Res.json().catch(() => ({ error: phase0Res.statusText }));
                      throw new Error(err.error || phase0Res.statusText);
                    }
                    const reader0 = phase0Res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let phase0Done = false;
                    let phase0Count = 0;
                    while (true) {
                      const { done, value } = await reader0.read();
                      if (done) break;
                      buffer += decoder.decode(value, { stream: true });
                      const lines = buffer.split('\n');
                      buffer = lines.pop() ?? '';
                      for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                          const obj = JSON.parse(line) as { type?: string; done?: number; total?: number; workId?: string; tagsAdded?: number; error?: string; success?: boolean; count?: number; results?: unknown[] };
                          if (obj.type === 'progress') {
                            setCombinedProgress({ phase: 'Phase0', done: obj.done ?? 0, total: obj.total ?? batchSize, workId: obj.workId, detail: obj.tagsAdded != null ? `+${obj.tagsAdded}tags` : undefined });
                          } else if (obj.type === 'done') {
                            phase0Done = true;
                            phase0Count = obj.count ?? 0;
                            if (obj.results) setTagBatchResults(obj.results as Array<{ workId: string; title: string; additionalSTags: number; aTags: number; bTags: number; characterName: number }>);
                          } else if (obj.type === 'error') {
                            throw new Error(obj.error || 'Unknown error');
                          }
                        } catch (parseErr) {
                          if (parseErr instanceof SyntaxError) continue;
                          throw parseErr;
                        }
                      }
                    }
                    if (!phase0Done || phase0Count === 0) throw new Error('Phase0 が完了しませんでした');
                    setCombinedProgress({ phase: 'Phase0 完了 → Phase1+2 開始', done: 0, total: phase0Count });
                    await new Promise((r) => setTimeout(r, 800));
                    setCombinedProgress({ phase: 'Phase1+2', done: 0, total: phase0Count });
                    const phase12Res = await fetch(`/api/admin/groq-check-batch?count=${phase0Count}`, { method: 'POST' });
                    if (!phase12Res.ok || !phase12Res.body) {
                      const err = await phase12Res.json().catch(() => ({ error: phase12Res.statusText }));
                      throw new Error(err.error || phase12Res.statusText);
                    }
                    const reader12 = phase12Res.body.getReader();
                    buffer = '';
                    let finalResults: Array<{ result: string }> = [];
                    while (true) {
                      const { done, value } = await reader12.read();
                      if (done) break;
                      buffer += decoder.decode(value, { stream: true });
                      const lines = buffer.split('\n');
                      buffer = lines.pop() ?? '';
                      for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                          const obj = JSON.parse(line) as { type?: string; done?: number; total?: number; workId?: string; result?: string; error?: string; success?: boolean; results?: Array<{ result: string }> };
                          if (obj.type === 'progress') {
                            setCombinedProgress({ phase: 'Phase1+2', done: obj.done ?? 0, total: obj.total ?? phase0Count, workId: obj.workId, detail: obj.result });
                          } else if (obj.type === 'done') {
                            finalResults = obj.results ?? [];
                          } else if (obj.type === 'error') {
                            throw new Error(obj.error || 'Unknown error');
                          }
                        } catch (parseErr) {
                          if (parseErr instanceof SyntaxError) continue;
                          throw parseErr;
                        }
                      }
                    }
                    const tagged = finalResults.filter((r) => r.result === 'タグ済').length;
                    const needsHumanCheck = finalResults.filter((r) => r.result === '人間による確認が必要').length;
                    const hasIssues = finalResults.filter((r) => r.result !== 'タグ済' && r.result !== '人間による確認が必要').length;
                    setCombinedResult({ tagged, needsHumanCheck, hasIssues });
                    setCombinedProgress(null);
                    setShowBatchResults(true);
                    const runsRes = await fetch('/api/admin/check-batch-runs?limit=5');
                    const runsData = await runsRes.json();
                    if (runsData.success && runsData.runs) setBatchRuns(runsData.runs);
                    fetchList();
                    fetchCounts();
                    setFilter('tagged');
                    alert(`✅ Phase0→1→2 完了\nタグ済: ${tagged}件 / 人間確認: ${needsHumanCheck}件 / 問題あり: ${hasIssues}件`);
                  } catch (e) {
                    setCombinedProgress(null);
                    setCombinedLoading(false);
                    alert(`エラー: ${e instanceof Error ? e.message : String(e)}`);
                    return;
                  }
                  setCombinedLoading(false);
                }}
                disabled={combinedLoading || groqTagLoading || groqCheckLoading || total === 0}
                style={{
                  padding: '0.4rem 0.9rem',
                  backgroundColor: combinedLoading || groqTagLoading || groqCheckLoading || total === 0 ? '#ccc' : '#6f42c1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: combinedLoading || groqTagLoading || groqCheckLoading || total === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {combinedLoading ? `実行中… (${combinedProgress?.phase ?? ''})` : `Phase0→1→2 一気に（${batchSize}件）`}
              </button>
              {combinedProgress && (
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {combinedProgress.phase}: {combinedProgress.done}/{combinedProgress.total}
                  {combinedProgress.workId && ` (${combinedProgress.workId}${combinedProgress.detail ? ` ${combinedProgress.detail}` : ''})`}
                </span>
              )}
              {combinedResult && (
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                  結果: タグ済 {combinedResult.tagged}件 / 人間確認 {combinedResult.needsHumanCheck}件 / 問題あり {combinedResult.hasIssues}件
                </span>
              )}
            </>
          )}
        {showTagBatchResults && tagBatchResults.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '8px', maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Phase0 タグ付け結果</h3>
                <button type="button" onClick={() => setShowTagBatchResults(false)} style={{ padding: '0.35rem 0.7rem', cursor: 'pointer' }}>閉じる</button>
              </div>
              <p style={{ color: '#666', marginBottom: '0.75rem' }}>{tagBatchResults.length}件をタグ付けし、チェック待ちに入れました</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', fontSize: '0.85rem' }}>
                {tagBatchResults.map((r) => (
                  <span key={r.workId} style={{ padding: '0.2rem 0.4rem', background: '#e8f5e9', borderRadius: '4px' }} title={r.title}>
                    {r.workId} (+{r.additionalSTags + r.aTags + r.bTags + r.characterName}tags)
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
          {(filter === 'pending' || filter === 'legacy_ai') && (
            <button
              type="button"
              onClick={copyForCheck}
              disabled={copyingForCheck || batchWorks.length === 0}
              style={{
                padding: '0.4rem 0.9rem',
                backgroundColor: batchWorks.length === 0 ? '#ccc' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchWorks.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {copyingForCheck ? '取得中…' : 'AIにタグチェックさせるためのコピペ'}
            </button>
          )}
          {filter === 'pending' && (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (groqCheckLoading || total === 0) return;
                  setGroqCheckLoading(true);
                  try {
                    const res = await fetch('/api/admin/groq-check-phase1', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      const displayResult = data.result === '人間による確認が必要' ? '問題あり' : data.result;
                      alert(`✅ ${data.workId} をチェックしました（${displayResult}）`);
                      fetchList();
                      fetchCounts();
                      if (data.result === '人間による確認が必要') {
                        setFilter('has_issues');
                      } else if (data.result === 'タグ済') {
                        setFilter('tagged');
                      }
                    } else {
                      alert(`エラー: ${data.error}${data.detail ? '\n' + data.detail : ''}`);
                    }
                  } catch (e) {
                    alert(`エラー: ${e instanceof Error ? e.message : String(e)}`);
                  } finally {
                    setGroqCheckLoading(false);
                  }
                }}
                disabled={groqCheckLoading || total === 0}
                style={{
                  padding: '0.4rem 0.9rem',
                  backgroundColor: groqCheckLoading || total === 0 ? '#ccc' : '#6f42c1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: groqCheckLoading || total === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {groqCheckLoading ? 'Phase1実行中…' : 'Phase1: 振り分けチェック'}
              </button>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value) as 2 | 5 | 10 | 20 | 50 | 100)}
                style={{ padding: '0.35rem', fontSize: '0.85rem' }}
              >
                {([2, 5, 10, 20, 50, 100] as const).map((n) => (
                  <option key={n} value={n}>{n}件</option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  if (groqCheckLoading || total === 0) return;
                  setGroqCheckLoading(true);
                  setBatchProgress({ done: 0, total: batchSize });
                  try {
                    const res = await fetch(`/api/admin/groq-check-batch?count=${batchSize}`, { method: 'POST' });
                    if (!res.ok || !res.body) {
                      const err = await res.json().catch(() => ({ error: res.statusText }));
                      throw new Error(err.error || res.statusText);
                    }
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let finalData: { success?: boolean; count?: number; results?: Array<{ result: string }>; error?: string } | null = null;
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      buffer += decoder.decode(value, { stream: true });
                      const lines = buffer.split('\n');
                      buffer = lines.pop() ?? '';
                      for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                          const obj = JSON.parse(line) as { type?: string; done?: number; total?: number; workId?: string; result?: string; error?: string; success?: boolean; count?: number; results?: Array<{ result: string }> };
                          if (obj.type === 'progress') {
                            setBatchProgress({ done: obj.done ?? 0, total: obj.total ?? batchSize, workId: obj.workId, result: obj.result });
                          } else if (obj.type === 'done') {
                            finalData = { success: obj.success, count: obj.count, results: obj.results };
                          } else if (obj.type === 'error') {
                            throw new Error(obj.error || 'Unknown error');
                          }
                        } catch (parseErr) {
                          if (parseErr instanceof SyntaxError) continue;
                          throw parseErr;
                        }
                      }
                    }
                    setBatchProgress(null);
                    if (finalData?.success) {
                      const taggedCount = finalData.results?.filter((r) => r.result === 'タグ済').length ?? 0;
                      alert(`✅ ${finalData.count}件をチェックしました。タグ済: ${taggedCount}件`);
                      fetchList();
                      fetchCounts();
                      setShowBatchResults(true);
                      const runsRes = await fetch('/api/admin/check-batch-runs?limit=10');
                      const runsData = await runsRes.json();
                      if (runsData.success && runsData.runs) setBatchRuns(runsData.runs);
                    }
                  } catch (e) {
                    setBatchProgress(null);
                    alert(`エラー: ${e instanceof Error ? e.message : String(e)}`);
                  } finally {
                    setGroqCheckLoading(false);
                  }
                }}
                disabled={groqCheckLoading || total === 0}
                style={{
                  padding: '0.4rem 0.9rem',
                  backgroundColor: groqCheckLoading || total === 0 ? '#ccc' : '#0d6efd',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: groqCheckLoading || total === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Phase1+2連続（{batchSize}件）
              </button>
              {batchProgress && (
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {batchProgress.done}/{batchProgress.total} 件完了
                  {batchProgress.workId && ` (${batchProgress.workId}: ${batchProgress.result === 'タグ済' ? '✓' : '問題あり'})`}
                </span>
              )}
              <button
                type="button"
                onClick={async () => {
                  setShowBatchResults(true);
                  const res = await fetch('/api/admin/check-batch-runs?limit=20');
                  const data = await res.json();
                  if (data.success && data.runs) setBatchRuns(data.runs);
                }}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', border: '1px solid #666', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
              >
                チェック結果一覧
              </button>
            </>
          )}
        </div>

        {(filter === 'untagged' || filter === 'legacy_ai') && (
          <details style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>【反映手順】AIが返したJSONをチェック待ちに入れる（タグ付け用）</summary>
            <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0, lineHeight: 1.6 }}>
              <li>AIが返した<strong>JSON配列</strong>（各要素に workId, matchedTags, tagReasoning など）を、<code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>data/chatgpt-export/tagging-pending.json</code> に保存する（ファイル名は固定）</li>
              <li>プロジェクトのルートでターミナルを開き、次を実行する:<br />
                <code style={{ display: 'block', marginTop: '0.25rem', background: '#eee', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  npx tsx scripts/apply-tagging.ts
                </code>
              </li>
              <li>成功すると、対象作品にタグが付き、<strong>★チェック待ち(作品)</strong>の先頭に並ぶ。この画面の「チェック待ち」タブで確認・修正する。</li>
            </ol>
          </details>
        )}
        {showBatchResults && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '8px', maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>チェック結果一覧</h3>
                <button type="button" onClick={() => setShowBatchResults(false)} style={{ padding: '0.35rem 0.7rem', cursor: 'pointer' }}>閉じる</button>
              </div>
              {batchRuns.length === 0 ? (
                <p style={{ color: '#666' }}>実行履歴がありません。Phase1+2連続を実行するとここに表示されます。</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {batchRuns.map((run) => {
                    let results: Array<{ workId: string; title: string; result: string; checkReasoning?: Record<string, string> }> = [];
                    try {
                      results = JSON.parse(run.resultsJson);
                    } catch { /* ignore */ }
                    return (
                      <details key={run.id} style={{ border: '1px solid #ddd', borderRadius: '6px', padding: '0.6rem' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                          {new Date(run.createdAt).toLocaleString('ja-JP')} — {run.batchSize}件
                        </summary>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {results.map((r) => (
                              <span key={r.workId} style={{ padding: '0.2rem 0.4rem', background: r.result === 'タグ済' ? '#d4edda' : '#fff3cd', borderRadius: '4px', fontSize: '0.8rem' }} title={r.title}>
                                {r.workId} {r.result === 'タグ済' ? '✓' : '問題あり'}
                              </span>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {(filter === 'pending' || filter === 'legacy_ai') && (
          <details style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>【反映手順】AIが返したチェック結果JSONでフォルダを動かす</summary>
            <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0, lineHeight: 1.6 }}>
              <li>AIが返した<strong>チェック結果のJSON</strong>（各要素に workId, result: 「タグ済」or「問題あり」）を、<code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>data/chatgpt-export/check-result.json</code> に保存する</li>
              <li>プロジェクトのルートで次を実行する:<br />
                <code style={{ display: 'block', marginTop: '0.25rem', background: '#eee', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  npx tsx scripts/apply-check-result.ts data/chatgpt-export/check-result.json
                </code>
              </li>
              <li>成功すると、各作品が<strong>タグ済み</strong>または<strong>問題あり</strong>（Phase2で提案すると<strong>人間確認</strong>に移動）に振り分けられる。</li>
            </ol>
          </details>
        )}
      </div>
      )}

      {filter === 'has_issues' && (
      <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #fd7e14', borderRadius: '6px', background: '#fff8f0' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Phase2: 追加提案</div>
        <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          問題ありの先頭1件について、allTags から不足タグを提案して人間確認フォルダに移動します。
        </p>
        <button
          type="button"
          onClick={async () => {
            if (groqCheckLoading || total === 0) return;
            setGroqCheckLoading(true);
            try {
              const res = await fetch('/api/admin/groq-check-phase2', { method: 'POST' });
              const data = await res.json();
              if (data.success) {
                alert(`✅ ${data.workId} に追加提案を反映しました（人間確認へ移動）`);
                fetchList();
                fetchCounts();
                setFilter('needs_human_check');
              } else {
                alert(`エラー: ${data.error}${data.detail ? '\n' + data.detail : ''}`);
              }
            } catch (e) {
              alert(`エラー: ${e instanceof Error ? e.message : String(e)}`);
            } finally {
              setGroqCheckLoading(false);
            }
          }}
          disabled={groqCheckLoading || total === 0}
          style={{
            padding: '0.4rem 0.9rem',
            backgroundColor: groqCheckLoading || total === 0 ? '#ccc' : '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: groqCheckLoading || total === 0 ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
          }}
        >
          {groqCheckLoading ? 'Phase2実行中…' : 'Phase2: 追加提案'}
        </button>
      </div>
      )}

      {listLoading && <p>一覧読み込み中...</p>}
      {!listLoading && works.length === 0 && <p>該当する作品がありません。</p>}
      {!listLoading && works.length > 0 && (filter === 'tagged' || filter === 'needs_review') && currentIndex < 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ marginBottom: '0.5rem' }}>
            総数: {total} 件（新しい順）
            {filter === 'tagged' && ' — タグ済みに入れた日時で整列'}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid #ddd', borderRadius: '4px', maxHeight: '60vh', overflowY: 'auto' }}>
            {works.map((w, i) => (
              <li
                key={w.workId}
                onClick={() => setCurrentIndex(i)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderBottom: i < works.length - 1 ? '1px solid #eee' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f8ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
              >
                <span style={{ display: 'block' }}>{w.title || w.workId}</span>
                {filter === 'tagged' && w.taggedAt != null && (
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    取得時刻：{formatTaggedAt(w.taggedAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!listLoading && works.length > 0 && ((filter !== 'tagged' && filter !== 'needs_review') || currentIndex >= 0) && (
        <>
          <p style={{ marginBottom: '0.5rem' }}>
            {(filter === 'tagged' || filter === 'needs_review') && (
              <button
                type="button"
                onClick={() => { setCurrentIndex(-1); setDetail(null); }}
                style={{ marginRight: '1rem', padding: '0.35rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                一覧に戻る
              </button>
            )}
            {currentIndex + 1} / {works.length} 件（総数: {total}）
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

          <details style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>一覧でフォルダを変更（開いて一括操作）</summary>
            <div style={{ marginTop: '0.5rem', maxHeight: '240px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '0.5rem', background: '#fafafa' }}>
              {works.slice(0, 50).map((w) => (
                <div key={w.workId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 200px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.title}>{w.workId} {w.title.slice(0, 36)}{w.title.length > 36 ? '…' : ''}</span>
                  <select
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', minWidth: '150px' }}
                    defaultValue=""
                    onChange={async (e) => {
                      const folder = e.target.value as FilterType;
                      if (!folder) return;
                      try {
                        const res = await fetch(`/api/admin/manual-tagging/works/${w.workId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manualTaggingFolder: folder }) });
                        if (res.ok) {
                          fetchList();
                          fetchCounts();
                          if (detail?.workId === w.workId) setDetail((d) => (d ? { ...d, manualTaggingFolder: folder } : null));
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  >
                    <option value="">移動先を選ぶ</option>
                    {(['tagged', 'needs_human_check', 'has_issues', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const).map((f) => (
                      <option key={f} value={f}>{FOLDER_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              ))}
              {works.length > 50 && <div style={{ fontSize: '0.8rem', color: '#666' }}>… 先頭50件のみ表示</div>}
            </div>
          </details>

          {detailLoading && <p>作品読み込み中...</p>}
          {!detailLoading && detail && (
            <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(240px, 0.7fr) minmax(380px, 1.2fr)', gap: '1rem', alignItems: 'start', minHeight: '400px' }}>
              {/* 左: フォルダ移動 + タイトル */}
              <div style={{ width: '200px' }}>
                <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>フォルダを移動</div>
                <select
                  value={formFolder}
                  onChange={(e) => { setFormFolder(e.target.value as FilterType); setDirty(true); }}
                  style={{ width: '100%', padding: '0.35rem', marginBottom: '0.35rem', fontSize: '0.85rem' }}
                >
                  {(['tagged', 'needs_human_check', 'has_issues', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const).map((f) => (
                    <option key={f} value={f}>{FOLDER_LABELS[f]}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <button type="button" onClick={() => { setFormFolder('tagged'); setDirty(true); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', backgroundColor: formFolder === 'tagged' ? '#28a745' : '#eee', color: formFolder === 'tagged' ? 'white' : '#333', border: 'none', borderRadius: '4px' }}>→ タグ済</button>
                  <button type="button" onClick={() => { setFormFolder('has_issues'); setDirty(true); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', backgroundColor: formFolder === 'has_issues' ? '#dc3545' : '#eee', color: formFolder === 'has_issues' ? 'white' : '#333', border: 'none', borderRadius: '4px' }}>→ 問題あり</button>
                  <button type="button" onClick={() => { setFormFolder('needs_human_check'); setDirty(true); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', backgroundColor: formFolder === 'needs_human_check' ? '#fd7e14' : '#eee', color: formFolder === 'needs_human_check' ? 'white' : '#333', border: 'none', borderRadius: '4px' }}>→ 人間確認</button>
                  <button type="button" onClick={() => { setFormFolder('pending'); setDirty(true); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', backgroundColor: formFolder === 'pending' ? '#0070f3' : '#eee', color: formFolder === 'pending' ? 'white' : '#333', border: 'none', borderRadius: '4px' }}>→ チェック待ち</button>
                </div>
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
              <div style={{ minWidth: '380px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {detail.lastTaggingReasoning && Object.keys(detail.lastTaggingReasoning).length > 0 ? (
                  <div style={{ padding: '0.6rem', background: '#f0f4f8', border: '1px solid #c9d6e3', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Phase0 のタグ付け理由</div>
                    <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                      {Object.entries(detail.lastTaggingReasoning).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: '0.2rem' }}><span style={{ color: '#666' }}>{k}:</span> {String(v)}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(detail.lastCheckReasoning && Object.keys(detail.lastCheckReasoning).length > 0) || (detail.lastCheckResultJson && Array.isArray((detail.lastCheckResultJson as { issues?: string[] }).issues) && (detail.lastCheckResultJson as { issues: string[] }).issues.length > 0) ? (
                  <div style={{ padding: '0.6rem', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Phase1 のチェック判断理由</div>
                    {detail.lastCheckReasoning && Object.keys(detail.lastCheckReasoning).length > 0 && (
                      <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                        {Object.entries(detail.lastCheckReasoning).map(([k, v]) => (
                          <div key={k} style={{ marginBottom: '0.2rem' }}><span style={{ color: '#666' }}>{k}:</span> {String(v)}</div>
                        ))}
                      </div>
                    )}
                    {detail.lastCheckResultJson && Array.isArray((detail.lastCheckResultJson as { issues?: string[] }).issues) && ((detail.lastCheckResultJson as { issues: string[] }).issues.length ?? 0) > 0 ? (
                      <div style={{ fontSize: '0.8rem', lineHeight: 1.5, marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #dee2e6' }}>
                        <div style={{ fontWeight: 'bold', color: '#856404', marginBottom: '0.2rem' }}>指摘（issues）:</div>
                        {(detail.lastCheckResultJson as { issues: string[] }).issues.map((issue, i) => (
                          <div key={i} style={{ marginBottom: '0.15rem', color: '#856404' }}>• {issue}</div>
                        ))}
                      </div>
                    ) : null}
                    {detail.lastCheckResultJson ? (
                      <details style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}>
                        <summary style={{ cursor: 'pointer', color: '#666' }}>出力 JSON を表示</summary>
                        <pre style={{ marginTop: '0.25rem', padding: '0.4rem', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {JSON.stringify(detail.lastCheckResultJson, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
                {detail.lastCheckTagChanges &&
                  (detail.lastCheckTagChanges.added.length > 0 ||
                    detail.lastCheckTagChanges.removed.length > 0 ||
                    (detail.lastCheckTagChanges.newProposal ?? '').trim()) && (
                  <div style={{ padding: '0.6rem', background: '#f0f8ff', border: '1px solid #b8d4e8', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>AIチェックによる修正提案</div>
                    <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.4rem' }}>
                      受け入れると左のフォルダが「タグ済」になります。次を開くと保存されます。内容は残してあるので後から見返せます。
                    </div>
                    {detail.lastCheckTagChanges.added.length > 0 && (
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: '#0d6efd', fontWeight: 'bold' }}>追加推奨:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                          {detail.lastCheckTagChanges.added.map((tag) => {
                            const rank = allTags?.s?.includes(tag) ? 'S' : allTags?.a?.includes(tag) ? 'A' : allTags?.b?.includes(tag) ? 'B' : 'C';
                            const alreadyIn = rank === 'S' ? formAdditionalS.includes(tag) : rank === 'A' ? formA.includes(tag) : rank === 'B' ? formB.includes(tag) : formC.includes(tag);
                            return (
                            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              {tag}
                              {alreadyIn ? (
                                <span style={{ fontSize: '0.7rem', color: '#28a745' }}>✓ 反映済</span>
                              ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const newAddS = rank === 'S' ? [...formAdditionalS, tag] : formAdditionalS;
                                  const newA = rank === 'A' ? [...formA, tag] : formA;
                                  const newB = rank === 'B' ? [...formB, tag] : formB;
                                  const newC = rank === 'C' ? [...formC, tag] : formC;
                                  setFormAdditionalS(newAddS);
                                  setFormA(newA);
                                  setFormB(newB);
                                  setFormC(newC);
                                  setFormFolder('tagged');
                                  setDetail((d) => (d ? { ...d, manualTaggingFolder: 'tagged' } : null));
                                  setDirty(true);
                                }}
                                style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', cursor: 'pointer', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px' }}
                              >
                                受け入れる
                              </button>
                              )}
                            </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {detail.lastCheckTagChanges.removed.length > 0 && (
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: '#666', fontWeight: 'bold' }}>削除推奨:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                          {detail.lastCheckTagChanges.removed.map((tag) => {
                            const stillHas = formAdditionalS.includes(tag) || formA.includes(tag) || formB.includes(tag) || formC.includes(tag);
                            return (
                            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <span style={{ textDecoration: 'line-through' }}>{tag}</span>
                              {stillHas ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const remSet = new Set([tag]);
                                  const newAddS = formAdditionalS.filter((x) => !remSet.has(x));
                                  const newA = formA.filter((x) => !remSet.has(x));
                                  const newB = formB.filter((x) => !remSet.has(x));
                                  const newC = formC.filter((x) => !remSet.has(x));
                                  setFormAdditionalS(newAddS);
                                  setFormA(newA);
                                  setFormB(newB);
                                  setFormC(newC);
                                  setFormFolder('tagged');
                                  setDetail((d) => (d ? { ...d, manualTaggingFolder: 'tagged' } : null));
                                  setDirty(true);
                                }}
                                style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', cursor: 'pointer', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px' }}
                              >
                                削除を反映
                              </button>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: '#28a745' }}>✓ 反映済</span>
                              )}
                            </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(detail.lastCheckTagChanges.newProposal ?? '').trim() && (
                      <div style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
                        <span style={{ color: '#28a745', fontWeight: 'bold' }}>新規提案タグ:</span> {detail.lastCheckTagChanges.newProposal}
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          {(['A', 'B', 'C'] as const).map((rank) => (
                            <button
                              key={rank}
                              type="button"
                              onClick={() => {
                                const tag = detail.lastCheckTagChanges!.newProposal!.trim();
                                const newA = rank === 'A' ? (formA.includes(tag) ? formA : [...formA, tag]) : formA;
                                const newB = rank === 'B' ? (formB.includes(tag) ? formB : [...formB, tag]) : formB;
                                const newC = rank === 'C' ? (formC.includes(tag) ? formC : [...formC, tag]) : formC;
                                setFormA(newA);
                                setFormB(newB);
                                setFormC(newC);
                                setFormFolder('tagged');
                                setDetail((d) => (d ? { ...d, manualTaggingFolder: 'tagged' } : null));
                                setDirty(true);
                              }}
                              style={{
                                padding: '0.15rem 0.5rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                backgroundColor: RANK_COLORS[rank].border,
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                              }}
                            >
                              {rank}で受け入れる
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const tag = detail.lastCheckTagChanges!.newProposal!.trim();
                              setFormCharacter(tag);
                              setFormFolder('tagged');
                              setDetail((d) =>
                                d?.lastCheckTagChanges
                                  ? { ...d, lastCheckTagChanges: { ...d.lastCheckTagChanges, newProposal: undefined } }
                                  : d
                              );
                              setDirty(true);
                            }}
                            style={{
                              padding: '0.15rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              backgroundColor: RANK_COLORS.X.border,
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                            }}
                          >
                            キャラで受け入れる
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDetail((d) =>
                                d?.lastCheckTagChanges ? { ...d, lastCheckTagChanges: { ...d.lastCheckTagChanges, newProposal: undefined } } : d
                              );
                              setDirty(true);
                            }}
                            style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', backgroundColor: '#999', color: 'white', border: 'none', borderRadius: '4px' }}
                          >
                            受け入れない
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
