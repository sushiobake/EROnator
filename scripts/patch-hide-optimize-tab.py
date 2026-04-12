# -*- coding: utf-8 -*-
"""Remove 閾値最適化 tab button from admin tags page; content block stays."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
t = p.read_text(encoding="utf-8")
block = """          <button
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
"""
if block not in t:
    raise SystemExit("optimize tab button block not found or already removed")
p.write_text(t.replace(block, "\n          {/* 閾値最適化: タブ非表示（中身は下の activeTab==='optimize' ブロックに保持） */}\n", 1), encoding="utf-8")
print("ok")
