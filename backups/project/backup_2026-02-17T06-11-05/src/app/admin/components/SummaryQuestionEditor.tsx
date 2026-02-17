'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getWorkCountLabel, getTagButtonBackgroundFromSection } from '../utils/tagWorkCount';

export interface SummaryQuestionItem {
  id: string;
  label: string;
  questionText: string;
  displayNames: string[];
  erotic?: boolean;
}

interface TagItem {
  displayName: string;
  tagType: string;
  displayCategory: string;
  /** DERIVED のみ。A/B/C。未設定は '' */
  rank?: string;
  /** そのタグが付いている作品数（表示・濃さ用） */
  workCount?: number;
}

interface Props {
  adminToken: string;
}

/** 表示用セクション: S=公式, A=派生のうちランクA, B=派生のうちランクB/C/未設定 */
function getSectionLabel(tag: TagItem): string {
  if (tag.tagType === 'OFFICIAL') return 'S（公式）';
  if (tag.tagType === 'DERIVED') return tag.rank === 'A' ? 'A（採用）' : 'B（派生）';
  return 'X（構造）';
}

export default function SummaryQuestionEditor({ adminToken }: Props) {
  const [list, setList] = useState<SummaryQuestionItem[]>([]);
  const [tagsFull, setTagsFull] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newForm, setNewForm] = useState<Partial<SummaryQuestionItem> & { id: string; label: string; questionText: string; displayNames: string[] } | null>(null);
  /** いま編集しているまとめは1つだけ。'new' = 新規フォーム、null = 未選択 */
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [tagListFilter, setTagListFilter] = useState('');
  /** どのタグの「まとめを指定して追加」メニューが開いているか。displayName または null */
  const [summaryMenuForTag, setSummaryMenuForTag] = useState<string | null>(null);

  const fetchList = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/summary-questions', {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) {
        setList(data.summaryQuestions);
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: '一覧の取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/tags/list', {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.tags && Array.isArray(data.tags)) {
        setTagsFull(data.tags.map((t: { displayName: string; tagType: string; displayCategory?: string; category?: string; rank?: string; workCount?: number }) => ({
          displayName: t.displayName,
          tagType: t.tagType || '',
          displayCategory: t.displayCategory ?? t.category ?? 'その他',
          rank: t.rank ?? '',
          workCount: typeof t.workCount === 'number' ? t.workCount : undefined,
        })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchList();
    fetchTags();
  }, [adminToken]);

  const summaryMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (summaryMenuForTag === null) return;
    const handleMouseDown = (e: MouseEvent) => {
      const el = summaryMenuRef.current;
      if (el && !el.contains(e.target as Node)) setSummaryMenuForTag(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [summaryMenuForTag]);

  const filteredTags = useMemo(() => {
    // X（STRUCTURAL）は表示しない
    let base = tagsFull.filter(t => t.tagType !== 'STRUCTURAL');
    if (!tagListFilter.trim()) return base;
    const q = tagListFilter.trim().toLowerCase();
    return base.filter(t => t.displayName.toLowerCase().includes(q));
  }, [tagsFull, tagListFilter]);

  const tagsBySection = useMemo(() => {
    const map = new Map<string, Map<string, string[]>>();
    for (const t of filteredTags) {
      const typeLabel = getSectionLabel(t);
      if (!map.has(typeLabel)) map.set(typeLabel, new Map());
      const catMap = map.get(typeLabel)!;
      const cat = t.displayCategory || 'その他';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(t.displayName);
    }
    const order = ['S（公式）', 'A（採用）', 'B（派生）'];
    const sections: Array<{ typeLabel: string; categories: Array<{ name: string; displayNames: string[] }> }> = [];
    for (const typeLabel of order) {
      const catMap = map.get(typeLabel);
      if (!catMap) continue;
      const categories = Array.from(catMap.entries()).map(([name, displayNames]) => ({ name, displayNames: displayNames.sort((a, b) => a.localeCompare(b, 'ja')) }));
      categories.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      sections.push({ typeLabel, categories });
    }
    return sections;
  }, [filteredTags]);

  const workCountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tagsFull) {
      if (typeof t.workCount === 'number') m.set(t.displayName, t.workCount);
    }
    return m;
  }, [tagsFull]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveOne = async (item: SummaryQuestionItem) => {
    setSavingId(item.id);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/summary-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({
          id: item.id,
          label: item.label,
          questionText: item.questionText,
          displayNames: item.displayNames,
          erotic: item.erotic,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) {
        setList(data.summaryQuestions);
        showMsg('success', '保存しました');
      } else {
        showMsg('error', data.error || '保存に失敗しました');
      }
    } catch (e) {
      console.error(e);
      showMsg('error', '保存に失敗しました');
    } finally {
      setSavingId(null);
    }
  };

  const deleteOne = async (id: string) => {
    if (!confirm(`まとめ質問「${id}」を削除しますか？`)) return;
    setMessage(null);
    if (editingId === id) setEditingId(null);
    try {
      const res = await fetch('/api/admin/summary-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) {
        setList(data.summaryQuestions);
        showMsg('success', '削除しました');
      } else {
        showMsg('error', data.error || '削除に失敗しました');
      }
    } catch (e) {
      console.error(e);
      showMsg('error', '削除に失敗しました');
    }
  };

  const createOne = async () => {
    if (!newForm || !newForm.id?.trim() || !newForm.label?.trim() || !newForm.questionText?.trim()) {
      showMsg('error', 'id・ラベル・質問文は必須です');
      return;
    }
    setMessage(null);
    try {
      const res = await fetch('/api/admin/summary-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({
          action: 'create',
          id: newForm.id.trim(),
          label: newForm.label.trim(),
          questionText: newForm.questionText.trim(),
          displayNames: Array.isArray(newForm.displayNames) ? newForm.displayNames.filter(d => typeof d === 'string' && d.trim() !== '') : [],
          erotic: !!newForm.erotic,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.summaryQuestions)) {
        setList(data.summaryQuestions);
        setNewForm(null);
        setEditingId(null);
        showMsg('success', '追加しました');
      } else {
        showMsg('error', data.error || '追加に失敗しました');
      }
    } catch (e) {
      console.error(e);
      showMsg('error', '追加に失敗しました');
    }
  };

  const updateLocal = (id: string, patch: Partial<SummaryQuestionItem>) => {
    setList(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const addDisplayName = (id: string, name: string) => {
    const n = (name || '').trim();
    if (!n) return;
    setList(prev => prev.map(q => {
      if (q.id !== id) return q;
      if (q.displayNames.includes(n)) return q;
      return { ...q, displayNames: [...q.displayNames, n] };
    }));
  };

  const removeDisplayName = (id: string, index: number) => {
    setList(prev => prev.map(q => {
      if (q.id !== id) return q;
      const next = [...q.displayNames];
      next.splice(index, 1);
      return { ...q, displayNames: next };
    }));
  };

  const addTagToEditing = (displayName: string) => {
    if (editingId === 'new' && newForm) {
      if (newForm.displayNames?.includes(displayName)) return;
      setNewForm(f => f ? { ...f, displayNames: [...(f.displayNames || []), displayName] } : null);
      return;
    }
    if (editingId && editingId !== 'new') {
      addDisplayName(editingId, displayName);
    }
  };

  /** タグを指定したまとめに内包タグとして追加（タグベースでまとめを選ぶ用） */
  const addTagToSummary = (summaryId: string, displayName: string) => {
    addDisplayName(summaryId, displayName);
    setSummaryMenuForTag(null);
  };

  const currentItem = editingId === 'new' ? null : editingId ? list.find(q => q.id === editingId) ?? null : null;

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2>まとめ質問の編集</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        上で「編集するまとめ」を選び、タグは下の一覧からクリックで内包タグに追加。S（公式）・A（採用）・B（派生）で区分、Xは非表示。
      </p>
      {message && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            borderRadius: '4px',
          }}
        >
          {message.text}
        </div>
      )}

      {/* 上: 編集エリア（横長） */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>編集するまとめ</label>
          <select
            value={editingId ?? ''}
            onChange={e => {
              const v = e.target.value;
              if (v === '') setEditingId(null);
              else if (v === '__new__') {
                setNewForm({ id: '', label: '', questionText: '', displayNames: [], erotic: false });
                setEditingId('new');
              } else {
                setEditingId(v);
              }
            }}
            style={{ padding: '0.5rem 0.75rem', fontSize: '14px', minWidth: '220px' }}
          >
            <option value="">— 選択 —</option>
            <option value="__new__">＋ 新規作成</option>
            {list.map(q => (
              <option key={q.id} value={q.id}>{q.id} — {q.label}</option>
            ))}
          </select>
        </div>

        {editingId === 'new' && newForm && (
          <div style={{ border: '2px solid #0070f3', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fcff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>ID</label><input type="text" value={newForm.id} onChange={e => setNewForm(f => f ? { ...f, id: e.target.value } : null)} placeholder="英数字で一意" style={{ padding: '0.5rem', width: '100%' }} /></div>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>ラベル</label><input type="text" value={newForm.label} onChange={e => setNewForm(f => f ? { ...f, label: e.target.value } : null)} placeholder="管理用表示名" style={{ padding: '0.5rem', width: '100%' }} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>質問文</label><textarea value={newForm.questionText} onChange={e => setNewForm(f => f ? { ...f, questionText: e.target.value } : null)} placeholder="例: 温泉とか、屋外とか…" rows={2} style={{ padding: '0.5rem', width: '100%', resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" checked={!!newForm.erotic} onChange={e => setNewForm(f => f ? { ...f, erotic: e.target.checked } : null)} /><span style={{ fontSize: '13px' }}>エロ（6問目以降のみ）</span></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>内包タグ（下の一覧をクリックで追加）</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px' }}>
                  {(newForm.displayNames || []).map((d, i) => (
                    <span key={`new-${d}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', backgroundColor: '#e8e8e8', borderRadius: '4px', fontSize: '13px', gap: '4px' }}>
                      {d}
                      <button type="button" onClick={() => setNewForm(f => f ? { ...f, displayNames: (f.displayNames || []).filter((_, j) => j !== i) } : null)} style={{ padding: '0 4px', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={createOne} style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>追加</button>
                <button type="button" onClick={() => { setNewForm(null); setEditingId(null); }} style={{ padding: '0.5rem 1rem', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {currentItem && (
          <div style={{ border: '2px solid #333', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>ID</label><code style={{ padding: '0.35rem', backgroundColor: '#eee', borderRadius: '4px', fontSize: '13px', display: 'block' }}>{currentItem.id}</code></div>
              <div><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>ラベル</label><input type="text" value={currentItem.label} onChange={e => updateLocal(currentItem.id, { label: e.target.value })} style={{ padding: '0.5rem', width: '100%' }} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>質問文</label><textarea value={currentItem.questionText} onChange={e => updateLocal(currentItem.id, { questionText: e.target.value })} rows={2} style={{ padding: '0.5rem', width: '100%', resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="checkbox" checked={!!currentItem.erotic} onChange={e => updateLocal(currentItem.id, { erotic: e.target.checked })} /><span style={{ fontSize: '13px' }}>エロ（6問目以降のみ）</span></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>内包タグ（下の一覧をクリックで追加）</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px' }}>
                  {currentItem.displayNames.map((d, i) => (
                    <span key={`${currentItem.id}-${d}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', backgroundColor: '#e8e8e8', borderRadius: '4px', fontSize: '13px', gap: '4px' }}>
                      {d}
                      <button type="button" onClick={() => removeDisplayName(currentItem.id, i)} style={{ padding: '0 4px', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => saveOne(currentItem)} disabled={savingId === currentItem.id} style={{ padding: '0.5rem 1rem', backgroundColor: savingId === currentItem.id ? '#ccc' : '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: savingId === currentItem.id ? 'not-allowed' : 'pointer' }}>
                  {savingId === currentItem.id ? '保存中...' : '保存'}
                </button>
                <button type="button" onClick={() => deleteOne(currentItem.id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>削除</button>
              </div>
            </div>
          </div>
        )}

        {!editingId && <p style={{ color: '#666', fontSize: '13px' }}>上でまとめを選んでください。</p>}
      </div>

      {/* 下: タグ一覧（S・A・Bで区分、見やすく） */}
      <div style={{ padding: '1.25rem', border: '1px solid #bbb', borderRadius: '8px', backgroundColor: '#fafafa', borderLeft: '4px solid #333' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#111' }}>タグ一覧（S・A・B）</h3>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '13px', color: '#444' }}>
          左の「＋タグ」は現在編集中のまとめに追加。右の「→まとめ」で一覧からまとめを選んでそのまとめに追加できます。
        </p>
        <input
          type="text"
          value={tagListFilter}
          onChange={e => setTagListFilter(e.target.value)}
          placeholder="タグ名で絞り込み..."
          style={{ width: '100%', maxWidth: '320px', padding: '0.5rem 0.75rem', marginBottom: '1rem', fontSize: '14px', border: '2px solid #999', borderRadius: '6px' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {tagsBySection.map(section => (
            <div key={section.typeLabel} style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1rem', border: '1px solid #ddd', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#333', color: '#fff', fontWeight: 'bold', fontSize: '14px', marginBottom: '0.75rem', borderRadius: '6px' }}>
                {section.typeLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {section.categories.map(cat => (
                  <div key={`${section.typeLabel}-${cat.name}`}>
                    <div style={{ padding: '0.35rem 0.6rem', backgroundColor: '#e8e8e8', fontWeight: 'bold', fontSize: '12px', marginBottom: '0.4rem', borderRadius: '4px', color: '#222' }}>
                      {cat.name}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '10px',
                        alignItems: 'stretch',
                      }}
                    >
                      {cat.displayNames.map(dn => (
                        <div
                          key={dn}
                          ref={summaryMenuForTag === dn ? summaryMenuRef : undefined}
                          style={{ position: 'relative', display: 'flex', gap: '4px', alignItems: 'stretch', minWidth: 0 }}
                        >
                          <button
                            type="button"
                            onClick={() => addTagToEditing(dn)}
                            disabled={!editingId}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '0.5rem 0.75rem',
                              fontSize: '14px',
                              fontWeight: 500,
                              border: '2px solid #666',
                              borderRadius: '6px',
                              cursor: editingId ? 'pointer' : 'default',
                              backgroundColor: getTagButtonBackgroundFromSection(section.typeLabel, workCountMap.get(dn), !editingId),
                              color: '#111',
                              textAlign: 'left',
                              minHeight: '40px',
                            }}
                            title={editingId ? `「${dn}」を現在のまとめに追加` : '上でまとめを選択'}
                          >
                            ＋ {getWorkCountLabel(dn, workCountMap.get(dn))}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSummaryMenuForTag(s => (s === dn ? null : dn))}
                            style={{
                              padding: '0 0.5rem',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '2px solid #555',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              backgroundColor: summaryMenuForTag === dn ? '#ddd' : '#f0f0f0',
                              color: '#333',
                              whiteSpace: 'nowrap',
                              minHeight: '40px',
                            }}
                            title="まとめを選んで追加"
                          >
                            →まとめ
                          </button>
                          {summaryMenuForTag === dn && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                zIndex: 20,
                                backgroundColor: '#fff',
                                border: '2px solid #666',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                maxHeight: '240px',
                                overflowY: 'auto',
                                minWidth: '200px',
                              }}
                            >
                              <div style={{ padding: '0.35rem 0.6rem', fontSize: '11px', color: '#666', borderBottom: '1px solid #eee' }}>
                                「{dn}」を追加するまとめ
                              </div>
                              {list.map(q => (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => addTagToSummary(q.id, dn)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '13px',
                                    textAlign: 'left',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: '#111',
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8f0fe'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                                >
                                  {q.id} — {q.label}
                                </button>
                              ))}
                              {list.length === 0 && <div style={{ padding: '0.5rem 0.75rem', fontSize: '13px', color: '#888' }}>まとめがありません</div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {filteredTags.length === 0 && <p style={{ fontSize: '14px', color: '#666', marginTop: '0.5rem' }}>該当するタグがありません。</p>}
        <p style={{ marginTop: '1rem', fontSize: '13px', color: '#666' }}>表示: {filteredTags.length} 件（S・A・B、Xは非表示）</p>
      </div>
    </section>
  );
}
