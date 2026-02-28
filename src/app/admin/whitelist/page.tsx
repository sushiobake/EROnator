'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WhitelistTag {
  displayName: string;
  category: string;
  status: 'approved' | 'pending';
}

interface RejectedTag {
  displayName: string;
  reason: string;
}

interface WhitelistConfig {
  version: string;
  lastUpdated: string;
  categories: string[];
  whitelist: WhitelistTag[];
  pending: WhitelistTag[];
  rejected: RejectedTag[];
}

export default function WhitelistPage() {
  const [config, setConfig] = useState<WhitelistConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('シチュエーション');
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'approved' | 'pending' | 'rejected'>('approved');

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/whitelist');
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load whitelist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleAction = async (action: string, tag: string, extra?: any) => {
    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tag, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
      } else {
        alert(data.error || 'Error');
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    await handleAction('add', newTag.trim(), { category: newCategory });
    setNewTag('');
  };

  const handleImportFromBackup = async () => {
    try {
      const res = await fetch('/api/admin/whitelist/import-backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`${data.imported}件インポートしました`);
        fetchConfig();
      }
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>読み込み中...</div>;
  if (!config) return <div style={{ padding: '20px' }}>エラー</div>;

  const filteredWhitelist = config.whitelist.filter(t => 
    !filter || t.displayName.includes(filter) || t.category.includes(filter)
  );
  const filteredPending = config.pending.filter(t => 
    !filter || t.displayName.includes(filter) || t.category.includes(filter)
  );
  const filteredRejected = config.rejected.filter(t => 
    !filter || t.displayName.includes(filter)
  );

  // カテゴリ別にグループ化
  const groupByCategory = (tags: WhitelistTag[]) => {
    const groups: Record<string, WhitelistTag[]> = {};
    for (const tag of tags) {
      const cat = tag.category || 'その他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tag);
    }
    return groups;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1440px', margin: '0 auto' }}>
      <h1>🏷️ 準有名タグ ホワイトリスト</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin" style={{ color: '#0066cc' }}>← タグ管理に戻る</Link>
        <span style={{ margin: '0 10px' }}>|</span>
        <Link href="/admin/reanalyze" style={{ color: '#0066cc' }}>DERIVED再抽出</Link>
      </div>

      {/* 統計 */}
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div>
          <strong>承認済み:</strong> {config.whitelist.length}件
        </div>
        <div>
          <strong>保留:</strong> {config.pending.length}件
        </div>
        <div>
          <strong>却下:</strong> {config.rejected.length}件
        </div>
        <div style={{ marginLeft: 'auto', color: '#666' }}>
          最終更新: {config.lastUpdated}
        </div>
      </div>

      {/* 新規追加 & インポート */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#e8f4e8',
        borderRadius: '8px'
      }}>
        <input
          type="text"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          placeholder="新しいタグ名"
          style={{ padding: '8px', flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && handleAddTag()}
        />
        <select 
          value={newCategory} 
          onChange={e => setNewCategory(e.target.value)}
          style={{ padding: '8px' }}
        >
          {config.categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button 
          onClick={handleAddTag}
          style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          ＋ 追加
        </button>
        <button 
          onClick={handleImportFromBackup}
          style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          📥 バックアップからインポート
        </button>
      </div>

      {/* フィルター */}
      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="🔍 フィルター..."
          style={{ padding: '8px', width: '300px' }}
        />
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
        {(['approved', 'pending', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === tab ? '#0066cc' : '#e0e0e0',
              color: activeTab === tab ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer'
            }}
          >
            {tab === 'approved' ? `✅ 承認済み (${filteredWhitelist.length})` :
             tab === 'pending' ? `⏳ 保留 (${filteredPending.length})` :
             `❌ 却下 (${filteredRejected.length})`}
          </button>
        ))}
      </div>

      {/* 承認済みタブ */}
      {activeTab === 'approved' && (
        <div style={{ border: '1px solid #ddd', borderRadius: '0 8px 8px 8px', padding: '15px' }}>
          {Object.entries(groupByCategory(filteredWhitelist)).sort().map(([category, tags]) => (
            <div key={category} style={{ marginBottom: '20px' }}>
              <h3 style={{ borderBottom: '2px solid #0066cc', paddingBottom: '5px' }}>
                {category} ({tags.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tags.sort((a, b) => a.displayName.localeCompare(b.displayName)).map(tag => (
                  <div 
                    key={tag.displayName}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#d4edda',
                      padding: '5px 10px',
                      borderRadius: '15px',
                      fontSize: '14px'
                    }}
                  >
                    <span>{tag.displayName}</span>
                    <button
                      onClick={() => handleAction('reject', tag.displayName, { reason: '不要' })}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        color: '#dc3545',
                        fontSize: '12px'
                      }}
                      title="却下"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 保留タブ */}
      {activeTab === 'pending' && (
        <div style={{ border: '1px solid #ddd', borderRadius: '0 8px 8px 8px', padding: '15px' }}>
          {filteredPending.length === 0 ? (
            <p style={{ color: '#666' }}>保留中のタグはありません</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>タグ名</th>
                  <th style={{ padding: '10px', textAlign: 'left', width: '150px' }}>カテゴリ</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '150px' }}>アクション</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map(tag => (
                  <tr key={tag.displayName} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{tag.displayName}</td>
                    <td style={{ padding: '10px' }}>
                      <select
                        value={tag.category}
                        onChange={e => handleAction('update', tag.displayName, { category: e.target.value })}
                        style={{ padding: '5px', width: '100%' }}
                      >
                        {config.categories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleAction('approve', tag.displayName, { category: tag.category })}
                        style={{ marginRight: '5px', padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        ✓ 承認
                      </button>
                      <button
                        onClick={() => handleAction('reject', tag.displayName, { reason: '不要' })}
                        style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        ✕ 却下
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 却下タブ */}
      {activeTab === 'rejected' && (
        <div style={{ border: '1px solid #ddd', borderRadius: '0 8px 8px 8px', padding: '15px' }}>
          {filteredRejected.length === 0 ? (
            <p style={{ color: '#666' }}>却下されたタグはありません</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filteredRejected.map(tag => (
                <div 
                  key={tag.displayName}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#f8d7da',
                    padding: '5px 10px',
                    borderRadius: '15px',
                    fontSize: '14px'
                  }}
                  title={tag.reason}
                >
                  <span style={{ textDecoration: 'line-through', color: '#666' }}>{tag.displayName}</span>
                  <button
                    onClick={() => handleAction('restore', tag.displayName)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer',
                      color: '#28a745',
                      fontSize: '12px'
                    }}
                    title="復元"
                  >
                    ↩
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
