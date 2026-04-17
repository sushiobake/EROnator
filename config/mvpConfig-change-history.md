# mvpConfig 変更履歴メモ

## 2026-04-16 (manual tuning)

- 目的: REVEAL 連発を抑え、断定前の確度要求を引き上げる。

### 変更前（復元用）

- reveal threshold schedule (`src/server/config/flowUtils.ts`)
  - Q1-15: 0.7
  - Q16-20: 0.6
  - Q21-25: 0.5
  - Q26-30: 0.4

- hard confirm min by phase (`config/mvpConfig.json`)
  - q20: 0.85
  - q25: 0.75
  - q30: 0.65

- reveal penalty (`config/mvpConfig.json`)
  - 0.8

### 変更後

- reveal threshold schedule (`src/server/config/flowUtils.ts`)
  - Q1-15: 0.7
  - Q16-20: 0.65
  - Q21-25: 0.6
  - Q26-30: 0.55

- hard confirm min by phase (`config/mvpConfig.json`)
  - q20: 0.75
  - q25: 0.65
  - q30: 0.55

- reveal penalty (`config/mvpConfig.json`)
  - 0.6

## 2026-04-16 (rollback 1 only)

- 目的: ①のみ元に戻す（②は維持）。

### 戻した項目（= 変更前へ復元）

- reveal threshold schedule (`src/server/config/flowUtils.ts`)
  - Q1-15: 0.7
  - Q16-20: 0.6
  - Q21-25: 0.5
  - Q26-30: 0.4

- hard confirm min by phase (`config/mvpConfig.json`)
  - q20: 0.85
  - q25: 0.75
  - q30: 0.65

### 維持した項目

- reveal penalty (`config/mvpConfig.json`)
  - 0.6

## 2026-04-16 (rollback 2)

- 目的: ②も元に戻す。

### 戻した項目（= 変更前へ復元）

- reveal penalty (`config/mvpConfig.json`)
  - 0.8

## 2026-04-16 (re-apply ①②)

- 目的: シミュ比較の結果を踏まえ、①②を再度有効化して運用する。

### 直前の状態（復元用）

- reveal threshold schedule (`src/server/config/flowUtils.ts`)
  - Q1-15: 0.7
  - Q16-20: 0.6
  - Q21-25: 0.5
  - Q26-30: 0.4

- hard confirm min by phase (`config/mvpConfig.json`)
  - q20: 0.85
  - q25: 0.75
  - q30: 0.65

- reveal penalty (`config/mvpConfig.json`)
  - 0.8

### 適用後（①②）

- reveal threshold schedule (`src/server/config/flowUtils.ts`)
  - Q1-15: 0.7
  - Q16-20: 0.65
  - Q21-25: 0.6
  - Q26-30: 0.55

- hard confirm min by phase (`config/mvpConfig.json`)
  - q20: 0.75
  - q25: 0.65
  - q30: 0.55

- reveal penalty (`config/mvpConfig.json`)
  - 0.6

## 2026-04-16 (tune REVEAL thresholds + PROBABLY_YES + early-exit UX)

- 目的:
  - ① REVEAL 閾値を少し緩和（断定が一度も出ない早期失敗を減らす）。
  - ② PROBABLY_YES の尤度を弱め、人間の「はい寄り」バイアスに対応。
  - ③ 早期失敗レビューに達しても、断定ミスがまだ0回なら先に1回強制断定（体験）。

### 変更前（復元用）

- reveal threshold schedule (`src/server/config/flowUtils.ts`)
  - Q1-15: 0.7
  - Q16-20: 0.65
  - Q21-25: 0.6
  - Q26-30: 0.55

- PROBABLY_YES 尤度（`src/server/algo/weightUpdate.ts`）
  - 二値尤度: タグあり 0.7 / なし 0.3
  - POPULARITY ソフト: `0.7 * p + 0.3 * (1 - p)`

- 早期失敗（`src/server/game/engine.ts` / `src/server/simulation/simulationRunner.ts`）
  - 早期失敗条件を満たすと即 FAIL_LIST（シミュは EARLY_FAIL_REVIEW で打切り）

### 変更後

- reveal threshold schedule (`src/server/config/flowUtils.ts`)
  - Q1-15: 0.7
  - Q16-20: 0.65
  - Q21-25: 0.55
  - Q26-30: 0.5

- PROBABLY_YES 尤度（`src/server/algo/weightUpdate.ts`）
  - 二値尤度: タグあり 0.6 / なし 0.4
  - POPULARITY ソフト: `0.6 * p + 0.4 * (1 - p)`

- 早期失敗ガード（`src/server/game/engine.ts` の `handleAnswerResponse`）
  - `shouldEarlyExit` が真かつ `session.revealMissCount === 0` のとき、候補が取れれば `REVEAL`（`forcedReveal: true`）。候補が無いときのみ従来どおり `FAIL_LIST`。

- シミュ同期（`src/server/simulation/simulationRunner.ts` の `evaluateSimulationEarlyExitAfterQuizAnswer`）
  - `revealMissCount === 0` かつ早期失敗スナップショットが真のときは打切りしない（`stop: false`）。

### バックアップ（この変更セットの直前ファイル一式）

- `config/backups/2026-04-16-reveal-earlyexit-probablyyes/*.bak` と `README.txt`

## 2026-04-16 (adminConfigNotes in mvpConfig)

- 目的: 管理画面のコンフィグタブから編集できる短い変更メモ欄を `mvpConfig.json` に正式追加（ゲーム挙動には未使用）。
- 追加: `adminConfigNotes`（任意文字列、最大 4000 文字）
- スキーマ: `src/server/config/schema.ts` の `MvpConfigSchema`
- UI: `src/app/admin/tags/tabs/ConfigTab.tsx` …「運用・変更メモ（参照のみ）」開閉セクションで `adminConfigNotes` を表示のみ（編集不可）
- 追記: `mvpConfig.json` の `adminConfigNotes` に、同日までの調整内容の要約を投入済み（更新はリポジトリ側で反映）。
