# 管理画面 進行パネル 設計メモ

タブをまたいで進捗を常時表示する「進行パネル」の設計。

**作成日: 2026-02-20** / **確定日: 2026-02-20**

---

## 目的

- 人力タグ付けで Phase0/1+2 実行中に作品インポートなど他タブへ移ると進捗が消える問題を解消
- 複数ジョブの進捗を一覧表示する

---

## 確定仕様

### 1. 対象ジョブ（3種類）

| 種別 | 内容 | 備考 |
|------|------|------|
| **作品インポート** | FANZA API 取得 / コメント取得 | AI分析は使用しない |
| **Phase0+1+2** | タグ付け → チェック | 人力タグ付けタブ |
| **シミュレーション** | 単発 / バッチ |  simulate タブ |

※「すべて一括」ボタンは将来実装。今回は対象外。

### 2. 並行実行

- 複数ジョブの同時実行あり
- 3種類それぞれを表示できればOK

### 3. パネル位置・レイアウト

- **右下固定**
- 縦長に大きくできる

### 4. 推定残り時間

- 「残り○分」を表示する

### 5. 状態管理

- **React Context** で進捗を共通管理（タブ切り替えでも保持）

---

## 技術方針

1. React Context で進捗状態を共通管理
2. タブより上位（page.tsx）に ProgressPanel を常時配置
3. 各ジョブ開始時に Context の `setProgress` を呼ぶ
4. フェーズごとの処理ペースから残り時間を算出

---

## 実装計画

### 新規作成

- `src/app/admin/context/AdminProgressContext.tsx` … Context + Provider
- `src/app/admin/components/ProgressPanel.tsx` … 右下固定パネル

### 変更対象

| ファイル | 変更内容 |
|----------|----------|
| `src/app/admin/tags/page.tsx` | Provider でラップ、ProgressPanel を配置 |
| `src/app/admin/components/ManualTagging.tsx` | useProgressContext で setProgress 呼び出し |
| `src/app/admin/components/ImportWorkflow.tsx` | API・コメント取得の進捗を Context に送る |
| `src/app/admin/tags/page.tsx` 内 simulate | シミュ進捗を Context に送る |

### Context の型（案）

```ts
type JobType = 'import' | 'phase012' | 'simulate';

type ProgressState = {
  import?: { current: number; total: number; phase?: string; etaMin?: number };
  phase012?: { done: number; total: number; phase?: string; etaMin?: number };
  simulate?: { current: number; total: number; etaMin?: number };
};

type ProgressContextValue = {
  progress: ProgressState;
  setProgress: (job: JobType, value: ProgressState[JobType] | null) => void;
};
```

---

## 参照

- `src/app/admin/tags/page.tsx` … 管理画面メイン（タブ構造）
- `src/app/admin/components/ManualTagging.tsx` … 人力タグ付け（進捗あり）
- `src/app/admin/components/ImportWorkflow.tsx` … 作品インポート（commentProgress 等）
- `src/app/admin/tags/page.tsx` 内 simulate タブ … シミュレーション
