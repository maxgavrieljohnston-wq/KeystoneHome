## Reframe "Path to deposit" → months saved by investing

The shared/example plan currently shows two required monthly contributions for the same fixed timeline:

- Save only: $X / mo
- Invest @ 7%: $Y / mo (smaller)

That buries the win as "a smaller number." Instead, hold the monthly contribution constant and show how much **sooner** investing gets them to the down payment.

### Change (single file: `src/routes/p.$slug.tsx`)

In the `Path to deposit` section (lines ~177–180):

1. Pick a single monthly contribution to compare against. Use, in order: `answers.monthlySavings` → `assumptions.investMonthly` → fall back to `savedOnly` (the current cash-only required monthly). Round to a clean dollar amount.
2. Compute time-to-goal at that monthly for both rates using `monthsToGoal(saved, downPayment, monthly, rate)` from `@/lib/invest-projection`:
   - `cashMonths = monthsToGoal(saved, downPayment, monthly, 0)`
   - `investMonths = monthsToGoal(saved, downPayment, monthly, returnRate)`
3. Render rows formatted as "X yr Y mo" (reuse the same `fmtMonths` helper used in `InvestVsSavePanel`; lift it into the file or inline a tiny copy):
   - `Save only` → `cashMonths`
   - `Invest @ 7%` → `investMonths` (bold, ember-tinted value)
4. Add a one-line callout under the rows: **"`Δ` months sooner with investing"**, where `Δ = cashMonths − investMonths`. Hide if non-positive or non-finite. Render in the theme's sage/positive color, JetBrains Mono eyebrow style.
5. Keep the section title `Path to deposit` and the monthly amount shown once as context (e.g., small eyebrow: `at $M/mo`).

### Edge cases

- If either value is `Infinity` (won't reach at that monthly), render `Won't reach` for that row and suppress the delta callout.
- If `monthly` resolves to 0, fall back to `savedOnly` so rows still render something meaningful.

### Out of scope

- No changes to the `InvestVsSavePanel` (dashboard) — it already uses this framing.
- No copy changes to other sections (`Monthly housing`, `Goal`).
- No schema / server-fn changes.
