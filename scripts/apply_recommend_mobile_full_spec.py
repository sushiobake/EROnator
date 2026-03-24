# -*- coding: utf-8 -*-
"""推薦モード モバイルUI 実装仕様書 — 完全適用（UTF-8）。RecommendMode + Stage justifyContent."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "src" / "app" / "components" / "Stage.tsx"
RM = ROOT / "src" / "app" / "components" / "RecommendMode.tsx"


def main():
    # --- Stage: justifyContent hideCharacter ? center : flex-end ---
    st = STAGE.read_text(encoding="utf-8")
    a, b = (
        "            justifyContent: 'flex-end',\n            minWidth: 0,\n            zIndex: 1,\n          }}\n        >\n          <div\n            style={{\n              width: '100%',\n              maxWidth: hc ? '100%' : 420,",
        "            justifyContent: hc ? 'center' : 'flex-end',\n            minWidth: 0,\n            zIndex: 1,\n          }}\n        >\n          <div\n            style={{\n              width: '100%',\n              maxWidth: hc ? '100%' : 420,",
    )
    if "justifyContent: hc ? 'center' : 'flex-end'" in st:
        print("OK Stage.tsx (already patched)")
    elif a in st:
        STAGE.write_text(st.replace(a, b, 1), encoding="utf-8")
        print("OK Stage.tsx")
    else:
        raise SystemExit("Stage.tsx: justifyContent anchor missing")

    t = RM.read_text(encoding="utf-8").replace("\r\n", "\n")

    def rep(old: str, new: str, label: str):
        nonlocal t
        old_n = old.replace("\r\n", "\n")
        if old_n not in t:
            raise SystemExit(f"MISSING [{label}]")
        t = t.replace(old_n, new.replace("\r\n", "\n"), 1)

    rep(
        "import type { RecommendCopy } from '@/server/config/schema';",
        "import type { RecommendCopy } from '@/server/config/schema';\n"
        "import { getSortPromptFront, getSortPromptBack, getBtnNextSortFront, getBtnNextSortBack } from '@/server/config/schema';",
        "import helpers",
    )
    rep(
        "import { useState, useEffect, useCallback, useRef } from 'react';",
        "import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';",
        "react import",
    )

    picked_block = '''

/** 選択済みタグのピル行（仕様書・白板内） */
const PICKED_TAGS_ROW_HEIGHT = 44;

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
}

'''
    rep(
        "type RankedTag = { tagKey: string; displayName: string; category?: CategoryLabel; rank: 1 | 2 | 3 | 4 | 5 };\n\nexport function RecommendMode",
        f"type RankedTag = {{ tagKey: string; displayName: string; category?: CategoryLabel; rank: 1 | 2 | 3 | 4 | 5 }};{picked_block}\nexport function RecommendMode",
        "picked row after RankedTag",
    )

    rep(
        "  const [sort2Ranks, setSort2Ranks] = useState<Map<string, 1 | 2 | 3 | 4 | 5>>(new Map());\n",
        "  const [sort2Ranks, setSort2Ranks] = useState<Map<string, 1 | 2 | 3 | 4 | 5>>(new Map());\n"
        "  const [stepBeforeSort2, setStepBeforeSort2] = useState<BackStep>('s8');\n",
        "stepBeforeSort2",
    )

    old_go = """    const idx = BACK_STEPS.indexOf(s);
    if (skipAdding) {
      if (idx < 4) setStep(BACK_STEPS[idx + 1]!);
      else setStep('sort2');
    } else {
      if (idx < 2) {
        setStep(BACK_STEPS[idx + 1]!);
      } else if (idx === 2) {
        setStep(nextUnknown.length > 0 ? 'sort2' : 's7');
      } else if (idx === 3) {
        setStep(nextUnknown.length > 0 ? 'sort2' : 's8');
      } else {
        setStep('sort2');
      }
    }
  };"""

    new_go = """    const idx = BACK_STEPS.indexOf(s);
    const goSort2 = () => {
      setStepBeforeSort2(s);
      setStep('sort2');
    };
    if (skipAdding) {
      if (idx < 4) setStep(BACK_STEPS[idx + 1]!);
      else goSort2();
    } else {
      if (idx < 2) {
        setStep(BACK_STEPS[idx + 1]!);
      } else if (idx === 2) {
        if (nextUnknown.length > 0) goSort2();
        else setStep('s7');
      } else if (idx === 3) {
        if (nextUnknown.length > 0) goSort2();
        else setStep('s8');
      } else {
        goSort2();
      }
    }
  };"""
    rep(old_go, new_go, "goNextFromUnknown")

    # ai_gate
    rep(
        """  if (step === 'ai_gate') {
    return (
      <>
      <Stage
        characterVariant="usually"
        characterSpeech={
          <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>{rc.aiGatePreamble}</p>
            <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{rc.aiGateMain}</p>
          </div>
        }
      >
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
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
""",
        """  if (step === 'ai_gate') {
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
""",
        "ai_gate",
    )

    # thinking
    rep(
        """  if (step === 'thinking') {
    return (
      <>
        <Stage
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
        """  if (step === 'thinking') {
    return (
      <>
        <Stage
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
        </Stage>
""",
        "thinking",
    )

    # initial block
    rep(
        """  const initBtnBase = {
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
        characterSpeech={null}
        whiteboardWide={true}
      >
        <div style={{ padding: isMobile ? '0.75rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
            {rc.initialMain}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 32 }}>
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
          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
            {rc.initialPriorityQuestion}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
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
                  {selected && <span style={{ fontSize: 13, fontWeight: 'bold' }}>{['①', '②', '③'][idx]}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => canProceedFromInitial && setStep('f1')}
              disabled={!canProceedFromInitial}
              style={{
                padding: isMobile ? '14px 24px' : '16px 32px',
                fontSize: isMobile ? 16 : 17,
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
                padding: isMobile ? '8px 16px' : '10px 20px',
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
            </button>
          </div>
          <div style={{ marginTop: 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep('ai_gate')}
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
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rc.btnFix}
            </button>
          </div>
        </div>
      </Stage>
""",
        """  const initBtnBase = {
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
""",
        "initial",
    )

    # Remove sortPrompt const and add sortFixBtnStyle before sort1
    rep(
        "  const instruction = isFamousStep ? rc.questionFamous : rc.questionUnknown;\n\n  const sortPrompt = (rc as { sortPrompt?: string }).sortPrompt ?? '今選んでいる要素を、好きな順に５つ並べて';\n\n  if (step === 'sort1') {",
        "  const instruction = isFamousStep ? rc.questionFamous : rc.questionUnknown;\n\n  const sortFixBtnStyle: CSSProperties = {\n    display: 'flex',\n    alignItems: 'center',\n    gap: isMobile ? 4 : 6,\n    padding: isMobile ? '4px 8px' : '6px 10px',\n    fontSize: isMobile ? 11 : 12,\n    cursor: 'pointer',\n    backgroundColor: 'transparent',\n    border: 'none',\n    borderRadius: 6,\n    color: 'var(--color-text-muted)',\n  };\n\n  const rcTyped = rc as RecommendCopy;\n\n  if (step === 'sort1') {",
        "sortPrompt remove + sortFix",
    )

    # sort1 full replace from renderCol through Stage close
    old_s1 = """    const col1 = items.slice(0, 5);
    const col2 = items.slice(5, 10);
    const col3 = items.slice(10, 15);
    const renderCol = (col: SelectedTag[], idx: number) => (
      <div key={`sort1-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {col.map(t => {
          const r = sort1Ranks.get(t.tagKey);
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
    );
    const sortBtnStyle = { padding: isMobile ? '8px 16px' : '10px 20px', fontSize: isMobile ? 13 : 14, fontWeight: 600, borderRadius: 8, cursor: 'pointer' as const };
    return (
      <>
        <Stage characterVariant="usually" characterSpeech={<p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{sortPrompt}</p>} whiteboardWide={true}>
          <div style={{ padding: isMobile ? '0.75rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, maxWidth: 600 }}>
              {col1.length > 0 && renderCol(col1, 0)}
              {col2.length > 0 && renderCol(col2, 1)}
              {col3.length > 0 && renderCol(col3, 2)}
            </div>
            <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
              {([1, 2, 3, 4, 5] as const).map(r => {
                const t = ranked.find((_, i) => i + 1 === r);
                return (
                  <span key={r} style={{ padding: '6px 12px', minWidth: 80, fontSize: isMobile ? 14 : 13, backgroundColor: t ? '#dbeafe' : 'transparent', color: t ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 8, border: `2px solid ${t ? '#3b82f6' : '#e5e7eb'}` }}>
                    {r}位{t ? `: ${t.displayName}` : ''}
                  </span>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button onClick={proceedFromSort1} disabled={!canProceedSort1} style={{ padding: isMobile ? '14px 24px' : '16px 32px', fontSize: isMobile ? 16 : 17, fontWeight: 600, backgroundColor: canProceedSort1 ? '#3b82f6' : '#e5e7eb', color: canProceedSort1 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 12, cursor: canProceedSort1 ? 'pointer' : 'not-allowed' }}>
                {rc.btnNext}
              </button>
              <button onClick={resetSort1} style={{ ...sortBtnStyle, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                {rc.btnRetry}
              </button>
            </div>
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }"""

    new_s1 = """    const col1 = items.slice(0, 5);
    const col2 = items.slice(5, 10);
    const col3 = items.slice(10, 15);
    const renderCol = (col: SelectedTag[], idx: number) => (
      <div key={`sort1-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 8 }}>
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
    );
    const sortBtnStyle = {
      padding: isMobile ? '6px 12px' : '10px 20px',
      fontSize: isMobile ? 13 : 14,
      fontWeight: 600,
      borderRadius: 8,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
        >
          <div style={{ padding: isMobile ? '0.15rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            {isMobile && (
              <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 13, lineHeight: 1.3 }}>
                {getSortPromptFront(rcTyped)}
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: isMobile ? 4 : 12, marginBottom: isMobile ? 8 : 20, maxWidth: 600 }}>
              {col1.length > 0 && renderCol(col1, 0)}
              {col2.length > 0 && renderCol(col2, 1)}
              {col3.length > 0 && renderCol(col3, 2)}
            </div>
            <div style={{ marginBottom: isMobile ? 10 : 20, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
              {([1, 2, 3, 4, 5] as const).map(r => {
                const tt = ranked.find((_, i) => i + 1 === r);
                return (
                  <span key={r} style={{ padding: isMobile ? '3px 6px' : '6px 12px', minWidth: isMobile ? 50 : 80, fontSize: isMobile ? 11 : 13, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 8, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                    {r}位{tt ? `: ${tt.displayName}` : ''}
                  </span>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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
                </button>
                <button type="button" onClick={resetSort1} style={{ ...sortBtnStyle, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                  {rc.btnRetry}
                </button>
              </div>
              <button type="button" onClick={() => { setSort1Ranks(new Map()); setStep('f3_2'); }} style={sortFixBtnStyle}>
                <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                </svg>
                {rc.btnFix}
              </button>
            </div>
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }"""

    rep(old_s1, new_s1, "sort1")

    # sort2: replace from backTags through end of sort2 if
    old_s2 = """    const backTags = selectedUnknown.slice(0, 9);
    const col1 = backTags.slice(0, 5);
    const col2 = backTags.slice(5, 10);
    const col3 = backTags.slice(10, 15);
    const renderCol = (col: typeof backTags, idx: number) => (
      <div key={`sort2-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
    );
    const sortBtnStyle = { padding: isMobile ? '8px 16px' : '10px 20px', fontSize: isMobile ? 13 : 14, fontWeight: 600, borderRadius: 8, cursor: 'pointer' as const };
    return (
      <>
        <Stage characterVariant="usually" characterSpeech={<p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{sortPrompt}</p>} whiteboardWide={true}>
          <div style={{ padding: isMobile ? '0.75rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            <p style={{ fontSize: isMobile ? 11 : 10, color: 'var(--color-text-muted)', margin: '0 0 10px 0', fontWeight: 500 }}>前半の１位～５位</p>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                  {rankedFamous.map((t, i) => {
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
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, borderLeft: '3px solid #6b7280', paddingLeft: 16 }}>
                {col1.length > 0 && renderCol(col1, 0)}
                {col2.length > 0 && renderCol(col2, 1)}
                {col3.length > 0 && renderCol(col3, 2)}
              </div>
            </div>
            <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
              {([1, 2, 3, 4, 5] as const).map(r => {
                const t = ranked.find((_, i) => i + 1 === r);
                return (
                  <span key={r} style={{ padding: '6px 12px', minWidth: 80, fontSize: isMobile ? 14 : 13, backgroundColor: t ? '#dbeafe' : 'transparent', color: t ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 8, border: `2px solid ${t ? '#3b82f6' : '#e5e7eb'}` }}>
                    {r}位{t ? `: ${t.displayName}` : ''}
                  </span>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button onClick={proceedFromSort2} disabled={!canProceedSort2} style={{ padding: isMobile ? '14px 24px' : '16px 32px', fontSize: isMobile ? 16 : 17, fontWeight: 600, backgroundColor: canProceedSort2 ? '#3b82f6' : '#e5e7eb', color: canProceedSort2 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 12, cursor: canProceedSort2 ? 'pointer' : 'not-allowed' }}>
                {rc.btnNext}
              </button>
              <button onClick={resetSort2} style={{ ...sortBtnStyle, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                {rc.btnRetry}
              </button>
            </div>
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }"""

    new_s2 = """    const backTags = selectedUnknown.slice(0, 9);
    const col1 = backTags.slice(0, 5);
    const col2 = backTags.slice(5, 10);
    const col3 = backTags.slice(10, 15);
    const renderCol = (col: typeof backTags, idx: number) => (
      <div key={`sort2-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
    );
    const sortBtnStyle2 = {
      padding: isMobile ? '6px 12px' : '10px 20px',
      fontSize: isMobile ? 13 : 14,
      fontWeight: 600,
      borderRadius: 8,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
        >
          <div style={{ padding: isMobile ? '0.15rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
            {isMobile ? (
              <>
                <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 13, lineHeight: 1.3 }}>{getSortPromptBack(rcTyped)}</p>
                <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {rankedFamous.map((t) => {
                    const rr = sort2Ranks.get(t.tagKey);
                    const labelRank = rr ?? t.rank;
                    return (
                      <button
                        key={t.tagKey}
                        type="button"
                        onClick={() => toggleRank(t.tagKey)}
                        style={{
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
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
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
                </div>
                <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
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
                    </button>
                    <button type="button" onClick={resetSort2} style={{ ...sortBtnStyle2, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                      {rc.btnRetry}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSort2Ranks(new Map());
                      setStep(stepBeforeSort2);
                    }}
                    style={sortFixBtnStyle}
                  >
                    <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="currentColor">
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                      {rankedFamous.map((t) => {
                        const r = sort2Ranks.get(t.tagKey);
                        return (
                          <button
                            key={t.tagKey}
                            type="button"
                            onClick={() => toggleRank(t.tagKey)}
                            style={{
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
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, borderLeft: '3px solid #6b7280', paddingLeft: 16 }}>
                    {col1.length > 0 && renderCol(col1, 0)}
                    {col2.length > 0 && renderCol(col2, 1)}
                    {col3.length > 0 && renderCol(col3, 2)}
                  </div>
                </div>
                <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: 'row' }}>
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
                    </button>
                    <button type="button" onClick={resetSort2} style={{ ...sortBtnStyle2, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                      {rc.btnRetry}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSort2Ranks(new Map());
                      setStep(stepBeforeSort2);
                    }}
                    style={sortFixBtnStyle}
                  >
                    <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rc.btnFix}
                  </button>
                </div>
              </>
            )}
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }"""

    rep(old_s2, new_s2, "sort2")

    # renderTagGrid: mobile 2 col, sizes
    rep(
        """        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          fontSize: isMobile ? 15 : 14,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
        }}
""",
        """        style={{
          display: 'flex',
          alignItems: 'center',
          padding: isMobile ? '8px 10px' : '10px 12px',
          fontSize: isMobile ? 13 : 14,
          minHeight: isMobile ? 32 : undefined,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
""",
        "TagButton",
    )

    rep(
        """    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 8,
      marginBottom: 20,
    };
""",
        """    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      gap: isMobile ? 6 : 8,
      marginBottom: isMobile ? 10 : 20,
    };
""",
        "gridStyle",
    )

    RM.write_text(t, encoding="utf-8")
    print("OK RecommendMode.tsx (base)")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "patch_recommend_tag_stage.py")], check=True)
    print("OK RecommendMode.tsx (tag stage)")


if __name__ == "__main__":
    main()
