# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

OLD_H = "const PICKED_TAGS_ROW_HEIGHT = 32;"
NEW_H = "const PICKED_TAGS_ROW_HEIGHT = 64;"
assert OLD_H in t
t = t.replace(OLD_H, NEW_H, 1)

# 次へ（モバイルを本編「これでok」と同サイズ）
OLD_NEXT = """              style={{
                padding: isMobile ? '9px 14px' : '16px 32px',
                fontSize: isMobile ? 16 : 17,
                minHeight: isMobile ? 44 : undefined,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
              }}"""
NEW_NEXT = """              style={{
                padding: isMobile ? '4px 6px' : '16px 32px',
                fontSize: isMobile ? 11 : 17,
                minHeight: isMobile ? 30 : undefined,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: isMobile ? 8 : 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
                boxSizing: 'border-box',
              }}"""
assert OLD_NEXT in t
t = t.replace(OLD_NEXT, NEW_NEXT, 1)

# やり直し（モバイル同サイズ）
OLD_RETRY = """              style={{
                padding: isMobile ? '8px 14px' : '10px 20px',
                fontSize: isMobile ? 14 : 14,
                minHeight: isMobile ? 40 : undefined,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
              }}"""
NEW_RETRY = """              style={{
                padding: isMobile ? '4px 6px' : '10px 20px',
                fontSize: isMobile ? 11 : 14,
                minHeight: isMobile ? 30 : undefined,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}"""
assert OLD_RETRY in t
t = t.replace(OLD_RETRY, NEW_RETRY, 1)

p.write_text(t, encoding="utf-8")
print("OK")
