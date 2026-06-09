## Combine Finances + Invest into "Portfolio"

Right now the feature icon bar has six entries: Plan, Finances (`editable`), Invest, Home, Accounts, Broker. We collapse `editable` and `invest` into one feature, keyed `portfolio`, labeled **Portfolio**.

### Changes

1. **`src/lib/dashboard-features.ts`**
   - Replace `editable` and `invest` keys with a single `portfolio` key.
   - New entry: `portfolio: { label: "Your portfolio", short: "Portfolio", icon: TrendingUp }` (or `PiggyBank` — pick one; I'll use `TrendingUp` since it covers both saving + investing).
   - `FEATURE_KEYS` becomes: `["plan", "portfolio", "home", "accounts", "broker"]`.

2. **`src/routes/features.$key.tsx`**
   - In `beforeLoad`, add redirects from the legacy keys `editable` and `invest` → `portfolio` (preserving `planId`), same pattern used today for `picture`/`assumptions` → `home`.
   - Remove the separate `case "editable"` and `case "invest"` branches; add one `case "portfolio"` that renders **both** panels stacked, with `EditablePlanPanel` first and `InvestVsSavePanel` below it, separated by a 24px spacer (matches the `home` case pattern).

3. **No changes** to `EditablePlanPanel.tsx` or `InvestVsSavePanel.tsx` themselves — they stay as-is and just render together under the new route.

4. **No dashboard.tsx changes needed** unless it hard-codes those keys; if it does, swap to `portfolio` (will verify during implementation).

### Out of scope

- No visual redesign of either panel — just colocating them under one feature page.
- No data/server changes.

### Verification

- `/features/editable?planId=…` and `/features/invest?planId=…` both redirect to `/features/portfolio?planId=…`.
- Icon bar shows 5 items ending with Portfolio in place of Finances + Invest.
- Portfolio page renders Finances panel then Invest panel; editing income/etc. still updates the dashboard.
