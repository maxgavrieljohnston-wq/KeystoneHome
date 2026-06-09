## Changes to `src/components/dashboard/InvestVsSavePanel.tsx`

1. **"You're contributing" line should reflect saved value, not live income.**
   - Today, `statedMonthly` is derived from `computeSavingsCapacity(answers)`, so it changes the moment a user edits income/expenses in the Finance panel.
   - Switch the baseline to the persisted value: prefer `assumptions.investMonthly`, fall back to `answers.monthlySavings`, and only fall back to capacity if neither exists (new plans).
   - This baseline is what the "You're contributing $X/mo" copy, the "Reset" baseline, the delta-vs-baseline comparison, and the dirty check all use. The slider still moves freely; the headline only updates after Save.

2. **Remove the "Reset to your $X" button** from the slider footer. Replace that row with just the min/max labels (left/right), keeping the existing layout balanced.

3. **Show the % assumption next to each strategy row.**
   - In the `STRATEGIES.map(...)` block, pass the rate to `RateRow` and render it as a small mono label (e.g. `7.0%`) next to or under the strategy name. Use existing color tokens (`C.inkMute`) so it reads as secondary.

No changes to server functions, persistence shape, or other panels.
