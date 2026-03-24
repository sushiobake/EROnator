# -*- coding: utf-8 -*-
"""Restore ai_gate+initial from backup (char visible). Add tall canvas for main recommend mobile."""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

if "MOBILE_RECOMMEND_CANVAS_BODY_PX" in t:
    raise SystemExit("Already patched?")

t = t.replace(
    "const LOGO_URL = '/ilust/inari_thinking_opening.png';\n\n/** ダウンロード用の専用レイアウト（白背景） */",
    "const LOGO_URL = '/ilust/inari_thinking_opening.png';\n\n/** 推薦モード本番（モバイル）：Stage 内キャンバス論理高さ 800 の 1.5 倍 */\nconst MOBILE_RECOMMEND_CANVAS_BODY_PX = 1200;\n\n/** ダウンロード用の専用レイアウト（白背景） */",
    1,
)

OLD_AI = """  if (step === 'ai_gate') {
    return (
      <>
      <Stage
        characterVariant="usually"
        characterSpeech={isMobile ? undefined : (
          <div>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 15 }}>{rc.aiGatePreamble}</p>
            <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{rc.aiGateMain}</p>
          </div>
        )}
        mobileHideCharacter={isMobile}
        mobileExtendWhiteboard={isMobile}
        whiteboardWide={true}
      >
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {isMobile && (
              <div style={{ marginBottom: 12, textAlign: 'center', width: '100%' }}>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 14 }}>{rc.aiGatePreamble}</p>
                <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 15 }}>{rc.aiGateMain}</p>
              </div>
            )}
            <AiGate onSelect={choice => { setAiGateChoice(choice); setStep('initial'); }} />
            <div style={{ marginTop: 16, width: '100%', maxWidth: 320, display: 'flex', justifyContent: 'flex-end' }}>
              <button
              type="button"
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: isMobile ? '4px 8px' : '6px 12px',
                fontSize: isMobile ? 11 : 14,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
                {rc.btnTopReset}
              </button>
            </div>
          </div>
        </>
      </Stage>
        {isDebugLocal && (
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
        )}
      </>
    );
  }"""

NEW_AI = """  if (step === 'ai_gate') {
    return (
      <>
      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
      >
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 14 : 15 }}>{rc.aiGatePreamble}</p>
              <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17 }}>{rc.aiGateMain}</p>
            </div>
            <AiGate onSelect={choice => { setAiGateChoice(choice); setStep('initial'); }} />
            <div style={{ marginTop: 16, width: '100%', maxWidth: 320, display: 'flex', justifyContent: 'flex-end' }}>
              <button
              type="button"
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 14,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
                {rc.btnTopReset}
              </button>
            </div>
          </div>
        </>
      </Stage>
        {isDebugLocal && (
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
        )}
      </>
    );
  }"""

if OLD_AI not in t:
    raise SystemExit("ai_gate block not found")
t = t.replace(OLD_AI, NEW_AI, 1)

OLD_INIT = """  const INITIAL_BTN_BASE = '#3b82f6';
  const INITIAL_BTN_LIGHT = ['#3b82f6', '#60a5fa', '#93c5fd'] as const;
  const initBtnBase = {
    padding: isMobile ? '7px 6px' : '12px 18px',
    fontSize: isMobile ? 13 : 14,
    fontWeight: 500,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box' as const,
    minHeight: isMobile ? 32 : undefined,
  };

  if (step === 'initial') {
    return (
      <>
      <Stage
        characterVariant="usually"
        characterSpeech={null}
        mobileHideCharacter={isMobile}
        mobileExtendWhiteboard={isMobile}
        whiteboardWide={true}
      >
        <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 15 : 17, lineHeight: 1.3 }}>
            {rc.initialMain}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? 8 : 8, marginBottom: isMobile ? 8 : 32 }}>
            {[
              { value: 'famous' as const, label: 'やっぱり有名作品！' },
              { value: 'hidden' as const, label: '隠れた名作！' },
              { value: 'middle' as const, label: '中間くらいの作品！' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPopularityChoice(value)}
                style={{
                  ...initBtnBase,
                  backgroundColor: popularityChoice === value ? '#dbeafe' : '#faf8f5',
                  color: popularityChoice === value ? '#1d4ed8' : 'var(--color-text)',
                  border: popularityChoice === value ? `2px solid ${INITIAL_BTN_BASE}` : '2px solid #e5e7eb',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 14 : 17, lineHeight: 1.3 }}>
            {rc.initialPriorityQuestion}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? 6 : 8, marginBottom: isMobile ? 6 : 20 }}>
            {CATEGORIES.map((cat) => {
              const idx = priorityOrder.indexOf(cat);
              const selected = idx >= 0;
              const shade = selected ? INITIAL_BTN_LIGHT[idx]! : INITIAL_BTN_BASE;
              return (
                <button
                  key={cat}
                  onClick={() => addToPriority(cat)}
                  style={{
                    ...initBtnBase,
                    backgroundColor: selected ? `${shade}22` : '#faf8f5',
                    color: selected ? '#1d4ed8' : 'var(--color-text)',
                    border: selected ? `2px solid ${shade}` : '2px solid #e5e7eb',
                    gap: 6,
                  }}
                >
                  {cat}
                  {selected && <span style={{ fontSize: isMobile ? 10 : 13, fontWeight: 'bold' }}>{['①', '②', '③'][idx]}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 12, alignItems: 'center' }}>
            <button
              onClick={() => canProceedFromInitial && setStep('f1')}
              disabled={!canProceedFromInitial}
              style={{
                padding: isMobile ? '8px 14px' : '16px 32px',
                fontSize: isMobile ? 14 : 17,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnNext}
            </button>
            <button
              onClick={resetInitial}
              style={{
                padding: isMobile ? '6px 12px' : '10px 20px',
                fontSize: isMobile ? 13 : 14,
                minHeight: isMobile ? 30 : undefined,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnRetry}
            </button>
          </div>
          <div style={{ marginTop: isMobile ? 4 : 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep('ai_gate')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 4 : 6,
                padding: isMobile ? '4px 8px' : '6px 12px',
                fontSize: isMobile ? 11 : 14,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rc.btnFix}
            </button>
          </div>
        </div>
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
      )}
      </>
    );
  }"""

NEW_INIT = """  const INITIAL_BTN_BASE = '#3b82f6';
  const INITIAL_BTN_LIGHT = ['#3b82f6', '#60a5fa', '#93c5fd'] as const;
  const initBtnBase = {
    padding: isMobile ? '10px 14px' : '12px 18px',
    fontSize: isMobile ? 15 : 14,
    fontWeight: 500,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  if (step === 'initial') {
    return (
      <>
      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
        mobileWhiteboardZoom={isMobile ? 1.3 : undefined}
        mobileWhiteboardPadding={isMobile ? '8px 10px' : undefined}
        whiteboardWide={true}
      >
        <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 15 : 17, lineHeight: 1.3 }}>
            {rc.initialMain}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 8 : 32 }}>
            {[
              { value: 'famous' as const, label: 'やっぱり有名作品！' },
              { value: 'hidden' as const, label: '隠れた名作！' },
              { value: 'middle' as const, label: '中間くらいの作品！' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPopularityChoice(value)}
                style={{
                  ...(isMobile ? { ...initBtnBase, padding: '7px 8px', fontSize: 12, minHeight: 32, borderRadius: 8 } : initBtnBase),
                  backgroundColor: popularityChoice === value ? '#dbeafe' : '#faf8f5',
                  color: popularityChoice === value ? '#1d4ed8' : 'var(--color-text)',
                  border: popularityChoice === value ? `2px solid ${INITIAL_BTN_BASE}` : '2px solid #e5e7eb',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 13 : 17, lineHeight: 1.3 }}>
            {rc.initialPriorityQuestion}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 6 : 20 }}>
            {CATEGORIES.map((cat) => {
              const idx = priorityOrder.indexOf(cat);
              const selected = idx >= 0;
              const shade = selected ? INITIAL_BTN_LIGHT[idx]! : INITIAL_BTN_BASE;
              return (
                <button
                  key={cat}
                  onClick={() => addToPriority(cat)}
                  style={{
                    ...(isMobile ? { ...initBtnBase, padding: '7px 8px', fontSize: 12, minHeight: 32, borderRadius: 8 } : initBtnBase),
                    backgroundColor: selected ? `${shade}22` : '#faf8f5',
                    color: selected ? '#1d4ed8' : 'var(--color-text)',
                    border: selected ? `2px solid ${shade}` : '2px solid #e5e7eb',
                    gap: 6,
                  }}
                >
                  {cat}
                  {selected && <span style={{ fontSize: isMobile ? 10 : 13, fontWeight: 'bold' }}>{['①', '②', '③'][idx]}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 6 : 12, alignItems: 'center' }}>
            <button
              onClick={() => canProceedFromInitial && setStep('f1')}
              disabled={!canProceedFromInitial}
              style={{
                padding: isMobile ? '8px 16px' : '16px 32px',
                fontSize: isMobile ? 14 : 17,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
              }}
            >
              {rc.btnNext}
            </button>
            <button
              onClick={resetInitial}
              style={{
                padding: isMobile ? '6px 10px' : '10px 20px',
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
            </button>
          </div>
          <div style={{ marginTop: isMobile ? 4 : 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep('ai_gate')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 4 : 6,
                padding: isMobile ? '3px 8px' : '6px 12px',
                fontSize: isMobile ? 11 : 14,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rc.btnFix}
            </button>
          </div>
        </div>
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
      )}
      </>
    );
  }"""

if OLD_INIT not in t:
    raise SystemExit("initial block not found")
t = t.replace(OLD_INIT, NEW_INIT, 1)

# Tall canvas on main recommend mobile only
repls2 = [
    (
        """          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
        >
          <div style={{ padding: isMobile ? '0.15rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            {isMobile && (
              <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>
                {getSortPromptFront(rcTyped)}
              </p>
            )}""",
        """          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
          mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
        >
          <div style={{ padding: isMobile ? '0.15rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            {isMobile && (
              <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>
                {getSortPromptFront(rcTyped)}
              </p>
            )}""",
    ),
    (
        """          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
        >
          <div style={{ padding: isMobile ? '0.15rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            {isMobile ? (
              <>
                <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>{getSortPromptBack(rcTyped)}</p>""",
        """          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
          mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
        >
          <div style={{ padding: isMobile ? '0.15rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            {isMobile ? (
              <>
                <p style={{ margin: '0 0 3px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 10, lineHeight: 1.3 }}>{getSortPromptBack(rcTyped)}</p>""",
    ),
    (
        """          thinkingSubType="opening"
          characterSpeech={
            isMobile ? undefined : (
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>
                {rc.thinkingText}
              </p>
            )
          }
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
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
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 16, lineHeight: 1.45 }}>
                {rc.thinkingText}
              </p>
            </div>
          ) : null}
        </Stage>""",
        """          thinkingSubType="opening"
          characterSpeech={
            isMobile ? undefined : (
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>
                {rc.thinkingText}
              </p>
            )
          }
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
          mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
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
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 16, lineHeight: 1.45 }}>
                {rc.thinkingText}
              </p>
            </div>
          ) : null}
        </Stage>""",
    ),
    (
        """      mobileHideCharacter={isMobile}
      mobileExtendWhiteboard={isMobile}
      whiteboardWide={true}
      mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
    >""",
        """      mobileHideCharacter={isMobile}
      mobileExtendWhiteboard={isMobile}
      whiteboardWide={true}
      mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
      mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
    >""",
    ),
]

for i, (a, b) in enumerate(repls2):
    if a not in t:
        raise SystemExit(f"Stage prop block {i} not found")
    t = t.replace(a, b, 1)

p.write_text(t, encoding="utf-8")
print("RecommendMode.tsx OK")
