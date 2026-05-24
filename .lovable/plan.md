
## Inspection: why features don't talk to each other

Every feature page reads the same `["my-plans"]` React Query. When one panel saves, it's supposed to invalidate that key so the other panels recompute from fresh data. Three concrete breaks:

### 1. Invest vs. Save — save doesn't invalidate the cache
`InvestVsSavePanel.handleSave` (`src/components/dashboard/InvestVsSavePanel.tsx`, ~L109) calls `updatePlanMeta` but never touches `qc.invalidateQueries`. Result: changing your rate or monthly contribution on the Invest page persists to the DB, but the dashboard's "Your numbers" block, the Assumptions panel, the Risk panel, and the Action Plan all keep showing the old rate/contribution until a hard reload.

**Fix:** add `useQueryClient` + `qc.invalidateQueries({ queryKey: ["my-plans"] })` (and `["dash-extras"]`) in the `onSuccess`/`finally` path, same shape as `EditablePlanPanel` and `PicturePlacePanel`.

### 2. Invest panel writes to the wrong field for "monthly savings"
The slider persists the contribution as `assumptions.investMonthly`, but `computePlanMetrics` (and therefore the dashboard's "Monthly savings" row and every other panel) reads `answers.monthlySavings`. So even with the cache fix, sliding the monthly contribution still wouldn't update the number shown on the dashboard or used by Risk/Action Plan calculations.

**Fix:** when saving from Invest, also send `answersPatch: { monthlySavings: Math.round(monthly) }` so the dashboard's "Monthly savings" and every downstream metric stays consistent with what the user dialed in. Keep `expectedReturnPct` in `assumptions`.

### 3. Assumptions panel — optimistic cache patch is a no-op
`AssumptionsPanel.patchCache` (~L120) does:
```ts
qc.setQueryData(["my-plans"], (prev) => {
  if (!Array.isArray(prev)) return prev; // ← always true; cache is { plans: [...] }
  ...
});
```
The cached value is `{ plans: [...] }`, not an array, so the optimistic update is silently skipped. The follow-up `invalidateQueries` still works, but the UI flickers for a moment with stale numbers.

**Fix:** rewrite `patchCache` to handle the `{ plans: PlanRow[] }` shape (map over `prev.plans`, return `{ ...prev, plans: next }`).

### 4. Verify nothing else regresses
- `EditablePlanPanel`, `PicturePlacePanel`, `revertPlanToInitial`, and `exportPlanPdf` already invalidate `["my-plans"]`. Leave untouched.
- `RiskScenariosPanel` is read-only — no save path to fix.
- `dash-extras` is only mutated by reminders/docs flows, which already manage their own keys; no change needed.

## Files touched
- `src/components/dashboard/InvestVsSavePanel.tsx` — add `useQueryClient`, invalidate `["my-plans"]` + `["dash-extras"]` after save, also send `answersPatch.monthlySavings`.
- `src/components/dashboard/AssumptionsPanel.tsx` — fix `patchCache` to operate on `{ plans: [...] }`.

No schema changes, no server-fn changes.

## One open question
The Invest slider currently calls its value "monthly contribution invested." Writing it to `answers.monthlySavings` makes it the single source of truth for that number across the app — which is what you want for the features to "talk to each other." Confirm that's the intent (vs. keeping a separate "what I'm currently saving" number from onboarding untouched and only using the slider locally).
