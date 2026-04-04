/**
 * 設定変更タブ
 */

'use client';

import { JSX, useState, useMemo, type ReactNode } from 'react';
import { RANK_BG, RANK_TEXT } from '@/app/admin/constants/rankColors';
import { DEFAULT_THINKING, DEFAULT_GAME_COPY, DEFAULT_RECOMMEND_COPY } from '@/server/config/schema';

interface ConfigTabProps {
  config: any;
  configLoading: boolean;
  configSaving: boolean;
  configMessage: { type: 'success' | 'error'; text: string } | null;
  debugEnabled: boolean;
  loadConfig: () => void;
  handleConfigSave: () => void;
  handleDebugToggle: (enabled: boolean) => void;
  updateConfig: (path: string[], value: any) => void;
  fieldDesc: (key: string) => JSX.Element;
}

const FLOW_COLORS = {
  normal: { bg: RANK_BG.S, color: RANK_TEXT.S },
  special: { bg: '#9c27b0', color: '#fff' },
  confirm: { bg: RANK_BG.B, color: RANK_TEXT.B },
  reveal: { bg: '#c8e6c9', color: '#2e7d32' },
  rescue: { bg: '#ffe0b2', color: '#e65100' },
  newtag: { bg: '#0d9488', color: '#fff' },
  noise: { bg: '#7c3aed', color: '#fff' },
} as const;

function FlowRow({ q, chips }: { q: string; chips: Array<{ bg: string; color: string; label: string }> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {q && <span style={{ minWidth: '5em', fontVariantNumeric: 'tabular-nums' }}>{q}</span>}
      {chips.map((c, i) => (
        <span key={i} style={{ background: c.bg, color: c.color, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{c.label}</span>
      ))}
    </div>
  );
}

function FlowDivider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '0.5rem 0' }} />;
}

function parseCommaSeparatedInts(s: string): number[] {
  return s
    .split(/[,，\s]+/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}


const DEFAULT_EARLY_EXIT_REVIEW = {
  enabled: true,
  reviewIndices: [25, 30, 35, 40],
  requiredConditions: 2,
  thresholds: {
    q25: { minConfidence: 0.2, maxEffectiveCandidates: 45, maxConfidenceDelta5: 0.04 },
    q30: { minConfidence: 0.16, maxEffectiveCandidates: 60, maxConfidenceDelta5: 0.035 },
    q35: { minConfidence: 0.13, maxEffectiveCandidates: 80, maxConfidenceDelta5: 0.03 },
    q40: { minConfidence: 0.1, maxEffectiveCandidates: 100, maxConfidenceDelta5: 0.025 },
  },
} as const;

type EarlyExitQ = 'q25' | 'q30' | 'q35' | 'q40';

function mergeEarlyExitReview(raw: unknown) {
  const r = raw as {
    enabled?: boolean;
    reviewIndices?: number[];
    requiredConditions?: number;
    thresholds?: Partial<Record<EarlyExitQ, { minConfidence?: number; maxEffectiveCandidates?: number; maxConfidenceDelta5?: number }>>;
  } | null | undefined;
  const t0 = DEFAULT_EARLY_EXIT_REVIEW.thresholds;
  return {
    enabled: r?.enabled !== false,
    reviewIndices:
      Array.isArray(r?.reviewIndices) && r.reviewIndices.length > 0
        ? r.reviewIndices
        : [...DEFAULT_EARLY_EXIT_REVIEW.reviewIndices],
    requiredConditions:
      typeof r?.requiredConditions === 'number' ? r.requiredConditions : DEFAULT_EARLY_EXIT_REVIEW.requiredConditions,
    thresholds: {
      q25: { ...t0.q25, ...r?.thresholds?.q25 },
      q30: { ...t0.q30, ...r?.thresholds?.q30 },
      q35: { ...t0.q35, ...r?.thresholds?.q35 },
      q40: { ...t0.q40, ...r?.thresholds?.q40 },
    },
  };
}

function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: { id: string; title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} style={{ marginBottom: '0.75rem', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fff' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          padding: '0.6rem 1rem',
          textAlign: 'left',
          border: 'none',
          backgroundColor: open ? '#f0f4f8' : '#f8f9fa',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {title}
        <span style={{ color: '#666' }}>{open ? '▲ 閉じる' : '▼ 開く'}</span>
      </button>
      {open && <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #eee' }}>{children}</div>}
    </section>
  );
}

export default function ConfigTab({
  config,
  configLoading,
  configSaving,
  configMessage,
  debugEnabled,
  loadConfig,
  handleConfigSave,
  handleDebugToggle,
  updateConfig,
  fieldDesc,
}: ConfigTabProps) {
  const eeMerged = useMemo(
    () => mergeEarlyExitReview(config?.flow?.earlyExitReview),
    [config?.flow?.earlyExitReview]
  );
  return (
    <section style={{ marginBottom: '2rem', fontSize: '1rem', lineHeight: 1.6 }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>コンフィグ</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        開発環境でのみ利用可能です。設定変更後は開発サーバーを停止して再起動してください。
      </p>

      {configLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>読み込み中...</p>
        </div>
      ) : !config ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'red' }}>設定を読み込めませんでした。</p>
          <button onClick={loadConfig} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            再読み込み
          </button>
        </div>
      ) : (
        <>
          {configMessage && (
            <div
              style={{
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: configMessage.type === 'success' ? '#d4edda' : '#f8d7da',
                color: configMessage.type === 'success' ? '#155724' : '#721c24',
                border: `1px solid ${configMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '4px',
              }}
            >
              {configMessage.text}
            </div>
          )}

          {/* デバッグ設定（コンパクト） */}
          <section id="config-debug" style={{ marginBottom: '1rem', padding: '0.6rem 1rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={debugEnabled}
                onChange={(e) => handleDebugToggle(e.target.checked)}
                style={{ marginRight: '0.5rem', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>デバッグパネル表示</span>
            </label>
          </section>

          {/* 現在の質問の流れ（開閉・参照用）v1.5 */}
          <CollapsibleSection id="config-question-flow" title="現在の質問の流れ（v1.5）" defaultOpen={false}>
            <p style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.85rem', color: '#555' }}>
              実装は{' '}
              <code style={{ background: '#eee', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>selectNextQuestion</code> /{' '}
              <code style={{ background: '#eee', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>specialQuestionSelection</code>
              。特別枠・救済・新タグ・ノイズは下の「特別質問スロット・救済・新タグ・ノイズ誘導」から変更できます。
            </p>
            <p style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#333' }}>
              <strong>現在の config 値</strong>：特別枠 Q
              {(config.flow?.specialQuestionSlotIndices ?? [3, 5, 9, 12]).join('・')}／救済 Q
              {(config.flow?.rescueSpecialCondition?.slotIndices ?? [16, 20, 24]).join('・')}／新タグ Q
              {(config.newTagQuestions?.slotIndices ?? [2, 7, 13]).join('・')}
              {config.noiseGuideRecommend?.enabled === false ? '／ノイズ誘導オフ' : '／ノイズ誘導オン'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
              <FlowRow q="Q1" chips={[{ ...FLOW_COLORS.normal, label: '通常（まとめ or タグ）' }]} />
              <FlowRow q="Q2" chips={[{ ...FLOW_COLORS.newtag, label: '新タグ（有効時・最優先）' }, { ...FLOW_COLORS.normal, label: 'または通常' }]} />
              <FlowRow q="Q3" chips={[{ ...FLOW_COLORS.special, label: '特別（シリーズ or 有名度）' }]} />
              <FlowRow q="Q4" chips={[{ ...FLOW_COLORS.normal, label: '通常' }]} />
              <FlowRow q="Q5" chips={[{ ...FLOW_COLORS.special, label: '特別（50音・行）' }]} />
              <FlowRow q="Q6" chips={[{ ...FLOW_COLORS.normal, label: '通常' }]} />
              <FlowRow q="Q7" chips={[{ ...FLOW_COLORS.newtag, label: '新タグ' }, { ...FLOW_COLORS.normal, label: 'または通常' }]} />
              <FlowRow q="Q8" chips={[{ ...FLOW_COLORS.normal, label: '通常' }]} />
              <FlowRow q="Q9" chips={[{ ...FLOW_COLORS.special, label: '特別（Q3の残り：シリーズ or 有名度）' }]} />
              <FlowDivider />
              <FlowRow q="Q10" chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }]} />
              <FlowRow q="Q11" chips={[{ ...FLOW_COLORS.normal, label: '通常＋確認' }, { ...FLOW_COLORS.special, label: 'UNKNOWN補填で特別が乗る場合あり' }]} />
              <FlowRow q="Q12" chips={[{ ...FLOW_COLORS.special, label: '特別（タイトル長 or 先頭文字種）' }]} />
              <FlowRow q="Q13" chips={[{ ...FLOW_COLORS.noise, label: 'ノイズ（条件時・最優先）' }, { ...FLOW_COLORS.newtag, label: '新タグ3本目' }, { ...FLOW_COLORS.normal, label: '通常' }]} />
              <FlowDivider />
              <FlowRow q="Q14-15" chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }]} />
              <FlowRow q="Q16" chips={[{ ...FLOW_COLORS.rescue, label: '救済・特別（条件付き）' }]} />
              <FlowRow q="Q17-19" chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }, { ...FLOW_COLORS.reveal, label: 'REVEAL' }]} />
              <FlowRow q="Q20" chips={[{ ...FLOW_COLORS.rescue, label: '救済（条件付き）' }]} />
              <FlowRow q="Q21-23" chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }, { ...FLOW_COLORS.reveal, label: 'REVEAL' }]} />
              <FlowRow q="Q24" chips={[{ ...FLOW_COLORS.rescue, label: '救済（条件付き）' }]} />
              <FlowRow q={`Q25-${config?.flow?.maxQuestions ?? 35}`} chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }, { ...FLOW_COLORS.reveal, label: 'REVEAL' }]} />
            </div>
            <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.85rem', color: '#555' }}>
              確認（黄）の補足: 20問目まで＝タイトル頭文字を優先。21問目以降＝タイトル頭文字・作者・キャラクターの3種類をランダムに選択（キャラがなければ2種類）。
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ background: FLOW_COLORS.normal.bg, color: FLOW_COLORS.normal.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>水色〜紫: 通常</span>
              <span style={{ background: FLOW_COLORS.special.bg, color: FLOW_COLORS.special.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>濃紫: 特別</span>
              <span style={{ background: FLOW_COLORS.confirm.bg, color: FLOW_COLORS.confirm.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>黄: 確認</span>
              <span style={{ background: FLOW_COLORS.reveal.bg, color: FLOW_COLORS.reveal.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>緑: REVEAL</span>
              <span style={{ background: FLOW_COLORS.rescue.bg, color: FLOW_COLORS.rescue.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>オレンジ: 救済</span>
              <span style={{ background: FLOW_COLORS.newtag.bg, color: FLOW_COLORS.newtag.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>ティール: 新タグ</span>
              <span style={{ background: FLOW_COLORS.noise.bg, color: FLOW_COLORS.noise.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>紫系: ノイズ誘導</span>
            </div>
          </CollapsibleSection>

          {/* 推薦モードの計算式（表示のみ・実装は API 側定数） */}
          <CollapsibleSection id="config-recommend-formula" title="推薦モードの計算式" defaultOpen={false}>
            <p style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
              以下は <code style={{ background: '#eee', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>POST /api/recommend</code> の「好みマッチ度」と並び順のメモです。数値の変更はソースの定数（
              <code style={{ background: '#eee', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>RECOMMEND_PREF_BASE</code>
              など）で行います。この画面からは編集しません。
            </p>
            <pre
              style={{
                margin: 0,
                padding: '0.75rem 1rem',
                background: '#f6f8fa',
                border: '1px solid #e1e4e8',
                borderRadius: '6px',
                fontSize: '0.8rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
{`【好みマッチ度・並びスコア（同一式）】
  最終点 = clamp(50, 100, 50 + tagMatchRatio×35 + popAlign×15)
  表示は小数第1位。並び順も同じ値。

【tagMatchRatio】0〜1
  ・ランク付き／有名・無名フロー: マッチしたタグの重み合計 ÷ 選択タグの重み合計
    （順位重み 1位=5 … 5位=1、または有名/無名の固定重み）
  ・レガシー tagKeys のみ: 一致タグ数 ÷ 選択タグ数（タグなし時は 1）

【popAlign】0〜1（初期質問「有名度」の嗜好）
  maxPop = 今回取得した候補作品群の popularityBase の最大値（最低 1）
  ・やっぱり有名作品 → targetPop = maxPop
  ・隠れた名作 → targetPop = 0
  ・中間くらい → targetPop = maxPop÷2
  （未指定・不正値は「中間」と同じ扱い）
  popAlign = max(0, min(1, 1 − |作品のpopularityBase − targetPop| / maxPop))

【レビュー】
  popularityBase 自体にレビュー件数帯＋reviewAverage が含まれるため、
  ここでは reviewAverage を別枠で足さない（二重加算を避ける）。

【補足】
  popularityBase の理論上限は DB 仕様上 55。データが伸びると maxPop も上がり、
  中間の targetPop も自動で連動する。`}
            </pre>
          </CollapsibleSection>

          {/* ゲーム文言（コンパクト） */}
          <CollapsibleSection id="config-game-copy" title="ゲーム文言（トップ・質問・断定・正解・外れ・おすすめ・AI_GATE）" defaultOpen={false}>
            <p style={{ color: '#666', marginTop: 0, marginBottom: '0.5rem', fontSize: '0.8rem' }}>トップは行ごと。{'{workCount}'} は作品数に置換。</p>
            {(() => {
              const gc = config.gameCopy ?? DEFAULT_GAME_COPY;
              const small = { fontSize: '0.8rem' as const, marginBottom: '0.35rem' };
              const gameCopyFields: { key: string; label: string }[] = [
                { key: 'questionPreamble', label: '質問の前段（各質問の直上に表示する1行）' },
                { key: 'revealPreamble', label: '断定の前段（「この作品で合ってる？」画面の上の淡い文）' },
                { key: 'revealMain', label: '断定のメイン（「この作品で合ってる？」の太い文）' },
                { key: 'successSpeech', label: '正解時のキャラ台詞（{questionCount}で質問数に置換）' },
                { key: 'successTitle', label: '正解時のタイトル（正解画面の作品上の見出し）' },
                { key: 'recommendTitle', label: 'おすすめ見出し（正解・惜しかった画面の「おすすめ5件」の上）' },
                { key: 'failListSpeech', label: '外れ①メイン（全部外してリスト表示になったときのキャラの一言）' },
                { key: 'failListSubMobile', label: '外れ①サブ・スマホ（リスト画面でスマホ時の2行目）' },
                { key: 'failListSubPc', label: '外れ①サブ・PC（リスト画面でPC時の2行目）' },
                { key: 'failListNotInListPrompt', label: '外れ①「リストにない」押下後（作品名入力の上の一文）' },
                { key: 'almostSuccessSpeech', label: '外れ②惜しかった（{questionCount}で質問数に置換）' },
                { key: 'aiGatePreamble', label: 'AIゲートの前段（最初の「AI生成？」の上の淡い文）' },
                { key: 'aiGateMain', label: 'AIゲートのメイン（最初の「AI生成作品ではない？」）' },
              ];
              return (
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={small}><strong>トップ行（トップ画面の挨拶。行ごと）</strong></div>
                  {(gc.topLines ?? []).map((line: string, i: number) => (
                    <input key={i} type="text" value={line} onChange={(e) => {
                      const next = [...(gc.topLines ?? [])];
                      next[i] = e.target.value;
                      updateConfig(['gameCopy'], { ...gc, topLines: next });
                    }} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.25rem', fontSize: '0.8rem' }} />
                  ))}
                  {gameCopyFields.map(({ key, label }) => (
                    <div key={key} style={small}>
                      <strong>{label}</strong>
                      <input type="text" value={(gc as Record<string, string>)[key] ?? ''} onChange={(e) => updateConfig(['gameCopy'], { ...gc, [key]: e.target.value })} style={{ width: '100%', padding: '0.35rem', fontSize: '0.8rem' }} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </CollapsibleSection>

          {/* 「考え中」9種（opening / inGame early,mid,late,closing / endingCorrect / endingWrong / failListSelect / failListNotInList） */}
          <CollapsibleSection id="config-thinking" title="「考え中」の表記（9種）" defaultOpen={false}>
            <p style={{ color: '#666', marginTop: 0, marginBottom: '0.5rem', fontSize: '0.8rem' }}>
              各場面の文言と、表示する画像ファイル名。画像は <code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>public/ilust</code> フォルダに、下に書いた名前で入れてください。
            </p>
            <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.75rem', padding: '0.5rem', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #eee' }}>
              <strong>考え中で使う画像ファイル一覧（ilust に置くもの）</strong>
              <ul style={{ margin: '0.35rem 0 0 1rem', paddingLeft: 0 }}>
                <li><code>inari_thinking_opening.png</code>（開始〜1問目）</li>
                <li><code>inari_thinking_early.png</code>（質問後・候補多め）</li>
                <li><code>inari_thinking_mid.png</code>（質問後・候補やや絞れ）</li>
                <li><code>inari_thinking_late.png</code>（質問後・候補少なめ）</li>
                <li><code>inari_thinking_closing.png</code>（質問後・候補少ない）</li>
                <li><code>inari_thinking_ending_correct.png</code>（正解後）</li>
                <li><code>inari_thinking_ending_wrong.png</code>（断定で外れた後）</li>
                <li><code>inari_thinking_fail_list_select.png</code>（失敗リストで作品を選んだとき）</li>
                <li><code>inari_thinking_fail_list_not_in_list.png</code>（失敗リストで「リストにない」を送ったとき）</li>
              </ul>
              <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: '#888' }}>未配置の種類は <code>inari_thinking.png</code> にフォールバックします。</div>
            </div>
            {(() => {
              const th = config.thinking ?? DEFAULT_THINKING;
              const inGame = th.inGame ?? DEFAULT_THINKING.inGame;
              const small = { fontSize: '0.8rem' as const, marginBottom: '0.35rem' };
              return (
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={small}><strong>開始〜1問目まで（1文）</strong></div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>画像: <code>inari_thinking_opening.png</code> を ilust に入れる</div>
                  <input type="text" value={th.opening?.text ?? ''} onChange={(e) => updateConfig(['thinking'], { ...th, opening: { text: e.target.value } })} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.5rem', fontSize: '0.8rem' }} />
                  <div style={small}><strong>正解したあと〜おすすめ表示まで（1文）</strong></div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>画像: <code>inari_thinking_ending_correct.png</code> を ilust に入れる</div>
                  <input type="text" value={th.endingCorrect?.text ?? ''} onChange={(e) => updateConfig(['thinking'], { ...th, endingCorrect: { text: e.target.value } })} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.5rem', fontSize: '0.8rem' }} />
                  <div style={small}><strong>断定で外れたあと〜次へ（1文）</strong></div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>画像: <code>inari_thinking_ending_wrong.png</code> を ilust に入れる</div>
                  <input type="text" value={th.endingWrong?.text ?? ''} onChange={(e) => updateConfig(['thinking'], { ...th, endingWrong: { text: e.target.value } })} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem', fontSize: '0.8rem' }} />
                  <div style={{ ...small, marginTop: '0.5rem' }}><strong>質問に答えたあと〜次の質問が返るまで（inGame）表示方法</strong></div>
                  <select value={inGame.displayMode} onChange={(e) => updateConfig(['thinking'], { ...th, inGame: { ...inGame, displayMode: e.target.value as 'random' | 'sequential' } })} style={{ padding: '0.35rem', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="sequential">順番</option>
                    <option value="random">ランダム</option>
                  </select>
                  {(['early', 'mid', 'late', 'closing'] as const).map((level) => {
                    const labels: Record<string, string> = {
                      early: 'early（候補まだ多い・EC&gt;500）',
                      mid: 'mid（候補やや絞れた・50&lt;EC≤500）',
                      late: 'late（候補少なめ・10&lt;EC≤50）',
                      closing: 'closing（候補少ない・EC≤10）',
                    };
                    const imageNames: Record<string, string> = {
                      early: 'inari_thinking_early.png',
                      mid: 'inari_thinking_mid.png',
                      late: 'inari_thinking_late.png',
                      closing: 'inari_thinking_closing.png',
                    };
                    const defaultTexts = DEFAULT_THINKING.inGame[level].texts;
                    const texts = inGame[level]?.texts ?? defaultTexts ?? ['考え中…'];
                    return (
                      <div key={level} style={{ marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #eee', borderRadius: '4px' }}>
                        <strong style={{ fontSize: '0.8rem' }}>{labels[level]}</strong> 最大5件
                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>画像: <code>{imageNames[level]}</code> を ilust に入れる</div>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <input key={i} type="text" value={texts[i] ?? ''} onChange={(e) => {
                            const next = [...texts];
                            const v = e.target.value;
                            if (v) next[i] = v; else next.splice(i, 1);
                            const final = next.filter(Boolean).length > 0 ? next.filter(Boolean) : [defaultTexts[0]];
                            updateConfig(['thinking'], { ...th, inGame: { ...inGame, [level]: { texts: final } } });
                          }} placeholder={i === 0 ? '必須' : '任意'} style={{ width: '100%', padding: '0.35rem', marginTop: '0.25rem', fontSize: '0.8rem' }} />
                        ))}
                      </div>
                    );
                  })}
                  <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #eee' }}>
                    <div style={small}><strong>失敗リストで作品を選んだとき（1文）</strong></div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>画像: <code>inari_thinking_fail_list_select.png</code> を ilust に入れる</div>
                    <input type="text" value={th.failListSelect?.text ?? ''} onChange={(e) => updateConfig(['thinking'], { ...th, failListSelect: { text: e.target.value } })} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.5rem', fontSize: '0.8rem' }} />
                    <div style={small}><strong>失敗リストで「リストにない」を送ったとき（1文）</strong></div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.2rem' }}>画像: <code>inari_thinking_fail_list_not_in_list.png</code> を ilust に入れる</div>
                    <input type="text" value={th.failListNotInList?.text ?? ''} onChange={(e) => updateConfig(['thinking'], { ...th, failListNotInList: { text: e.target.value } })} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.5rem', fontSize: '0.8rem' }} />
                  </div>
                </div>
              );
            })()}
          </CollapsibleSection>

          {/* 推薦の文言や表記 */}
          <CollapsibleSection id="config-recommend" title="「推薦」の文言や表記" defaultOpen={false}>
            <p style={{ color: '#666', marginTop: 0, marginBottom: '0.5rem', fontSize: '0.8rem' }}>
              推薦モードの質問文やボタン文言を編集できます。
            </p>
            {(() => {
              const rc = config.recommendCopy ?? DEFAULT_RECOMMEND_COPY;
              const small = { fontSize: '0.8rem' as const, marginBottom: '0.35rem' };
              const fields: { key: keyof typeof DEFAULT_RECOMMEND_COPY; label: string }[] = [
                { key: 'aiGatePreamble', label: 'AIゲート前段（あなたの好みは？）' },
                { key: 'aiGateMain', label: 'AIゲートメイン（AI生成作品？それとも違う？）' },
                { key: 'initialMain', label: '初期画面メイン（あなたの好みは？）' },
                { key: 'initialPriorityQuestion', label: '優先度の質問（あなたが優先したいのは？順位をつけて！）' },
                { key: 'questionFamousStory', label: '有名タグ質問・ストーリー系カテゴリのとき' },
                { key: 'questionFamousPlay', label: '有名タグ質問・プレイ系カテゴリのとき' },
                { key: 'questionFamousCharacter', label: '有名タグ質問・キャラクター系カテゴリのとき' },
                { key: 'questionFamous', label: '有名タグ質問・共通フォールバック（上記3つが空のとき）' },
                { key: 'questionUnknown', label: '質問4-8（無名タグ）の文言' },
                {
                  key: 'famousPickMinHint',
                  label: '有名タグ：1件も選ばずに進めないとき（例：１個くらい気になるやつ選んでよ！）',
                },
                { key: 'sortPromptFront', label: '整理ページ（前半・sort1）のキャラ台詞' },
                { key: 'sortPromptBack', label: '整理ページ（後半・sort2）のキャラ台詞' },
                { key: 'sortPrompt', label: '整理キャラ台詞・共通フォールバック（前半/後半が空のとき）' },
                { key: 'thinkingText', label: '考え中（あなたにぴったりの作品を探しているわ…）' },
                { key: 'recommendResultsHeading', label: '推薦・結果画面の見出し（例：こんな作品なんてどう？）' },
                { key: 'btnNext', label: 'ボタン：次へ（初期画面など）' },
                {
                  key: 'btnNextSortFront',
                  label: 'ボタン：整理ページ（前半・sort1）のメイン（初期の「次へ」と別。例：後半へ進む）',
                },
                {
                  key: 'btnNextSortBack',
                  label: 'ボタン：整理ページ（後半・sort2）のメイン（例：結果を見る）',
                },
                { key: 'btnRetry', label: 'ボタン：やり直し' },
                { key: 'btnOk', label: 'ボタン：これでok' },
                { key: 'btnNotInList', label: 'ボタン：この中にはない（後半タグ用）' },
                { key: 'btnFamousExpand', label: 'ボタン：選択肢を増やす（前半有名タグ）' },
                { key: 'btnFamousCollapse', label: 'ボタン：選択肢を減らす（前半有名タグ）' },
                { key: 'btnFixRecommend', label: 'ボタン：推薦モードの「ひとつ前に戻る」（戻る系）' },
                { key: 'btnFix', label: 'ボタン：修正する（ゲーム本体用・推薦では未使用なら空で可）' },
                { key: 'btnTopReset', label: 'ボタン：トップに戻る' },
              ];
              return (
                <div style={{ fontSize: '0.85rem' }}>
                  {fields.map(({ key, label }) => (
                    <div key={key} style={small}>
                      <strong>{label}</strong>
                      <input
                        type="text"
                        value={(rc as Record<string, string>)[key] ?? ''}
                        onChange={(e) => updateConfig(['recommendCopy'], { ...rc, [key]: e.target.value })}
                        style={{ width: '100%', padding: '0.35rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
          </CollapsibleSection>

          {/* 答え合わせ・確認質問（折りたたみ） */}
          <CollapsibleSection id="config-reveal" title="答え合わせ・確認質問のタイミング">
            <p style={{ color: '#666', marginTop: 0, marginBottom: '1rem' }}>「この作品で合ってる？」をいつ出すか、その前に「〇〇あるかしら？」や頭文字・作者をいつ挟むかを決めます。</p>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>答え合わせを出す確信度のしきい値</strong>
                {fieldDesc('revealThreshold')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>「この作品で合ってる？」と答え合わせするタイミング。候補の確信度がこの値以上になると答え合わせに進みます。0～1（例: 0.7＝70%）</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={config.confirm.revealThreshold}
                  onChange={(e) => updateConfig(['confirm', 'revealThreshold'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>タグで直接聞く質問を挟む確信度の範囲</strong>
                {fieldDesc('confidenceConfirmBand')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>「〇〇あるかしら？」のような確認質問を、確信度がこの範囲（最小～最大）のときに出します。範囲外だと通常のタグ質問だけになります。</span>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={config.confirm.confidenceConfirmBand[0]}
                    onChange={(e) => {
                      const newBand: [number, number] = [parseFloat(e.target.value), config.confirm.confidenceConfirmBand[1]];
                      updateConfig(['confirm', 'confidenceConfirmBand'], newBand);
                    }}
                    style={{ flex: 1, padding: '0.5rem' }}
                  />
                  <span style={{ lineHeight: '2.5rem' }}>～</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={config.confirm.confidenceConfirmBand[1]}
                    onChange={(e) => {
                      const newBand: [number, number] = [config.confirm.confidenceConfirmBand[0], parseFloat(e.target.value)];
                      updateConfig(['confirm', 'confidenceConfirmBand'], newBand);
                    }}
                    style={{ flex: 1, padding: '0.5rem' }}
                  />
                </div>
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>必ず確認質問を出す質問番号</strong>
                {fieldDesc('qForcedIndices')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>指定した質問番号では、確信度に関係なく「確認質問」を1問挟みます。カンマ区切り（例: 6,10,17）</span>
                <input
                  type="text"
                  value={config.confirm.qForcedIndices.join(',')}
                  onChange={(e) => {
                    const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                    updateConfig(['confirm', 'qForcedIndices'], values);
                  }}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>タグで直接聞く質問（やわらかめ）の下限確信度</strong>
                {fieldDesc('softConfidenceMin')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>確信度がこの値以上のとき、「〇〇あるかしら？」のようなタグ確認質問を出します。0～1。</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={config.confirm.softConfidenceMin}
                  onChange={(e) => updateConfig(['confirm', 'softConfidenceMin'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>頭文字・作者で聞く質問（きっぱり）の下限確信度</strong>
                {fieldDesc('hardConfidenceMin')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>確信度がこの値以上のとき、「タイトルの頭文字は〇かしら？」「作者は〇〇かしら？」のような直接質問を出します。0～1。</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={config.confirm.hardConfidenceMin}
                  onChange={(e) => updateConfig(['confirm', 'hardConfidenceMin'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
          </CollapsibleSection>

          {/* アルゴリズム（スコア・重み・タグ選択・スケール）（折りたたみ） */}
          <CollapsibleSection id="config-algo" title="アルゴリズム（重みの更新・質問の選び方・効かせ方）">
            <p style={{ color: '#666', marginTop: 0, marginBottom: '1rem' }}>回答でスコアをどう更新するか、次にどのタグを出すか、1問の効きをどれくらいにするかを決めます。失敗が多いときは「質問の選び方」の useIG を OFF にしたり、ベイズの bayesianEpsilon を大きくすると改善しやすいです。</p>

            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>重みの更新（回答でスコアをどう変えるか）</h4>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>回答によるスコアの動き方（強さ）</strong>
                {fieldDesc('beta')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>YES/NOに応じて候補の重みをどれくらい強く変えるか。大きいほど1問の影響が強く、収束が早くなりがちです。</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={config.algo.beta}
                  onChange={(e) => updateConfig(['algo', 'beta'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>人気度をスコアに混ぜる割合</strong>
                {fieldDesc('alpha')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>再生数など「人気」をスコアにどれだけ反映するか。0～1。0だと人気はほぼ無視されます。</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={config.algo.alpha}
                  onChange={(e) => updateConfig(['algo', 'alpha'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>タグの「ある/ない」を決めるしきい値</strong>
                {fieldDesc('derivedConfidenceThreshold')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>作品ごとのタグの確信度がこの値以上なら「そのタグあり」として扱います。0～1。</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={config.algo.derivedConfidenceThreshold}
                  onChange={(e) => updateConfig(['algo', 'derivedConfidenceThreshold'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>答え合わせで外れたときのスコアの下げ幅</strong>
                {fieldDesc('revealPenalty')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>「この作品で合ってる？」でNOだった候補のスコアを、どれくらい割り引くか。0～1。大きいほど外れ候補が早く沈みます。</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={config.algo.revealPenalty}
                  onChange={(e) => updateConfig(['algo', 'revealPenalty'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>

            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>次の質問の選び方（どのタグを出すか・IG／p値）</h4>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>タグを出題する「p値」の範囲</strong>
                {fieldDesc('explorePValueMin / explorePValueMax')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>この範囲外のp値のタグは出題しません。未設定時はフィルタなし。例: 0.1～0.9</span>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    placeholder="0.1"
                    value={config.algo.explorePValueMin ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateConfig(['algo', 'explorePValueMin'], v === '' ? undefined : parseFloat(v));
                    }}
                    style={{ width: '80px', padding: '0.5rem' }}
                  />
                  <span>～</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    placeholder="0.9"
                    value={config.algo.explorePValueMax ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateConfig(['algo', 'explorePValueMax'], v === '' ? undefined : parseFloat(v));
                    }}
                    style={{ width: '80px', padding: '0.5rem' }}
                  />
                </div>
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.algo.explorePValueFallbackEnabled !== false}
                  onChange={(e) => updateConfig(['algo', 'explorePValueFallbackEnabled'], e.target.checked)}
                />
                <strong>p値範囲内のタグが無いとき、頭文字・作者質問に切り替える</strong>
                {fieldDesc('explorePValueFallbackEnabled')}
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.algo.useIGForExploreSelection !== false}
                  onChange={(e) => updateConfig(['algo', 'useIGForExploreSelection'], e.target.checked)}
                />
                <strong>タグ質問を「情報利得(IG)」で選ぶ</strong>
                {fieldDesc('useIGForExploreSelection')}
              </label>
              <p style={{ marginTop: '0.35rem', marginLeft: '1.5rem', color: '#555', lineHeight: '1.5' }}>
                ON（推奨）：1問で候補が一番分かれるタグを選びます。正答が多いと早く絞れますが、ノイズで1問間違えると確度が大きく崩れやすいです。
                <br />
                OFF：p値が0.5に近い（どちらとも言いにくい）タグを選びます。1問の効きは穏やかで、ノイズに強くなりやすい代わりに収束はやや遅れます。失敗が多いときはOFFを試してください。
              </p>
            </div>

            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>回答の効かせ方（1問あたりのスケール）</h4>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>まとめ質問の回答強度スケール</strong>
                {fieldDesc('summaryQuestionStrengthScale')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>まとめ質問（「学校が舞台？」など）のYES/NOが確度に与える影響の倍率。1＝通常タグと同程度、0.6＝控えめ。未設定時0.6。</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="0.6"
                  value={config.algo.summaryQuestionStrengthScale ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateConfig(['algo', 'summaryQuestionStrengthScale'], v === '' ? undefined : parseFloat(v));
                  }}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>通常タグ質問の回答強度スケール</strong>
                {fieldDesc('exploreTagStrengthScale')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>まとめ以外のタグ質問（通常・エロ・抽象）のYES/NOが確度に与える影響の倍率。1＝変更なし。未設定時1。</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="1"
                  value={config.algo.exploreTagStrengthScale ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateConfig(['algo', 'exploreTagStrengthScale'], v === '' ? undefined : parseFloat(v));
                  }}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>SOFT確認の回答強度スケール</strong>
                {fieldDesc('softConfirmStrengthScale')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>「〇〇あるかしら？」のようなSOFT確認質問のYES/NOが確度に与える影響の倍率。1＝変更なし。未設定時1。</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="1"
                  value={config.algo.softConfirmStrengthScale ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateConfig(['algo', 'softConfirmStrengthScale'], v === '' ? undefined : parseFloat(v));
                  }}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.algo.useBayesianUpdate !== false}
                  onChange={(e) => updateConfig(['algo', 'useBayesianUpdate'], e.target.checked)}
                />
                <strong>タグ・確認質問の重み更新をベイズ（事後確率）で行う</strong>
                {fieldDesc('useBayesianUpdate')}
              </label>
              <span style={{ display: 'block', marginTop: '0.35rem', marginLeft: '1.5rem', color: '#666' }}>OFFにすると従来の強度×betaで更新。未設定時はON（ベイズ使用）。</span>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>ベイズ更新時の尤度の下限（bayesianEpsilon）</strong>
                {fieldDesc('bayesianEpsilon')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>単一値で全フェーズに使う。下のフェーズ別で上書き可能。</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  placeholder="0.02"
                  value={config.algo.bayesianEpsilon ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateConfig(['algo', 'bayesianEpsilon'], v === '' ? undefined : parseFloat(v));
                  }}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>フェーズ別イプシロン（P4）</strong>
              {fieldDesc('bayesianEpsilonPhases')}
              <span style={{ display: 'block', marginTop: '0.35rem' }}>EC に応じて値を変える。3つとも同じ値（例: 0.05）にすれば単一値と同じ。</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <label>
                  前半 (EC&gt;200):
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="0.5"
                    value={config.algo.bayesianEpsilonPhases?.early ?? config.algo.bayesianEpsilon ?? 0.05}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      const cur = config.algo.bayesianEpsilonPhases ?? {
                        early: config.algo.bayesianEpsilon ?? 0.05,
                        mid: config.algo.bayesianEpsilon ?? 0.05,
                        late: config.algo.bayesianEpsilon ?? 0.05,
                      };
                      updateConfig(['algo', 'bayesianEpsilonPhases'], { ...cur, early: v });
                    }}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
                <label>
                  中盤 (20&lt;EC≤200):
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="0.5"
                    value={config.algo.bayesianEpsilonPhases?.mid ?? config.algo.bayesianEpsilon ?? 0.05}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      const cur = config.algo.bayesianEpsilonPhases ?? {
                        early: config.algo.bayesianEpsilon ?? 0.05,
                        mid: config.algo.bayesianEpsilon ?? 0.05,
                        late: config.algo.bayesianEpsilon ?? 0.05,
                      };
                      updateConfig(['algo', 'bayesianEpsilonPhases'], { ...cur, mid: v });
                    }}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
                <label>
                  後半 (EC≤20):
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="0.5"
                    value={config.algo.bayesianEpsilonPhases?.late ?? config.algo.bayesianEpsilon ?? 0.05}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      const cur = config.algo.bayesianEpsilonPhases ?? {
                        early: config.algo.bayesianEpsilon ?? 0.05,
                        mid: config.algo.bayesianEpsilon ?? 0.05,
                        late: config.algo.bayesianEpsilon ?? 0.05,
                      };
                      updateConfig(['algo', 'bayesianEpsilonPhases'], { ...cur, late: v });
                    }}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
              </div>
            </div>
          </CollapsibleSection>

          {/* ゲームの流れ（折りたたみ） */}
          <CollapsibleSection id="config-flow" title="ゲームの流れ（質問数・失敗時・頭文字の範囲など）">
            <p style={{ color: '#666', marginTop: 0, marginBottom: '1rem' }}>1ゲームの最大質問数、答え合わせを連続で外してよい回数、失敗時に表示する候補数、まとめ質問の優先度、頭文字・作者を何位までから選ぶかなどを決めます。</p>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>1ゲームの最大質問数</strong>
                {fieldDesc('maxQuestions')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>この回数まで質問したらゲーム終了（正解が出なくても終了）します。</span>
                <input
                  type="number"
                  min="1"
                  value={config.flow.maxQuestions}
                  onChange={(e) => updateConfig(['flow', 'maxQuestions'], parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>答え合わせを連続で外してよい回数</strong>
                {fieldDesc('maxRevealMisses')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>「この作品で合ってる？」をこの回数だけ連続で外すと、答え合わせは打ち切られて質問に戻ります。</span>
                <input
                  type="number"
                  min="1"
                  value={config.flow.maxRevealMisses}
                  onChange={(e) => updateConfig(['flow', 'maxRevealMisses'], parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>失敗時に表示する候補の数</strong>
                {fieldDesc('failListN')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>質問数オーバーなどでゲーム失敗のとき、上位何件の候補を「惜しかった作品」として表示するか。</span>
                <input
                  type="number"
                  min="1"
                  value={config.flow.failListN}
                  onChange={(e) => updateConfig(['flow', 'failListN'], parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>確認質問を挟む「候補数しきい値」の計算用</strong>
                {fieldDesc('effectiveConfirmThresholdParams')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>候補数に応じて確認質問を出すかどうかを決める式のパラメータ。通常はそのままで問題ありません。min・max・divisor の3つ。</span>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label>
                      最小:
                      <input
                        type="number"
                        min="1"
                        value={config.flow.effectiveConfirmThresholdParams.min}
                        onChange={(e) => updateConfig(['flow', 'effectiveConfirmThresholdParams', 'min'], parseInt(e.target.value))}
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      />
                    </label>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>
                      最大:
                      <input
                        type="number"
                        min="1"
                        value={config.flow.effectiveConfirmThresholdParams.max}
                        onChange={(e) => updateConfig(['flow', 'effectiveConfirmThresholdParams', 'max'], parseInt(e.target.value))}
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      />
                    </label>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>
                      割る数:
                      <input
                        type="number"
                        min="1"
                        value={config.flow.effectiveConfirmThresholdParams.divisor}
                        onChange={(e) => updateConfig(['flow', 'effectiveConfirmThresholdParams', 'divisor'], parseInt(e.target.value))}
                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      />
                    </label>
                  </div>
                </div>
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>連続でNOが続いたとき「当たり狙い」にする回数</strong>
                {fieldDesc('consecutiveNoForAtari')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>直近の回答がこの回数だけ連続NOのとき、次の1問は当たりやすいタグを選びます。単調さを和らげます。未設定時は3。</span>
                <input
                  type="number"
                  min="1"
                  value={config.flow.consecutiveNoForAtari ?? 3}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateConfig(['flow', 'consecutiveNoForAtari'], v === '' ? undefined : parseInt(v) || 3);
                  }}
                  placeholder="3"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>まとめ質問を優先して選ぶ確率</strong>
                {fieldDesc('summaryPreferRatio')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>0～1。この確率で「まとめ質問だけ」に絞ってから1問選びます。0なら優先なし。0.3なら30%の確率でまとめが多く出ます。まとめがなかなか出ないときは0.3～0.5程度に上げて試してください。</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={config.flow.summaryPreferRatio ?? 0}
                  onChange={(e) => updateConfig(['flow', 'summaryPreferRatio'], e.target.value === '' ? undefined : parseFloat(e.target.value))}
                  placeholder="0"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>頭文字・作者を聞くとき、候補の上位何件から選ぶか</strong>
                {fieldDesc('titleInitialTopN')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>「タイトルの頭文字は〇かしら？」「作者は〇〇かしら？」を、確度の高い順に何件目の作品までから選ぶか。1＝1位だけ（従来どおり）。2や3にすると頭文字のバリエーションが増えますが、正解がその範囲に入っていないと正解の頭文字を一度も聞けず終わるリスクがあります。推奨は2か3。</span>
                <input
                  type="number"
                  min="1"
                  value={config.flow.titleInitialTopN ?? 1}
                  onChange={(e) => updateConfig(['flow', 'titleInitialTopN'], e.target.value === '' ? undefined : parseInt(e.target.value) || 1)}
                  placeholder="1"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
          </CollapsibleSection>


          <CollapsibleSection id="config-early-exit-review" title="早期失敗の閾値" defaultOpen={false}>
            <p style={{ color: '#666', marginTop: 0, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              ここで設定した<strong>問数に答えた直後</strong>だけ審査します（例: 25 なら 25 問目に答えたあと）。
              「1位の確率がまだ低い」「実質候補がまだ広い」「直近5問の答え方から出す代理値が小さい」の3条件について、
              <strong>いくつマッチしたら</strong>失敗一覧へ切り替えるかを決めます。3つ目は確率の厳密な差分ではなく、直近5問の YES / NO / わからない の偏りから出す近似です。
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={eeMerged.enabled}
                  onChange={(e) =>
                    updateConfig(['flow', 'earlyExitReview'], {
                      ...mergeEarlyExitReview(config.flow.earlyExitReview),
                      enabled: e.target.checked,
                    })
                  }
                />
                <strong>早期失敗の審査を有効にする</strong>
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>審査する問数（カンマ区切り）</strong>
                <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.85rem', color: '#555' }}>
                  この番号の質問に答えた直後に、下記の閾値セットで判定します。既定は 25,30,35,40。
                </span>
                <input
                  type="text"
                  value={eeMerged.reviewIndices.join(',')}
                  onChange={(e) =>
                    updateConfig(['flow', 'earlyExitReview'], {
                      ...mergeEarlyExitReview(config.flow.earlyExitReview),
                      reviewIndices: parseCommaSeparatedInts(e.target.value),
                    })
                  }
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>発動に必要なマッチ数（1〜3）</strong>
                <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.85rem', color: '#555' }}>
                  3条件のうち、いくつ満たしたら失敗一覧へ切り替えるか。通常は 2。
                </span>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={eeMerged.requiredConditions}
                  onChange={(e) =>
                    updateConfig(['flow', 'earlyExitReview'], {
                      ...mergeEarlyExitReview(config.flow.earlyExitReview),
                      requiredConditions: Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 2)),
                    })
                  }
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            {(['q25', 'q30', 'q35', 'q40'] as const).map((qk) => {
              const label = qk === 'q25' ? '25問目の直後' : qk === 'q30' ? '30問目の直後' : qk === 'q35' ? '35問目の直後' : '40問目の直後';
              const th = eeMerged.thresholds[qk];
              return (
                <div
                  key={qk}
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#f5f5f5',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <strong style={{ fontSize: '0.95rem' }}>{label}（{qk}）</strong>
                  <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.82rem', color: '#555' }}>
                    ① 1位の確率がこの値<strong>未満</strong>なら1マッチ　② 実質候補がこの値<strong>より大きい</strong>なら1マッチ　③ 直近5問の代理がこの値<strong>以下</strong>なら1マッチ
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 120px' }}>
                      ① 未満（0〜1）
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={1}
                        value={th.minConfidence}
                        onChange={(e) => {
                          const base = mergeEarlyExitReview(config.flow.earlyExitReview);
                          updateConfig(['flow', 'earlyExitReview'], {
                            ...base,
                            thresholds: { ...base.thresholds, [qk]: { ...base.thresholds[qk], minConfidence: parseFloat(e.target.value) || 0 } },
                          });
                        }}
                        style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                      />
                    </label>
                    <label style={{ flex: '1 1 120px' }}>
                      ② より大きいとマッチ（件数）
                      <input
                        type="number"
                        min={1}
                        value={th.maxEffectiveCandidates}
                        onChange={(e) => {
                          const base = mergeEarlyExitReview(config.flow.earlyExitReview);
                          updateConfig(['flow', 'earlyExitReview'], {
                            ...base,
                            thresholds: {
                              ...base.thresholds,
                              [qk]: { ...base.thresholds[qk], maxEffectiveCandidates: parseInt(e.target.value, 10) || 1 },
                            },
                          });
                        }}
                        style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                      />
                    </label>
                    <label style={{ flex: '1 1 120px' }}>
                      ③ 以下でマッチ（代理）
                      <input
                        type="number"
                        step="0.005"
                        min={0}
                        max={1}
                        value={th.maxConfidenceDelta5}
                        onChange={(e) => {
                          const base = mergeEarlyExitReview(config.flow.earlyExitReview);
                          updateConfig(['flow', 'earlyExitReview'], {
                            ...base,
                            thresholds: {
                              ...base.thresholds,
                              [qk]: { ...base.thresholds[qk], maxConfidenceDelta5: parseFloat(e.target.value) || 0 },
                            },
                          });
                        }}
                        style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </CollapsibleSection>


          {/* 特別質問・救済・新タグ・ノイズ（mvpConfig v1.5） */}
          <CollapsibleSection id="config-special-slots-v15" title="特別質問スロット・救済・新タグ・ノイズ誘導" defaultOpen={false}>
            <p style={{ color: '#666', marginTop: 0, marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              数値はカンマ区切り（例: 3,5,9,12）。保存時に Zod で検証されます。新タグの <code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>variants</code>（質問文・tagKey）は項目が多いため{' '}
              <code style={{ background: '#eee', padding: '0.1rem 0.3rem' }}>config/mvpConfig.json</code> を直接編集するか、読み込んだ JSON をマージして保存してください。
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>特別質問スロット（Q番号）</strong>
                <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.85rem', color: '#555' }}>既定 [3,5,9,12]＝Q3 シリーズ/有名度、Q5 50音、Q9 残り、Q12 タイトル長/文字種</span>
                <input
                  type="text"
                  value={(config.flow?.specialQuestionSlotIndices ?? [3, 5, 9, 12]).join(',')}
                  onChange={(e) => updateConfig(['flow', 'specialQuestionSlotIndices'], parseCommaSeparatedInts(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fff8e1', borderRadius: '6px', border: '1px solid #ffe082' }}>
              <strong style={{ fontSize: '0.9rem' }}>救済条件・スロット</strong>
              <div style={{ marginTop: '0.5rem' }}>
                <label>
                  救済を出す Q 番号（カンマ区切り）
                  <input
                    type="text"
                    value={(config.flow?.rescueSpecialCondition?.slotIndices ?? [16, 20, 24]).join(',')}
                    onChange={(e) =>
                      updateConfig(['flow', 'rescueSpecialCondition'], {
                        ...config.flow.rescueSpecialCondition,
                        slotIndices: parseCommaSeparatedInts(e.target.value),
                        effectiveCandidatesMin: config.flow.rescueSpecialCondition?.effectiveCandidatesMin ?? 25,
                        confidenceMax: config.flow.rescueSpecialCondition?.confidenceMax ?? 0.35,
                      })
                    }
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.35rem' }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 140px' }}>
                  effectiveCandidates 最小
                  <input
                    type="number"
                    min="1"
                    value={config.flow?.rescueSpecialCondition?.effectiveCandidatesMin ?? 25}
                    onChange={(e) =>
                      updateConfig(['flow', 'rescueSpecialCondition'], {
                        ...config.flow.rescueSpecialCondition,
                        slotIndices: config.flow.rescueSpecialCondition?.slotIndices ?? [16, 20, 24],
                        effectiveCandidatesMin: parseInt(e.target.value, 10) || 25,
                        confidenceMax: config.flow.rescueSpecialCondition?.confidenceMax ?? 0.35,
                      })
                    }
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.35rem' }}
                  />
                </label>
                <label style={{ flex: '1 1 140px' }}>
                  confidence 最大
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={config.flow?.rescueSpecialCondition?.confidenceMax ?? 0.35}
                    onChange={(e) =>
                      updateConfig(['flow', 'rescueSpecialCondition'], {
                        ...config.flow.rescueSpecialCondition,
                        slotIndices: config.flow.rescueSpecialCondition?.slotIndices ?? [16, 20, 24],
                        effectiveCandidatesMin: config.flow.rescueSpecialCondition?.effectiveCandidatesMin ?? 25,
                        confidenceMax: parseFloat(e.target.value) || 0.35,
                      })
                    }
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.35rem' }}
                  />
                </label>
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={config.newTagQuestions?.enabled !== false}
                  onChange={(e) =>
                    updateConfig(['newTagQuestions'], {
                      ...config.newTagQuestions,
                      enabled: e.target.checked,
                      slotIndices: config.newTagQuestions?.slotIndices ?? [2, 7, 13],
                      variants: config.newTagQuestions?.variants ?? [],
                    })
                  }
                />
                <span>新タグ質問を有効にする</span>
              </label>
              <label>
                新タグを出す Q 番号（カンマ区切り）
                <input
                  type="text"
                  value={(config.newTagQuestions?.slotIndices ?? [2, 7, 13]).join(',')}
                  onChange={(e) =>
                    updateConfig(['newTagQuestions'], {
                      ...config.newTagQuestions,
                      enabled: config.newTagQuestions?.enabled !== false,
                      slotIndices: parseCommaSeparatedInts(e.target.value),
                      variants: config.newTagQuestions?.variants ?? [],
                    })
                  }
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.35rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={config.noiseGuideRecommend?.enabled !== false}
                  onChange={(e) =>
                    updateConfig(['noiseGuideRecommend'], {
                      ...config.noiseGuideRecommend,
                      enabled: e.target.checked,
                      questionText: config.noiseGuideRecommend?.questionText ?? 'もしかして…特定の作品やタイトルにこだわりがない？',
                    })
                  }
                />
                <span>ノイズ誘導（推薦へ）を有効にする</span>
              </label>
              <label>
                ノイズ質問文
                <input
                  type="text"
                  value={config.noiseGuideRecommend?.questionText ?? ''}
                  onChange={(e) =>
                    updateConfig(['noiseGuideRecommend'], {
                      ...config.noiseGuideRecommend,
                      enabled: config.noiseGuideRecommend?.enabled !== false,
                      questionText: e.target.value,
                    })
                  }
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.35rem' }}
                />
              </label>
            </div>
          </CollapsibleSection>

          {/* データ品質（タグの出題条件）（折りたたみ） */}
          <CollapsibleSection id="config-data" title="データ品質（タグの出題条件）">
            <p style={{ color: '#666', marginTop: 0, marginBottom: '1rem' }}>タグを「出題候補」にするときの条件です。極端に少ない作品にしかないタグや、ほぼ全員が持つタグを出題から外すために使います。</p>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>「何人持ってるタグを出すか」の決め方</strong>
                {fieldDesc('minCoverageMode')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>RATIO＝割合でしきい値、WORKS＝作品数でしきい値、AUTO＝自動。通常は WORKS のままで問題ありません。</span>
                <select
                  value={config.dataQuality.minCoverageMode}
                  onChange={(e) => updateConfig(['dataQuality', 'minCoverageMode'], e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                >
                  <option value="RATIO">割合でしきい値（RATIO）</option>
                  <option value="WORKS">作品数でしきい値（WORKS）</option>
                  <option value="AUTO">自動（AUTO）</option>
                </select>
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>タグを出題する「最小の割合」</strong>
                {fieldDesc('minCoverageRatio')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>候補作品中、この割合以上の作品が持っているタグだけ出題します。RATIOモードのとき使います。0～1。空なら無効。</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={config.dataQuality.minCoverageRatio ?? ''}
                  onChange={(e) => updateConfig(['dataQuality', 'minCoverageRatio'], e.target.value === '' ? null : parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>タグを出題する「最小の作品数」</strong>
                {fieldDesc('minCoverageWorks')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>候補作品中、この件数以上の作品が持っているタグだけ出題します。WORKSモードのとき使います。空なら無効。</span>
                <input
                  type="number"
                  min="0"
                  value={config.dataQuality.minCoverageWorks ?? ''}
                  onChange={(e) => updateConfig(['dataQuality', 'minCoverageWorks'], e.target.value === '' ? null : parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
          </CollapsibleSection>

          {/* 人気度（折りたたみ） */}
          <CollapsibleSection id="config-popularity" title="人気度">
            <p style={{ color: '#666', marginTop: 0, marginBottom: '1rem' }}>正解したときの「人気」の扱いです。現状はボーナス0で、スコアにはアルゴリズムの alpha で混ぜる形です。</p>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>正解したときに人気スコアへ加えるボーナス</strong>
                {fieldDesc('playBonusOnSuccess')}
                <span style={{ display: 'block', marginTop: '0.35rem' }}>答え合わせで正解した作品に、人気スコアをどれだけ足すか。0なら加算なし。</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={config.popularity.playBonusOnSuccess}
                  onChange={(e) => updateConfig(['popularity', 'playBonusOnSuccess'], parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
          </CollapsibleSection>

          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <h3>注意事項</h3>
            <ul style={{ marginLeft: '1.5rem' }}>
              <li>設定変更後は開発サーバーを再起動してください（<code>npm run dev</code>を停止して再起動）</li>
              <li>バリデーションエラーがある場合は保存されません</li>
              <li>保存前に自動的にバックアップが作成されます（<code>config/mvpConfig.json.bak</code>）</li>
              <li>このページは開発環境でのみ利用できます</li>
            </ul>
          </div>

          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
            <button
              onClick={handleConfigSave}
              disabled={configSaving}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                backgroundColor: configSaving ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: configSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {configSaving ? '保存中...' : '設定を保存'}
            </button>
            <button
              onClick={loadConfig}
              disabled={configSaving}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                marginLeft: '1rem',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: configSaving ? 'not-allowed' : 'pointer',
              }}
            >
              リセット
            </button>
          </div>
        </>
      )}
    </section>
  );
}
