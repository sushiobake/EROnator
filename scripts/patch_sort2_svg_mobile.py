# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")
old = """                    <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>"""
new = """                    <svg style={{ width: isMobile ? 14 : 11, height: isMobile ? 14 : 11 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>"""
assert old in t
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("ok")
