## Goal

Drop the `advancedAssumptions` step from the signup wizard. Compute tax / insurance / closing / etc. automatically from the user's ZIP (via `metroByZip` in `src/data/metros.ts`), with a national-average fallback. Keep manual editing as a Plus-gated feature, but only on the dashboard — never during signup.

## Changes

### 1. Signup flow (`src/routes/index.tsx`)
- Remove `"advancedAssumptions"` from the `FLOW` and `PROGRESS_SCREENS` arrays.
- Remove the `assumptions` field from the `Data` type and `INITIAL` constant (no longer collected client-side).
- Delete the `AdvancedAssumptionsScreen` component and its `if (screen === "advancedAssumptions")` branch.
- Anywhere `d.assumptions.*` is read (lines ~2695, ~3116 — closing %, moving, tax/insurance rates), replace with the same defaults the new helper uses, or just let `computePlanMetrics` derive them. No user-provided overrides during signup.
- When the plan is submitted, save `assumptions: {}` (empty) so the backend/derivation always wins.

### 2. New shared derivation helper (`src/lib/plan-assumptions.ts`)
- Export `deriveAssumptions(answers)` returning the assumption object expected by `computePlanMetrics`:
  - `propertyTaxRate` / `insuranceRate` → from `metroByZip(zip)` if matched, else national fallback (0.012 / 0.006).
  - `closingPct: 0.03`, `movingBudget: 1500`, plus any other current defaults.
- Pure function, no DB calls. Safe to import from server fns and client.

### 3. Backend always derives (`src/lib/plan-metrics.ts` + server fns)
- Update `computePlanMetrics(answers, assumptions)` so it ignores stored `assumptions` and always calls `deriveAssumptions(answers)` first, merging only `investMonthly` (the slider value persisted by the invest panel) from the stored row. This satisfies "Recompute everything on next view" for legacy plans without nuking the Plus invest-slider override.
- Add a small allow-list of keys that can still come from the stored `assumptions` blob: currently just `investMonthly`. Everything else is derived.

### 4. Plus-only dashboard editor (`src/routes/dashboard.tsx` + new component)
- Add `src/components/dashboard/AssumptionsPanel.tsx`:
  - Shows derived defaults (tax %, insurance %, closing %, moving $, mortgage rate, expected return %).
  - Plus members can override each field; saves through the existing `updatePlanMeta` server fn (writes to `plans.assumptions`).
  - Free/Plus-locked state reuses the existing `Section` lock pattern from `InvestVsSavePanel.tsx`.
- Extend `computePlanMetrics`' allow-list to honor any of these specific overrides when present in stored `assumptions`. Derivation is the floor; Plus overrides win.

### 5. Tier-features copy (`src/lib/tier-features.ts`)
- Replace the implicit "Plus = override assumptions during signup" affordance with an explicit Plus item: `Custom assumptions (tax, insurance, closing, rate)`. Drop any pricing-page copy that referenced "fine-tune during onboarding".

## Out of scope
- No DB migration — the `plans.assumptions` jsonb column stays; we just stop populating it from signup and treat most keys as read-only overrides on the dashboard.
- No changes to PDF / stress test / compare beyond what falls out of `computePlanMetrics` now sourcing defaults itself (they already call it).

## Notes for the user
- Signup gets one screen shorter and no longer hints at a "Plus feature" mid-flow.
- Existing saved plans will re-render with metro-derived numbers next time the dashboard loads. If a user had previously typed a custom tax rate as a Plus member, they will need to re-enter it from the new dashboard panel (one-time).
- National-fallback rates (1.2 % tax, 0.6 % insurance) match what's already in `plan-metrics.ts` today, so unrecognized ZIPs behave identically to today.
