# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")
old = """const PICKED_TAGS_ROW_HEIGHT = 44;

function RecommendPickedTagsRow({ tags, isMobile }: { tags: SelectedTag[]; isMobile: boolean }) {
  return (
    <div
      style={{
        marginTop: 6,
        width: '100%',
        maxWidth: 640,
        minHeight: PICKED_TAGS_ROW_HEIGHT,
        maxHeight: PICKED_TAGS_ROW_HEIGHT,
        overflowY: 'auto',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignContent: 'flex-start',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      {tags.map((x) => (
        <span
          key={x.tagKey}
          title={x.displayName}
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.3,
            padding: isMobile ? '4px 8px' : '4px 10px',
            borderRadius: 9999,
            backgroundColor: '#dbeafe',
            color: '#1d4ed8',
            border: '1px solid #93c5fd',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            verticalAlign: 'middle',
          }}
        >
          {x.displayName}
        </span>
      ))}
    </div>
  );
}"""
new = """const PICKED_TAGS_ROW_HEIGHT = 35;

function RecommendPickedTagsRow({ tags, isMobile }: { tags: SelectedTag[]; isMobile: boolean }) {
  return (
    <div
      style={{
        marginTop: 5,
        width: '100%',
        maxWidth: 640,
        minHeight: PICKED_TAGS_ROW_HEIGHT,
        maxHeight: PICKED_TAGS_ROW_HEIGHT,
        overflowY: 'auto',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        alignContent: 'flex-start',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      {tags.map((x) => (
        <span
          key={x.tagKey}
          title={x.displayName}
          style={{
            display: 'inline-block',
            fontSize: 9,
            fontWeight: 500,
            lineHeight: 1.3,
            padding: isMobile ? '3px 6px' : '3px 8px',
            borderRadius: 9999,
            backgroundColor: '#dbeafe',
            color: '#1d4ed8',
            border: '1px solid #93c5fd',
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            verticalAlign: 'middle',
          }}
        >
          {x.displayName}
        </span>
      ))}
    </div>
  );
}"""
if old not in t:
    raise SystemExit("RecommendPickedTagsRow block not found")
p.write_text(t.replace(old, new, 1), encoding="utf-8")
print("OK")
