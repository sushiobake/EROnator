/**
 * 設定変更タブ
 */

'use client';

import { JSX, useState, type ReactNode } from 'react';
import { RANK_BG, RANK_TEXT } from '@/app/admin/constants/rankColors';
import { DEFAULT_THINKING } from '@/server/config/schema';

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

          {/* 現在の質問の流れ */}
          <section style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#fff', fontSize: '0.9rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>【現在の質問の流れ】</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <FlowRow q="Q1-2" chips={[{ ...FLOW_COLORS.normal, label: '通常（まとめ or タグ）' }]} />
              <FlowRow q="Q3" chips={[{ ...FLOW_COLORS.special, label: '特別（シリーズ or 有名度）' }]} />
              <FlowRow q="Q4" chips={[{ ...FLOW_COLORS.normal, label: '通常' }]} />
              <FlowRow q="Q5" chips={[{ ...FLOW_COLORS.special, label: '特別（文字種 or Q3で使わなかった方）' }]} />
              <FlowRow q="Q6-8" chips={[{ ...FLOW_COLORS.normal, label: '通常' }]} />
              <FlowRow q="Q9" chips={[{ ...FLOW_COLORS.special, label: '特別（50音 or 残り）' }]} />
              <FlowDivider />
              <FlowRow q="Q10-15" chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認（〇〇あるかしら？）' }]} />
              <FlowRow q="Q16" chips={[{ ...FLOW_COLORS.special, label: '特別（残り。わからない時はQ11に補填）' }]} />
              <FlowDivider />
              <FlowRow q="Q17-19" chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }, { ...FLOW_COLORS.reveal, label: 'REVEAL（この作品で合ってる？）' }]} />
              <FlowRow q="Q20" chips={[{ ...FLOW_COLORS.rescue, label: '救済（条件満たすときのみ）' }]} />
              <FlowRow q="Q21-23" chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }, { ...FLOW_COLORS.reveal, label: 'REVEAL' }]} />
              <FlowRow q="Q24" chips={[{ ...FLOW_COLORS.rescue, label: '救済（条件満たすときのみ）' }]} />
              <FlowRow q={`Q25-${config?.flow?.maxQuestions ?? 35}`} chips={[{ ...FLOW_COLORS.normal, label: '通常' }, { ...FLOW_COLORS.confirm, label: '確認' }, { ...FLOW_COLORS.reveal, label: 'REVEAL' }]} />
            </div>
            <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.85rem', color: '#555' }}>
              確認（黄）の補足: 20問目まで＝タイトル頭文字を優先。21問目以降＝タイトル頭文字・作者・キャラクターの3種類をランダムに選択（キャラがなければ2種類）。
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ background: FLOW_COLORS.normal.bg, color: FLOW_COLORS.normal.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>紫: 通常</span>
              <span style={{ background: FLOW_COLORS.special.bg, color: FLOW_COLORS.special.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>濃紫: 特別</span>
              <span style={{ background: FLOW_COLORS.confirm.bg, color: FLOW_COLORS.confirm.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>黄: 確認</span>
              <span style={{ background: FLOW_COLORS.reveal.bg, color: FLOW_COLORS.reveal.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>緑: REVEAL</span>
              <span style={{ background: FLOW_COLORS.rescue.bg, color: FLOW_COLORS.rescue.color, padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>オレンジ: 救済</span>
            </div>
          </section>

          {/* 「考え中」の表記（折りたたみ） */}
          <CollapsibleSection id="config-thinking" title="「考え中」の表記" defaultOpen={true}>
            <p style={{ color: '#666', marginTop: 0, marginBottom: '1rem' }}>
              回答送信後、次の質問が返るまでの「考え中」表示の文言を編集できます。有効候補数（EC）に応じて early / mid / late / closing の4段階で切り替わります。各レベルに最大5個まで登録でき、ランダムまたは順番に表示されます。
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>表示方法</strong>
                <span style={{ display: 'block', marginTop: '0.35rem' }}>複数文言があるときの出し方。sequential＝順番に（同じ文言の連続を避ける）、random＝ランダム。</span>
                <select
                  value={(config.thinking ?? DEFAULT_THINKING).displayMode}
                  onChange={(e) => {
                    const cur = config.thinking ?? DEFAULT_THINKING;
                    updateConfig(['thinking'], { ...cur, displayMode: e.target.value as 'random' | 'sequential' });
                  }}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                >
                  <option value="sequential">順番に表示</option>
                  <option value="random">ランダムに表示</option>
                </select>
              </label>
            </div>
            {(['early', 'mid', 'late', 'closing'] as const).map((level) => {
              const labels = { early: 'early（EC&gt;500）', mid: 'mid（50&lt;EC≤500）', late: 'late（10&lt;EC≤50）', closing: 'closing（EC≤10）' };
              const texts = (config.thinking ?? DEFAULT_THINKING)[level];
              return (
                <div key={level} style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: '4px' }}>
                  <strong>{labels[level]}</strong>
                  <span style={{ display: 'block', marginTop: '0.25rem', fontWeight: 'normal', color: '#666', fontSize: '0.9rem' }}>最大5件</span>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        value={texts[i] ?? ''}
                        onChange={(e) => {
                          const cur = config.thinking ?? DEFAULT_THINKING;
                          const next = [...texts];
                          const v = e.target.value;
                          if (v) {
                            next[i] = v;
                          } else {
                            next.splice(i, 1);
                          }
                          const filtered = next.filter(Boolean);
                          const final = filtered.length > 0 ? filtered : [DEFAULT_THINKING[level][0]];
                          updateConfig(['thinking'], { ...cur, [level]: final });
                        }}
                        placeholder={i === 0 ? '文言を入力（1件以上必須）' : '追加（任意）'}
                        style={{ width: '100%', padding: '0.5rem' }}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
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
