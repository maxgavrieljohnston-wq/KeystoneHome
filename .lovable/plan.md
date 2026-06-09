## Make the Dashboard look like the example plan

Reuse the exported `PlanView` component from `src/routes/p.$slug.tsx` (already used by `/example`) to render the dashboard body in the same editorial cream-paper layout. Keep the existing chrome: header (plan switcher + log out), the `Download PDF` / `Reset to original plan` buttons, and the feature icon bar.

### Single file change: `src/routes/dashboard.tsx`

1. Import `PlanView`, type `PlanViewPlan` from `./p.$slug`.
2. In `DashboardPage`, after computing `selected`, build a `PlanViewPlan` object from it:
   - `title`, `theme`, `answers`, `assumptions`, `current_savings`, `target_move_in`, `created_at` mapped 1:1 from the selected `PlanRow`.
3. Replace the current body (`Welcome back…` greeting + `NumbersSummary`) with `<PlanView plan={planForView} kicker="— Your plan, dialed in" />`.
4. Keep above `PlanView`:
   - The existing header (Dashboard eyebrow + plan selector / title + Log out).
   - `<DashboardActions planId={selected.id} />` (Download PDF + Reset buttons).
5. Keep below `PlanView`:
   - `<FeatureIconBar selectedPlanId={selectedId} />`.
6. Delete the now-unused `NumbersSummary` and `ComparisonRow` components and the `computePlanMetrics` / `computeTimeToGoal` / `formatMonths` / `fmtCurrency` imports/helpers (only if no longer referenced).
7. Outer container: keep the existing `maxWidth: 960` wrapper so header + buttons + icon bar stay aligned; `PlanView` provides its own inner `maxWidth: 640` column, which matches the example page's feel.

### Out of scope

- No changes to `PlanView` itself, the example route, or any server functions.
- No change to the action button styling or behavior.
- No change to feature icon bar contents or routes.
- No schema / data changes.

### Visual result

Dashboard top → header with plan name + Log out → Download PDF / Reset buttons → editorial PlanView (Target price hero, Down payment / Cash to close, Monthly housing, Path to deposit with months-sooner callout, Goal) → feature icon bar.
