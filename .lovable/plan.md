Move the Savings progress panel inside the PlanView sheet instead of below it.

**Approach:** `PlanView` already accepts a `footer` prop rendered inside its 640px column, before the "Made with Keystone" line. Pass the savings progress UI as that footer.

**Changes to `src/routes/dashboard.tsx`:**
1. Remove the standalone `<SavingsProgressPanel>` rendered after `<PlanView>`.
2. Refactor `SavingsProgressPanel` to render as a `Section`-style block (kicker label + bordered card) that fits inside the sheet — drop the outer `maxWidth: 640` wrapper and the top margin tuned for "below the sheet".
3. Pass it via `<PlanView plan={planForView} kicker="…" footer={<SavingsProgressPanel … />} />`.

**Out of scope:** No changes to `PlanView` itself, server functions, or other components.