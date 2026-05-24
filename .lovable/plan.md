## Plan: Move Monthly Action Plan to its own page

### Changes

**1. `src/lib/dashboard-features.ts`**
- Add `"plan"` to `FEATURE_KEYS` (placed first).
- Add entry: `plan: { label: "Your monthly action plan", short: "Plan", icon: CalendarCheck }`.

**2. `src/routes/features.$key.tsx`**
- Import `MonthlyActionPlan` + `getDashboardExtras` data already loaded.
- Add `case "plan":` that renders `<MonthlyActionPlan>` with the same props currently passed on the dashboard (`planId`, `planCreatedAt`, `answers`, `assumptions`, `currentSavings`, `targetMoveIn`, `shareEnabled`, `remindersEnabled`, `lenderDocCount`, `initialProgress`).

**3. `src/routes/dashboard.tsx`**
- Remove the `<MonthlyActionPlan>` block (and the now-unused import + `ActionPlanProgress` type if unused elsewhere).
- Dashboard then shows only the numbers + greeting + feature icon bar (the icon bar now includes the new Plan icon, accessible from every page).

### Result
- New route: `/features/plan` shows the Monthly Action Plan.
- The icon bar (already on dashboard and all feature pages) gains a "Plan" icon linking there.
- Dashboard becomes purely the numbers summary.
