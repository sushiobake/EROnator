# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/app/admin/tags/page.tsx"
text = p.read_text(encoding="utf-8")

text = text.replace(
    "type TabType = 'works' | 'tags' | 'summary' | 'import' | 'manual' | 'initial' | 'simulate' | 'config' |",
    "type TabType = 'works' | 'tags' | 'summary' | 'import' | 'manual' | 'initial' | 'simulate' | 'optimize' | 'config' |",
    1,
)

text = text.replace(
    "  const [simBatchLoading, setSimBatchLoading] = useState(false);\n  const [simMatrixRegenerating, setSimMatrixRegenerating] = useState(false);",
    "  const [simBatchLoading, setSimBatchLoading] = useState(false);\n  const [optimizeLoading, setOptimizeLoading] = useState(false);\n  const [optimizeMessage, setOptimizeMessage] = useState<string | null>(null);\n  const [simMatrixRegenerating, setSimMatrixRegenerating] = useState(false);",
    1,
)

btn_after = """          </button>
          <button
            onClick={() => setActiveTab('config')}"""
btn_new = """          </button>
          <button
            onClick={() => setActiveTab('optimize')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'optimize' ? '#2e7d32' : 'transparent',
              color: activeTab === 'optimize' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'optimize' ? '2px solid #2e7d32' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'optimize' ? 'bold' : 'normal',
            }}
          >
            閾値最適化
          </button>
          <button
            onClick={() => setActiveTab('config')}"""
if btn_after not in text:
    raise SystemExit("button anchor not found")
text = text.replace(btn_after, btn_new, 1)

section = """      {/* タブコンテンツ コンフィグ */}
      {activeTab === 'config' && ("""
section_new = """      {/* タブコンテンツ 閾値最適化 */}
      {activeTab === 'optimize' && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>閾値最適化シミュレーション</h2>
          <p style={{ color: '#666', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            実行ボタン1つで Phase1（100作品・粗探索）→ Phase2（200作品・上位5）→ Phase3（500作品・最良1件）を自動実行します。
            数時間〜一晩かかる場合があります。進捗は右下パネル・bulk-job-status で確認できます。結果は data/threshold-optimize-results/ に保存されます。
          </p>
          {optimizeMessage && (
            <p style={{ color: '#2e7d32', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{optimizeMessage}</p>
          )}
          <button
            type="button"
            disabled={optimizeLoading || !adminToken}
            onClick={async () => {
              if (!adminToken) return;
              setOptimizeLoading(true);
              setOptimizeMessage(null);
              try {
                const res = await fetch('/api/admin/threshold-optimize', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                  body: JSON.stringify({ fullAutoPipeline: true }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error((j as { error?: string }).error ?? 'failed');
                setOptimizeMessage('ジョブを開始しました。完了までお待ちください。');
              } catch (e) {
                setOptimizeMessage(e instanceof Error ? e.message : 'エラー');
              } finally {
                setOptimizeLoading(false);
              }
            }}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              backgroundColor: optimizeLoading ? '#ccc' : '#2e7d32',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: optimizeLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {optimizeLoading ? '開始リクエスト送信中…' : 'フルパイプラインを開始（自動）'}
          </button>
        </section>
      )}

      {/* タブコンテンツ コンフィグ */}
      {activeTab === 'config' && ("""
if section not in text:
    raise SystemExit("config section anchor not found")
text = text.replace(section, section_new, 1)

p.write_text(text, encoding="utf-8")
print("ok")
