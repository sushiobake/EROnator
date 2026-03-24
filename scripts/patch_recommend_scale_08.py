# -*- coding: utf-8 -*-
"""タグリストボタン・sort1/sort2 のボタン＆順位表示を約0.8倍に縮小。UTF-8."""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

pairs = [
    # --- renderTagGrid: リストボタン ---
    (
        """          padding: isMobile ? '8px 10px' : '10px 12px',
          fontSize: isMobile ? 13 : 14,
          minHeight: isMobile ? 32 : undefined,""",
        """          padding: isMobile ? '6px 8px' : '8px 10px',
          fontSize: isMobile ? 10 : 11,
          minHeight: isMobile ? 26 : undefined,""",
    ),
    (
        """      gap: isMobile ? 6 : 8,
      marginBottom: isMobile ? 10 : 20,""",
        """      gap: isMobile ? 5 : 6,
      marginBottom: isMobile ? 8 : 16,""",
    ),
    # --- sort1 ---
    (
        """      <div key={`sort1-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 8 }}>
        {col.map(t => {
          const r = sort1Ranks.get(t.tagKey);
          return (
            <button
              key={t.tagKey}
              type="button"
              onClick={() => toggleRank(t.tagKey)}
              style={{
                padding: isMobile ? '5px 4px' : '10px 14px',
                fontSize: isMobile ? 12 : 14,
                fontWeight: 500,
                textAlign: 'left',
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {t.displayName}
            </button>
          );
        })}
      </div>
    );""",
        """      <div key={`sort1-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 3 : 6 }}>
        {col.map(t => {
          const r = sort1Ranks.get(t.tagKey);
          return (
            <button
              key={t.tagKey}
              type="button"
              onClick={() => toggleRank(t.tagKey)}
              style={{
                padding: isMobile ? '4px 3px' : '8px 11px',
                fontSize: isMobile ? 10 : 11,
                fontWeight: 500,
                textAlign: 'left',
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {t.displayName}
            </button>
          );
        })}
      </div>
    );""",
    ),
    (
        """    const sortBtnStyle = {
      padding: isMobile ? '6px 12px' : '10px 20px',
      fontSize: isMobile ? 13 : 14,
      fontWeight: 600,
      borderRadius: 8,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };""",
        """    const sortBtnStyle = {
      padding: isMobile ? '5px 10px' : '8px 16px',
      fontSize: isMobile ? 10 : 11,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 24 } : {}),
    };""",
    ),
    (
        """          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}""",
        """          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>{getSortPromptFront(rcTyped)}</p>}""",
    ),
    (
        """              <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 13, lineHeight: 1.3 }}>
                {getSortPromptFront(rcTyped)}
              </p>""",
        """              <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>
                {getSortPromptFront(rcTyped)}
              </p>""",
    ),
    (
        """            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? 4 : 12, marginBottom: isMobile ? 8 : 20, maxWidth: 600 }}>""",
        """            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? 3 : 10, marginBottom: isMobile ? 6 : 16, maxWidth: 600 }}>""",
    ),
    (
        """            <div style={{ marginBottom: isMobile ? 10 : 20, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
              {([1, 2, 3, 4, 5] as const).map(r => {
                const tt = ranked.find((_, i) => i + 1 === r);
                return (
                  <span key={r} style={{ padding: isMobile ? '3px 6px' : '6px 12px', minWidth: isMobile ? 50 : 80, fontSize: isMobile ? 11 : 13, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 8, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                    {r}位{tt ? `: ${tt.displayName}` : ''}
                  </span>
                );
              })}
            </div>""",
        """            <div style={{ marginBottom: isMobile ? 8 : 16, display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 6, flexDirection: 'row' }}>
              {([1, 2, 3, 4, 5] as const).map(r => {
                const tt = ranked.find((_, i) => i + 1 === r);
                return (
                  <span key={r} style={{ padding: isMobile ? '2px 5px' : '5px 10px', minWidth: isMobile ? 40 : 64, fontSize: isMobile ? 9 : 10, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                    {r}位{tt ? `: ${tt.displayName}` : ''}
                  </span>
                );
              })}
            </div>""",
    ),
    (
        """            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={proceedFromSort1}
                  disabled={!canProceedSort1}
                  style={{
                    padding: isMobile ? '8px 14px' : '16px 32px',
                    fontSize: isMobile ? 14 : 17,
                    minHeight: isMobile ? 36 : undefined,
                    fontWeight: 600,
                    backgroundColor: canProceedSort1 ? '#3b82f6' : '#e5e7eb',
                    color: canProceedSort1 ? '#fff' : '#9ca3af',
                    border: 'none',
                    borderRadius: 12,
                    cursor: canProceedSort1 ? 'pointer' : 'not-allowed',
                    boxSizing: 'border-box',
                  }}
                >
                  {getBtnNextSortFront(rcTyped)}
                </button>""",
        """            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 8, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={proceedFromSort1}
                  disabled={!canProceedSort1}
                  style={{
                    padding: isMobile ? '6px 11px' : '13px 26px',
                    fontSize: isMobile ? 11 : 14,
                    minHeight: isMobile ? 29 : undefined,
                    fontWeight: 600,
                    backgroundColor: canProceedSort1 ? '#3b82f6' : '#e5e7eb',
                    color: canProceedSort1 ? '#fff' : '#9ca3af',
                    border: 'none',
                    borderRadius: 10,
                    cursor: canProceedSort1 ? 'pointer' : 'not-allowed',
                    boxSizing: 'border-box',
                  }}
                >
                  {getBtnNextSortFront(rcTyped)}
                </button>""",
    ),
    (
        """              <button type="button" onClick={() => { setSort1Ranks(new Map()); setStep('f3_2'); }} style={sortFixBtnStyle}>
                <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="currentColor">""",
        """              <button type="button" onClick={() => { setSort1Ranks(new Map()); setStep('f3_2'); }} style={sortFixBtnStyle}>
                <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="currentColor">""",
    ),
    # --- sort2 renderCol (PC) ---
    (
        """      <div key={`sort2-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {col.map(t => {
          const r = sort2Ranks.get(t.tagKey);
          return (
            <button
              key={t.tagKey}
              type="button"
              onClick={() => toggleRank(t.tagKey)}
              style={{
                padding: '10px 14px',
                fontSize: isMobile ? 15 : 14,
                fontWeight: 500,
                textAlign: 'left',
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {t.displayName}
            </button>
          );
        })}
      </div>
    );""",
        """      <div key={`sort2-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {col.map(t => {
          const r = sort2Ranks.get(t.tagKey);
          return (
            <button
              key={t.tagKey}
              type="button"
              onClick={() => toggleRank(t.tagKey)}
              style={{
                padding: '8px 11px',
                fontSize: isMobile ? 12 : 11,
                fontWeight: 500,
                textAlign: 'left',
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {t.displayName}
            </button>
          );
        })}
      </div>
    );""",
    ),
    (
        """    const sortBtnStyle2 = {
      padding: isMobile ? '6px 12px' : '10px 20px',
      fontSize: isMobile ? 13 : 14,
      fontWeight: 600,
      borderRadius: 8,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };""",
        """    const sortBtnStyle2 = {
      padding: isMobile ? '5px 10px' : '8px 16px',
      fontSize: isMobile ? 10 : 11,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 24 } : {}),
    };""",
    ),
    (
        """          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}""",
        """          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>{getSortPromptBack(rcTyped)}</p>}""",
    ),
    # sort2 mobile block
    (
        """                <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 13, lineHeight: 1.3 }}>{getSortPromptBack(rcTyped)}</p>
                <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>""",
        """                <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>{getSortPromptBack(rcTyped)}</p>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 6px 0', fontWeight: 500 }}>前半の１位～５位</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>""",
    ),
    (
        """                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 9999,
                          backgroundColor: rr ? '#dbeafe' : '#e5e7eb',
                          color: rr ? '#1d4ed8' : 'var(--color-text)',
                          border: rr ? '1px solid #93c5fd' : '1px solid #d1d5db',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                      >
                        {labelRank}位:{t.displayName}
                      </button>""",
        """                        style={{
                          padding: '3px 6px',
                          fontSize: 8,
                          fontWeight: 600,
                          borderRadius: 9999,
                          backgroundColor: rr ? '#dbeafe' : '#e5e7eb',
                          color: rr ? '#1d4ed8' : 'var(--color-text)',
                          border: rr ? '1px solid #93c5fd' : '1px solid #d1d5db',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                      >
                        {labelRank}位:{t.displayName}
                      </button>""",
    ),
    (
        """                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {backTags.map(t => {
                    const r = sort2Ranks.get(t.tagKey);
                    return (
                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          padding: '5px 6px',
                          fontSize: 12,
                          fontWeight: 500,
                          textAlign: 'left',
                          minHeight: 28,
                          backgroundColor: r ? '#dbeafe' : '#faf8f5',
                          color: r ? '#1d4ed8' : 'var(--color-text)',
                          border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                      >
                        {t.displayName}
                      </button>
                    );
                  })}
                </div>""",
        """                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
                  {backTags.map(t => {
                    const r = sort2Ranks.get(t.tagKey);
                    return (
                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
                          padding: '4px 5px',
                          fontSize: 10,
                          fontWeight: 500,
                          textAlign: 'left',
                          minHeight: 22,
                          backgroundColor: r ? '#dbeafe' : '#faf8f5',
                          color: r ? '#1d4ed8' : 'var(--color-text)',
                          border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        {t.displayName}
                      </button>
                    );
                  })}
                </div>""",
    ),
    (
        """                <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
                  {([1, 2, 3, 4, 5] as const).map(r => {
                    const tt = ranked.find((_, i) => i + 1 === r);
                    return (
                      <span key={r} style={{ padding: '3px 6px', minWidth: 50, fontSize: 11, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 8, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                        {r}位{tt ? `: ${tt.displayName}` : ''}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={proceedFromSort2}
                      disabled={!canProceedSort2}
                      style={{
                        padding: '8px 14px',
                        fontSize: 14,
                        minHeight: 36,
                        fontWeight: 600,
                        backgroundColor: canProceedSort2 ? '#3b82f6' : '#e5e7eb',
                        color: canProceedSort2 ? '#fff' : '#9ca3af',
                        border: 'none',
                        borderRadius: 12,
                        cursor: canProceedSort2 ? 'pointer' : 'not-allowed',
                        boxSizing: 'border-box',
                      }}
                    >
                      {getBtnNextSortBack(rcTyped)}
                    </button>""",
        """                <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>
                  {([1, 2, 3, 4, 5] as const).map(r => {
                    const tt = ranked.find((_, i) => i + 1 === r);
                    return (
                      <span key={r} style={{ padding: '2px 5px', minWidth: 40, fontSize: 9, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                        {r}位{tt ? `: ${tt.displayName}` : ''}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={proceedFromSort2}
                      disabled={!canProceedSort2}
                      style={{
                        padding: '6px 11px',
                        fontSize: 11,
                        minHeight: 29,
                        fontWeight: 600,
                        backgroundColor: canProceedSort2 ? '#3b82f6' : '#e5e7eb',
                        color: canProceedSort2 ? '#fff' : '#9ca3af',
                        border: 'none',
                        borderRadius: 10,
                        cursor: canProceedSort2 ? 'pointer' : 'not-allowed',
                        boxSizing: 'border-box',
                      }}
                    >
                      {getBtnNextSortBack(rcTyped)}
                    </button>""",
    ),
    (
        """                    <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rc.btnFix}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '0 0 10px 0', fontWeight: 500 }}>前半の１位～５位</p>
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>""",
        """                    <svg style={{ width: 11, height: 11 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rc.btnFix}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>
                <div style={{ display: 'flex', gap: 13, marginBottom: 16, alignItems: 'stretch' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 112 }}>""",
    ),
    (
        """                            style={{
                              padding: '10px 14px',
                              fontSize: 14,
                              fontWeight: 500,
                              textAlign: 'left',
                              backgroundColor: r ? '#dbeafe' : '#faf8f5',
                              color: r ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            {t.displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, borderLeft: '3px solid #6b7280', paddingLeft: 16 }}>""",
        """                            style={{
                              padding: '8px 11px',
                              fontSize: 11,
                              fontWeight: 500,
                              textAlign: 'left',
                              backgroundColor: r ? '#dbeafe' : '#faf8f5',
                              color: r ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 6,
                              cursor: 'pointer',
                            }}
                          >
                            {t.displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, borderLeft: '3px solid #6b7280', paddingLeft: 13 }}>""",
    ),
    (
        """                <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
                  {([1, 2, 3, 4, 5] as const).map(r => {
                    const tt = ranked.find((_, i) => i + 1 === r);
                    return (
                      <span key={r} style={{ padding: '6px 12px', minWidth: 80, fontSize: 13, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 8, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                        {r}位{tt ? `: ${tt.displayName}` : ''}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <button type="button" onClick={proceedFromSort2} disabled={!canProceedSort2} style={{ padding: '16px 32px', fontSize: 17, fontWeight: 600, backgroundColor: canProceedSort2 ? '#3b82f6' : '#e5e7eb', color: canProceedSort2 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 12, cursor: canProceedSort2 ? 'pointer' : 'not-allowed' }}>
                      {getBtnNextSortBack(rcTyped)}
                    </button>""",
        """                <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>
                  {([1, 2, 3, 4, 5] as const).map(r => {
                    const tt = ranked.find((_, i) => i + 1 === r);
                    return (
                      <span key={r} style={{ padding: '5px 10px', minWidth: 64, fontSize: 10, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                        {r}位{tt ? `: ${tt.displayName}` : ''}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <button type="button" onClick={proceedFromSort2} disabled={!canProceedSort2} style={{ padding: '13px 26px', fontSize: 14, fontWeight: 600, backgroundColor: canProceedSort2 ? '#3b82f6' : '#e5e7eb', color: canProceedSort2 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, cursor: canProceedSort2 ? 'pointer' : 'not-allowed' }}>
                      {getBtnNextSortBack(rcTyped)}
                    </button>""",
    ),
    (
        """                    <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rc.btnFix}
                  </button>
                </div>
              </>
            )}
          </div>
        </Stage>""",
        """                    <svg style={{ width: 13, height: 13 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rc.btnFix}
                  </button>
                </div>
              </>
            )}
          </div>
        </Stage>""",
    ),
]

for i, (a, b) in enumerate(pairs):
    if a not in t:
        raise SystemExit(f"Block {i} not found")
    t = t.replace(a, b, 1)

p.write_text(t, encoding="utf-8")
print("OK", len(pairs), "replacements")
