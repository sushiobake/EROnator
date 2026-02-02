/**
 * タグ管理コンポーネント（統合ビュー）
 * ランク: S（OFFICIAL）、A/B/C（DERIVED）、X（STRUCTURAL）
 * S/Xは編集不可、A/B/Cは編集可能
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { RANK_BG, RANK_TEXT } from '../constants/rankColors';

interface TagItem {
  tagKey: string;
  displayName: string;
  tagType: string;
  category: string | null;
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

  // 質問テンプレート読み込み
  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/tags/question-template');
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
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

  useEffect(() => {
    fetchTags();
    fetchRanks();
    fetchTemplates();
    fetchBannedTags();
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

  // 質問テンプレート保存
  const handleSaveTemplate = async (displayName: string, template: string) => {
    try {
      const res = await fetch('/api/admin/tags/question-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, template: template.trim() || null })
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
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
        
        // カテゴリフィルタ
        if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
        
        // 検索
        if (searchText && !t.displayName.toLowerCase().includes(searchText.toLowerCase())) return false;
        
        return true;
      })
      .sort((a, b) => {
        // あいうえお順
        return a.displayName.localeCompare(b.displayName, 'ja');
      });
  }, [tags, ranks, showRanks, categoryFilter, searchText]);

  // ページネーション
  const totalPages = Math.ceil(filteredTags.length / PAGE_SIZE);
  const paginatedTags = filteredTags.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // カテゴリ一覧
  const categories = useMemo(() => {
    const cats = new Set(tags.map(t => t.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [tags]);

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

  // 全選択・全解除
  const handleSelectAll = () => {
    const newSet = new Set(selectedTags);
    paginatedTags.forEach(t => newSet.add(t.tagKey));
    setSelectedTags(newSet);
  };
  
  const handleDeselectAll = () => {
    const newSet = new Set(selectedTags);
    paginatedTags.forEach(t => newSet.delete(t.tagKey));
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
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
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

  // デフォルト質問文を生成
  const getDefaultQuestion = (displayName: string): string => {
    return `「${displayName}」が登場しますか？`;
  };

  return (
    <div>
      {/* 統計 */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        flexWrap: 'wrap'
      }}>
        <div><strong>全タグ:</strong> {stats.total}件</div>
        <div style={{ color: RANK_TEXT.S }}><strong>S:</strong> {stats.S}</div>
        <div style={{ color: RANK_TEXT.A }}><strong>A:</strong> {stats.A}</div>
        <div style={{ color: RANK_TEXT.B }}><strong>B:</strong> {stats.B}</div>
        <div style={{ color: RANK_TEXT.C }}><strong>C:</strong> {stats.C}</div>
        <div style={{ color: '#666' }}><strong>未設定:</strong> {stats.N}</div>
        <div style={{ color: RANK_TEXT.X }}><strong>X:</strong> {stats.X}</div>
      </div>

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
            <option key={c} value={c!}>{c}</option>
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
          表示: {filteredTags.length}件
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

      {/* タグテーブル */}
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
        <thead>
          <tr style={{ backgroundColor: '#e9ecef' }}>
            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', width: '40px' }}>選択</th>
            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', width: '50px' }}>ランク</th>
            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', width: '180px' }}>タグ名</th>
            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>質問文</th>
            <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', width: '140px' }}>作品/カテゴリ</th>
            <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', width: '60px' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTags.map(tag => {
            const unifiedRank = getUnifiedRank(tag);
            const editable = isEditable(tag);
            const template = templates[tag.displayName];
            const questionText = template || getDefaultQuestion(tag.displayName);
            
            return (
              <tr 
                key={tag.tagKey}
                style={{ 
                  backgroundColor: selectedTags.has(tag.tagKey) ? '#e8f5e9' : getRankBgColor(unifiedRank) + '40'
                }}
              >
                <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedTags.has(tag.tagKey)}
                    onChange={() => {
                      setSelectedTags(prev => {
                        const next = new Set(prev);
                        if (next.has(tag.tagKey)) {
                          next.delete(tag.tagKey);
                        } else {
                          next.add(tag.tagKey);
                        }
                        return next;
                      });
                    }}
                  />
                </td>
                <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>
                  {editable ? (
                    <select
                      value={ranks[tag.displayName] || ''}
                      onChange={e => handleRankChange(tag.displayName, e.target.value as 'A' | 'B' | 'C' | '')}
                      style={{ 
                        padding: '2px',
                        backgroundColor: getRankBgColor(unifiedRank),
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
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
                <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                  {editable && editingTag === tag.tagKey ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameTag(tag.tagKey, editingName);
                          if (e.key === 'Escape') { setEditingTag(null); setEditingName(''); }
                        }}
                        style={{ flex: 1, padding: '2px 4px' }}
                        autoFocus
                      />
                      <button onClick={() => handleRenameTag(tag.tagKey, editingName)} style={{ padding: '2px 6px', fontSize: '11px' }}>✓</button>
                      <button onClick={() => { setEditingTag(null); setEditingName(''); }} style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
                    </div>
                  ) : (
                    <span 
                      onClick={() => editable && (setEditingTag(tag.tagKey), setEditingName(tag.displayName))}
                      style={{ cursor: editable ? 'pointer' : 'default' }}
                      title={editable ? 'クリックして編集' : ''}
                    >
                      {tag.displayName} {editable && '✏️'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
                  {editingTemplate === tag.tagKey ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        value={editingTemplateValue}
                        onChange={e => setEditingTemplateValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveTemplate(tag.displayName, editingTemplateValue);
                          if (e.key === 'Escape') { setEditingTemplate(null); setEditingTemplateValue(''); }
                        }}
                        style={{ flex: 1, padding: '2px 4px' }}
                        autoFocus
                      />
                      <button onClick={() => handleSaveTemplate(tag.displayName, editingTemplateValue)} style={{ padding: '2px 6px', fontSize: '11px' }}>✓</button>
                      <button onClick={() => { setEditingTemplate(null); setEditingTemplateValue(''); }} style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
                    </div>
                  ) : (
                    <span 
                      onClick={() => { setEditingTemplate(tag.tagKey); setEditingTemplateValue(questionText); }}
                      style={{ cursor: 'pointer' }}
                      title="クリックして編集"
                    >
                      {questionText} ✏️
                    </span>
                  )}
                </td>
                <td style={{ padding: '6px', border: '1px solid #ddd', fontSize: '12px' }}>
                  {tag.workCount}件 {tag.category && <span style={{ color: '#666' }}>/ {tag.category}</span>}
                </td>
                <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center' }}>
                  {tag.tagType !== 'OFFICIAL' && (
                    <button
                      onClick={() => handleDeleteTag(tag.tagKey)}
                      style={{ padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      削除
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '10px', 
          marginTop: '15px',
          alignItems: 'center'
        }}>
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>≪</button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '5px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>＜</button>
          <span style={{ padding: '5px 15px' }}>{currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '5px 10px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>＞</button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '5px 10px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>≫</button>
        </div>
      )}

      {loading && (
        <div style={{ padding: '20px', textAlign: 'center' }}>読み込み中...</div>
      )}
    </div>
  );
}
