# -*- coding: utf-8 -*-
"""UTF-8 safe insert for admin tags page: V3 comprehensive optimize button."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
text = path.read_text(encoding="utf-8")

marker = """          )}
          <p style={{ color: '#666', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            早期失敗v2（条件②＝候補が広すぎ）の検証用スイープ: 50作品・9通り＋Baseline・約1〜2時間目安。結果は同じく data/threshold-optimize-results/ に保存されます。
          </p>"""

insert = """          )}
          <p style={{ color: '#666', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            V3包括最適化: 45パラメータ＋BaselineでPhase1（25作品×2試行×曖昧さ1,3,5）→ Phase2は上位8件（60作品×3試行×曖昧さ1〜5）→ Phase3は上位3件（100作品×4試行×曖昧さ1〜5）。所要目安 約5.5時間。結果は data/threshold-optimize-results/ に pipeline-v3-*.json として保存されます。
          </p>
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
                  body: JSON.stringify({
                    comprehensiveV3: true,
                    aiGateChoice: 'BOTH',
                  }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error((j as { error?: string }).error ?? 'failed');
                setOptimizeMessage('V3包括パイプラインを開始しました。完了までお待ちください。');
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
              backgroundColor: optimizeLoading ? '#ccc' : '#6a1b9a',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: optimizeLoading ? 'not-allowed' : 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            {optimizeLoading ? '開始リクエスト送信中…' : 'V3包括最適化を開始（約5.5時間）'}
          </button>
          <p style={{ color: '#666', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            早期失敗v2（条件②＝候補が広すぎ）の検証用スイープ: 50作品・9通り＋Baseline・約1〜2時間目安。結果は同じく data/threshold-optimize-results/ に保存されます。
          </p>"""

if marker not in text:
    raise SystemExit("marker not found; page.tsx may have changed")
if "comprehensiveV3: true" in text:
    print("already patched")
else:
    text = text.replace(marker, insert, 1)
    path.write_text(text, encoding="utf-8")
    print("patched OK")
