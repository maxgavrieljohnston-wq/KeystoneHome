# Plaid sync as the subscription anchor

The pitch: connect your savings, checking, and brokerage accounts. Keystone watches your real balances and recomputes your "months to ready" every week. Cancel and the live tracker freezes — you only see the manual numbers you typed in.

This is the strongest possible anchor for a monthly sub: people don't unplug something that's wired into their bank accounts and silently working in the background.

## What the user sees

**Dashboard "Live readiness" panel** (replaces the static down-payment number)
- Connect button → Plaid Link modal → pick accounts to count toward the down payment
- Once connected: total saved, weekly delta ("+$420 this week"), months-to-ready, and a sparkline of the last 12 weeks
- "On track / behind / ahead" badge based on plan target vs actual pace

**Weekly snapshot email** (Plus + Pro)
- Every Monday: balance, change since last week, change since plan start, months-to-ready
- Tied to existing reminders system (already in `reminders.functions.ts`)

**Pro extras on top of the same connection**
- **Spending breakdown**: top 5 categories from connected checking, with one specific "if you trim $X here, you reach your goal N months sooner" suggestion
- **Auto-save streak**: how many weeks in a row the user hit their savings target
- **Snapshot history chart**: full month-over-month chart instead of just 12 weeks

## Tier split

| Capability                           | Free | Plus | Pro |
|--------------------------------------|------|------|-----|
| Connect 1 account                    |      | ✓    | ✓   |
| Connect up to 6 accounts             |      |      | ✓   |
| Live balance + months-to-ready       |      | ✓    | ✓   |
| Weekly snapshot email                |      | ✓    | ✓   |
| 12-week sparkline                    |      | ✓    | ✓   |
| Full snapshot history                |      |      | ✓   |
| Spending breakdown + savings tip     |      |      | ✓   |
| Auto-save streak                     |      |      | ✓   |

## How retention works

Free → Plus conversion driver: the connect button is visible to free users, but clicking it shows the upgrade modal. ("See your real progress, not what you typed in 3 months ago.")

Plus → Pro upgrade driver: spending breakdown is the bait. Once people see "you spent $640 on takeout last month — that's 2.1 months of progress," they upgrade.

Cancellation friction: when a user cancels, the connection isn't deleted — it's paused. The dashboard shows "Reconnect to resume tracking" with the last known snapshot frozen. One click brings it back.

## Technical plan

**1. Plaid setup**
- Add Plaid as a custom integration (not in the connector list — it requires per-end-user OAuth, so the Lovable Plaid connector would only work for one developer account)
- Add secrets: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox` for preview, `production` for published)
- Use Plaid Link via the `react-plaid-link` package on the frontend
- Server functions handle: `createLinkToken`, `exchangePublicToken`, `fetchBalances`, `fetchTransactions` (Pro only), `disconnectItem`

**2. Database**
New tables:
- `plaid_items` — one row per connected institution (user_id, item_id, access_token (encrypted), institution_name, status, environment)
- `account_links` — accounts the user opted into for tracking (item_id, plaid_account_id, name, type, mask, include_in_down_payment)
- `balance_snapshots` — weekly balance per account (account_id, balance, captured_at) — this is what powers the chart and "behind/ahead" math
- `spending_summaries` — Pro only, monthly aggregate per category (user_id, month, category, amount)

All write paths through server functions with `supabaseAdmin` (matches existing pattern from memory). Access tokens encrypted at rest with `pgsodium` or app-level AES with a key from secrets.

**3. Weekly snapshot job**
- Add a cron-triggered route at `/api/public/snapshots/run` (matches existing `/api/public/reminders/dispatch` pattern, same `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` auth)
- Loops active `plaid_items`, calls Plaid `/accounts/balance/get`, writes to `balance_snapshots`, enqueues weekly email if it's Monday
- pg_cron schedule: every day at 7am user-local (or just UTC for v1)

**4. Tier gating**
- New `plaid` feature in `tier-features.ts` (Plus) and `plaid_spending` (Pro)
- `useUpgradeGate("plus", "Live account sync")` on the connect button for free users
- Server-side: every Plaid server fn checks `has_active_subscription` before refreshing balances; expired subs get a 402 and the UI shows the frozen snapshot

**5. Plaid sandbox vs production**
- Mirror the existing Paddle sandbox/live pattern
- Preview uses Plaid sandbox creds, published uses production
- Store `environment` on `plaid_items` so a sandbox-connected account in preview never appears for the same user in published

## Scope of this build

In scope:
- Plaid Link onboarding flow + connect/disconnect
- Live balance display + weekly snapshot persistence
- 12-week sparkline + months-to-ready math
- Weekly email
- Plus/Pro gating

Out of scope for v1 (follow-up work):
- Pro spending breakdown + savings tip
- Auto-save streak
- Full history chart
- Multi-institution support beyond 6 accounts

## Risks worth flagging

- **Plaid pricing**: free tier is generous in sandbox, but production charges per connected item per month (~$0.30-$1.20 depending on products used). Worth checking the math: at $5/mo Plus, even one connected item with Transactions enabled eats meaningful margin. Recommendation: Plus = Balance product only (cheap), Pro = Balance + Transactions (the spending features).
- **Plaid production access** requires an application — Plaid reviews your app before granting production keys. Sandbox works immediately. Plan for a 1-2 day review delay before launch.
- **Token security**: access tokens are bank-grade credentials. Must be encrypted at rest, never returned to the client, and rotated if a breach is suspected.
- **Free trial risk**: if you offer a free trial, someone could connect, see their data, cancel, and never pay. Mitigation: no trial, or trial that doesn't unlock Plaid until day 3.

## What needs your input before I build

1. **Plaid account**: I'll need you to create a Plaid developer account at dashboard.plaid.com and share the Client ID + Sandbox Secret. I'll request these via the secret tool when we start.
2. **Free tier limit**: should free users see the connect button at all (as upsell bait), or hide it completely?
3. **Trial**: any free trial on Plus, or straight to paid?
