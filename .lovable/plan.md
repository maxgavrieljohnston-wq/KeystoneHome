## Problem

The "Target price" (and the rest of the numbers) shown on the dashboard sheet and the public shared plan come from inline math in `src/routes/p.$slug.tsx` (`PlanView`). Picture Your Place uses `computePlanMetrics` from `src/lib/plan-metrics.ts`. The two paths drift:

- `PlanView` does **not** read `answers.targetPriceOverride`, so any override set elsewhere is ignored on the dashboard.
- Small formula differences (PMI/tax/insurance/HOA defaults, rate derivation via `deriveAssumptions`) produce slightly different numbers even without an override.

Result: the price on Picture Your Place doesn't match the price on the dashboard.

## Fix

Make `PlanView` the single source of truth's consumer — render from `computePlanMetrics(plan.answers, plan.assumptions)` instead of its own inline calculation.

### Changes (one file)

`src/routes/p.$slug.tsx`:

1. Import `computePlanMetrics` from `@/lib/plan-metrics`.
2. Replace the inline math block (lines ~83–137) with:
   - Keep `theme`, `a`, `styleName`, `zipData.city` derivation (still needed for the title/header).
   - Compute `const m = computePlanMetrics(a, plan.assumptions as any);`
   - Use `m.targetPrice`, `m.downPct`, `m.downPayment`, `m.monthlyMortgage`, `m.taxIns`, `m.pmi`, `m.hoa`, `m.reserve`, `m.totalHousing`, `m.closing`, `m.moving`, `m.cashToClose`, `m.saved`, `m.timelineYears`, `m.monthlyToSave`, `m.monthlyInvested` in the JSX where the locals were previously referenced.
3. Drop now-unused imports (`styleAdjustments`, `calcMortgage`, `calcRequiredMonthly`, `rateFromCredit`, `rateAddFromDownPct`, `combinedEmploymentAdjustment`, `getPriceByZip`) — keep `HOME_STYLES` for the title fallback.

### Out of scope

- No changes to `PicturePlacePanel`, dashboard layout, or server functions.
- No schema / migration changes.
- Saved override behavior already works in `computePlanMetrics`; nothing else needs to change.

## Verification

- Open Picture Your Place, change beds/baths/state, Save. Return to the dashboard — Target price, down payment, monthly housing, and cash-to-close should match exactly.
- Open a shared plan link — numbers should still render (now sourced from `computePlanMetrics`).
