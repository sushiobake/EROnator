# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
t = p.read_text(encoding="utf-8")

# 1) imports
if ", useMemo," not in t.split("from 'react';", 1)[0]:
    t = t.replace(
        "import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';",
        "import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from 'react';",
        1,
    )
if "ResultScreenFourButtons" not in t:
    t = t.replace(
        "import { Stage } from './Stage';",
        "import { Stage } from './Stage';\nimport { ResultScreenFourButtons } from './ResultScreenFourButtons';",
        1,
    )

if "SHARE_CAPTURE_LOGO_URL" not in t:
    t = t.replace(
        "const LOGO_URL = '/ilust/inari_thinking_opening.png';\n\n/** 推薦モード本番",
        "const LOGO_URL = '/ilust/inari_thinking_opening.png';\nconst SHARE_CAPTURE_LOGO_URL = '/ilust/eronator_logo.jpg';\n\n/** 推薦モード本番",
        1,
    )

# 2) Picked row (backup 20260226)
old_picked = """/** 選択済みタグのピル行（仕様書・白板内） */
const PICKED_TAGS_ROW_HEIGHT = 35;

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

new_picked = """/**
 * いま選んでいるタグの要約（ピル型）。「これでok」行の下。整理画面では使わない。
 */
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
            fontSize: isMobile ? 12 : 11,
            fontWeight: 500,
            lineHeight: 1.3,
            padding: isMobile ? '5px 11px' : '4px 10px',
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

if old_picked not in t:
    raise SystemExit("picked block not found")
t = t.replace(old_picked, new_picked, 1)

# 3) default rc heading
t = t.replace(
    "    btnTopReset: 'トップに戻る',\n  };",
    "    btnTopReset: 'トップに戻る',\n    recommendResultsHeading: 'こんな作品なんてどう？',\n  };",
    1,
)

# 4) Insert useMemo block before ai_gate
marker = """  const currentUnknownBatch = ['s4', 's5', 's6', 's7', 's8'].includes(step as string)
    ? unknownTags.slice(getBackBatchStart(step as BackStep), getBackBatchStart(step as BackStep) + 20)
    : [];

  if (step === 'ai_gate') {"""

insert = """  const currentUnknownBatch = ['s4', 's5', 's6', 's7', 's8'].includes(step as string)
    ? unknownTags.slice(getBackBatchStart(step as BackStep), getBackBatchStart(step as BackStep) + 20)
    : [];

  /** 早期 return より前（hooks 順序） */
  const isFamousStep = ['f1', 'f1_2', 'f2', 'f2_2', 'f3', 'f3_2'].includes(step as string);
  const isBackStep = ['s4', 's5', 's6', 's7', 's8'].includes(step as string);
  const famousCatForPicked =
    isFamousStep && priorityOrder.length >= 3
      ? (step as string).startsWith('f1')
        ? priorityOrder[0]!
        : (step as string).startsWith('f2')
          ? priorityOrder[1]!
          : priorityOrder[2]!
      : null;

  const frontPickedTagsDisplay = useMemo(() => {
    const seen = new Set<string>();
    const out: SelectedTag[] = [];
    for (const x of selectedFamous) {
      if (!seen.has(x.tagKey)) {
        seen.add(x.tagKey);
        out.push(x);
      }
    }
    if (famousCatForPicked) {
      for (const key of checkedFamous) {
        if (seen.has(key)) continue;
        const opt = currentFamousOptions.find(o => o.tagKey === key);
        if (opt) {
          seen.add(key);
          out.push({ tagKey: key, displayName: opt.displayName, category: famousCatForPicked });
        }
      }
    }
    return out;
  }, [selectedFamous, checkedFamous, currentFamousOptions, famousCatForPicked]);

  const backPickedTagsDisplay = useMemo(() => {
    const seen = new Set<string>();
    const out: SelectedTag[] = [];
    for (const x of selectedUnknown) {
      if (!seen.has(x.tagKey)) {
        seen.add(x.tagKey);
        out.push(x);
      }
    }
    for (const key of checkedUnknown) {
      if (seen.has(key)) continue;
      const row = currentUnknownBatch.find(y => y.tagKey === key) ?? unknownTags.find(y => y.tagKey === key);
      if (row) {
        seen.add(key);
        out.push({ tagKey: key, displayName: row.displayName });
      }
    }
    return out;
  }, [selectedUnknown, checkedUnknown, currentUnknownBatch, unknownTags]);

  if (step === 'ai_gate') {"""

if "frontPickedTagsDisplay" not in t:
    if marker not in t:
        raise SystemExit("marker for useMemo insert not found")
    t = t.replace(marker, insert, 1)

# 5) Remove duplicate isFamousStep / isBackStep before questionNumDisplay
dup = """  const isFamousStep = ['f1', 'f1_2', 'f2', 'f2_2', 'f3', 'f3_2'].includes(step as string);
  const isBackStep = ['s4', 's5', 's6', 's7', 's8'].includes(step as string);
  const questionNumDisplay = isFamousStep"""

if dup in t:
    t = t.replace(dup, "  const questionNumDisplay = isFamousStep", 1)

# 6) AI gate: center content vertically on mobile
old_ai_inner = """        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 14 : 15 }}>{rc.aiGatePreamble}</p>
              <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17 }}>{rc.aiGateMain}</p>
            </div>
            <AiGate onSelect={choice => { setAiGateChoice(choice); setStep('initial'); }} }} />"""

# fix typo - backup has no double }}
old_ai_inner = """        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 14 : 15 }}>{rc.aiGatePreamble}</p>
              <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17 }}>{rc.aiGateMain}</p>
            </div>
            <AiGate onSelect={choice => { setAiGateChoice(choice); setStep('initial'); }} />"""

new_ai_inner = """        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              ...(isMobile
                ? { minHeight: '100%', justifyContent: 'center', boxSizing: 'border-box', padding: '12px 0 20px' }
                : {}),
            }}
          >
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 14 : 15 }}>{rc.aiGatePreamble}</p>
              <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17 }}>{rc.aiGateMain}</p>
            </div>
            <AiGate onSelect={choice => { setAiGateChoice(choice); setStep('initial'); }} />"""

if old_ai_inner not in t:
    raise SystemExit("ai_gate inner block not found")
t = t.replace(old_ai_inner, new_ai_inner, 1)

# 7) Initial: question + button sizes (match AI gate mobile: 16 main / 14 secondary, buttons 17)
old_init_text = """        <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
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
          </div>"""

new_init_text = """        <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>
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
                  ...(isMobile
                    ? { ...initBtnBase, padding: '8px 16px', fontSize: 17, minHeight: 40, borderRadius: 10, fontWeight: 500 }
                    : initBtnBase),
                  backgroundColor: popularityChoice === value ? '#dbeafe' : '#faf8f5',
                  color: popularityChoice === value ? '#1d4ed8' : 'var(--color-text)',
                  border: popularityChoice === value ? `2px solid ${INITIAL_BTN_BASE}` : '2px solid #e5e7eb',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ margin: isMobile ? '0 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: isMobile ? 'var(--color-text-muted)' : 'var(--color-text)', fontSize: isMobile ? 14 : 17, lineHeight: 1.3 }}>
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
                    ...(isMobile
                      ? { ...initBtnBase, padding: '8px 16px', fontSize: 17, minHeight: 40, borderRadius: 10, fontWeight: 500 }
                      : initBtnBase),
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
          </div>"""

if old_init_text not in t:
    raise SystemExit("initial text block not found")
t = t.replace(old_init_text, new_init_text, 1)

# 8) Mobile results: capture + list + ResultScreenFourButtons
old_mob_res = """          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
            <img src={LOGO_URL} alt="ERONATOR" style={{ height: 36, width: 'auto', maxWidth: '50%', marginBottom: 4 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0 }}>こんな作品なんてどう？</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: CAPTURE_CARD_GAP }}>
            {recommendedWorks.slice(0, 10).map(rec => (
              <div key={rec.workId} style={{ padding: 8, backgroundColor: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {typeof rec.matchRate === 'number' && (
                  <div style={{ marginBottom: 4 }}>
                    <p style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, margin: '0 0 1px 0', lineHeight: 1.2 }}>似てる度</p>
                    <p style={{ fontSize: 12, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{Number(rec.matchRate).toFixed(1)}％</p>
                  </div>
                )}"""

new_mob_res_cap = """          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
            <img src={SHARE_CAPTURE_LOGO_URL} alt="ERONATOR" style={{ height: 36, width: 'auto', maxWidth: '50%', marginBottom: 0 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: CAPTURE_CARD_GAP }}>
            {recommendedWorks.slice(0, 10).map(rec => (
              <div key={rec.workId} style={{ padding: 8, backgroundColor: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {typeof rec.matchRate === 'number' && (
                  <div style={{ marginBottom: 4 }}>
                    <p style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, margin: '0 0 1px 0', lineHeight: 1.2 }}>好みマッチ度</p>
                    <p style={{ fontSize: 12, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{Number(rec.matchRate).toFixed(1)}％</p>
                  </div>
                )}"""

if old_mob_res not in t:
    raise SystemExit("mobile capture header block not found")
t = t.replace(old_mob_res, new_mob_res_cap, 1)

old_mob_btns = """            <div style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 10px 0', fontWeight: 500, padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              こんな作品なんてどう？
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {recommendedWorks.slice(0, 10).map(rec => (
                <MobileWorkCardHorizontal key={rec.workId} work={rec} showFanzaLink={true} matchRate={rec.matchRate} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleShareMobile(false)}
                  style={{ flex: 1, minWidth: 0, padding: '10px 16px', fontSize: 13, fontWeight: 600, backgroundColor: '#0f1419', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >
                  結果を保存
                </button>
                <button
                  type="button"
                  onClick={() => handleShareMobile(true)}
                  style={{ flex: 1, minWidth: 0, padding: '10px 16px', fontSize: 13, fontWeight: 600, backgroundColor: '#0f1419', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.3 }}
                >
                  <span>結果を</span>
                  <span>「モザイク」で保存</span>
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <a
                  href="#"
                  onClick={e => { e.preventDefault(); window.open(tweetIntent, '_blank', 'noopener,noreferrer'); }}
                  style={{ flex: 1, minWidth: 0, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: '#0f1419', border: 'none', borderRadius: 8, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ポストする
                </a>
                <button
                  type="button"
                  onClick={onBack}
                  style={{ flex: 1, minWidth: 0, padding: '10px 16px', fontSize: 13, fontWeight: 600, backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >
                  トップに戻る
                </button>
              </div>
            </div>
          </div>"""

new_mob_btns = """            <div style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 10px 0', fontWeight: 500, padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {rc.recommendResultsHeading ?? 'こんな作品なんてどう？'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {recommendedWorks.slice(0, 10).map(rec => (
                <MobileWorkCardHorizontal key={rec.workId} work={rec} showFanzaLink={true} matchRate={rec.matchRate} matchRateLabel="好みマッチ度" />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
              <ResultScreenFourButtons
                onSavePlain={() => handleShareMobile(false)}
                onSaveMosaic={() => handleShareMobile(true)}
                onPost={() => window.open(tweetIntent, '_blank', 'noopener,noreferrer')}
                onBackToTop={onBack}
                isMobile
              />
            </div>
          </div>"""

if old_mob_btns not in t:
    raise SystemExit("mobile results buttons block not found")
t = t.replace(old_mob_btns, new_mob_btns, 1)

# 9) PC capture + grid label
t = t.replace(
    """          <img
            src={LOGO_URL}
            alt="ERONATOR"
            style={{ height: 44, width: 'auto', maxWidth: '45%', marginBottom: 6 }}
          />
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>
            こんな作品なんてどう？
          </p>""",
    """          <img
            src={SHARE_CAPTURE_LOGO_URL}
            alt="ERONATOR"
            style={{ height: 44, width: 'auto', maxWidth: '45%', marginBottom: 0 }}
          />""",
    1,
)
t = t.replace(
    "<p style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>似てる度</p>",
    "<p style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>好みマッチ度</p>",
    1,
)

# 10) PC Stage heading
t = t.replace(
    """        characterSpeech={
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>こんな作品なんてどう？</p>
        }""",
    """        characterSpeech={
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>{rc.recommendResultsHeading ?? 'こんな作品なんてどう？'}</p>
        }""",
    1,
)

# 11) RecommendResultsGrid label + buttons
t = t.replace(
    "<p style={{ fontSize: isMobile ? 9 : 10, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>似てる度</p>",
    "<p style={{ fontSize: isMobile ? 9 : 10, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>好みマッチ度</p>",
    1,
)

old_grid_btns = """      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: isMobile ? Math.round(12 * s) : Math.round(14 * s),
        }}
      >
        {onSharePC && (
          <>
            <button
              type="button"
              onClick={() => onSharePC(false)}
              style={{ flex: 1, minWidth: 0, padding: '10px 16px', fontSize: 13, fontWeight: 600, backgroundColor: '#0f1419', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              結果を保存
            </button>
            <button
              type="button"
              onClick={() => onSharePC(true)}
              style={{ flex: 1, minWidth: 0, padding: '10px 16px', fontSize: 13, fontWeight: 600, backgroundColor: '#0f1419', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              結果を「モザイク」で保存
            </button>
          </>
        )}
        <a
          href="#"
          onClick={e => {
            e.preventDefault();
            window.open(tweetIntent, '_blank', 'noopener,noreferrer');
          }}
          style={{ flex: 1, minWidth: 0, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: '#0f1419', border: 'none', borderRadius: 8, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ポストする
        </a>
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          トップに戻る
        </button>
      </div>"""

new_grid_btns = """      <div
        style={{
          marginTop: isMobile ? Math.round(12 * s) : Math.round(14 * s),
          width: '100%',
        }}
      >
        <ResultScreenFourButtons
          onSavePlain={onSharePC ? () => onSharePC(false) : undefined}
          onSaveMosaic={onSharePC ? () => onSharePC(true) : undefined}
          onPost={() => window.open(tweetIntent, '_blank', 'noopener,noreferrer')}
          onBackToTop={onBack}
          isMobile={isMobile}
        />
      </div>"""

if old_grid_btns not in t:
    raise SystemExit("RecommendResultsGrid buttons block not found")
t = t.replace(old_grid_btns, new_grid_btns, 1)

# 12) Tag list footer: compact mobile + picked display + fix
old_footer = """        {renderTagGrid()}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            gap: isMobile ? 8 : 12,
            alignItems: isMobile ? 'stretch' : 'center',
            marginTop: isMobile ? 8 : 0,
            width: '100%',
            maxWidth: 640,
          }}
        >
          <div style={{ display: 'flex', gap: 10, flex: isMobile ? undefined : 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
            <button
              type="button"
              onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
              style={{
                flex: 1,
                minWidth: 0,
                padding: isMobile ? '8px 10px' : '16px 32px',
                fontSize: isMobile ? 13 : 17,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnOk}
            </button>
            <button
              type="button"
              onClick={() => (isFamousStep ? goNextFromFamous(true) : goNextFromUnknown(true))}
              style={{
                flex: 1,
                minWidth: 0,
                padding: isMobile ? '8px 10px' : '10px 20px',
                fontSize: isMobile ? 13 : 14,
                minHeight: isMobile ? 36 : undefined,
                fontWeight: 600,
                backgroundColor: '#faf8f5',
                color: 'var(--color-text)',
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnNotInList}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isFamousStep) setCheckedFamous(new Set());
              else setCheckedUnknown(new Set());
            }}
            style={{
              alignSelf: isMobile ? 'flex-end' : 'center',
              padding: isMobile ? '4px 10px' : '10px 20px',
              fontSize: isMobile ? 12 : 14,
              fontWeight: 600,
              backgroundColor: '#fff',
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
        {isFamousStep && <RecommendPickedTagsRow tags={selectedFamous} isMobile={isMobile} />}
        {isBackStep && <RecommendPickedTagsRow tags={selectedUnknown} isMobile={isMobile} />}
        {(isFamousStep || isBackStep) && (
          <div style={{ marginTop: 8, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                const s = step as FrontStep | BackStep;
                if (s === 'f1') {
                  setCheckedFamous(new Set());
                  setStep('initial');
                } else if (isFamousStep) {
                  const prevMap: Record<string, FrontStep> = { f1_2: 'f1', f2: 'f1_2', f2_2: 'f2', f3: 'f2_2', f3_2: 'f3' };
                  const prev = prevMap[s];
                  if (prev) {
                    const toRestore = selectedFamous.slice(-lastAddedFamousCount);
                    setSelectedFamous(prevSel => prevSel.slice(0, -lastAddedFamousCount));
                    setCheckedFamous(new Set(toRestore.map(x => x.tagKey)));
                    setStep(prev);
                  }
                } else if (s === 's4') {
                  setStep('sort1');
                } else if (isBackStep) {
                  const prevMap: Record<string, BackStep> = { s5: 's4', s6: 's5', s7: 's6', s8: 's7' };
                  const prev = prevMap[s];
                  if (prev) {
                    const toRestore = selectedUnknown.slice(-lastAddedUnknownCount);
                    setSelectedUnknown(prevSel => prevSel.slice(0, -lastAddedUnknownCount));
                    setCheckedUnknown(new Set(toRestore.map(x => x.tagKey)));
                    setStep(prev);
                  }
                }
              }}
              style={sortFixBtnStyle}
            >
              <svg style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rc.btnFix}
            </button>
          </div>
        )}"""

new_footer = """        {renderTagGrid()}
        {isMobile ? (
          <div style={{ marginTop: 6, width: '100%', maxWidth: 640 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
                style={{
                  flex: '1 1 30%',
                  minWidth: 0,
                  padding: '4px 6px',
                  fontSize: 11,
                  minHeight: 30,
                  fontWeight: 600,
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {rc.btnOk}
              </button>
              <button
                type="button"
                onClick={() => (isFamousStep ? goNextFromFamous(true) : goNextFromUnknown(true))}
                style={{
                  flex: '1 1 40%',
                  minWidth: 0,
                  padding: '4px 6px',
                  fontSize: 10,
                  minHeight: 30,
                  fontWeight: 600,
                  backgroundColor: '#faf8f5',
                  color: 'var(--color-text)',
                  border: '2px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {rc.btnNotInList}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isFamousStep) setCheckedFamous(new Set());
                  else setCheckedUnknown(new Set());
                }}
                style={{
                  flex: '1 1 25%',
                  minWidth: 0,
                  padding: '4px 6px',
                  fontSize: 10,
                  minHeight: 30,
                  fontWeight: 600,
                  backgroundColor: '#fff',
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
            {isFamousStep && <RecommendPickedTagsRow tags={frontPickedTagsDisplay} isMobile={isMobile} />}
            {isBackStep && <RecommendPickedTagsRow tags={backPickedTagsDisplay} isMobile={isMobile} />}
            {(isFamousStep || isBackStep) && (
              <div style={{ marginTop: 4, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    const s = step as FrontStep | BackStep;
                    if (s === 'f1') {
                      setCheckedFamous(new Set());
                      setStep('initial');
                    } else if (isFamousStep) {
                      const prevMap: Record<string, FrontStep> = { f1_2: 'f1', f2: 'f1_2', f2_2: 'f2', f3: 'f2_2', f3_2: 'f3' };
                      const prev = prevMap[s];
                      if (prev) {
                        const toRestore = selectedFamous.slice(-lastAddedFamousCount);
                        setSelectedFamous(prevSel => prevSel.slice(0, -lastAddedFamousCount));
                        setCheckedFamous(new Set(toRestore.map(x => x.tagKey)));
                        setStep(prev);
                      }
                    } else if (s === 's4') {
                      setStep('sort1');
                    } else if (isBackStep) {
                      const prevMap: Record<string, BackStep> = { s5: 's4', s6: 's5', s7: 's6', s8: 's7' };
                      const prev = prevMap[s];
                      if (prev) {
                        const toRestore = selectedUnknown.slice(-lastAddedUnknownCount);
                        setSelectedUnknown(prevSel => prevSel.slice(0, -lastAddedUnknownCount));
                        setCheckedUnknown(new Set(toRestore.map(x => x.tagKey)));
                        setStep(prev);
                      }
                    }
                  }}
                  style={{ ...sortFixBtnStyle, padding: '2px 6px', fontSize: 10, gap: 3 }}
                >
                  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rc.btnFix}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
                marginTop: 0,
                width: '100%',
                maxWidth: 640,
              }}
            >
              <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '16px 32px',
                    fontSize: 17,
                    fontWeight: 600,
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {rc.btnOk}
                </button>
                <button
                  type="button"
                  onClick={() => (isFamousStep ? goNextFromFamous(true) : goNextFromUnknown(true))}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    backgroundColor: '#faf8f5',
                    color: 'var(--color-text)',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {rc.btnNotInList}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isFamousStep) setCheckedFamous(new Set());
                  else setCheckedUnknown(new Set());
                }}
                style={{
                  alignSelf: 'center',
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: '#fff',
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
            {isFamousStep && <RecommendPickedTagsRow tags={frontPickedTagsDisplay} isMobile={isMobile} />}
            {isBackStep && <RecommendPickedTagsRow tags={backPickedTagsDisplay} isMobile={isMobile} />}
            {(isFamousStep || isBackStep) && (
              <div style={{ marginTop: 8, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    const s = step as FrontStep | BackStep;
                    if (s === 'f1') {
                      setCheckedFamous(new Set());
                      setStep('initial');
                    } else if (isFamousStep) {
                      const prevMap: Record<string, FrontStep> = { f1_2: 'f1', f2: 'f1_2', f2_2: 'f2', f3: 'f2_2', f3_2: 'f3' };
                      const prev = prevMap[s];
                      if (prev) {
                        const toRestore = selectedFamous.slice(-lastAddedFamousCount);
                        setSelectedFamous(prevSel => prevSel.slice(0, -lastAddedFamousCount));
                        setCheckedFamous(new Set(toRestore.map(x => x.tagKey)));
                        setStep(prev);
                      }
                    } else if (s === 's4') {
                      setStep('sort1');
                    } else if (isBackStep) {
                      const prevMap: Record<string, BackStep> = { s5: 's4', s6: 's5', s7: 's6', s8: 's7' };
                      const prev = prevMap[s];
                      if (prev) {
                        const toRestore = selectedUnknown.slice(-lastAddedUnknownCount);
                        setSelectedUnknown(prevSel => prevSel.slice(0, -lastAddedUnknownCount));
                        setCheckedUnknown(new Set(toRestore.map(x => x.tagKey)));
                        setStep(prev);
                      }
                    }
                  }}
                  style={sortFixBtnStyle}
                >
                  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rc.btnFix}
                </button>
              </div>
            )}
          </>
        )}"""

if old_footer not in t:
    raise SystemExit("tag footer block not found")
t = t.replace(old_footer, new_footer, 1)

# Remove bogus check line if any
p.write_text(t, encoding="utf-8")
print("OK")
