
## 1) Remove the Compare feature entirely

Compare is unused by your new dashboard direction and adds maintenance. Full removal:

- Delete `src/routes/compare.tsx` (the page) and `src/lib/compare.functions.ts` (the server fn). The router plugin will regenerate `routeTree.gen.ts` automatically.
- Remove the `<Link to="/compare">Compare</Link>` entry from `DashboardNav` in `src/routes/dashboard.tsx` (line 256).
- Search-and-remove any other `/compare` references (currently only `dashboard.tsx`, `UpgradeModal.tsx`, and `tier-features.ts`):
  - `src/lib/tier-features.ts` — drop the "Scenario compare" Pro feature entry so it no longer appears in `UnlockedFeaturesGrid` / `PremiumPanel`.
  - `src/components/UpgradeModal.tsx` — drop any compare-related bullet/label.

No DB or migration changes — `plans` already supports everything else.

## 2) Replace "Build new plan" with a live-editable plan on the dashboard

### What the user sees (Plus/Pro only)

In the left column of the paid dashboard, replace `PlansList` with a new **"Your numbers"** card on top of the existing plan card. It contains three editable inputs:

- **Target home price** — currency input
- **Current savings** — currency input
- **Monthly contribution** — currency input

As the user types, every dependent number on the page updates immediately:
- KPI strip in `PaidHero` (Target price, Cash to close, Saved / % of goal, Need / month)
- `GoalTracker` progress bar inside the plan card
- `InvestVsSavePanel`, `RecommendedAccountsPanel`, `AssumptionsPanel`, `RiskScenariosPanel` (all already read from `answers`/`assumptions`)

Two controls live next to the inputs:
- **Revert to original** — restores the snapshot captured when the dashboard first loaded (disabled when nothing changed).
- A subtle "Saved" / "Saving…" status indicator.

The standalone **"+ Build new plan"** button and the "1 of 1 free scenarios used" copy are removed for paid users. (Free users keep the existing flow unchanged — they only have 1 plan and still go through the wizard to create it.)

### How it stays in sync everywhere

Inputs are the source of truth in a local state object, debounced (~500ms) and autosaved through a single server fn. We persist them so PDF/CSV exports (which re-read the row server-side) always see the latest values.

Storage mapping (no schema migration needed):

| UI field | Stored as |
|---|---|
| Current savings | `plans.current_savings` (already exists, already used by metrics) |
| Monthly contribution | `plans.answers.monthlySavings` (already read by `plan-metrics.ts`) |
| Target home price | `plans.answers.targetPriceOverride` (new key inside the existing `answers` JSONB) |

`computePlanMetrics` is updated so that when `answers.targetPriceOverride` is a positive number, it is used as `targetPrice` directly (bypassing the zip × style × lifestyle multiplier). Everything downstream (down payment, cash-to-close, PMI, monthly mortgage, invest-vs-save) already derives from `targetPrice`, so this single change propagates through the dashboard, PDF, and CSV without further edits.

### Server-side changes (small, focused)

In `src/lib/plans.functions.ts`:

- Extend `updateMetaSchema` to accept an optional `answersPatch: { monthlySavings?: number; targetPriceOverride?: number | null }`. In the handler, when present, fetch the existing `answers` JSONB, shallow-merge the patch, and update.
- Keep the existing `currentSavings` field — it already writes to `plans.current_savings`.

No changes needed to `exportPlanPdf` / `exportPlanCsv` / `buildPlanPdfBytes`: they already re-read `answers` + `assumptions` + `current_savings` and call `computePlanMetrics`, which will now honor the override.

### Revert behavior

On dashboard mount, snapshot the first plan's `{ targetPrice (computed if no override), monthlySavings, currentSavings, targetPriceOverride }`. "Revert" writes the snapshot back via the same `updatePlanMeta` call, clearing `targetPriceOverride` to `null` so the computed price returns.

## Technical notes

- `PlansList` is only used in two spots in `dashboard.tsx` (paid hero column + free flow). For paid users we render the new `<EditablePlanPanel>` plus a slimmed `<PlanCard>` (still gives PDF/CSV/share/settings actions). Free users keep `PlansList` as-is.
- New component file: `src/components/dashboard/EditablePlanPanel.tsx` — purely presentational + debounced mutation, uses `useMutation` against `updatePlanMeta`. Invalidates `["my-plans"]` on success so all dashboard panels re-render with fresh values.
- `computePlanMetrics` change is one early branch:
  ```ts
  const overrideRaw = a.targetPriceOverride;
  const override = typeof overrideRaw === "number" && overrideRaw > 0 ? overrideRaw : null;
  const targetPrice = override ?? Math.round(zipData.avg * mult);
  ```
- No DB migration. `answers` is already `jsonb` and accepts arbitrary keys.
- `handleNewPlan` and the `FREE_LIMIT` copy stay in the free-user branch only.
- Files touched: `src/routes/dashboard.tsx`, `src/lib/plans.functions.ts`, `src/lib/plan-metrics.ts`, `src/lib/tier-features.ts`, `src/components/UpgradeModal.tsx`, new `src/components/dashboard/EditablePlanPanel.tsx`. Files deleted: `src/routes/compare.tsx`, `src/lib/compare.functions.ts`.
