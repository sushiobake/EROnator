# -*- coding: utf-8 -*-
"""One-off UTF-8 safe patches for early-exit v2 (mvpConfig, UI copy, optimize tab)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch_mvp_config():
    path = ROOT / "config" / "mvpConfig.json"
    text = path.read_text(encoding="utf-8")
    data = json.loads(text)
    ee = data["flow"]["earlyExitReview"]
    ee["thresholds"] = {
        "q25": {"minConfidence": 0.08, "maxEffectiveCandidates": 80},
        "q30": {"minConfidence": 0.1, "maxEffectiveCandidates": 50},
        "q35": {"minConfidence": 0.12, "maxEffectiveCandidates": 30},
        "q40": {"minConfidence": 0.1, "maxEffectiveCandidates": 40},
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("patched", path)


def patch_thresholds_summary():
    path = ROOT / "src" / "app" / "admin" / "components" / "SimEarlyExitThresholdsSummary.tsx"
    s = path.read_text(encoding="utf-8")
    if "②≤${t.maxEffectiveCandidates}（狭さ）" in s:
        s = s.replace(
            "return `${n}問:①${(t.minConfidence * 100).toFixed(0)}%②≤${t.maxEffectiveCandidates}（狭さ）`;",
            "return `${n}問:①${(t.minConfidence * 100).toFixed(0)}%②>${t.maxEffectiveCandidates}（広さ）`;",
        )
    if "「狭さ」閾値以下" in s:
        s = s.replace(
            "①<strong>確度</strong>（→の右）が下限未満　②<strong>実質候補</strong>が「狭さ」閾値以下（件数）",
            "①<strong>確度</strong>（→の右）が下限未満　②<strong>実質候補</strong>が「広さ」閾値超（件数）",
        )
    path.write_text(s, encoding="utf-8")
    print("patched", path)


def patch_optimize_tab():
    path = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
    s = path.read_text(encoding="utf-8")
    old_btn = """          <button
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
"""
    new_block = """          <p style={{ color: '#666', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            早期失敗v2（条件②＝候補が広すぎ）の検証用スイープ: 50作品・9通り＋Baseline・約1〜2時間目安。結果は同じく data/threshold-optimize-results/ に保存されます。
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
                    earlyExitV2: true,
                    sampleSize: 50,
                    trialsPerWork: 3,
                    ambiguityLevels: [1, 3, 5],
                    aiGateChoice: 'BOTH',
                  }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error((j as { error?: string }).error ?? 'failed');
                setOptimizeMessage('早期失敗v2スイープを開始しました。完了までお待ちください。');
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
              backgroundColor: optimizeLoading ? '#ccc' : '#1565c0',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: optimizeLoading ? 'not-allowed' : 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            {optimizeLoading ? '開始リクエスト送信中…' : '早期失敗v2スイープ開始（50件・約1〜2時間）'}
          </button>
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
"""
    if old_btn not in s:
        raise SystemExit("page.tsx: expected button block not found")
    s = s.replace(old_btn, new_block)
    path.write_text(s, encoding="utf-8")
    print("patched", path)


def patch_config_tab():
    path = ROOT / "src" / "app" / "admin" / "tags" / "tabs" / "ConfigTab.tsx"
    s = path.read_text(encoding="utf-8")
    old_thr = """    q25: { minConfidence: 0.22, maxEffectiveCandidates: 15 },
    q30: { minConfidence: 0.18, maxEffectiveCandidates: 20 },
    q35: { minConfidence: 0.15, maxEffectiveCandidates: 25 },
    q40: { minConfidence: 0.12, maxEffectiveCandidates: 30 },"""
    new_thr = """    q25: { minConfidence: 0.08, maxEffectiveCandidates: 80 },
    q30: { minConfidence: 0.1, maxEffectiveCandidates: 50 },
    q35: { minConfidence: 0.12, maxEffectiveCandidates: 30 },
    q40: { minConfidence: 0.1, maxEffectiveCandidates: 40 },"""
    if old_thr in s:
        s = s.replace(old_thr, new_thr)
    if "（狭すぎ）" in s:
        s = s.replace(
            "① 1位の確率がこの値<strong>未満</strong>　② 実質候補がこの値<strong>以下</strong>（狭すぎ）のとき②側が揃う",
            "① 1位の確率がこの値<strong>未満</strong>　② 実質候補がこの値<strong>超</strong>（広すぎ）のとき②側が揃う",
        )
    if "「狭さ」上限" in s:
        s = s.replace(
            "② 実質候補「狭さ」上限（件数）",
            "② 実質候補「広さ」閾値（件数・超えたら②成立）",
        )
    path.write_text(s, encoding="utf-8")
    print("patched", path)


if __name__ == "__main__":
    patch_mvp_config()
    patch_thresholds_summary()
    patch_optimize_tab()
    patch_config_tab()
