Add a "Savings progress" panel to the bottom of the Dashboard that shows how much the user has saved toward their down-payment goal.

**Placement:** Render it after `<PlanView>` and before `<FeatureIconBar>` so it sits near the bottom of the page body.

**Design (match PlanView editorial style):**
- Use the same `paper`/`ink` color tokens and `Cormorant Garamond` / `JetBrains Mono` typography.
- Section label in mono uppercase.
- Large serif figure for current savings and goal amount.
- A thin horizontal progress bar (4 px, `ember` fill on `inkFaint` track).
- A small mono caption showing "X% of $Y down payment".

**Data:**
- `currentSavings` comes from `selected.current_savings`.
- `downPayment` can be computed with the same helper used by `PlanView` (`calcRequiredMonthly`, `rateFromCredit`, etc., imported from `@/lib/keystone`), or via `computePlanMetrics` if still available in the dashboard.
- Percent = `saved / downPayment * 100`, clamped at 100.

**Files:**
- `src/routes/dashboard.tsx` — add the new panel component inline or import it, wire it into the JSX between `PlanView` and `FeatureIconBar`.
- No changes to `PlanView`, example route, server functions, or schema.

**Out of scope:** No edits to the Reset / Download PDF buttons, header, or FeatureIconBar.