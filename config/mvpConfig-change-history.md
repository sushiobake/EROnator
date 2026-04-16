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
