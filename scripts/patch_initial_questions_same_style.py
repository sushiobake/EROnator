# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

OLD = "<p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: isMobile ? 'var(--color-text-muted)' : 'var(--color-text)', fontSize: isMobile ? 14 : 17, lineHeight: 1.3 }}>\n            {rc.initialPriorityQuestion}"
NEW = "<p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>\n            {rc.initialPriorityQuestion}"
assert OLD in t, "block not found"
t = t.replace(OLD, NEW, 1)
p.write_text(t, encoding="utf-8")
print("OK")
