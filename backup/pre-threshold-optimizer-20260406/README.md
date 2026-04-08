# pre-threshold-optimizer-20260406

閾値最適化機能実装直前のバックアップ（2026-04-06）。

## 含まれるファイル

- `simulate-route.ts.bak` — `src/app/api/admin/simulate/route.ts`
- `simulationWorker.ts.bak` — `src/server/simulation/simulationWorker.ts`
- `progressStore.ts.bak` — `src/server/bulk/progressStore.ts`
- `AdminProgressContext.tsx.bak` — `src/app/admin/context/AdminProgressContext.tsx`
- `bulk-job-status-route.ts.bak` — `src/app/api/admin/bulk-job-status/route.ts`
- `page.tsx.after-patch.bak` — タブ追加後の `src/app/admin/tags/page.tsx`（参考）

## 戻し方（例）

個別ファイルを上書き復元する場合:

```text
copy /Y backup\pre-threshold-optimizer-20260406\simulate-route.ts.bak src\app\api\admin\simulate\route.ts
```

Git 利用時は `git checkout -- <path>` の方が安全な場合があります。
