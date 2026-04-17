/**
 * タグ管理コンポーネント（統合ビュー）
 * ランク: S（OFFICIAL）、A/B/C（DERIVED）、X（STRUCTURAL）
 * S/Xは編集不可、A/B/Cは編集可能
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RANK_BG, RANK_TEXT } from '../constants/rankColors';
import { getWorkCountIntensity, getWorkCountRowAlphaHex } from '../utils/tagWorkCount';

interface TagItem {
  tagKey: string;
  displayName: string;
  tagType: string;
  category: string | null;
  displayCategory?: string;
  questionText?: string | null;
  workCount: number;
}

interface BannedTag {
  pattern: string;
  type: 'exact' | 'startsWith' | 'contains' | 'regex';
  reason?: string;
  addedAt?: string;
}

interface Props {
  adminToken: string;
}

// 統合ランク: S（OFFICIAL）、A/B/C（DERIVED）、X（STRUCTURAL）、N（未分類）
type UnifiedRank = 'S' | 'A' | 'B' | 'C' | 'X' | 'N' | '';
type ReflectionChangeType = 'DB_ONLY' | 'CONFIG_ONLY' | 'MIXED_OR_LOGIC';
type ReflectionChecklistState = {
  matrixDone: boolean;
  dbSynced: boolean;
  deployed: boolean;
  required: { matrix: boolean; db: boolean; deploy: boolean };
  lastChangeType: ReflectionChangeType | null;
  lastChangeLabel: string;
  updatedAt: string;
};

const PAGE_SIZE = 200;
const REFLECTION_CHECKLIST_STORAGE_KEY = 'eronator.admin.reflection-checklist.v1';
const REFLECTION_CHECKLIST_UPDATED_EVENT = 'eronator:reflection-checklist-updated';
const REFLECTION_CHANGE_TEMPLATES: Record<ReflectionChangeType, {
  title: string;
  whatChanged: string;
  nextActions: string[];
  required: { matrix: boolean; db: boolean; deploy: boolean };
}> = {
  DB_ONLY: {
    title: 'DB更新（ランク・カテゴリ・質問文など）',
    whatChanged: '本番に合わせるには DB 側の同期が必要です。',
    nextActions: [
      '本番DBへ同等の変更を反映します。',
      '質問文変更時は実プレイ/シミュレーションで表示を確認します。',
      '反映後の件数・対象タグを再確認します。',
    ],
    required: { matrix: false, db: true, deploy: false },
  },
  CONFIG_ONLY: {
    title: '設定更新（統合・包括）',
    whatChanged: 'include/unify 定義が変わり、質問選択や推薦結果に影響します。',
    nextActions: [
      'シミュレーションタブで「行列を再生成」を実行します。',
      '本番反映としてデプロイを実行します。',
      '反映後にタグ表示・推薦候補・シミュレーション結果を確認します。',
    ],
    required: { matrix: true, db: false, deploy: true },
  },
  MIXED_OR_LOGIC: {
    title: 'ロジック/質問系更新（まとめ質問・特別質問）',
    whatChanged: '質問出題や分岐ロジックに影響するため、DB同期とデプロイの両方を確認します。',
    nextActions: [
      '本番DBが関係する変更を同期します。',
      '本番デプロイを実行します。',
      '本番相当条件で質問分岐と文面を確認します。',
    ],
    required: { matrix: false, db: true, deploy: true },
  },
};
const TAG_MANAGER_REFLECTION_MEMOS: Array<{ title: string; notes: string[] }> = [
  {
    title: 'ランク・カテゴリ・質問文を保存したとき',
    notes: [
      'DB変更です。本番反映時は本番DB側にも同等変更が必要です。',
      '質問文は統合/包括グループへ波及するため、意図しないタグまで変わっていないか確認します。',
      '保存後は実プレイまたはシミュレーションで文面と分岐を確認します。',
    ],
  },
  {
    title: '統合・包括を保存したとき',
    notes: [
      '設定ファイル変更です。行列再生成（シミュレーションタブ）を必ず実行します。',
      '本番反映はコード変更として本番デプロイが必要です。',
      '代表タグ・サブタグ表示、推薦候補、シミュレーション結果をセットで確認します。',
    ],
  },
  {
    title: '特別質問・まとめ質問を変更したとき',
    notes: [
      '質問選択ロジックに直接影響するため、実際の出題順を必ず確認します。',
      'DB変更を含む場合は本番DB同期、設定変更を含む場合は本番デプロイを行います。',
    ],
  },
];

const createEmptyReflectionChecklist = (): ReflectionChecklistState => ({
  matrixDone: false,
  dbSynced: false,
  deployed: false,
  required: { matrix: false, db: false, deploy: false },
  lastChangeType: null,
  lastChangeLabel: '',
  updatedAt: '',
});

const readReflectionChecklist = (): ReflectionChecklistState => {
  if (typeof window === 'undefined') return createEmptyReflectionChecklist();
  try {
    const raw = localStorage.getItem(REFLECTION_CHECKLIST_STORAGE_KEY);
    if (!raw) return createEmptyReflectionChecklist();
    const parsed = JSON.parse(raw) as Partial<ReflectionChecklistState>;
    return {
      matrixDone: !!parsed.matrixDone,
      dbSynced: !!parsed.dbSynced,
      deployed: !!parsed.deployed,
      required: {
        matrix: !!parsed.required?.matrix,
        db: !!parsed.required?.db,
        deploy: !!parsed.required?.deploy,
      },
      lastChangeType: parsed.lastChangeType ?? null,
      lastChangeLabel: parsed.lastChangeLabel ?? '',
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch {
    return createEmptyReflectionChecklist();
  }
};

const writeReflectionChecklist = (next: ReflectionChecklistState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFLECTION_CHECKLIST_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(REFLECTION_CHECKLIST_UPDATED_EVENT));
};

export default function TagManager({ adminToken }: Props) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ranks, setRanks] = useState<Record<string, 'A' | 'B' | 'C' | ''>>({});
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  
  // ランク表示フィルタ（複数選択）- デフォルトはS+Aのみ
  const [showRanks, setShowRanks] = useState<Set<UnifiedRank>>(new Set(['S', 'A']));
  
  // カテゴリフィルタ
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  
  // 検索
  const [searchText, setSearchText] = useState('');
  
  // 並び替え（デフォルト: 作品数多い順）
  const [sortBy, setSortBy] = useState<'workCount' | 'rank' | 'displayName'>('workCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 0件タグを非表示（デフォルトON）
  const [hideZeroCount, setHideZeroCount] = useState(true);
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);

  // 編集用
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingTemplateValue, setEditingTemplateValue] = useState('');

  // 禁止タグ用
  const [bannedTags, setBannedTags] = useState<BannedTag[]>([]);
  const [newBannedTag, setNewBannedTag] = useState<{ pattern: string; type: 'exact' | 'startsWith' | 'contains' | 'regex'; reason: string }>({
    pattern: '', type: 'contains', reason: ''
  });

  // 包括・統合（テーブル内で代表タグ直下にサブ行として表示する用）
  const [includeUnifyView, setIncludeUnifyView] = useState<{
    include: Array<{ representative: string; rank: string; questionText: string; included: Array<{ displayName: string; rank: string }> }>;
    unify: Array<{ tags: Array<{ displayName: string; rank: string }>; questionText: string }>;
    representativeCategory?: Record<string, string>;
  } | null>(null);

  // まとめ質問（全カテゴリの先頭に表示）
  const [summaryQuestions, setSummaryQuestions] = useState<Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean; disabled?: boolean }>>([]);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editingSummaryValue, setEditingSummaryValue] = useState('');

  // 使用不可タグ（質問候補に含めない）
  const [vagueDisplayNames, setVagueDisplayNames] = useState<Set<string>>(new Set());
  // エロ質問タグ（7問目以降にのみ出題）
  const [eroticDisplayNames, setEroticDisplayNames] = useState<Set<string>>(new Set());
  // 特別質問（シリーズ・文字種・有名度・50音・50音2次・作者文字種）
  const [specialQuestions, setSpecialQuestions] = useState<{
    SERIES?: { questionText?: string };
    TITLE_CHAR_TYPE?: { KANJI?: string; HIRAGANA_OR_KATAKANA?: string };
    POPULARITY?: { questionText?: string; popularityThreshold?: number };
    TITLE_SYLLABLE?: { ranges?: Array<{ id: string; label: string; questionText: string; chars: string[] }> };
    TITLE_SYLLABLE_2?: {
      branches?: Record<string, {
        yesBranch?: { label: string; questionText: string; chars: string[] };
        noBranch?: { label: string; questionText: string; chars: string[] };
      }>;
    };
    AUTHOR_CHAR_TYPE?: { HIRAGANA_OR_KATAKANA?: string; KANJI_OR_ALPHA?: string };
  } | null>(null);
  const [specialQuestionsCollapsed, setSpecialQuestionsCollapsed] = useState(true);
  const [editingSpecial, setEditingSpecial] = useState<{
    type: string;
    key?: string;
    id?: string;
    subKey?: 'questionText' | 'chars' | 'label';
    parentId?: string;
    branch?: 'yesBranch' | 'noBranch';
  } | null>(null);
  const [editingSpecialValue, setEditingSpecialValue] = useState('');
  const [includeUnifyDialogOpen, setIncludeUnifyDialogOpen] = useState(false);
  const [includeUnifyMainTagKey, setIncludeUnifyMainTagKey] = useState('');
  const [includeUnifySaving, setIncludeUnifySaving] = useState(false);
  const [reflectionModal, setReflectionModal] = useState<{
    open: boolean;
    source: 'manual' | 'auto';
    changeType: ReflectionChangeType | null;
    triggerLabel: string;
  }>({ open: false, source: 'manual', changeType: null, triggerLabel: '' });
  const [reflectionChecklist, setReflectionChecklist] = useState<ReflectionChecklistState>(() => readReflectionChecklist());

  const reflectionPendingCount = useMemo(() => {
    let n = 0;
    if (reflectionChecklist.required.matrix && !reflectionChecklist.matrixDone) n += 1;
    if (reflectionChecklist.required.db && !reflectionChecklist.dbSynced) n += 1;
    if (reflectionChecklist.required.deploy && !reflectionChecklist.deployed) n += 1;
    return n;
  }, [reflectionChecklist]);

  const activeReflectionType = reflectionModal.changeType ?? reflectionChecklist.lastChangeType;
  const activeReflectionTemplate = activeReflectionType ? REFLECTION_CHANGE_TEMPLATES[activeReflectionType] : null;

  const updateReflectionChecklist = (updater: (prev: ReflectionChecklistState) => ReflectionChecklistState) => {
    const next = updater(readReflectionChecklist());
    setReflectionChecklist(next);
    writeReflectionChecklist(next);
  };

  const openReflectionForChange = (changeType: ReflectionChangeType, triggerLabel: string) => {
    const tpl = REFLECTION_CHANGE_TEMPLATES[changeType];
    updateReflectionChecklist((prev) => ({
      ...prev,
      matrixDone: tpl.required.matrix ? false : prev.matrixDone,
      dbSynced: tpl.required.db ? false : prev.dbSynced,
      deployed: tpl.required.deploy ? false : prev.deployed,
      required: { ...tpl.required },
      lastChangeType: changeType,
      lastChangeLabel: triggerLabel,
      updatedAt: new Date().toISOString(),
    }));
    setReflectionModal({ open: true, source: 'auto', changeType, triggerLabel });
  };

  const toggleReflectionCheck = (key: 'matrixDone' | 'dbSynced' | 'deployed') => {
    updateReflectionChecklist((prev) => ({ ...prev, [key]: !prev[key], updatedAt: new Date().toISOString() }));
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== REFLECTION_CHECKLIST_STORAGE_KEY) return;
      setReflectionChecklist(readReflectionChecklist());
    };
    const onCustom = () => setReflectionChecklist(readReflectionChecklist());
    if (typeof window !== 'undefined') {
      setReflectionChecklist(readReflectionChecklist());
      window.addEventListener('storage', onStorage);
      window.addEventListener(REFLECTION_CHECKLIST_UPDATED_EVENT, onCustom);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(REFLECTION_CHECKLIST_UPDATED_EVENT, onCustom);
      }
    };
  }, []);

  // タグ読み込み
  const fetchTags = async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tags/list', {
        headers: { 'x-eronator-admin-token': adminToken }
      });
      const data = await res.json();
      if (data.tags) {
        setTags(data.tags);
        setTemplates(buildTemplatesFromTags(data.tags));
      }
      if (Array.isArray(data.categoryOrder)) {
        setCategoryOrder(data.categoryOrder);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  };

  // ランク読み込み
  const fetchRanks = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/tags/ranks', {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.ranks) {
        setRanks(data.ranks);
      }
    } catch (error) {
      console.error('Failed to fetch ranks:', error);
    }
  };

  // Phase 3: テンプレートは tags（list API の questionText）から構築。fetchTemplates は廃止。
  const buildTemplatesFromTags = (tagList: TagItem[]) => {
    const map: Record<string, string> = {};
    for (const t of tagList) {
      if (t.questionText?.trim() && !map[t.displayName]) {
        map[t.displayName] = t.questionText.trim();
      }
    }
    return map;
  };

  // 包括・統合一覧読み込み
  const fetchIncludeUnifyView = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/tags/include-unify-view', {
        headers: { 'x-eronator-admin-token': adminToken }
      });
      const data = await res.json();
      if (data.success && data.include && data.unify) {
        setIncludeUnifyView({ include: data.include, unify: data.unify, representativeCategory: data.representativeCategory });
      }
    } catch (error) {
      console.error('Failed to fetch include-unify view:', error);
    }
  };

  // 禁止タグ読み込み（API は { bannedTags: [...] } を返す）
  const fetchBannedTags = async () => {
    try {
      const res = await fetch('/api/admin/banned-tags');
      const data = await res.json();
      if (Array.isArray(data.bannedTags)) {
        setBannedTags(data.bannedTags);
      }
    } catch (error) {
      console.error('Failed to fetch banned tags:', error);
    }
  };

  // 禁止タグ追加
  const handleAddBannedTag = async () => {
    if (!newBannedTag.pattern.trim()) return;
    try {
      const res = await fetch('/api/admin/banned-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBannedTag)
      });
      const data = await res.json();
      if (data.success) {
        await fetchBannedTags();
        setNewBannedTag({ pattern: '', type: 'contains', reason: '' });
      }
    } catch (error) {
      console.error('Failed to add banned tag:', error);
    }
  };

  // 禁止タグ削除
  const handleDeleteBannedTag = async (pattern: string, type: string) => {
    if (!confirm(`「${pattern}」を削除しますか？`)) return;
    try {
      const res = await fetch('/api/admin/banned-tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, type })
      });
      const data = await res.json();
      if (data.success) {
        await fetchBannedTags();
      }
    } catch (error) {
      console.error('Failed to delete banned tag:', error);
    }
  };

  // まとめ質問読み込み
  const fetchSummaryQuestions = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/summary-questions', { headers: { 'x-eronator-admin-token': adminToken } });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) setSummaryQuestions(data.summaryQuestions);
    } catch (e) { console.error('Failed to fetch summary questions:', e); }
  };
  // 使用不可タグ読み込み
  const fetchVagueTags = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/vague-tags', { headers: { 'x-eronator-admin-token': adminToken } });
      const data = await res.json();
      if (data.success && Array.isArray(data.displayNames)) setVagueDisplayNames(new Set(data.displayNames));
    } catch (e) { console.error('Failed to fetch abstract tags:', e); }
  };
  // エロ質問タグ読み込み
  const fetchEroticTags = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/erotic-tags', { headers: { 'x-eronator-admin-token': adminToken } });
      const data = await res.json();
      if (data.success && Array.isArray(data.displayNames)) setEroticDisplayNames(new Set(data.displayNames));
    } catch (e) { console.error('Failed to fetch erotic tags:', e); }
  };

  // 特別質問読み込み
  const fetchSpecialQuestions = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/special-questions', { headers: { 'x-eronator-admin-token': adminToken } });
      const data = await res.json();
      if (data.success) {
        setSpecialQuestions({
          SERIES: data.SERIES,
          TITLE_CHAR_TYPE: data.TITLE_CHAR_TYPE,
          POPULARITY: data.POPULARITY,
          TITLE_SYLLABLE: data.TITLE_SYLLABLE,
          TITLE_SYLLABLE_2: data.TITLE_SYLLABLE_2,
          AUTHOR_CHAR_TYPE: data.AUTHOR_CHAR_TYPE,
        });
      }
    } catch (e) { console.error('Failed to fetch special questions:', e); }
  };

  useEffect(() => {
    fetchTags();
    fetchRanks();
    fetchBannedTags();
    fetchIncludeUnifyView();
    fetchSummaryQuestions();
    fetchVagueTags();
    fetchEroticTags();
    fetchSpecialQuestions();
  }, [adminToken]);

  // 統合ランクを取得
  const getUnifiedRank = (tag: TagItem): UnifiedRank => {
    if (tag.tagType === 'OFFICIAL') return 'S';
    if (tag.tagType === 'STRUCTURAL') return 'X';
    const rank = ranks[tag.displayName];
    if (rank) return rank;
    return 'N'; // 未分類
  };

  // 編集可能かどうか
  const isEditable = (tag: TagItem): boolean => {
    return tag.tagType === 'DERIVED';
  };

  // ランク更新（DERIVEDのみ）
  const handleRankChange = async (displayName: string, rank: 'A' | 'B' | 'C' | '') => {
    try {
      const res = await fetch('/api/admin/tags/ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', tagKey: displayName, rank: rank || null })
      });
      const data = await res.json();
      if (data.success) {
        setRanks(data.ranks);
        openReflectionForChange('DB_ONLY', 'ランクを更新');
      }
    } catch (error) {
      console.error('Failed to update rank:', error);
    }
  };

  // 一括ランク更新
  const handleBulkRankChange = async (rank: 'A' | 'B' | 'C' | '') => {
    if (selectedTags.size === 0) {
      alert('タグを選択してください');
      return;
    }
    // 選択されたタグのうちDERIVEDのもののdisplayNameを取得
    const displayNames = tags
      .filter(t => selectedTags.has(t.tagKey) && t.tagType === 'DERIVED')
      .map(t => t.displayName);
    
    if (displayNames.length === 0) {
      alert('編集可能なタグが選択されていません（S/Xランクは変更不可）');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/tags/ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'bulk', 
          tagKeys: displayNames, 
          ranks: rank || null 
        })
      });
      const data = await res.json();
      if (data.success) {
        setRanks(data.ranks);
        setSelectedTags(new Set());
        openReflectionForChange('DB_ONLY', 'ランクを一括更新');
      }
    } catch (error) {
      console.error('Failed to bulk update ranks:', error);
    }
  };

  const selectedTagItems = useMemo(() => {
    return tags.filter((t) => selectedTags.has(t.tagKey));
  }, [tags, selectedTags]);

  const selectedTagItemsSortedForIncludeUnify = useMemo(() => {
    const rankOrder: Record<UnifiedRank, number> = { S: 0, A: 1, B: 2, C: 3, X: 4, N: 5, '': 6 };
    const list = [...selectedTagItems];
    list.sort((a, b) => {
      const wc = b.workCount - a.workCount;
      if (wc !== 0) return wc;
      const ra = rankOrder[getUnifiedRank(a)];
      const rb = rankOrder[getUnifiedRank(b)];
      if (ra !== rb) return ra - rb;
      return a.displayName.localeCompare(b.displayName, 'ja');
    });
    return list;
  }, [selectedTagItems, ranks]);

  const includeUnifyPreview = useMemo(() => {
    const main = selectedTagItemsSortedForIncludeUnify.find((t) => t.tagKey === includeUnifyMainTagKey);
    if (!main) return { unifyMembers: [] as TagItem[], includeMembers: [] as TagItem[] };
    const mainRank = getUnifiedRank(main);
    const unifyMembers: TagItem[] = [];
    const includeMembers: TagItem[] = [];
    for (const t of selectedTagItemsSortedForIncludeUnify) {
      if (t.tagKey === main.tagKey) continue;
      if (getUnifiedRank(t) === mainRank && mainRank !== '') unifyMembers.push(t);
      else includeMembers.push(t);
    }
    return { unifyMembers, includeMembers };
  }, [selectedTagItemsSortedForIncludeUnify, includeUnifyMainTagKey, ranks]);

  const handleOpenIncludeUnifyDialog = () => {
    if (selectedTagItems.length < 2) {
      alert('2件以上のタグを選択してください');
      return;
    }
    const preferred = selectedTagItemsSortedForIncludeUnify[0];
    if (!preferred) return;
    setIncludeUnifyMainTagKey(preferred.tagKey);
    setIncludeUnifyDialogOpen(true);
  };

  const handleSaveIncludeUnify = async () => {
    const main = selectedTagItemsSortedForIncludeUnify.find((t) => t.tagKey === includeUnifyMainTagKey);
    if (!main) {
      alert('メインタグを選択してください');
      return;
    }
    const selectedDisplayNames = selectedTagItemsSortedForIncludeUnify.map((t) => t.displayName);
    if (selectedDisplayNames.length < 2) {
      alert('2件以上のタグを選択してください');
      return;
    }
    const rankByDisplayName = Object.fromEntries(
      selectedTagItemsSortedForIncludeUnify.map((t) => [t.displayName, getUnifiedRank(t)])
    );
    const ok = confirm(
      [
        'この操作は統合・包括ルールを更新します。',
        '',
        '影響範囲:',
        '- ゲーム中の質問選択・重み更新',
        '- 推薦モード（有名/無名タグ・スコア）',
        '- シミュレーション結果',
        '',
        '保存後は以下を確認してください:',
        '- タグ管理表示（代表/サブ行）',
        '- 推薦の候補と結果',
        '- シミュレーション',
      ].join('\n')
    );
    if (!ok) return;
    setIncludeUnifySaving(true);
    try {
      const res = await fetch('/api/admin/tags/include-unify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'x-eronator-admin-token': adminToken } : {}),
        },
        body: JSON.stringify({
          mainDisplayName: main.displayName,
          selectedDisplayNames,
          rankByDisplayName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || '統合・包括の保存に失敗しました');
        return;
      }
      await fetchIncludeUnifyView();
      setSelectedTags(new Set());
      setIncludeUnifyDialogOpen(false);
      openReflectionForChange('CONFIG_ONLY', '統合・包括を保存');
      alert(
        `保存しました（メイン: ${main.displayName}）\n同ランク→統合: ${data.summary?.unifyAdded ?? 0}件\n異ランク→包括: ${data.summary?.includeAdded ?? 0}件`
      );
    } catch (error) {
      console.error('Failed to save include-unify:', error);
      alert('統合・包括の保存に失敗しました');
    } finally {
      setIncludeUnifySaving(false);
    }
  };

  // タグ削除
  const handleDeleteTag = async (tagKey: string) => {
    const tag = tags.find(t => t.tagKey === tagKey);
    if (!tag || tag.tagType === 'OFFICIAL') {
      alert('このタグは削除できません');
      return;
    }
    if (!confirm(`「${tag.displayName}」を削除しますか？\n関連するWorkTagも削除されます。`)) return;
    try {
      const res = await fetch('/api/admin/tags/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagKey })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTags();
      } else {
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  // Cランク一括削除
  const handleDeleteAllC = async () => {
    const cTags = tags.filter(t => t.tagType === 'DERIVED' && ranks[t.displayName] === 'C');
    
    if (cTags.length === 0) {
      alert('Cランクのタグがありません');
      return;
    }
    
    if (!confirm(`Cランクのタグを全て削除しますか？\n\n対象: ${cTags.length}件\n${cTags.slice(0, 10).map(t => t.displayName).join('\n')}${cTags.length > 10 ? `\n... 他${cTags.length - 10}件` : ''}\n\n関連するWorkTagも削除されます。この操作は取り消せません。`)) {
      return;
    }
    
    try {
      const res = await fetch('/api/admin/tags/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagKeys: cTags.map(t => t.tagKey) })
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.deleted || cTags.length}件のCランクタグを削除しました`);
        await fetchTags();
      } else {
        alert(data.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('Failed to delete C tags:', error);
    }
  };

  // タグ名変更
  const handleRenameTag = async (tagKey: string, newName: string) => {
    if (!newName.trim()) {
      alert('タグ名を入力してください');
      return;
    }
    try {
      const res = await fetch('/api/admin/tags/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagKey, newDisplayName: newName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setEditingTag(null);
        setEditingName('');
        await fetchTags();
        await fetchRanks();
      } else {
        alert(data.error || '名前変更に失敗しました');
      }
    } catch (error) {
      console.error('Failed to rename tag:', error);
    }
  };

  // Phase 3: 質問テンプレート保存（DB 更新 + 統合・包括グループ内に同期）
  const handleSaveTemplate = async (tagKey: string, displayName: string, template: string) => {
    try {
      const res = await fetch('/api/admin/tags/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'x-eronator-admin-token': adminToken } : {}) },
        body: JSON.stringify({ tagKey, questionText: template.trim() || null })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTags();
        setEditingTemplate(null);
        setEditingTemplateValue('');
        openReflectionForChange('DB_ONLY', `質問文を保存: ${displayName}`);
      } else {
        alert(data.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  // カテゴリ: 5つのうち1つだけ（ストーリー / プレイ / キャラ / その他 / 未分類）
  const CATEGORIES = ['ストーリー', 'プレイ', 'キャラクター', 'その他', '未分類'] as const;
  const currentCategory = (c: string | null | undefined) => (c && CATEGORIES.includes(c as typeof CATEGORIES[number]) ? c : '未分類');
  const handleCategoryChange = async (tagKey: string, value: string) => {
    const category = value === '未分類' ? '未分類' : (CATEGORIES.includes(value as typeof CATEGORIES[number]) ? value : '未分類');
    try {
      const res = await fetch('/api/admin/tags/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'x-eronator-admin-token': adminToken } : {}) },
        body: JSON.stringify({ tagKey, category })
      });
      const data = await res.json();
      if (data.success) {
        setTags(prev => prev.map(t => t.tagKey === tagKey ? { ...t, category } : t));
        openReflectionForChange('DB_ONLY', 'カテゴリを保存');
      }
      else alert(data.error || 'カテゴリの保存に失敗しました');
    } catch (error) { console.error('Failed to save category:', error); }
  };
  // ランクのソート用順序（S=最優先 → N=最後）
  const RANK_ORDER: Record<UnifiedRank, number> = { S: 0, A: 1, B: 2, C: 3, X: 4, N: 5, '': 6 };

  // フィルタリング
  const filteredTags = useMemo(() => {
    return tags
      .filter(t => {
        const unifiedRank = getUnifiedRank(t);
        
        // ランク表示フィルタ
        if (!showRanks.has(unifiedRank)) {
          return false;
        }
        
        // カテゴリフィルタ（5つから1つ。キャラタグは displayCategory）
        if (categoryFilter !== 'ALL') {
          const dispCat = (t as TagItem).displayCategory;
          if (categoryFilter === 'キャラタグ') {
            if (dispCat !== 'キャラタグ') return false;
          } else {
            const cur = currentCategory(t.category);
            if (cur !== categoryFilter) return false;
          }
        }
        
        // 検索
        if (searchText && !t.displayName.toLowerCase().includes(searchText.toLowerCase())) return false;
        
        // 0件タグを非表示
        if (hideZeroCount && t.workCount <= 0) return false;
        
        return true;
      });
  }, [tags, ranks, showRanks, categoryFilter, searchText, hideZeroCount]);


  // カテゴリフィルタ用: ストーリー, プレイ, キャラ, その他, 未分類, キャラタグ（この順）
  const categoryFilterOptions = ['ストーリー', 'プレイ', 'キャラクター', 'その他', '未分類', 'キャラタグ'] as const;


  // 包括・統合: 「代表の下に移動」するタグ集合と、代表→サブ一覧・代表のランク
  const { movedSet, repIncludes, repUnify, repRank } = useMemo(() => {
    const moved = new Set<string>();
    const inc = new Map<string, Array<{ displayName: string; rank: string }>>();
    const uny = new Map<string, Array<{ displayName: string; rank: string }>>();
    const rankMap = new Map<string, string>();
    if (!includeUnifyView) return { movedSet: moved, repIncludes: inc, repUnify: uny, repRank: rankMap };
    for (const item of includeUnifyView.include) {
      for (const x of item.included) moved.add(x.displayName);
      inc.set(item.representative, item.included);
      rankMap.set(item.representative, item.rank);
    }
    for (const group of includeUnifyView.unify) {
      if (group.tags.length === 0) continue;
      const [first, ...rest] = group.tags;
      for (const x of rest) moved.add(x.displayName);
      uny.set(first.displayName, rest);
      rankMap.set(first.displayName, first.rank);
    }
    return { movedSet: moved, repIncludes: inc, repUnify: uny, repRank: rankMap };
  }, [includeUnifyView]);

  // テーブル行: メイン行 / サブ行のみ（カテゴリ見出し・まとめ質問は別ブロックへ移動済み）
  type TableRow =
    | { type: 'main'; tag: TagItem }
    | { type: 'main-orphan'; displayName: string; rank: string }
    | { type: 'sub'; subDisplayName: string; subRank: string; subTag?: TagItem };
  const tableRows = useMemo((): TableRow[] => {
    const rows: TableRow[] = [];
    const mainItems: Array<{ type: 'real'; tag: TagItem } | { type: 'orphan'; displayName: string; rank: string }> = [
      ...filteredTags.filter(t => !movedSet.has(t.displayName)).map(t => ({ type: 'real' as const, tag: t })),
      ...[...repIncludes.keys(), ...repUnify.keys()].filter(r => !tags.some(t => t.displayName === r)).map(rep => ({ type: 'orphan' as const, displayName: rep, rank: repRank.get(rep) || 'A' })),
    ];
    const mult = sortOrder === 'asc' ? 1 : -1;
    mainItems.sort((a, b) => {
      const getTag = (x: typeof mainItems[0]) => x.type === 'real' ? x.tag : null;
      const ta = getTag(a);
      const tb = getTag(b);
      if (sortBy === 'workCount') {
        const wa = ta?.workCount ?? 0;
        const wb = tb?.workCount ?? 0;
        const diff = wa - wb;
        if (diff !== 0) return mult * diff;
      }
      if (sortBy === 'rank') {
        const ra = RANK_ORDER[(ta ? getUnifiedRank(ta) : (a.type === 'orphan' ? (a.rank as UnifiedRank) : 'N')) ?? 'N'];
        const rb = RANK_ORDER[(tb ? getUnifiedRank(tb) : (b.type === 'orphan' ? (b.rank as UnifiedRank) : 'N')) ?? 'N'];
        const diff = ra - rb;
        if (diff !== 0) return mult * diff;
      }
      const na = a.type === 'real' ? a.tag.displayName : a.displayName;
      const nb = b.type === 'real' ? b.tag.displayName : b.displayName;
      return mult * na.localeCompare(nb, 'ja');
    });
    for (const item of mainItems) {
      if (item.type === 'real') {
        rows.push({ type: 'main', tag: item.tag });
        const subs = [...(repIncludes.get(item.tag.displayName) ?? []), ...(repUnify.get(item.tag.displayName) ?? [])];
        for (const s of subs) {
          const subTag = tags.find(t => t.displayName === s.displayName);
          rows.push({ type: 'sub', subDisplayName: s.displayName, subRank: s.rank, subTag });
        }
      } else {
        rows.push({ type: 'main-orphan', displayName: item.displayName, rank: item.rank });
        const subs = [...(repIncludes.get(item.displayName) ?? []), ...(repUnify.get(item.displayName) ?? [])];
        for (const s of subs) {
          const subTag = tags.find(t => t.displayName === s.displayName);
          rows.push({ type: 'sub', subDisplayName: s.displayName, subRank: s.rank, subTag });
        }
      }
    }
    return rows;
  }, [filteredTags, movedSet, repIncludes, repUnify, repRank, tags, sortBy, sortOrder, ranks]);

  // ページネーションは「行」単位（カテゴリ見出し・メイン・サブを含む）
  const paginatedTableRows = useMemo(() => {
    return tableRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [tableRows, currentPage]);
  const totalPagesTable = Math.ceil(tableRows.length / PAGE_SIZE);

  // 統計
  const stats = useMemo(() => {
    const s = tags.filter(t => t.tagType === 'OFFICIAL').length;
    const a = tags.filter(t => t.tagType === 'DERIVED' && ranks[t.displayName] === 'A').length;
    const b = tags.filter(t => t.tagType === 'DERIVED' && ranks[t.displayName] === 'B').length;
    const c = tags.filter(t => t.tagType === 'DERIVED' && ranks[t.displayName] === 'C').length;
    const n = tags.filter(t => t.tagType === 'DERIVED' && !ranks[t.displayName]).length; // 未分類
    const x = tags.filter(t => t.tagType === 'STRUCTURAL').length;
    return { S: s, A: a, B: b, C: c, N: n, X: x, total: tags.length };
  }, [tags, ranks]);

  // 全選択・全解除（現在ページのメイン行のみ）
  const handleSelectAll = () => {
    const newSet = new Set(selectedTags);
    paginatedTableRows.forEach(r => { if (r.type === 'main') newSet.add(r.tag.tagKey); });
    setSelectedTags(newSet);
  };
  
  const handleDeselectAll = () => {
    const newSet = new Set(selectedTags);
    paginatedTableRows.forEach(r => { if (r.type === 'main') newSet.delete(r.tag.tagKey); });
    setSelectedTags(newSet);
  };

  // ランクの背景色（共通定数に統一）
  const getRankBgColor = (rank: UnifiedRank): string => {
    switch (rank) {
      case 'S': return RANK_BG.S;
      case 'A': return RANK_BG.A;
      case 'B': return RANK_BG.B;
      case 'C': return RANK_BG.C;
      case 'X': return RANK_BG.X;
      case 'N': return '#e9ecef'; // 未分類（グレー）
      default: return '#f5f5f5';
    }
  };

  // ランクバッジ
  const RankBadge = ({ rank }: { rank: UnifiedRank }) => (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: '3px',
      fontSize: '11px',
      fontWeight: 'bold',
      backgroundColor: getRankBgColor(rank),
      color: rank === 'S' ? RANK_TEXT.S : rank === 'A' ? RANK_TEXT.A : rank === 'B' ? RANK_TEXT.B : rank === 'C' ? RANK_TEXT.C : rank === 'X' ? RANK_TEXT.X : rank === 'N' ? '#495057' : '#666'
    }}>
      {rank === 'N' ? '-' : (rank || '-')}
    </span>
  );

  // ランクチェックボックス切り替え
  const toggleRankFilter = (rank: UnifiedRank) => {
    setShowRanks(prev => {
      const next = new Set(prev);
      if (next.has(rank)) {
        next.delete(rank);
      } else {
        next.add(rank);
      }
      return next;
    });
    setCurrentPage(1);
  };

  // 汎用パターン（BCタグ・未設定時）。キャラタグは別で「○○というキャラクターが登場する？」を使用
  const getDefaultQuestion = (displayName: string): string => {
    return `${displayName}が関係している？`;
  };
  const getCharacterQuestion = (displayName: string): string => {
    return `${displayName}というキャラクターが登場する？`;
  };

  // まとめ質問の質問文を保存
  const handleSaveSummaryQuestion = async (id: string, questionText: string) => {
    try {
      const res = await fetch('/api/admin/summary-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ id, questionText }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) {
        setSummaryQuestions(data.summaryQuestions);
        setEditingSummaryId(null);
        setEditingSummaryValue('');
        openReflectionForChange('MIXED_OR_LOGIC', 'まとめ質問を保存');
      }
    } catch (e) { console.error('Failed to save summary question:', e); }
  };

  // まとめ質問のエロトグル（6問目以降にのみ出題）
  const handleToggleSummaryErotic = async (id: string) => {
    const q = summaryQuestions.find(s => s.id === id);
    if (q == null) return;
    try {
      const res = await fetch('/api/admin/summary-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ id, erotic: !q.erotic }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) setSummaryQuestions(data.summaryQuestions);
    } catch (e) { console.error('Failed to toggle summary erotic:', e); }
  };

  // まとめ質問の使用不可トグル（質問候補に含めない）
  const handleToggleSummaryDisabled = async (id: string) => {
    const q = summaryQuestions.find(s => s.id === id);
    if (q == null) return;
    try {
      const res = await fetch('/api/admin/summary-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ id, disabled: !q.disabled }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) setSummaryQuestions(data.summaryQuestions);
    } catch (e) { console.error('Failed to toggle summary disabled:', e); }
  };

  // 使用不可タグのトグル
  const handleToggleVague = async (displayName: string) => {
    try {
      const res = await fetch('/api/admin/vague-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.displayNames)) setVagueDisplayNames(new Set(data.displayNames));
    } catch (e) { console.error('Failed to toggle abstract:', e); }
  };
  // エロ質問タグのトグル
  const handleToggleErotic = async (displayName: string) => {
    try {
      const res = await fetch('/api/admin/erotic-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.displayNames)) setEroticDisplayNames(new Set(data.displayNames));
    } catch (e) { console.error('Failed to toggle erotic:', e); }
  };

  // 50音範囲の削除
  const handleDeleteSyllableRange = async (rangeId: string) => {
    if (!adminToken || !specialQuestions?.TITLE_SYLLABLE?.ranges) return;
    if (!confirm(`「${specialQuestions.TITLE_SYLLABLE.ranges.find(r => r.id === rangeId)?.label ?? rangeId}」を削除しますか？`)) return;
    try {
      const updated = specialQuestions.TITLE_SYLLABLE.ranges.filter(r => r.id !== rangeId);
      const res = await fetch('/api/admin/special-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ type: 'TITLE_SYLLABLE', key: 'ranges', value: updated }),
      });
      const data = await res.json();
      if (data.success) {
        setSpecialQuestions(prev => prev ? { ...prev, TITLE_SYLLABLE: data.TITLE_SYLLABLE } : null);
        setEditingSpecial(null);
        setEditingSpecialValue('');
      } else alert(data.error || '削除に失敗しました');
    } catch (e) {
      console.error(e);
      alert('削除に失敗しました');
    }
  };

  // 特別質問の保存
  const handleSaveSpecialQuestion = async () => {
    if (!editingSpecial || !adminToken) return;
    try {
      const body: Record<string, unknown> = { type: editingSpecial.type };
      if (editingSpecial.key) body.key = editingSpecial.key;
      if (editingSpecial.id && editingSpecial.type === 'TITLE_SYLLABLE' && editingSpecial.subKey === 'chars') {
        // 範囲の chars を更新: カンマ区切りをパースして ranges 全体を置換
        const ranges = specialQuestions?.TITLE_SYLLABLE?.ranges ?? [];
        const chars = editingSpecialValue.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
        const updated = ranges.map(r => r.id === editingSpecial.id ? { ...r, chars } : r);
        body.key = 'ranges';
        body.value = updated;
      } else if (editingSpecial.id && editingSpecial.type === 'TITLE_SYLLABLE' && !editingSpecial.subKey) {
        body.key = editingSpecial.id;
      } else if (editingSpecial.type === 'POPULARITY' && editingSpecial.key === 'popularityThreshold') {
        body.value = parseInt(editingSpecialValue, 10);
      } else if (editingSpecial.type === 'TITLE_SYLLABLE' && editingSpecial.key === 'ranges') {
        try {
          body.value = JSON.parse(editingSpecialValue);
        } catch {
          alert('JSON形式が不正です');
          return;
        }
      } else if (editingSpecial.type === 'TITLE_SYLLABLE_2' && editingSpecial.parentId && editingSpecial.branch && editingSpecial.subKey) {
        body.key = `${editingSpecial.parentId}.${editingSpecial.branch}.${editingSpecial.subKey}`;
        body.value = editingSpecial.subKey === 'chars'
          ? editingSpecialValue.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)
          : editingSpecialValue;
      } else if (editingSpecial.type === 'AUTHOR_CHAR_TYPE' && editingSpecial.key) {
        body.key = editingSpecial.key;
        body.value = editingSpecialValue;
      } else {
        body.value = editingSpecialValue;
      }
      const res = await fetch('/api/admin/special-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSpecialQuestions({
          SERIES: data.SERIES,
          TITLE_CHAR_TYPE: data.TITLE_CHAR_TYPE,
          POPULARITY: data.POPULARITY,
          TITLE_SYLLABLE: data.TITLE_SYLLABLE,
          TITLE_SYLLABLE_2: data.TITLE_SYLLABLE_2,
          AUTHOR_CHAR_TYPE: data.AUTHOR_CHAR_TYPE,
        });
        setEditingSpecial(null);
        setEditingSpecialValue('');
        openReflectionForChange('MIXED_OR_LOGIC', '特別質問を保存');
      } else {
        alert(data.error || '保存に失敗しました');
      }
    } catch (e) {
      console.error('Failed to save special question:', e);
      alert('保存に失敗しました');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>タグ＆質問リスト</h2>
        <button
          type="button"
          onClick={() => setReflectionModal({ open: true, source: 'manual', changeType: reflectionChecklist.lastChangeType, triggerLabel: reflectionChecklist.lastChangeLabel })}
          style={{
            padding: '3px 10px',
            borderRadius: '999px',
            border: '1px solid #99c5ff',
            backgroundColor: '#f4f9ff',
            color: '#0b5ed7',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="タグ編集時の安全反映メモを表示"
        >
          反映メモ
          {reflectionPendingCount > 0 ? ` (${reflectionPendingCount})` : ''}
        </button>
      </div>

      {reflectionModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={() => setReflectionModal({ open: false, source: reflectionModal.source, changeType: reflectionModal.changeType, triggerLabel: reflectionModal.triggerLabel })}
        >
          <div
            style={{
              width: 'min(820px, 95vw)',
              maxHeight: '80vh',
              overflowY: 'auto',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #dbe6ff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              padding: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>タグ＆質問リストの安全反映メモ</div>
              <button
                type="button"
                onClick={() => setReflectionModal({ open: false, source: reflectionModal.source, changeType: reflectionModal.changeType, triggerLabel: reflectionModal.triggerLabel })}
                style={{ marginLeft: 'auto', padding: '4px 10px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                閉じる
              </button>
            </div>
            {reflectionModal.source === 'auto' && (
              <div style={{ marginBottom: '8px', fontSize: '0.84rem', color: '#495057' }}>
                保存を検知: {reflectionModal.triggerLabel || '変更内容'}
              </div>
            )}
            {activeReflectionTemplate && (
              <div style={{ border: '1px solid #dbe6ff', borderRadius: '6px', padding: '10px', backgroundColor: '#f4f9ff', marginBottom: '10px' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{activeReflectionTemplate.title}</div>
                <div style={{ fontSize: '0.84rem', color: '#334155', marginBottom: '6px' }}>{activeReflectionTemplate.whatChanged}</div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', lineHeight: 1.5 }}>
                  {activeReflectionTemplate.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ border: '1px solid #e3e3e3', borderRadius: '6px', padding: '10px', backgroundColor: '#fff', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>実施チェック（この端末）</div>
              <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: '6px' }}>
                未完了: {reflectionPendingCount}件
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={reflectionChecklist.matrixDone}
                    disabled={!reflectionChecklist.required.matrix}
                    onChange={() => toggleReflectionCheck('matrixDone')}
                  />
                  <span>行列再生成済み</span>
                  {!reflectionChecklist.required.matrix && <span style={{ color: '#888', fontSize: '0.78rem' }}>（今回の変更では必須ではありません）</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={reflectionChecklist.dbSynced}
                    disabled={!reflectionChecklist.required.db}
                    onChange={() => toggleReflectionCheck('dbSynced')}
                  />
                  <span>本番DB同期済み</span>
                  {!reflectionChecklist.required.db && <span style={{ color: '#888', fontSize: '0.78rem' }}>（今回の変更では必須ではありません）</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={reflectionChecklist.deployed}
                    disabled={!reflectionChecklist.required.deploy}
                    onChange={() => toggleReflectionCheck('deployed')}
                  />
                  <span>本番デプロイ済み</span>
                  {!reflectionChecklist.required.deploy && <span style={{ color: '#888', fontSize: '0.78rem' }}>（今回の変更では必須ではありません）</span>}
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {TAG_MANAGER_REFLECTION_MEMOS.map((memo) => (
                <div key={memo.title} style={{ border: '1px solid #e3e3e3', borderRadius: '6px', padding: '10px', backgroundColor: '#fcfcff' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>{memo.title}</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', lineHeight: 1.5 }}>
                    {memo.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 禁止タグ管理（折りたたみ） */}
      <details style={{ marginBottom: '20px' }}>
        <summary style={{ cursor: 'pointer', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
          🚫 取得禁止タグ管理 ({bannedTags.length}件)
        </summary>
        <div style={{ padding: '15px', backgroundColor: '#fffbeb', borderRadius: '0 0 8px 8px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="パターン"
              value={newBannedTag.pattern}
              onChange={e => setNewBannedTag(prev => ({ ...prev, pattern: e.target.value }))}
              style={{ padding: '5px 10px', flex: 1, minWidth: '150px' }}
            />
            <select
              value={newBannedTag.type}
              onChange={e => setNewBannedTag(prev => ({ ...prev, type: e.target.value as 'exact' | 'startsWith' | 'contains' | 'regex' }))}
              style={{ padding: '5px' }}
            >
              <option value="exact">完全一致</option>
              <option value="startsWith">前方一致</option>
              <option value="contains">部分一致</option>
              <option value="regex">正規表現</option>
            </select>
            <input
              type="text"
              placeholder="理由（任意）"
              value={newBannedTag.reason}
              onChange={e => setNewBannedTag(prev => ({ ...prev, reason: e.target.value }))}
              style={{ padding: '5px 10px', width: '150px' }}
            />
            <button onClick={handleAddBannedTag} style={{ padding: '5px 15px' }}>追加</button>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {bannedTags.map((bt, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '5px 10px',
                backgroundColor: i % 2 === 0 ? 'white' : '#f9f9f9',
                borderRadius: '4px',
                marginBottom: '2px'
              }}>
                <span>
                  <code style={{ backgroundColor: '#eee', padding: '2px 5px', borderRadius: '3px' }}>{bt.pattern}</code>
                  <span style={{ color: '#666', marginLeft: '10px', fontSize: '12px' }}>({bt.type})</span>
                  {bt.reason && <span style={{ color: '#999', marginLeft: '10px', fontSize: '12px' }}>{bt.reason}</span>}
                </span>
                <button 
                  onClick={() => handleDeleteBannedTag(bt.pattern, bt.type)}
                  style={{ padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* 特別質問（シリーズ・文字種・有名度・50音） */}
      <details
        open={!specialQuestionsCollapsed}
        onToggle={e => setSpecialQuestionsCollapsed(!(e.target as HTMLDetailsElement).open)}
        style={{ marginBottom: '20px' }}
      >
        <summary style={{ cursor: 'pointer', padding: '10px', backgroundColor: '#e8f4fd', borderRadius: '4px' }}>
          ⭐ 特別質問（シリーズ・文字種・有名度・50音・50音2次・作者文字種）
        </summary>
        <div style={{ padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '0 0 8px 8px' }}>
          {specialQuestions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* SERIES */}
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>シリーズもの</div>
                {editingSpecial?.type === 'SERIES' ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={editingSpecialValue}
                      onChange={e => setEditingSpecialValue(e.target.value)}
                      style={{ flex: 1, padding: '6px' }}
                      placeholder="その作品は、シリーズものや総集編？"
                    />
                    <button onClick={handleSaveSpecialQuestion} style={{ padding: '6px 12px' }}>保存</button>
                    <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }}>キャンセル</button>
                  </div>
                ) : (
                  <div
                    onClick={() => { setEditingSpecial({ type: 'SERIES' }); setEditingSpecialValue(specialQuestions.SERIES?.questionText ?? ''); }}
                    style={{ cursor: 'pointer', padding: '6px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    {specialQuestions.SERIES?.questionText || '（未設定）'} ✏️
                  </div>
                )}
              </div>

              {/* TITLE_CHAR_TYPE */}
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>タイトル文字種（2択: 漢字 / ひらがなorカタカナ）</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(['KANJI', 'HIRAGANA_OR_KATAKANA'] as const).map(k => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '140px' }}>{k === 'KANJI' ? '漢字' : 'ひらがなorカタカナ'}:</span>
                      {editingSpecial?.type === 'TITLE_CHAR_TYPE' && editingSpecial.key === k ? (
                        <>
                          <input
                            type="text"
                            value={editingSpecialValue}
                            onChange={e => setEditingSpecialValue(e.target.value)}
                            style={{ flex: 1, padding: '6px' }}
                          />
                          <button onClick={handleSaveSpecialQuestion} style={{ padding: '6px 12px' }}>保存</button>
                          <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }}>キャンセル</button>
                        </>
                      ) : (
                        <div
                          onClick={() => { setEditingSpecial({ type: 'TITLE_CHAR_TYPE', key: k }); setEditingSpecialValue(specialQuestions.TITLE_CHAR_TYPE?.[k] ?? ''); }}
                          style={{ flex: 1, cursor: 'pointer', padding: '6px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                          {specialQuestions.TITLE_CHAR_TYPE?.[k] || '（未設定）'} ✏️
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* POPULARITY */}
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>有名度</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '80px' }}>質問文:</span>
                    {editingSpecial?.type === 'POPULARITY' && !editingSpecial.key ? (
                      <>
                        <input
                          type="text"
                          value={editingSpecialValue}
                          onChange={e => setEditingSpecialValue(e.target.value)}
                          style={{ flex: 1, padding: '6px' }}
                          placeholder="その作品は、かなり有名？"
                        />
                        <button onClick={handleSaveSpecialQuestion} style={{ padding: '6px 12px' }}>保存</button>
                        <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }}>キャンセル</button>
                      </>
                    ) : (
                      <div
                        onClick={() => { setEditingSpecial({ type: 'POPULARITY' }); setEditingSpecialValue(specialQuestions.POPULARITY?.questionText ?? ''); }}
                        style={{ flex: 1, cursor: 'pointer', padding: '6px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        {specialQuestions.POPULARITY?.questionText || '（未設定）'} ✏️
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '80px' }}>閾値:</span>
                    {editingSpecial?.type === 'POPULARITY' && editingSpecial.key === 'popularityThreshold' ? (
                      <>
                        <input
                          type="number"
                          value={editingSpecialValue}
                          onChange={e => setEditingSpecialValue(e.target.value)}
                          style={{ width: '80px', padding: '6px' }}
                        />
                        <button onClick={handleSaveSpecialQuestion} style={{ padding: '6px 12px' }}>保存</button>
                        <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }}>キャンセル</button>
                      </>
                    ) : (
                      <div
                        onClick={() => { setEditingSpecial({ type: 'POPULARITY', key: 'popularityThreshold' }); setEditingSpecialValue(String(specialQuestions.POPULARITY?.popularityThreshold ?? 40)); }}
                        style={{ cursor: 'pointer', padding: '6px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd', width: '80px' }}
                      >
                        {specialQuestions.POPULARITY?.popularityThreshold ?? 40} ✏️
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TITLE_SYLLABLE */}
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>50音分類（さ～わ行・あ～さ行・か～は行など）</div>
                {((specialQuestions.TITLE_SYLLABLE?.ranges ?? []).length ? specialQuestions.TITLE_SYLLABLE!.ranges! : []).map((r) => (
                  <div key={r.id} style={{ marginBottom: '12px', padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{r.label} (id: {r.id})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '70px', fontSize: '12px' }}>質問文:</span>
                        {editingSpecial?.type === 'TITLE_SYLLABLE' && editingSpecial.id === r.id && !editingSpecial.subKey ? (
                          <>
                            <input
                              type="text"
                              value={editingSpecialValue}
                              onChange={e => setEditingSpecialValue(e.target.value)}
                              style={{ flex: 1, padding: '6px' }}
                              placeholder={r.questionText}
                            />
                            <button onClick={handleSaveSpecialQuestion} style={{ padding: '6px 12px' }}>保存</button>
                            <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }}>キャンセル</button>
                          </>
                        ) : (
                          <div
                            onClick={() => { setEditingSpecial({ type: 'TITLE_SYLLABLE', key: r.id, id: r.id }); setEditingSpecialValue(r.questionText); }}
                            style={{ flex: 1, cursor: 'pointer', padding: '6px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd' }}
                          >
                            {r.questionText} ✏️
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ width: '70px', fontSize: '12px', paddingTop: '6px' }}>対象文字:</span>
                        {editingSpecial?.type === 'TITLE_SYLLABLE' && editingSpecial.id === r.id && editingSpecial.subKey === 'chars' ? (
                          <>
                            <input
                              type="text"
                              value={editingSpecialValue}
                              onChange={e => setEditingSpecialValue(e.target.value)}
                              style={{ flex: 1, padding: '6px', fontFamily: 'monospace' }}
                              placeholder="ア,イ,ウ,エ,オ,..."
                            />
                            <button onClick={handleSaveSpecialQuestion} style={{ padding: '6px 12px' }}>保存</button>
                            <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }}>キャンセル</button>
                          </>
                        ) : (
                          <div
                            onClick={() => { setEditingSpecial({ type: 'TITLE_SYLLABLE', id: r.id, subKey: 'chars' }); setEditingSpecialValue((r.chars ?? []).join(',')); }}
                            style={{ flex: 1, cursor: 'pointer', padding: '6px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                          >
                            {(r.chars ?? []).join(',') || '（未設定）'} ✏️
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteSyllableRange(r.id)}
                        style={{ fontSize: '11px', padding: '2px 8px', color: '#c00', border: '1px solid #c00', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
                {(!specialQuestions.TITLE_SYLLABLE?.ranges?.length) && (
                  <div style={{ color: '#999', fontSize: '12px' }}>config/specialQuestions.json で TITLE_SYLLABLE.ranges を設定してください</div>
                )}
              </div>

              {/* TITLE_SYLLABLE_2 */}
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>50音2次（1次質問のYES/NO後の絞り込み）</div>
                {specialQuestions.TITLE_SYLLABLE_2?.branches && Object.entries(specialQuestions.TITLE_SYLLABLE_2.branches).map(([parentId, branches]) => {
                  const parentRange = specialQuestions.TITLE_SYLLABLE?.ranges?.find(r => r.id === parentId);
                  const parentLabel = parentRange?.label ?? parentId;
                  return (
                    <div key={parentId} style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#fafafa', borderRadius: '4px', border: '1px solid #ddd' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>1次: {parentLabel} ({parentId})</div>
                      {(['yesBranch', 'noBranch'] as const).map(branch => {
                        const b = branch === 'yesBranch' ? branches.yesBranch : branches.noBranch;
                        if (!b) return null;
                        const branchLabel = branch === 'yesBranch' ? 'YES時' : 'NO時';
                        return (
                          <div key={branch} style={{ marginBottom: '8px', paddingLeft: '12px', borderLeft: '3px solid #ccc' }}>
                            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{branchLabel} ({b.label})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '60px', fontSize: '11px' }}>質問文:</span>
                                {editingSpecial?.type === 'TITLE_SYLLABLE_2' && editingSpecial.parentId === parentId && editingSpecial.branch === branch && editingSpecial.subKey === 'questionText' ? (
                                  <>
                                    <input
                                      type="text"
                                      value={editingSpecialValue}
                                      onChange={e => setEditingSpecialValue(e.target.value)}
                                      style={{ flex: 1, padding: '6px', fontSize: '12px' }}
                                    />
                                    <button onClick={handleSaveSpecialQuestion} style={{ padding: '4px 10px', fontSize: '12px' }}>保存</button>
                                    <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }} style={{ fontSize: '12px' }}>キャンセル</button>
                                  </>
                                ) : (
                                  <div
                                    onClick={() => { setEditingSpecial({ type: 'TITLE_SYLLABLE_2', parentId, branch, subKey: 'questionText' }); setEditingSpecialValue(b.questionText); }}
                                    style={{ flex: 1, cursor: 'pointer', padding: '6px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                                  >
                                    {b.questionText || '（未設定）'} ✏️
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '60px', fontSize: '11px' }}>対象文字:</span>
                                {editingSpecial?.type === 'TITLE_SYLLABLE_2' && editingSpecial.parentId === parentId && editingSpecial.branch === branch && editingSpecial.subKey === 'chars' ? (
                                  <>
                                    <input
                                      type="text"
                                      value={editingSpecialValue}
                                      onChange={e => setEditingSpecialValue(e.target.value)}
                                      style={{ flex: 1, padding: '6px', fontSize: '12px', fontFamily: 'monospace' }}
                                      placeholder="サ,シ,ス,..."
                                    />
                                    <button onClick={handleSaveSpecialQuestion} style={{ padding: '4px 10px', fontSize: '12px' }}>保存</button>
                                    <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }} style={{ fontSize: '12px' }}>キャンセル</button>
                                  </>
                                ) : (
                                  <div
                                    onClick={() => { setEditingSpecial({ type: 'TITLE_SYLLABLE_2', parentId, branch, subKey: 'chars' }); setEditingSpecialValue((b.chars ?? []).join(',')); }}
                                    style={{ flex: 1, cursor: 'pointer', padding: '6px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd', fontSize: '11px' }}
                                  >
                                    {(b.chars ?? []).join(',') || '（未設定）'} ✏️
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {(!specialQuestions.TITLE_SYLLABLE_2?.branches || Object.keys(specialQuestions.TITLE_SYLLABLE_2.branches).length === 0) && (
                  <div style={{ color: '#999', fontSize: '12px' }}>config/specialQuestions.json で TITLE_SYLLABLE_2.branches を設定してください</div>
                )}
              </div>

              {/* AUTHOR_CHAR_TYPE */}
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>作者名の文字種（2択・情報量最大: ひらがなorカタカナ vs 漢字orアルファベット）</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(['HIRAGANA_OR_KATAKANA', 'KANJI_OR_ALPHA'] as const).map(k => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '180px' }}>{k === 'HIRAGANA_OR_KATAKANA' ? 'ひらがなorカタカナ' : '漢字orアルファベット'}:</span>
                      {editingSpecial?.type === 'AUTHOR_CHAR_TYPE' && editingSpecial.key === k ? (
                        <>
                          <input
                            type="text"
                            value={editingSpecialValue}
                            onChange={e => setEditingSpecialValue(e.target.value)}
                            style={{ flex: 1, padding: '6px' }}
                          />
                          <button onClick={handleSaveSpecialQuestion} style={{ padding: '6px 12px' }}>保存</button>
                          <button onClick={() => { setEditingSpecial(null); setEditingSpecialValue(''); }}>キャンセル</button>
                        </>
                      ) : (
                        <div
                          onClick={() => { setEditingSpecial({ type: 'AUTHOR_CHAR_TYPE', key: k }); setEditingSpecialValue(specialQuestions.AUTHOR_CHAR_TYPE?.[k] ?? ''); }}
                          style={{ flex: 1, cursor: 'pointer', padding: '6px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}
                        >
                          {specialQuestions.AUTHOR_CHAR_TYPE?.[k] || '（未設定）'} ✏️
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* まとめ質問（文言の編集のみ・詳細はまとめ質問タブで。含むタグは小さく表示） */}
      <details style={{ marginBottom: '20px' }}>
        <summary style={{ cursor: 'pointer', padding: '10px', backgroundColor: '#f0e6fa', borderRadius: '4px' }}>
          🪭 まとめ質問 ({summaryQuestions.length}件)
        </summary>
        <div style={{ padding: '15px', backgroundColor: '#faf5ff', borderRadius: '0 0 8px 8px' }}>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>文言の編集のみ。詳細は「まとめ質問」タブで設定できます。</p>
          {summaryQuestions.length === 0 ? (
            <p style={{ color: '#999' }}>まとめ質問はありません</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ backgroundColor: '#eee' }}>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left', width: '100px' }}>ラベル</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left' }}>質問文</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left', width: '180px' }}>含むタグ</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'center', width: '72px' }}>使用不可</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'center', width: '52px' }}>エロ</th>
                </tr>
              </thead>
              <tbody>
                {summaryQuestions.map(q => {
                  const isEditing = editingSummaryId === q.id;
                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', verticalAlign: 'middle' }}>{q.label}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd', verticalAlign: 'middle' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editingSummaryValue}
                              onChange={e => setEditingSummaryValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveSummaryQuestion(q.id, editingSummaryValue); if (e.key === 'Escape') { setEditingSummaryId(null); setEditingSummaryValue(''); } }}
                              style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
                              autoFocus
                            />
                            <button onClick={() => handleSaveSummaryQuestion(q.id, editingSummaryValue)} style={{ padding: '6px 12px' }}>保存</button>
                            <button onClick={() => { setEditingSummaryId(null); setEditingSummaryValue(''); }} style={{ padding: '6px 12px' }}>キャンセル</button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { setEditingSummaryId(q.id); setEditingSummaryValue(q.questionText); }}
                            style={{ cursor: 'pointer', display: 'block', padding: '4px 0' }}
                            title="クリックして編集"
                          >
                            {q.questionText} ✏️
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '4px 8px', border: '1px solid #ddd', verticalAlign: 'middle', fontSize: '10px', color: '#666', lineHeight: 1.3, maxWidth: '180px' }}>
                        {q.displayNames?.length ? q.displayNames.join(', ') : '—'}
                      </td>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'center', verticalAlign: 'middle' }}>
                        <input type="checkbox" checked={!!q.disabled} onChange={() => handleToggleSummaryDisabled(q.id)} title="使用不可（質問候補に含めない）" />
                      </td>
                      <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'center', verticalAlign: 'middle' }}>
                        <input type="checkbox" checked={!!q.erotic} onChange={() => handleToggleSummaryErotic(q.id)} title="エロ質問（6問目以降）" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </details>

      {/* ランク表示フィルタ（チェックボックス） */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        marginBottom: '15px',
        padding: '10px 15px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontWeight: 'bold' }}>表示:</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showRanks.has('S')} onChange={() => toggleRankFilter('S')} />
          <span style={{ backgroundColor: RANK_BG.S, padding: '2px 8px', borderRadius: '4px', color: RANK_TEXT.S, fontWeight: 'bold' }}>S ({stats.S})</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showRanks.has('A')} onChange={() => toggleRankFilter('A')} />
          <span style={{ backgroundColor: RANK_BG.A, padding: '2px 8px', borderRadius: '4px', color: RANK_TEXT.A, fontWeight: 'bold' }}>A ({stats.A})</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showRanks.has('B')} onChange={() => toggleRankFilter('B')} />
          <span style={{ backgroundColor: RANK_BG.B, padding: '2px 8px', borderRadius: '4px', color: RANK_TEXT.B, fontWeight: 'bold' }}>B ({stats.B})</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showRanks.has('C')} onChange={() => toggleRankFilter('C')} />
          <span style={{ backgroundColor: RANK_BG.C, padding: '2px 8px', borderRadius: '4px', color: RANK_TEXT.C, fontWeight: 'bold' }}>C ({stats.C})</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showRanks.has('X')} onChange={() => toggleRankFilter('X')} />
          <span style={{ backgroundColor: RANK_BG.X, padding: '2px 8px', borderRadius: '4px', color: RANK_TEXT.X, fontWeight: 'bold' }}>X ({stats.X})</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showRanks.has('N')} onChange={() => toggleRankFilter('N')} />
          <span style={{ backgroundColor: '#e9ecef', padding: '2px 8px', borderRadius: '4px', color: '#495057', fontWeight: 'bold' }}>未分類 ({stats.N})</span>
        </label>
        
        <span>|</span>
        
        {/* カテゴリフィルタ */}
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          style={{ padding: '6px' }}
        >
          <option value="ALL">すべてのタグ</option>
          {categoryFilterOptions.map(c => (
            <option key={c} value={c}>{c === 'キャラクター' ? 'キャラ' : c}</option>
          ))}
        </select>
        
        {/* 検索 */}
        <input
          type="text"
          placeholder="タグ名で検索..."
          value={searchText}
          onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
          style={{ padding: '6px 12px', width: '150px' }}
        />
        
        <span>|</span>
        
        {/* 並び替え */}
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value as 'workCount' | 'rank' | 'displayName'); setCurrentPage(1); }}
          style={{ padding: '6px' }}
        >
          <option value="displayName">表示名</option>
          <option value="workCount">作品数</option>
          <option value="rank">ランク</option>
        </select>
        <button
          type="button"
          onClick={() => { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
          style={{ padding: '4px 8px', fontSize: '0.9rem' }}
          title={sortOrder === 'asc' ? '昇順 → クリックで降順' : '降順 → クリックで昇順'}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
        
        <span>|</span>
        
        {/* 0件タグ非表示 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideZeroCount}
            onChange={e => { setHideZeroCount(e.target.checked); setCurrentPage(1); }}
          />
          <span>0件を非表示</span>
        </label>
        
        <span style={{ color: '#666', marginLeft: 'auto' }}>
          表示: {tableRows.length}行
        </span>
      </div>

      {/* 一括操作 */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: 'white',
        borderRadius: '4px',
        border: '1px solid #ddd',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <button onClick={handleSelectAll} style={{ padding: '5px 10px' }}>ページ全選択</button>
        <button onClick={handleDeselectAll} style={{ padding: '5px 10px' }}>解除</button>
        <span style={{ color: '#666' }}>選択: {selectedTags.size}件</span>
        <button
          onClick={handleOpenIncludeUnifyDialog}
          disabled={selectedTagItems.length < 2}
          style={{
            padding: '5px 10px',
            marginLeft: '8px',
            backgroundColor: selectedTagItems.length < 2 ? '#ccc' : '#6f42c1',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedTagItems.length < 2 ? 'not-allowed' : 'pointer',
            opacity: selectedTagItems.length < 2 ? 0.75 : 1,
            fontWeight: 600,
          }}
          title="選択したタグをメインタグ中心で統合・包括します"
        >
          統合・包括する
        </button>
        
        <span style={{ marginLeft: '20px' }}>一括ランク:</span>
        <button 
          onClick={() => handleBulkRankChange('A')} 
          disabled={selectedTags.size === 0}
          style={{ padding: '4px 10px', backgroundColor: RANK_BG.A, cursor: selectedTags.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedTags.size === 0 ? 0.5 : 1 }}
        >
          →A
        </button>
        <button 
          onClick={() => handleBulkRankChange('B')} 
          disabled={selectedTags.size === 0}
          style={{ padding: '4px 10px', backgroundColor: RANK_BG.B, cursor: selectedTags.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedTags.size === 0 ? 0.5 : 1 }}
        >
          →B
        </button>
        <button 
          onClick={() => handleBulkRankChange('C')} 
          disabled={selectedTags.size === 0}
          style={{ padding: '4px 10px', backgroundColor: RANK_BG.C, cursor: selectedTags.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedTags.size === 0 ? 0.5 : 1 }}
        >
          →C
        </button>
        
        <span style={{ marginLeft: 'auto', borderLeft: '1px solid #ccc', paddingLeft: '15px' }}>
          <button 
            onClick={handleDeleteAllC} 
            disabled={stats.C === 0}
            style={{ 
              padding: '5px 15px', 
              backgroundColor: stats.C === 0 ? '#ccc' : '#dc3545', 
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: stats.C === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            🗑️ 現在のCを全削除 ({stats.C}件)
          </button>
        </span>
      </div>

      {includeUnifyDialogOpen && (
        <div
          style={{
            marginBottom: '15px',
            padding: '12px',
            border: '1px solid #d0bfff',
            backgroundColor: '#f8f4ff',
            borderRadius: '6px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '8px' }}>統合・包括の設定</div>
          <p style={{ margin: '0 0 8px 0', color: '#444', fontSize: '0.9rem' }}>
            やることは同じで、メインタグとのランク差で自動的に振り分けます（同ランク=統合 / 異ランク=包括）。
          </p>
          <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '4px', fontSize: '0.85rem', color: '#5f4b00' }}>
            注意: この変更はタグ表示だけでなく、ゲーム中の質問選択・推薦結果・シミュレーション結果にも影響します。
          </div>

          <div style={{ marginBottom: '8px', fontWeight: 600 }}>メインにするタグを1つ選択</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginBottom: '10px' }}>
            {selectedTagItemsSortedForIncludeUnify.map((t) => {
              const rank = getUnifiedRank(t);
              return (
                <label
                  key={t.tagKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    border: '1px solid #e5dbff',
                    borderRadius: '4px',
                    backgroundColor: includeUnifyMainTagKey === t.tagKey ? '#efe7ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="include-unify-main"
                    checked={includeUnifyMainTagKey === t.tagKey}
                    onChange={() => setIncludeUnifyMainTagKey(t.tagKey)}
                  />
                  <RankBadge rank={rank} />
                  <span style={{ fontWeight: 600 }}>{t.displayName}</span>
                  <span style={{ color: '#666', marginLeft: 'auto', fontSize: '0.85rem' }}>{t.workCount}件</span>
                </label>
              );
            })}
          </div>

          <div style={{ marginBottom: '10px', fontSize: '0.85rem', color: '#444' }}>
            <div>統合（同ランク）: {includeUnifyPreview.unifyMembers.map((t) => t.displayName).join(' / ') || 'なし'}</div>
            <div>包括（異ランク）: {includeUnifyPreview.includeMembers.map((t) => t.displayName).join(' / ') || 'なし'}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSaveIncludeUnify}
              disabled={includeUnifySaving || !includeUnifyMainTagKey}
              style={{
                padding: '6px 12px',
                backgroundColor: includeUnifySaving ? '#ccc' : '#6f42c1',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: includeUnifySaving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {includeUnifySaving ? '保存中...' : 'この内容で保存'}
            </button>
            <button
              onClick={() => setIncludeUnifyDialogOpen(false)}
              disabled={includeUnifySaving}
              style={{ padding: '6px 12px' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* タグテーブル（カテゴリ見出し行＋まとめ質問＋代表タグ＋サブ行） */}
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ backgroundColor: '#e9ecef' }}>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '36px' }}>選択</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '44px' }}>ランク</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd', width: '160px' }}>タグ名</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd' }}>質問文</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', border: '1px solid #ddd', width: '72px' }}>作品</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd', minWidth: '200px' }}>カテゴリ</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '64px' }}>使用不可</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '52px' }}>エロ</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '52px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTableRows.map((row, idx) => {
            if (row.type === 'sub') {
              const subRank = (row.subRank || 'A') as UnifiedRank;
              const subTag = row.subTag;
              const subRowStyle = { padding: '2px 4px', fontSize: '11px', lineHeight: 1.2 };
              return (
                <tr key={`sub-${row.subDisplayName}-${idx}`} style={{ backgroundColor: (getRankBgColor(subRank) + '25') }}>
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }}>
                    <RankBadge rank={subRank} />
                  </td>
                  <td style={{ ...subRowStyle, border: '1px solid #ddd' }}>└ {row.subDisplayName}</td>
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', color: '#666' }}>同上</td>
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'right' }}>
                    {subTag != null ? `${subTag.workCount}件` : '—'}
                  </td>
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', color: '#666' }}>
                    {subTag != null && subTag.category ? subTag.category : '—'}
                  </td>
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                </tr>
              );
            }
            if (row.type === 'main-orphan') {
              const rank = (row.rank || 'A') as UnifiedRank;
              const subs = [...(repIncludes.get(row.displayName) ?? []), ...(repUnify.get(row.displayName) ?? [])];
              return (
                <React.Fragment key={`orphan-${row.displayName}-${idx}`}>
                  <tr style={{ backgroundColor: (getRankBgColor(rank) + '40') }}>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <RankBadge rank={rank} />
                    </td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>{row.displayName}</td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px', color: '#666' }}>—</td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px', color: '#999', textAlign: 'right' }}>—</td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px', color: '#999' }}>DBに未登録</td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <input type="checkbox" checked={vagueDisplayNames.has(row.displayName)} onChange={() => handleToggleVague(row.displayName)} title="使用不可（質問候補に含めない）" />
                    </td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <input type="checkbox" checked={eroticDisplayNames.has(row.displayName)} onChange={() => handleToggleErotic(row.displayName)} title="エロ質問（7問目以降）" />
                    </td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                  </tr>
                  {subs.map((s, j) => {
                    const subRank = (s.rank || 'A') as UnifiedRank;
                    const subTag = tags.find(t => t.displayName === s.displayName);
                    const subRowStyle = { padding: '2px 4px', fontSize: '11px', lineHeight: 1.2 };
                    return (
                      <tr key={`orphan-sub-${row.displayName}-${s.displayName}-${j}`} style={{ backgroundColor: (getRankBgColor(subRank) + '25') }}>
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }}>
                          <RankBadge rank={subRank} />
                        </td>
                        <td style={{ ...subRowStyle, border: '1px solid #ddd' }}>└ {s.displayName}</td>
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', color: '#666' }}>同上</td>
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'right' }}>
                          {subTag != null ? `${subTag.workCount}件` : '—'}
                        </td>
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', color: '#666' }}>
                          {subTag != null && subTag.category ? subTag.category : '—'}
                        </td>
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                        <td style={{ ...subRowStyle, border: '1px solid #ddd', textAlign: 'center' }} />
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            }
            const tag = row.tag;
            const unifiedRank = getUnifiedRank(tag);
            const editable = isEditable(tag);
            const template = templates[tag.displayName];
            const displayCategory = (tag as TagItem).displayCategory ?? tag.category ?? '未分類';
            const questionText = template || (displayCategory === 'キャラタグ' ? getCharacterQuestion(tag.displayName) : getDefaultQuestion(tag.displayName));
            const intensity = getWorkCountIntensity(tag.workCount);
            const rowAlpha = getWorkCountRowAlphaHex(intensity);
            return (
              <tr 
                key={tag.tagKey}
                style={{ 
                  backgroundColor: selectedTags.has(tag.tagKey) ? '#e8f5e9' : getRankBgColor(unifiedRank) + rowAlpha
                }}
              >
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedTags.has(tag.tagKey)}
                    onChange={() => {
                      setSelectedTags(prev => {
                        const next = new Set(prev);
                        if (next.has(tag.tagKey)) next.delete(tag.tagKey);
                        else next.add(tag.tagKey);
                        return next;
                      });
                    }}
                  />
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                  {editable ? (
                    <select
                      value={ranks[tag.displayName] || ''}
                      onChange={e => handleRankChange(tag.displayName, e.target.value as 'A' | 'B' | 'C' | '')}
                      style={{ padding: '2px', backgroundColor: getRankBgColor(unifiedRank), border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
                    >
                      <option value="">-</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  ) : (
                    <RankBadge rank={unifiedRank} />
                  )}
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd' }}>
                  {editable && editingTag === tag.tagKey ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="text" value={editingName} onChange={e => setEditingName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRenameTag(tag.tagKey, editingName); if (e.key === 'Escape') { setEditingTag(null); setEditingName(''); } }} style={{ flex: 1, padding: '2px 4px' }} autoFocus />
                      <button onClick={() => handleRenameTag(tag.tagKey, editingName)} style={{ padding: '2px 6px', fontSize: '11px' }}>✓</button>
                      <button onClick={() => { setEditingTag(null); setEditingName(''); }} style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
                    </div>
                  ) : (
                    <span onClick={() => editable && (setEditingTag(tag.tagKey), setEditingName(tag.displayName))} style={{ cursor: editable ? 'pointer' : 'default' }} title={editable ? 'クリックして編集' : ''}>
                      {tag.displayName} {editable && '✏️'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '0.6em', lineHeight: 1.2, maxWidth: '320px' }}>
                  {editingTemplate === tag.tagKey ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="text" value={editingTemplateValue} onChange={e => setEditingTemplateValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(tag.tagKey, tag.displayName, editingTemplateValue); if (e.key === 'Escape') { setEditingTemplate(null); setEditingTemplateValue(''); } }} style={{ flex: 1, padding: '2px 4px' }} autoFocus />
                      <button onClick={() => handleSaveTemplate(tag.tagKey, tag.displayName, editingTemplateValue)} style={{ padding: '2px 6px', fontSize: '11px' }}>✓</button>
                      <button onClick={() => { setEditingTemplate(null); setEditingTemplateValue(''); }} style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
                    </div>
                  ) : (
                    <span onClick={() => { setEditingTemplate(tag.tagKey); setEditingTemplateValue(questionText); }} style={{ cursor: 'pointer' }} title="クリックして編集">
                      {questionText} ✏️
                    </span>
                  )}
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px', textAlign: 'right' }}>
                  {tag.workCount}件
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '11px' }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'center' }}>
                    {CATEGORIES.map(cat => (
                      <label key={cat} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="radio"
                          name={`cat-${tag.tagKey}`}
                          checked={currentCategory(tag.category) === cat}
                          onChange={() => handleCategoryChange(tag.tagKey, cat)}
                        />
                        {cat === 'キャラクター' ? 'キャラ' : cat}
                      </label>
                    ))}
                  </span>
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={vagueDisplayNames.has(tag.displayName)}
                    onChange={() => handleToggleVague(tag.displayName)}
                    title="使用不可（質問候補に含めない）"
                  />
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={eroticDisplayNames.has(tag.displayName)}
                    onChange={() => handleToggleErotic(tag.displayName)}
                    title="エロ質問（7問目以降にのみ出題）"
                  />
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                  {tag.tagType !== 'OFFICIAL' && (
                    <button onClick={() => handleDeleteTag(tag.tagKey)} style={{ padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>削除</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ページネーション（行単位） */}
      {totalPagesTable > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px', alignItems: 'center' }}>
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>≪</button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>＜</button>
          <span style={{ padding: '5px 15px' }}>{currentPage} / {totalPagesTable}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPagesTable, p + 1))} disabled={currentPage === totalPagesTable} style={{ padding: '5px 10px', cursor: currentPage === totalPagesTable ? 'not-allowed' : 'pointer' }}>＞</button>
          <button onClick={() => setCurrentPage(totalPagesTable)} disabled={currentPage === totalPagesTable} style={{ padding: '5px 10px', cursor: currentPage === totalPagesTable ? 'not-allowed' : 'pointer' }}>≫</button>
        </div>
      )}

      {loading && (
        <div style={{ padding: '20px', textAlign: 'center' }}>読み込み中...</div>
      )}
    </div>
  );
}
