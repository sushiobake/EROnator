# -*- coding: utf-8 -*-
"""admin/tags/page.tsx: 推薦プレイ履歴タブ"""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "app" / "admin" / "tags" / "page.tsx"
text = path.read_text(encoding="utf-8")

old_tab = (
    "type TabType = 'works' | 'tags' | 'summary' | 'import' | 'manual' | 'initial' | 'simulate' | 'config' | 'history' | 'contact' | 'changelog';"
)
new_tab = (
    "type TabType = 'works' | 'tags' | 'summary' | 'import' | 'manual' | 'initial' | 'simulate' | 'config' | 'history' | 'recommendHistory' | 'contact' | 'changelog';"
)
if old_tab not in text:
    raise SystemExit("TabType not found")
text = text.replace(old_tab, new_tab, 1)

MARK_STATE = """  const [historyReplayLoading, setHistoryReplayLoading] = useState(false);
  const CONTACT_INQUIRY_PAGE_SIZE = 30;"""
INSERT_STATE = """  const [historyReplayLoading, setHistoryReplayLoading] = useState(false);
  const [recHistLoading, setRecHistLoading] = useState(false);
  const [recHistItems, setRecHistItems] = useState<
    Array<{
      id: string;
      recommendSessionId: string;
      sessionStartedAt: string | null;
      clickedFanza: boolean;
      detailJson: unknown;
      topWorkId: string | null;
      topWorkTitle: string | null;
      createdAt: string;
    }>
  >([]);
  const [recHistTotal, setRecHistTotal] = useState(0);
  const [recHistPage, setRecHistPage] = useState(1);
  const [recHistLimit] = useState(50);
  const [recHistSelectedIds, setRecHistSelectedIds] = useState<Set<string>>(new Set());
  const [recHistDeleteLoading, setRecHistDeleteLoading] = useState(false);
  const [recHistDetailRowId, setRecHistDetailRowId] = useState<string | null>(null);
  const CONTACT_INQUIRY_PAGE_SIZE = 30;"""
if MARK_STATE not in text:
    raise SystemExit("state marker not found")
text = text.replace(MARK_STATE, INSERT_STATE, 1)

MARK_AFTER_FETCH = """    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchContactInquiries = async (page: number = 1, fromUser: boolean = false) => {"""

FETCH_FN = """    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchRecommendPlayHistory = async (page: number = 1) => {
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (!token) return;
    if (historyUseRemote && !remoteDeploymentUrl) {
      alert(
        'リモートの履歴を表示するには「本番URL」を入力するか、プレビューだけ試す場合は「プレビューURL」に貼ってください。.env.local に NEXT_PUBLIC_PRODUCTION_APP_URL を設定しても構いません。'
      );
      return;
    }
    setRecHistLoading(true);
    try {
      if (historyUseRemote) {
        const response = await fetch('/api/admin/recommend-play-history-remote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({
            targetUrl: remoteDeploymentUrl,
            token: productionHistoryToken || adminToken,
            page,
            limit: recHistLimit,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          setRecHistItems(data.items);
          setRecHistTotal(data.total ?? 0);
          setRecHistPage(page);
        }
      } else {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(recHistLimit));
        const response = await fetch(`/api/admin/recommend-play-history?${params.toString()}`, {
          headers: { 'x-eronator-admin-token': adminToken },
        });
        if (!response.ok) {
          if (response.status === 403) throw new Error('アクセスが拒否されました');
          throw new Error(`取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          setRecHistItems(data.items);
          setRecHistTotal(data.total ?? 0);
          setRecHistPage(page);
        }
      }
    } catch (e) {
      console.error('[recommend-play-history]', e);
      setRecHistItems([]);
      setRecHistTotal(0);
      alert(e instanceof Error ? e.message : '履歴の取得に失敗しました');
    } finally {
      setRecHistLoading(false);
    }
  };

  const fetchContactInquiries = async (page: number = 1, fromUser: boolean = false) => {"""

if MARK_AFTER_FETCH not in text:
    raise SystemExit("after fetchPlayHistory marker not found")
text = text.replace(MARK_AFTER_FETCH, FETCH_FN, 1)

MARK_DELETE = """    } finally {
      setHistoryDeleteLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'history') return;"""

DELETE_BLOCK = """    } finally {
      setHistoryDeleteLoading(false);
    }
  };

  const handleRecHistDeleteSelected = async () => {
    const ids = Array.from(recHistSelectedIds);
    if (ids.length === 0) {
      alert('削除する履歴を選択してください。');
      return;
    }
    if (!confirm(`選択した ${ids.length} 件の推薦プレイ履歴を削除します。よろしいですか？`)) return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (!token) return;
    if (historyUseRemote && !remoteDeploymentUrl) {
      alert('リモートの履歴を削除するには「本番URL」または「プレビューURL」を入力してください。');
      return;
    }
    setRecHistDeleteLoading(true);
    try {
      if (historyUseRemote) {
        const res = await fetch('/api/admin/recommend-play-history-remote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({
            action: 'delete',
            targetUrl: remoteDeploymentUrl,
            token: productionHistoryToken || adminToken,
            ids,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '削除に失敗しました');
        setRecHistSelectedIds(new Set());
        await fetchRecommendPlayHistory(recHistPage);
        alert(`${data.deleted ?? ids.length} 件を削除しました。`);
      } else {
        const res = await fetch('/api/admin/recommend-play-history/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({ ids }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '削除に失敗しました');
        setRecHistSelectedIds(new Set());
        await fetchRecommendPlayHistory(recHistPage);
        alert(`${data.deleted ?? ids.length} 件を削除しました。`);
      }
    } catch (e) {
      console.error('[recommend-play-history delete]', e);
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setRecHistDeleteLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'history') return;"""

if MARK_DELETE not in text:
    raise SystemExit("delete marker not found")
text = text.replace(MARK_DELETE, DELETE_BLOCK, 1)

MARK_USE = """  useEffect(() => {
    if (activeTab !== 'history') return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (historyUseRemote && !remoteDeploymentUrl) return;
    if (token) fetchPlayHistory(1);
  }, [activeTab, adminToken, historyOutcome, historyUseRemote, productionHistoryUrl, previewHistoryUrl]);

  // 詳細モーダル用: 表示時にリプレイAPIで p値・確度 を再計算"""

USE_INSERT = """  useEffect(() => {
    if (activeTab !== 'history') return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (historyUseRemote && !remoteDeploymentUrl) return;
    if (token) fetchPlayHistory(1);
  }, [activeTab, adminToken, historyOutcome, historyUseRemote, productionHistoryUrl, previewHistoryUrl]);

  useEffect(() => {
    if (activeTab !== 'recommendHistory') return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (historyUseRemote && !remoteDeploymentUrl) return;
    if (token) fetchRecommendPlayHistory(1);
  }, [activeTab, adminToken, historyUseRemote, productionHistoryUrl, previewHistoryUrl]);

  // 詳細モーダル用: 表示時にリプレイAPIで p値・確度 を再計算"""

if MARK_USE not in text:
    raise SystemExit("useEffect marker not found")
text = text.replace(MARK_USE, USE_INSERT, 1)

MARK_BTN = """            本番プレイ履歴
          </button>
          <button
            onClick={() => setActiveTab('contact')}"""

BTN_INSERT = """            本番プレイ履歴
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recommendHistory')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'recommendHistory' ? '#7c3aed' : 'transparent',
              color: activeTab === 'recommendHistory' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'recommendHistory' ? '3px solid #7c3aed' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'recommendHistory' ? 'bold' : 'normal',
            }}
          >
            推薦プレイ履歴
          </button>
          <button
            onClick={() => setActiveTab('contact')}"""

if MARK_BTN not in text:
    raise SystemExit("button marker not found")
text = text.replace(MARK_BTN, BTN_INSERT, 1)

MARK_SECTION = """            </div>
          )}
        </section>
      )}

      {activeTab === 'contact' && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>お問い合わせ一覧</h2>"""

SECTION_INSERT = """            </div>
          )}
        </section>
      )}

      {activeTab === 'recommendHistory' && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>推薦プレイ履歴</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            推薦モードで結果まで完了したプレイのみ1件として保存されます（本番プレイ履歴と同様）。タグの流れ・並べ替え・おすすめ結果・FANZAクリックを確認できます。
          </p>
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#5b21b6' }}>
              リモート取得・本番URL・プレビューURL・管理トークンは<strong>本番プレイ履歴タブ</strong>と共通です。
            </p>
          </div>
          {historyUseRemote && !remoteDeploymentUrl && (
            <p style={{ color: '#b45309', marginBottom: '1rem', fontSize: '0.9rem' }}>
              リモート取得がオンですが、本番URLもプレビューURLも空です。本番プレイ履歴タブでどちらかを入力するか、オフにするとローカルSQLiteのみ表示されます。
            </p>
          )}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fetchRecommendPlayHistory(1)}
              disabled={recHistLoading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: recHistLoading ? '#ccc' : '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: recHistLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {recHistLoading ? '読込中...' : '再読み込み'}
            </button>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>
              全 {recHistTotal} 件 {recHistPage > 1 && `（ページ ${recHistPage}）`}
            </span>
          </div>
          {recHistLoading && recHistItems.length === 0 ? (
            <p>読み込み中...</p>
          ) : recHistItems.length === 0 ? (
            <p style={{ color: '#666' }}>履歴がありません。</p>
          ) : (
            <>
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRecHistDeleteSelected}
                  disabled={recHistDeleteLoading || recHistSelectedIds.size === 0}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: recHistSelectedIds.size === 0 ? '#ccc' : '#c62828',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: recHistSelectedIds.size === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {recHistDeleteLoading ? '削除中...' : `選択した履歴を削除（${recHistSelectedIds.size}件）`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRecHistSelectedIds(
                      recHistItems.length > 0 && recHistSelectedIds.size === recHistItems.length
                        ? new Set()
                        : new Set(recHistItems.map((r) => r.id))
                    )
                  }
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', background: '#eee', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {recHistItems.length > 0 && recHistSelectedIds.size === recHistItems.length ? '選択解除' : '全選択'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }}>選択</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>1位作品</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', whiteSpace: 'nowrap', width: '1%' }}>日時</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }} title="推薦開始〜記録まで">滞在</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }}>FANZA</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }}>詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recHistItems.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={recHistSelectedIds.has(row.id)}
                            onChange={() =>
                              setRecHistSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.id)) next.delete(row.id);
                                else next.add(row.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td style={{ padding: '0.5rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.topWorkTitle ?? undefined}>
                          {row.topWorkTitle ?? row.topWorkId ?? '—'}
                        </td>
                        <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {row.sessionStartedAt && row.createdAt
                            ? (() => {
                                const start = new Date(row.sessionStartedAt).getTime();
                                const end = new Date(row.createdAt).getTime();
                                const sec = Math.round((end - start) / 1000);
                                if (sec < 60) return `${sec}秒`;
                                const m = Math.floor(sec / 60);
                                const s = sec % 60;
                                return s > 0 ? `${m}分${s}秒` : `${m}分`;
                              })()
                            : '—'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }} title={row.clickedFanza ? 'リンクをクリック済み' : ''}>
                          {row.clickedFanza ? '◎' : 'ー'}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setRecHistDetailRowId(row.id)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.85rem',
                              backgroundColor: '#7c3aed',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recHistDetailRowId != null && (() => {
                const row = recHistItems.find((r) => r.id === recHistDetailRowId);
                const detail = row?.detailJson;
                const text =
                  detail != null && typeof detail === 'object'
                    ? JSON.stringify(detail, null, 2)
                    : String(detail ?? '');
                return (
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      background: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10000,
                    }}
                    onClick={() => setRecHistDetailRowId(null)}
                  >
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: '8px',
                        width: '95vw',
                        maxWidth: '900px',
                        height: '85vh',
                        maxHeight: '800px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '1.05rem' }}>推薦プレイ詳細（JSON）</strong>
                        <button
                          type="button"
                          onClick={() => setRecHistDetailRowId(null)}
                          style={{ padding: '0.4rem 1rem', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
                        >
                          閉じる
                        </button>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: '1rem',
                          overflow: 'auto',
                          flex: 1,
                          fontSize: '0.8rem',
                          lineHeight: 1.45,
                          background: '#fafafa',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {text}
                      </pre>
                    </div>
                  </div>
                );
              })()}
              {recHistTotal > recHistLimit && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fetchRecommendPlayHistory(recHistPage - 1)}
                    disabled={recHistLoading || recHistPage <= 1}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: recHistPage <= 1 ? '#ccc' : '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: recHistPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    前へ
                  </button>
                  <span style={{ fontSize: '0.9rem' }}>
                    ページ {recHistPage} / {Math.ceil(recHistTotal / recHistLimit) || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchRecommendPlayHistory(recHistPage + 1)}
                    disabled={recHistLoading || recHistPage >= Math.ceil(recHistTotal / recHistLimit)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: recHistPage >= Math.ceil(recHistTotal / recHistLimit) ? '#ccc' : '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: recHistPage >= Math.ceil(recHistTotal / recHistLimit) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'contact' && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>お問い合わせ一覧</h2>"""

if MARK_SECTION not in text:
    raise SystemExit("section marker not found")
text = text.replace(MARK_SECTION, SECTION_INSERT, 1)

path.write_text(text, encoding="utf-8")
print("OK admin page")
