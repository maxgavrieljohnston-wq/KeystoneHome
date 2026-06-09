## Merge "Plan" into Dashboard

Currently the icon bar's first item is **Plan** (`/features/plan`, renders `MonthlyActionPlan`), and **Dashboard** is a separate `/dashboard` page (PlanView + savings progress) with no icon. We collapse them: Dashboard becomes one of the icons, and its page also renders the monthly action plan.

### Changes

1. **`src/lib/dashboard-features.ts`**
   - Rename key `plan` → `dashboard`. Meta: `{ label: "Your dashboard", short: "Dashboard", icon: LayoutDashboard }` (from lucide-react).
   - `FEATURE_KEYS` becomes `["dashboard", "portfolio", "home", "accounts", "broker"]`.

2. **`src/components/dashboard/FeatureIconBar.tsx`**
   - Special-case the `dashboard` key so its `<Link>` goes to `/dashboard` (with `planId` search) instead of `/features/$key`.
   - Active highlight: pass `activeKey="dashboard"` from the dashboard page so it lights up there.

3. **`src/routes/dashboard.tsx`**
   - Below the existing `PlanView` + `SavingsProgressPanel`, render `<MonthlyActionPlan ...>` using the same props the feature page passes today (extras from `getDashboardExtras` are already fetched here).
   - Pass `activeKey="dashboard"` to `FeatureIconBar`.

4. **`src/routes/features.$key.tsx`**
   - Add redirect: `key === "plan"` → `/dashboard?planId=…`.
   - Remove the `case "plan"` branch (no longer needed).
   - Remove the "← Back to dashboard" button block (and the now-unused `ArrowLeft` import and `useNavigate` if not otherwise used).

### Out of scope

- No visual redesign of `MonthlyActionPlan`, `PlanView`, or the savings panel.
- No changes to the action-plan data model or server functions.

### Verification

- Icon bar shows 5 icons starting with **Dashboard**, and the Dashboard icon links to `/dashboard`.
- `/dashboard` shows the existing plan view, savings progress, AND the monthly action plan stacked.
- `/features/plan?planId=…` redirects to `/dashboard?planId=…`.
- Other feature pages (`portfolio`, `home`, `accounts`, `broker`) no longer show the "Back to dashboard" link — users navigate via the icon bar at the bottom.
