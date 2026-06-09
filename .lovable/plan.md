## Add Down payment % field to "Tune the inputs"

Down payment % lives on `answers.downGoalPct` (not in `assumptions`), and `computePlanMetrics` floors it by the home style's `minDown`. So this is a separate control from the other override fields in `AssumptionsPanel`.

### Changes (one file)

`src/components/dashboard/AssumptionsPanel.tsx`:

1. Render a "Down payment" field at the top of the inputs grid, styled like the existing fields (label, big serif number input, `%` suffix).
2. Local state `downPct` initialized from `answers.downGoalPct` (fallback 9). Re-sync in the existing `useEffect` that runs on `planId` change.
3. On **Save overrides**: in addition to the current `assumptions` patch, send `answersPatch: { downGoalPct: downPct }` via `updateMeta`. Optimistically patch the cached plan's `answers.downGoalPct` so every panel recomputes immediately (same pattern as `patchCache`, but on `answers`).
4. On **Reset to defaults**: also clear the override by sending `answersPatch: { downGoalPct: 9 }` (the project default) and reset local state.
5. Input accepts `0–100`, `step=0.5`. Placeholder shows the current effective `downGoalPct`.

### Out of scope

- No server function changes — `updatePlanMeta` already accepts `answersPatch.downGoalPct`.
- No change to the style-based `minDown` floor; if the user picks a value below it, `computePlanMetrics` still raises it. We can show a small hint later if needed.

### Verification

- Change Down payment % → Save → dashboard "Down payment" stat and monthly housing update to match. Reload page — value persists.
