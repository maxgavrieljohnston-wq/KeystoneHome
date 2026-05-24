## Problem

Custom assumptions (`propertyTaxPct`, `insuranceAnnual`, `closingCostPct`, `movingCost`, `mortgageRatePct`, `expectedReturnPct`) **do** flow into the backend math — `computePlanMetrics(answers, assumptions)` honors every override, and Editable Plan, Invest vs Save, Risk Scenarios, and Monthly Action Plan all re-derive from that function via `useMemo([answers, assumptions])`.

The bug is on the write path: `AssumptionsPanel.save()` / `reset()` call `updatePlanMeta` but never invalidate the `["my-plans"]` query. So the dashboard keeps passing the stale `assumptions` prop into every panel until the user hard-refreshes. EditablePlanPanel already does this correctly — Assumptions just got missed.

## Fix (frontend-only)

**`src/components/dashboard/AssumptionsPanel.tsx`**
1. Import `useQueryClient` from `@tanstack/react-query`.
2. After `updateMeta(...)` succeeds in both `save()` and `reset()`, call `qc.invalidateQueries({ queryKey: ["my-plans"] })`.
3. Optimistic feel: also call `qc.setQueryData(["my-plans"], …)` to patch the active plan's `assumptions` in cache immediately, so the recompute happens on the same tick the user clicks Save (no flicker waiting for the refetch).

## Optional polish (ask before doing)

- **Debounced live preview while typing**: today values only apply on Save. We could auto-save 600ms after the last keystroke (Plus users only), so panels update as you type. Slightly more server traffic; nice UX. Default: leave Save-button behavior, add invalidation only.

## Verification

- Open `/dashboard`, change Property tax in Assumptions, hit Save → Editable Plan's monthly tax+ins, Invest vs Save timeline, Risk Scenarios chart, and Monthly Action Plan progress strip should all update without a page reload.
- Reset to defaults → same panels revert.
- Typecheck passes (no API surface changed).
