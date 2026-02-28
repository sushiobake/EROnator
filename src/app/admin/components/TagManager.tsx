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

const PAGE_SIZE = 200;

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
  const [summaryQuestions, setSummaryQuestions] = useState<Array<{ id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean }>>([]);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editingSummaryValue, setEditingSummaryValue] = useState('');

  // 抽象質問タグ（11問目以降にのみ出題）
  const [vagueDisplayNames, setVagueDisplayNames] = useState<Set<string>>(new Set());
  // エロ質問タグ（7問目以降にのみ出題）
  const [eroticDisplayNames, setEroticDisplayNames] = useState<Set<string>>(new Set());
  // まとめ質問セクションの開閉（デフォルトは閉じる）
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);

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
    try {
      const res = await fetch('/api/admin/tags/ranks');
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
  // 抽象質問タグ読み込み
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
      }
    } catch (error) {
      console.error('Failed to bulk update ranks:', error);
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
      } else {
        alert(data.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  // フィルタリング（あいうえお順）
  const filteredTags = useMemo(() => {
    return tags
      .filter(t => {
        const unifiedRank = getUnifiedRank(t);
        
        // ランク表示フィルタ
        if (!showRanks.has(unifiedRank)) {
          return false;
        }
        
        // カテゴリフィルタ（表示用 displayCategory を優先）
        const cat = (t as TagItem).displayCategory ?? t.category ?? 'その他';
        if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false;
        
        // 検索
        if (searchText && !t.displayName.toLowerCase().includes(searchText.toLowerCase())) return false;
        
        return true;
      })
      .sort((a, b) => {
        // あいうえお順
        return a.displayName.localeCompare(b.displayName, 'ja');
      });
  }, [tags, ranks, showRanks, categoryFilter, searchText]);


  // カテゴリ一覧（categoryOrder 順、その他・キャラタグが最後）
  const categories = useMemo(() => {
    const catSet = new Set(tags.map(t => (t as TagItem).displayCategory ?? t.category ?? 'その他').filter(Boolean));
    if (categoryOrder.length > 0) {
      const ordered = categoryOrder.filter(c => catSet.has(c));
      const rest = Array.from(catSet).filter(c => !categoryOrder.includes(c)).sort();
      return [...ordered, ...rest];
    }
    return Array.from(catSet).sort();
  }, [tags, categoryOrder]);

  // 全カテゴリ表示用: displayCategory でグループ化（categoryOrder 順）
  const tagsByDisplayCategory = useMemo(() => {
    const map = new Map<string, TagItem[]>();
    for (const t of filteredTags) {
      const cat = (t as TagItem).displayCategory ?? t.category ?? 'その他';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));
    }
    return map;
  }, [filteredTags]);

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

  // テーブル行: カテゴリ見出し / まとめ質問ヘッダ（畳み） / まとめ質問 / メイン行 / サブ行
  type TableRow =
    | { type: 'category'; category: string }
    | { type: 'summary-header'; count: number }
    | { type: 'summary'; id: string; label: string; questionText: string; displayNames: string[]; erotic?: boolean }
    | { type: 'main'; tag: TagItem }
    | { type: 'main-orphan'; displayName: string; rank: string }
    | { type: 'sub'; subDisplayName: string; subRank: string; subTag?: TagItem };
  const repCategory = includeUnifyView?.representativeCategory ?? {};
  const tableRows = useMemo((): TableRow[] => {
    const rows: TableRow[] = [];
    if (categoryFilter === 'ALL' && summaryQuestions.length > 0) {
      if (summaryCollapsed) {
        rows.push({ type: 'summary-header', count: summaryQuestions.length });
      } else {
        rows.push({ type: 'category', category: 'まとめ質問タグ' });
        for (const q of summaryQuestions) {
          rows.push({ type: 'summary', id: q.id, label: q.label, questionText: q.questionText, displayNames: q.displayNames, erotic: q.erotic });
        }
      }
    }
    const addedReps = new Set<string>();
    const allReps = new Set([...repIncludes.keys(), ...repUnify.keys()]);
    const orphanReps = [...allReps].filter(r => !tags.some(t => t.displayName === r));
    const orderedCats = categoryOrder.length > 0 ? categoryOrder.filter(c => tagsByDisplayCategory.has(c)) : [];
    const restCats = Array.from(tagsByDisplayCategory.keys()).filter(c => !categoryOrder.includes(c)).sort();
    const catsFromOrphans = [...new Set(orphanReps.map(r => repCategory[r]).filter(Boolean))];
    const allCatsSet = new Set(categoryFilter === 'ALL' ? [...orderedCats, ...restCats, ...catsFromOrphans] : [categoryFilter]);
    const catsOrdered = categoryOrder.length > 0
      ? [...categoryOrder.filter(c => allCatsSet.has(c)), ...[...allCatsSet].filter(c => !categoryOrder.includes(c)).sort()]
      : [...allCatsSet].sort();
    for (const cat of catsOrdered) {
      const list = tagsByDisplayCategory.get(cat) ?? [];
      const orphanRepsInCat = orphanReps.filter(r => repCategory[r] === cat);
      if (list.length === 0 && orphanRepsInCat.length === 0) continue;
      if (categoryFilter === 'ALL') rows.push({ type: 'category', category: cat });
      const mainItems: Array<{ type: 'real'; tag: TagItem } | { type: 'orphan'; displayName: string; rank: string }> = [
        ...list.filter(t => !movedSet.has(t.displayName)).map(t => ({ type: 'real' as const, tag: t })),
        ...orphanRepsInCat.map(rep => ({ type: 'orphan' as const, displayName: rep, rank: repRank.get(rep) || 'A' })),
      ];
      mainItems.sort((a, b) => (a.type === 'real' ? a.tag.displayName : a.displayName).localeCompare(b.type === 'real' ? b.tag.displayName : b.displayName));
      for (const item of mainItems) {
        if (item.type === 'real') {
          rows.push({ type: 'main', tag: item.tag });
          addedReps.add(item.tag.displayName);
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
    }
    return rows;
  }, [categoryFilter, categoryOrder, tagsByDisplayCategory, movedSet, repIncludes, repUnify, repRank, repCategory, tags, summaryQuestions, summaryCollapsed]);

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

  // 抽象質問タグのトグル
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
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>タグ＆質問リスト</h2>

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
          <option value="ALL">全カテゴリ</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
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

      {/* タグテーブル（カテゴリ見出し行＋まとめ質問＋代表タグ＋サブ行） */}
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ backgroundColor: '#e9ecef' }}>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '36px' }}>選択</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '44px' }}>ランク</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd', width: '160px' }}>タグ名</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd' }}>質問文</th>
            <th style={{ padding: '6px', textAlign: 'left', border: '1px solid #ddd', width: '220px', minWidth: '220px' }}>作品/カテゴリ</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '64px' }}>抽象質問</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '52px' }}>エロ</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', border: '1px solid #ddd', width: '52px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTableRows.map((row, idx) => {
            if (row.type === 'summary-header') {
              return (
                <tr
                  key="summary-header"
                  onClick={() => setSummaryCollapsed(false)}
                  style={{
                    backgroundColor: '#e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <td colSpan={8} style={{ padding: '4px 8px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                    ▶ 〇 まとめ質問タグ ({row.count}件) — クリックで展開
                  </td>
                </tr>
              );
            }
            if (row.type === 'category') {
              return (
                <tr key={`cat-${row.category}`} style={{ backgroundColor: '#e2e8f0' }}>
                  <td colSpan={8} style={{ padding: '4px 8px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                    {row.category === 'まとめ質問タグ' ? (
                      <span onClick={() => setSummaryCollapsed(true)} style={{ cursor: 'pointer' }} title="クリックで畳む">▼ 〇 {row.category}</span>
                    ) : (
                      `〇 ${row.category}`
                    )}
                  </td>
                </tr>
              );
            }
            if (row.type === 'summary') {
              const isEditing = editingSummaryId === row.id;
              return (
                <tr key={`summary-${row.id}`} style={{ backgroundColor: '#f0f4ff' }}>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center', color: '#999' }}>—</td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>{row.label}</td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          value={editingSummaryValue}
                          onChange={e => setEditingSummaryValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveSummaryQuestion(row.id, editingSummaryValue); if (e.key === 'Escape') { setEditingSummaryId(null); setEditingSummaryValue(''); } }}
                          style={{ flex: 1, padding: '2px 4px' }}
                          autoFocus
                        />
                        <button onClick={() => handleSaveSummaryQuestion(row.id, editingSummaryValue)} style={{ padding: '2px 6px', fontSize: '11px' }}>✓</button>
                        <button onClick={() => { setEditingSummaryId(null); setEditingSummaryValue(''); }} style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
                      </div>
                    ) : (
                      <span onClick={() => { setEditingSummaryId(row.id); setEditingSummaryValue(row.questionText); }} style={{ cursor: 'pointer' }} title="クリックして編集">
                        {row.questionText} ✏️
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '11px', color: '#666', lineHeight: 1.3 }}>{row.displayNames.join(', ')}</td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!row.erotic}
                      onChange={() => handleToggleSummaryErotic(row.id)}
                      title="まとめエロ質問（6問目以降にのみ出題）"
                    />
                  </td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                </tr>
              );
            }
            if (row.type === 'sub') {
              const subRank = (row.subRank || 'A') as UnifiedRank;
              const subTag = row.subTag;
              return (
                <tr key={`sub-${row.subDisplayName}-${idx}`} style={{ backgroundColor: (getRankBgColor(subRank) + '25') }}>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                    <RankBadge rank={subRank} />
                  </td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>
                    └ {row.subDisplayName}
                  </td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px', color: '#666' }}>同上</td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>
                    {subTag != null ? `${subTag.workCount}件 ${subTag.category ? `/ ${subTag.category}` : ''}` : '—'}
                  </td>
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                  <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
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
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px', color: '#999' }}>DBに未登録</td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <input type="checkbox" checked={vagueDisplayNames.has(row.displayName)} onChange={() => handleToggleVague(row.displayName)} title="抽象質問（11問目以降）" />
                    </td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <input type="checkbox" checked={eroticDisplayNames.has(row.displayName)} onChange={() => handleToggleErotic(row.displayName)} title="エロ質問（7問目以降）" />
                    </td>
                    <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                  </tr>
                  {subs.map((s, j) => {
                    const subRank = (s.rank || 'A') as UnifiedRank;
                    const subTag = tags.find(t => t.displayName === s.displayName);
                    return (
                      <tr key={`orphan-sub-${row.displayName}-${s.displayName}-${j}`} style={{ backgroundColor: (getRankBgColor(subRank) + '25') }}>
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                          <RankBadge rank={subRank} />
                        </td>
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>└ {s.displayName}</td>
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px', color: '#666' }}>同上</td>
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>
                          {subTag != null ? `${subTag.workCount}件 ${subTag.category ? `/ ${subTag.category}` : ''}` : '—'}
                        </td>
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
                        <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }} />
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
            const displayCategory = (tag as TagItem).displayCategory ?? tag.category ?? 'その他';
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
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>
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
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', fontSize: '12px' }}>
                  {tag.workCount}件 {tag.category && <span style={{ color: '#666' }}>/ {tag.category}</span>}
                </td>
                <td style={{ padding: '3px 5px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={vagueDisplayNames.has(tag.displayName)}
                    onChange={() => handleToggleVague(tag.displayName)}
                    title="抽象質問（11問目以降にのみ出題）"
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
