Rollback (2026-04-16 batch: REVEAL thresholds, PROBABLY_YES likelihood, early-exit -> one forced REVEAL)

Restore from this folder (copy back to repo paths):

  engine.ts.bak          -> src/server/game/engine.ts
  flowUtils.ts.bak       -> src/server/config/flowUtils.ts
  weightUpdate.ts.bak    -> src/server/algo/weightUpdate.ts
  simulationRunner.ts.bak -> src/server/simulation/simulationRunner.ts
  mvpConfig-change-history.md.bak -> config/mvpConfig-change-history.md

Then run: npx tsc --noEmit
