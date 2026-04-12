# -*- coding: utf-8 -*-
"""Add early-fail exit label to admin sim result headers (UTF-8 safe)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src" / "app" / "admin" / "tags" / "page.tsx"
text = path.read_text(encoding="utf-8")

old1 = """                  {simResult.success ? '成功' : '失敗'} - {simResult.outcome}
                </h3>"""

new1 = """                  {simResult.success ? '成功' : '失敗'} - {simResult.outcome}
                  {(simResult as { diagnostic?: { endedBy?: string } }).diagnostic?.endedBy === 'EARLY_FAIL_REVIEW' ? (
                    <span style={{ marginLeft: '0.35rem', fontSize: '1rem', fontWeight: 700, color: '#b71c1c' }}>（早期失敗で終了）</span>
                  ) : null}
                </h3>"""

old2 = """                <span>{(simResult as { success?: boolean }).success ? '成功' : '失敗'} | <strong>作品:</strong> {simResult.targetWorkTitle} | <strong>最終:</strong> {simResult.finalWorkTitle || '(なし)'} | <strong>結果:</strong> {simResult.outcome}</span>"""

new2 = """                <span>{(simResult as { success?: boolean }).success ? '成功' : '失敗'} | <strong>作品:</strong> {simResult.targetWorkTitle} | <strong>最終:</strong> {simResult.finalWorkTitle || '(なし)'} | <strong>結果:</strong> {simResult.outcome}
                  {(simResult as { diagnostic?: { endedBy?: string } }).diagnostic?.endedBy === 'EARLY_FAIL_REVIEW' ? <strong style={{ color: '#b71c1c' }}>（早期失敗）</strong> : null}
                </span>"""

old3 = """                        {simResultModal.success ? '成功' : '失敗'} - {simResultModal.outcome} | 作品: {simResultModal.targetWorkTitle}
                      </h3>"""

new3 = """                        {simResultModal.success ? '成功' : '失敗'} - {simResultModal.outcome}
                        {(simResultModal as { diagnostic?: { endedBy?: string } }).diagnostic?.endedBy === 'EARLY_FAIL_REVIEW' ? (
                          <span style={{ marginLeft: '0.35rem', fontSize: '0.95rem', fontWeight: 700, color: '#b71c1c' }}>（早期失敗で終了）</span>
                        ) : null}
                        {' '}| 作品: {simResultModal.targetWorkTitle}
                      </h3>"""

for name, old, new in [("h3", old1, new1), ("subtitle", old2, new2), ("modal", old3, new3)]:
    if old not in text:
        raise SystemExit(f"marker not found: {name}")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("page.tsx early-exit display patched OK")
