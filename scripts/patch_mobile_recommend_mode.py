# -*- coding: utf-8 -*-
"""Patch RecommendMode.tsx for mobile recommend layout (UTF-8 safe)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src" / "app" / "components" / "RecommendMode.tsx"
text = path.read_text(encoding="utf-8")

repls = [
    (
        """      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
      >
""",
        """      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
        mobileHideCharacter={isMobile}
        mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
      >
""",
    ),
    (
        """        <Stage
          characterVariant="thinking"
          thinkingSubType="opening"
          characterSpeech={
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: isMobile ? 26 : 20 }}>
              {rc.thinkingText}
            </p>
          }
        >
          {null}
        </Stage>
""",
        """        <Stage
          characterVariant="thinking"
          thinkingSubType="opening"
          characterSpeech={
            isMobile ? undefined : (
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>
                {rc.thinkingText}
              </p>
            )
          }
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
        >
          {isMobile ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                textAlign: 'center',
                padding: '12px 8px',
                boxSizing: 'border-box',
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 15, lineHeight: 1.45 }}>
                {rc.thinkingText}
              </p>
            </div>
          ) : null}
        </Stage>
""",
    ),
    (
        """      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
        mobileWhiteboardZoom={isMobile ? 1.3 : undefined}
        mobileWhiteboardPadding={isMobile ? '8px 10px' : undefined}
        whiteboardWide={true}
      >
""",
        """      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
        mobileHideCharacter={isMobile}
        mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
        whiteboardWide={true}
      >
""",
    ),
    (
        """  const initBtnBase = {
    padding: isMobile ? '10px 14px' : '12px 18px',
    fontSize: isMobile ? 15 : 14,
""",
        """  const initBtnBase = {
    padding: isMobile ? '9px 12px' : '12px 18px',
    fontSize: isMobile ? 14 : 14,
""",
    ),
    (
        """                  ...(isMobile ? { ...initBtnBase, padding: '7px 8px', fontSize: 12, minHeight: 32, borderRadius: 8 } : initBtnBase),
                  backgroundColor: popularityChoice === value ? '#dbeafe' : '#faf8f5',
""",
        """                  ...(isMobile ? { ...initBtnBase, padding: '8px 10px', fontSize: 13, minHeight: 36, borderRadius: 8 } : initBtnBase),
                  backgroundColor: popularityChoice === value ? '#dbeafe' : '#faf8f5',
""",
    ),
    (
        """                  ...(isMobile ? { ...initBtnBase, padding: '7px 8px', fontSize: 12, minHeight: 32, borderRadius: 8 } : initBtnBase),
                    backgroundColor: selected ? `${shade}22` : '#faf8f5',
""",
        """                  ...(isMobile ? { ...initBtnBase, padding: '8px 10px', fontSize: 13, minHeight: 36, borderRadius: 8 } : initBtnBase),
                    backgroundColor: selected ? `${shade}22` : '#faf8f5',
""",
    ),
    (
        """                padding: isMobile ? '8px 16px' : '16px 32px',
                fontSize: isMobile ? 14 : 17,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
""",
        """                padding: isMobile ? '10px 16px' : '16px 32px',
                fontSize: isMobile ? 15 : 17,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
""",
    ),
    (
        """                padding: isMobile ? '6px 10px' : '10px 20px',
                fontSize: isMobile ? 11 : 14,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {rc.btnRetry}
""",
        """                padding: isMobile ? '8px 12px' : '10px 20px',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {rc.btnRetry}
""",
    ),
    (
        """        <Stage characterVariant="usually" mobileExtendWhiteboard={isMobile} mobileWhiteboardZoom={isMobile ? 1.1 : undefined} mobileWhiteboardPadding={isMobile ? '6px 8px' : undefined} whiteboardWide={true}>
          <div style={{ padding: isMobile ? '0.15rem 0' : '0.55rem 0', maxWidth: '100%', minWidth: 0 }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 12 : 17, lineHeight: 1.3 }}>{getSortPromptFront(rc)}</p>
""",
        """        <Stage characterVariant="usually" mobileExtendWhiteboard={isMobile} mobileHideCharacter={isMobile} mobileWhiteboardZoom={isMobile ? 1.32 : undefined} mobileWhiteboardPadding={isMobile ? '6px 8px' : undefined} whiteboardWide={true}>
          <div style={{ padding: isMobile ? '0.15rem 0' : '0.55rem 0', maxWidth: '100%', minWidth: 0 }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 15 : 17, lineHeight: 1.3 }}>{getSortPromptFront(rc)}</p>
""",
    ),
    (
        """        <Stage characterVariant="usually" mobileExtendWhiteboard={isMobile} mobileWhiteboardZoom={isMobile ? 1.1 : undefined} mobileWhiteboardPadding={isMobile ? '6px 8px' : undefined} whiteboardWide={true}>
          <div style={{ padding: isMobile ? '0.15rem 0' : '0.55rem 0', maxWidth: '100%', minWidth: 0 }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 12 : 17, lineHeight: 1.3 }}>{getSortPromptBack(rc)}</p>
            <p style={{ fontSize: isMobile ? 11 : 10, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>
""",
        """        <Stage characterVariant="usually" mobileExtendWhiteboard={isMobile} mobileHideCharacter={isMobile} mobileWhiteboardZoom={isMobile ? 1.32 : undefined} mobileWhiteboardPadding={isMobile ? '6px 8px' : undefined} whiteboardWide={true}>
          <div style={{ padding: isMobile ? '0.15rem 0' : '0.55rem 0', maxWidth: '100%', minWidth: 0 }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 15 : 17, lineHeight: 1.3 }}>{getSortPromptBack(rc)}</p>
            <p style={{ fontSize: isMobile ? 12 : 10, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>
""",
    ),
    (
        """    <Stage
      characterVariant="usually"
      whiteboardWide={true}
      mobileExtendWhiteboard={isMobile}
      mobileWhiteboardZoom={isMobile ? 1.3 : undefined}
      mobileWhiteboardPadding={isMobile ? '8px 10px' : undefined}
      mobileBelowCanvas={isMobile ? renderTagGrid() : undefined}
    >
""",
        """    <Stage
      characterVariant="usually"
      whiteboardWide={true}
      mobileExtendWhiteboard={isMobile}
      mobileHideCharacter={isMobile}
      mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
    >
""",
    ),
    (
        """        <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 13 : 17, lineHeight: 1.3 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 20 : 22, height: isMobile ? 20 : 22, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: isMobile ? 10 : 12, fontWeight: 'bold', marginRight: 6, verticalAlign: 'middle' }}>
            {questionNumDisplay}
          </span>
          {instruction}
        </p>
        {!isMobile && renderTagGrid()}
""",
        """        <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 15 : 17, lineHeight: 1.3 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 20 : 22, height: isMobile ? 20 : 22, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: isMobile ? 11 : 12, fontWeight: 'bold', marginRight: 6, verticalAlign: 'middle' }}>
            {questionNumDisplay}
          </span>
          {instruction}
        </p>
        {renderTagGrid()}
""",
    ),
    (
        """          padding: isMobile ? '8px 10px' : '10px 12px',
          fontSize: isMobile ? 13 : 14,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
""",
        """          padding: isMobile ? '9px 10px' : '10px 12px',
          fontSize: isMobile ? 14 : 14,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
""",
    ),
    (
        """                padding: isMobile ? '8px 10px' : '14px 18px',
                fontSize: isMobile ? 13 : 16,
                fontWeight: 600,
                backgroundColor: famousPrimaryDisabled ? '#e5e7eb' : '#3b82f6',
                color: famousPrimaryDisabled ? '#9ca3af' : '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: famousPrimaryDisabled ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnOk}
""",
        """                padding: isMobile ? '10px 12px' : '14px 18px',
                fontSize: isMobile ? 14 : 16,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                backgroundColor: famousPrimaryDisabled ? '#e5e7eb' : '#3b82f6',
                color: famousPrimaryDisabled ? '#9ca3af' : '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: famousPrimaryDisabled ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnOk}
""",
    ),
    (
        """                padding: isMobile ? '8px 10px' : '14px 18px',
                fontSize: isMobile ? 13 : 16,
                fontWeight: 600,
                borderRadius: 12,
                cursor: notInListDisabled ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
                border: '2px solid #e5e7eb',
                backgroundColor: notInListDisabled ? '#f3f4f6' : '#faf8f5',
                color: notInListDisabled ? '#9ca3af' : 'var(--color-text)',
              }}
            >
              {rc.btnNotInList}
""",
        """                padding: isMobile ? '10px 12px' : '14px 18px',
                fontSize: isMobile ? 14 : 16,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                borderRadius: 12,
                cursor: notInListDisabled ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
                border: '2px solid #e5e7eb',
                backgroundColor: notInListDisabled ? '#f3f4f6' : '#faf8f5',
                color: notInListDisabled ? '#9ca3af' : 'var(--color-text)',
              }}
            >
              {rc.btnNotInList}
""",
    ),
    (
        """              padding: isMobile ? '5px 10px' : '6px 12px',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
              boxSizing: 'border-box',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: 'var(--color-text-muted)',
              marginLeft: isMobile ? 0 : 4,
            }}
          >
            {rc.btnRetry}
          </button>
        </div>
        {(isFamousStep || isBackStep) && (
""",
        """              padding: isMobile ? '6px 12px' : '6px 12px',
              fontSize: isMobile ? 12 : 12,
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
              boxSizing: 'border-box',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: 'var(--color-text-muted)',
              marginLeft: isMobile ? 0 : 4,
            }}
          >
            {rc.btnRetry}
          </button>
        </div>
        {(isFamousStep || isBackStep) && (
""",
    ),
]

for i, (old, new) in enumerate(repls):
    if old not in text:
        raise SystemExit(f"Block {i} not found (len old={len(old)})")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("OK RecommendMode.tsx", len(repls), "replacements")
