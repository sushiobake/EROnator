# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")
old = """  const sortFixBtnStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 4 : 6,
    padding: isMobile ? '4px 8px' : '6px 10px',
    fontSize: isMobile ? 11 : 12,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: 'var(--color-text-muted)',
  };"""
new = """  const sortFixBtnStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 3 : 5,
    padding: isMobile ? '3px 6px' : '5px 8px',
    fontSize: isMobile ? 9 : 10,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 5,
    color: 'var(--color-text-muted)',
  };"""
if old not in t:
    raise SystemExit("sortFixBtnStyle block not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("OK")
