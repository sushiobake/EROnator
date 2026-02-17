'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RANK_CHIP } from '../constants/rankColors';

type FilterType = 'tagged' | 'needs_human_check' | 'pending' | 'untagged' | 'legacy_ai' | 'needs_review';

const FOLDER_LABELS: Record<FilterType, string> = {
  tagged: 'タグ済',
  needs_human_check: '人間による確認が必要',
  pending: 'チェック待ち',
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
  /** AIチェック時の追加推奨・削除推奨。受け入れるとタグに反映される */
  lastCheckTagChanges?: { added: string[]; removed: string[] } | null;
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
  const [batchSize, setBatchSize] = useState<5 | 10 | 20 | 50 | 100>(10);
  const [batchWorks, setBatchWorks] = useState<Array<{ workId: string; title: string }>>([]);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchSelect, setShowBatchSelect] = useState(false);
  const [copyingForGpt, setCopyingForGpt] = useState(false);
  const [copyingForCheck, setCopyingForCheck] = useState(false);

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
      const details = await Promise.all(
        batchWorks.map((w) =>
          fetch(`/api/admin/manual-tagging/works/${w.workId}`)
            .then((r) => r.json())
            .then((d) => (d.success && d.work ? d.work : null))
        )
      );
      const instruction = `【GPTへの指示】

■ ゴール（ここまでやって終わり）
・あなたがタグ付け（通常タグ＋キャラタグ）→ JSON を返す → その JSON を保存 → apply を実行 → 対象作品が「チェック待ち」フォルダの先頭に並ぶ。ユーザーは確認するだけ（保存も apply もやらない）。
・apply を実行しないとチェック待ちに並ばない。必ず apply まで実行すること。

■ ルール
・docs/legacy-ai-tagging-instruction.md に従う。
・各作品: (1) タイトルからタグを取る (2) **キャラタグ**: commentText に登場人物の名前が出ていれば characterName に必ず入れる、なければ null。各オブジェクトに characterName を必ず含める（省略禁止）(3) タイトルに数字・続編・総集編・編があればシリーズ系タグを1つ。
・出力: workId, title, matchedTags, suggestedTags, additionalSTags, characterName, tagReasoning の JSON 配列。workId は一覧に表示された値そのまま（cid: などを付け足さない・削らない）。

■ あなたがやること（全部）
1. タグ付けして JSON 配列を返す
2. 返した JSON を data/chatgpt-export/ に保存（例: cursor-analysis-untagged-10-batch1.json）
3. ターミナルで実行: npx tsx scripts/apply-cursor-legacy-ai-batch.ts 保存したファイル名.json
→ 完了。対象は「チェック待ち」フォルダの先頭に並んでいる。

【対象作品（この一覧の workId のみを処理してください）】
`;
      const body = details
        .map((d, i) => {
          if (!d) return `[${batchWorks[i]!.workId}] ${batchWorks[i]!.title}\n（取得失敗）`;
          const comment = (d.commentText || '').slice(0, 3000);
          return `---\nworkId: ${d.workId}\ntitle: ${d.title}\ncommentText:\n${comment}${comment.length >= 3000 ? '\n...(省略)' : ''}`;
        })
        .join('\n\n');
      const text = instruction + '\n' + body;
      await navigator.clipboard.writeText(text);
      alert(`クリップボードにコピーしました（${batchWorks.length}件）。AIにそのまま貼り付けてください。`);
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
      const details = await Promise.all(
        batchWorks.map((w) =>
          fetch(`/api/admin/manual-tagging/works/${w.workId}`)
            .then((r) => r.json())
            .then((d) => (d.success && d.work ? d.work : null))
        )
      );
      const payload = details.map((d, i) => {
        if (!d) {
          return { workId: batchWorks[i]!.workId, title: batchWorks[i]!.title, commentText: '', derivedTags: [], officialTags: [], characterName: null };
        }
        const derivedTags = [...(d.aTags || []), ...(d.bTags || []), ...(d.cTags || [])];
        const officialTags = [
          ...(d.officialTags || []).map((t: { displayName: string }) => t.displayName),
          ...(d.additionalSTags || []).map((t: { displayName: string }) => t.displayName),
        ];
        const characterName = (d.characterTags && d.characterTags.length > 0) ? d.characterTags[0] : null;
        return {
          workId: d.workId,
          title: d.title,
          commentText: d.commentText || '',
          derivedTags,
          officialTags,
          characterName,
        };
      });
      const instruction = `【AIへの指示】タグチェックを行ってください。docs/check-instruction.md（チェック指示書）に従い、各作品について「タイトル＋コメント」と「公式タグ＋付け加えたタグ」の対応を確認し、問題なければ「タグ済」、問題あれば「人間による確認が必要」と判定して返してください。タグを修正した場合は追加・削除したタグを明記してください。結果に応じて作品はタグ済フォルダか人間による確認が必要フォルダに振り分けられます。

【対象作品（JSON。この配列をそのままチェックしてください）】
`;
      const text = instruction + JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(text);
      alert(`クリップボードにコピーしました（${batchWorks.length}件）。AIにタグチェックさせる際にそのまま貼り付けてください。`);
    } catch (e) {
      console.error(e);
      alert('コピーに失敗しました。');
    } finally {
      setCopyingForCheck(false);
    }
  }, [batchWorks]);

  const filterLabels: { value: FilterType; label: string }[] = (
    ['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const
  ).map((value) => ({ value, label: FOLDER_LABELS[value] }));

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>人力タグ付け</h2>
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

      {/* AIタグ付け用バッチ: チェック待ち(pending)・未タグ・旧AIタグの3タブのみ表示。タブごとにコピペボタンを出し分け */}
      {(filter === 'pending' || filter === 'untagged' || filter === 'legacy_ai') && (
      <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '6px', background: '#f9f9f9' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.95rem' }}>AIタグ付け用バッチ</div>
        {filter === 'pending' && (
          <>
            <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              対象を決めたあと「AIにタグチェックさせるためのコピペ」を押すと、指示文＋作品データがクリップボードに入ります。AIに貼り付けてタグチェックを依頼してください。
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
          {([5, 10, 20, 50, 100] as const).map((n) => (
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
        </div>

        {(filter === 'untagged' || filter === 'legacy_ai') && (
          <details style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>【反映手順】AIが返したJSONをチェック待ちに入れる（タグ付け用）</summary>
            <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0, lineHeight: 1.6 }}>
              <li>AIが返した<strong>JSON配列</strong>（各要素に workId, matchedTags, tagReasoning など）を、<code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>data/chatgpt-export/</code> フォルダに保存する。例: <code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>cursor-analysis-untagged-10-batch1.json</code></li>
              <li>プロジェクトのルートでターミナルを開き、次を実行する:<br />
                <code style={{ display: 'block', marginTop: '0.25rem', background: '#eee', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  npx tsx scripts/apply-cursor-legacy-ai-batch.ts data/chatgpt-export/保存したファイル名.json
                </code>
              </li>
              <li>成功すると、対象作品にタグが付き、<strong>★チェック待ち(作品)</strong>の先頭に並ぶ。この画面の「チェック待ち」タブで確認・修正する。</li>
            </ol>
          </details>
        )}
        {(filter === 'pending' || filter === 'legacy_ai') && (
          <details style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>【反映手順】AIが返したチェック結果JSONでフォルダを動かす</summary>
            <ol style={{ margin: '0.5rem 0 0 1.2rem', padding: 0, lineHeight: 1.6 }}>
              <li>AIが返した<strong>チェック結果のJSON</strong>（各要素に workId, result: 「タグ済」or「人間による確認が必要」）を、<code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>data/chatgpt-export/</code> に保存する。例: <code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>check-result.json</code></li>
              <li>プロジェクトのルートで次を実行する:<br />
                <code style={{ display: 'block', marginTop: '0.25rem', background: '#eee', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  npx tsx scripts/apply-check-result.ts data/chatgpt-export/保存したファイル名.json
                </code>
              </li>
              <li>成功すると、各作品が<strong>タグ済み</strong>または<strong>人間による確認が必要</strong>に振り分けられ、<strong>タグ済みタブの一覧の先頭</strong>（タグ済みに入れた日時が新しい順）に並ぶ。</li>
            </ol>
          </details>
        )}
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
                    {(['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const).map((f) => (
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
            <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(340px, 1fr) minmax(300px, 340px)', gap: '1rem', alignItems: 'start', minHeight: '400px' }}>
              {/* 左: フォルダ移動 + タイトル */}
              <div style={{ width: '200px' }}>
                <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>フォルダを移動</div>
                <select
                  value={formFolder}
                  onChange={(e) => { setFormFolder(e.target.value as FilterType); setDirty(true); }}
                  style={{ width: '100%', padding: '0.35rem', marginBottom: '0.35rem', fontSize: '0.85rem' }}
                >
                  {(['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const).map((f) => (
                    <option key={f} value={f}>{FOLDER_LABELS[f]}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <button type="button" onClick={() => { setFormFolder('tagged'); setDirty(true); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', backgroundColor: formFolder === 'tagged' ? '#28a745' : '#eee', color: formFolder === 'tagged' ? 'white' : '#333', border: 'none', borderRadius: '4px' }}>→ タグ済</button>
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
              <div style={{ minWidth: '300px', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {detail.lastCheckTagChanges && (detail.lastCheckTagChanges.added.length > 0 || detail.lastCheckTagChanges.removed.length > 0) && (
                  <div style={{ padding: '0.6rem', background: '#f0f8ff', border: '1px solid #b8d4e8', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.2rem' }}>AIチェックによる修正提案</div>
                    <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.4rem' }}>
                      チェック結果を反映したとき、AIが提案した追加・削除タグです。「すべて受け入れる」でフォームに反映し、保存すると確定します。一部だけ変えたい場合は受け入れたあと手動で編集してください。
                    </div>
                    {detail.lastCheckTagChanges.added.length > 0 && (
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#0d6efd', fontWeight: 'bold' }}>追加推奨:</span>{' '}
                        {detail.lastCheckTagChanges.added.join('、')}
                      </div>
                    )}
                    {detail.lastCheckTagChanges.removed.length > 0 && (
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: '#666', fontWeight: 'bold' }}>削除推奨:</span>{' '}
                        <span style={{ textDecoration: 'line-through' }}>{detail.lastCheckTagChanges.removed.join('、')}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const { added, removed } = detail.lastCheckTagChanges!;
                        const remSet = new Set(removed);
                        setFormAdditionalS((prev) => prev.filter((x) => !remSet.has(x)));
                        setFormA((prev) => [...prev.filter((x) => !remSet.has(x)), ...added]);
                        setFormB((prev) => prev.filter((x) => !remSet.has(x)));
                        setFormC((prev) => prev.filter((x) => !remSet.has(x)));
                        setFormFolder('tagged');
                        setDetail((d) => (d && d.lastCheckTagChanges ? { ...d, lastCheckTagChanges: null, manualTaggingFolder: 'tagged' } : d));
                        setDirty(true);
                      }}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                      すべて受け入れる
                    </button>
                    <span style={{ fontSize: '0.75rem', color: '#555', marginLeft: '0.35rem' }}>（保存時にタグ済に移動）</span>
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
