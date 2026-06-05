## Goal

Make the down-payment screen's DTI comparison unambiguous against the results page by surfacing both DTI numbers with the same labels and thresholds used in "What it costs to live there."

## Changes (single file: `src/routes/index.tsx`, `downGoal` screen)

1. Compute a second ratio alongside the existing `recDTI`:
   - `recFrontDTI = recHousing / grossMonthly` (housing-only ÷ gross)
   - Rename the existing value to `recBackDTI = (monthlyDebts + recHousing) / grossMonthly` for clarity.

2. Update the explanation copy so the DTI figure is explicitly labeled as back-end:
   - Replace `"yours would be ${(recDTI * 100).toFixed(0)}%"` with `"your back-end DTI would be ${(recBackDTI * 100).toFixed(0)}% (front-end ${(recFrontDTI * 100).toFixed(0)}%)"` in the two branches that currently mention it.
   - Keep the 43% cap framing (back-end is what lenders cap).

3. Add a small labeled readout under the price card (or directly above the explanation paragraph) that mirrors the results-page chip exactly:
   - `Front-end DTI {X}% (lenders prefer ≤28%) · Back-end DTI {Y}% (lenders prefer ≤36%)`
   - Same typographic treatment as the existing mono caption labels on this screen.

4. No changes to the offered down-payment options, recommendation logic, math, or the results page. Calculations already mirror `computePlanMetrics` per the prior fix — this is purely a labeling/disclosure change so users can compare like-for-like.

## Out of scope

- Aligning `effectiveDownPct`/`targetPriceOverride`/Plus assumption overrides between screens (that's option A — not requested).
- Any backend/server-fn changes.
