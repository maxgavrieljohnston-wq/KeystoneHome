## Goal

When a Plus/Pro user saves changes on the **Picture your place** tab (state, home style, beds/baths, etc.), every other feature panel (Editable plan, Invest vs save, Monthly action plan, Assumptions, Recommended accounts, etc.) should immediately reflect the new target price, down payment, monthly housing, and timeline numbers.

## Root cause

All panels already read from the shared `["my-plans"]` query and recompute metrics via `computePlanMetrics(answers, assumptions)`. The save flow invalidates that query correctly. The bug is upstream:

1. `PicturePlacePanel` now stores a **2‑letter state code** in `answers.zip` (e.g. `"TX"`), and computes preview pricing via `priceByState(code)`.
2. The server (`updatePlanMeta` in `src/lib/plans.functions.ts`) only refreshes `answers.zipData` when `zip.length >= 3` via `getPriceByZip`. With a 2‑char state code, the branch is skipped, so `zipData` keeps the **old** value (or stays undefined).
3. `computePlanMetrics` then uses the stale `zipData`, so target price / down payment / monthly housing on every other panel don't change when the user switches states.

Net effect: Picture-tab preview shows the new state's numbers, but no other panel does — exactly what the user is reporting.

## Fix

Make the server-stored `zipData` always match what `PicturePlacePanel` shows, regardless of whether `answers.zip` is a zip code or a state code.

### `src/lib/plans.functions.ts` — `updatePlanMeta` handler

Replace the `zip.length >= 3` branch with logic that handles both shapes:

- If `answersPatch.zip` is a 2-letter alpha code → `merged.zipData = priceByState(zip)`.
- Else if it's a 3+ digit string → `merged.zipData = getPriceByZip(zip)` (existing behavior).
- If `zip` is cleared (empty string) → delete `zipData`.

This keeps the legacy zip path working for any older plans while making state-code saves authoritative.

### `src/lib/plan-metrics.ts` (defensive)

When `zipData` is missing and `a.zip` looks like a 2-letter alpha code, fall back to `priceByState(zip)` instead of `getPriceByZip(zip)`. This makes legacy plans repaired on next save without breaking the current render.

## What does NOT need to change

- `PicturePlacePanel` — already invalidates `["my-plans"]` and sends the full feature patch.
- Other panels (`EditablePlanPanel`, `InvestVsSavePanel`, `MonthlyActionPlan`, `AssumptionsPanel`, `RecommendedAccountsPanel`) — they already derive numbers from `computePlanMetrics(selected.answers, selected.assumptions)`. Once `zipData` is correct, they update automatically on the next render after invalidation.
- DB schema — `target_price` is not persisted; it's always recomputed from `answers`, so no migration is needed.

## Verification

1. On `/features/picture`, switch the state from one value to another and click Save.
2. Navigate to `/features/editable`, `/features/invest`, `/features/assumptions`, and the dashboard — the target price and downstream numbers should match the new state.
3. Switching back also updates them.
