## Goals

1. Plus becomes a **$29 one-time purchase** (lifetime access). No more monthly/yearly Plus.
2. Pro pricing/UI gains a **"Coming soon" investing teaser** — eventual brokerage partnership to auto-invest funds toward the user's down payment goal.
3. Existing Plus monthly/yearly subscribers are **canceled in Paddle and converted to lifetime Plus**.

---

## 1. Paddle catalog changes

- Create new price `plus_lifetime` on the existing `plus_plan` product: $29 USD, **no recurring interval** (one-time), quantity 1–1.
- Archive (PATCH) old prices `plus_monthly` and `plus_yearly` so they cannot be checked out.
- Pro prices unchanged.

## 2. Subscription model — handle one-time purchase

The current `subscriptions` table is built around recurring (status, current_period_end, cancel_at_period_end). For a one-time Plus:

- Webhook handler: when `transaction.completed` fires for `plus_lifetime` (no subscription event will fire for one-time), insert a `subscriptions` row with:
  - `price_id = 'plus_lifetime'`, `product_id = 'plus_plan'`
  - `status = 'active'`
  - `current_period_end = NULL` (treated as "never expires" by existing `periodActive` logic)
  - `paddle_subscription_id` = transaction ID (since there's no sub ID) — needs unique handling
- Add `PLUS_PRICES` entry: `plus_lifetime` (alongside `plus_monthly`/`plus_yearly` for grandfathered legacy rows).
- `useSubscription` already treats null `current_period_end` as active — verify and keep that.
- `has_active_subscription` SQL helper: confirm it accepts NULL period_end as active for the lifetime case (likely needs a small migration).

## 3. UI: pricing page, upgrade modal, dashboard

**`src/lib/tier-features.ts`**
- Add a new entry at the top of `PRO_FEATURES`:
  ```
  { id: "investing", short: "Auto-invest your down payment (coming soon)",
    long: "We'll partner with a brokerage to invest your savings and reach your down payment goal faster — coming soon to Pro" }
  ```
- Add a `comingSoon?: boolean` flag on `TierFeature`; set true for `investing`.

**`src/components/UpgradeModal.tsx`**
- Plus tier card: remove monthly/yearly toggle for Plus. Show `$29` with `one-time` label instead of `/mo`.
- If `requiredTier === 'plus'`, hide the billing toggle entirely (Pro is the only tier with monthly/yearly).
- If both tiers are visible, render Plus as one-time and keep Pro toggle.
- Render features with `comingSoon` badge (small "SOON" chip in ember color).
- Use new price ID `plus_lifetime` for the Plus checkout call.

**`src/routes/pricing.tsx`**
- Same one-time framing for Plus, "SOON" badge on the investing line for Pro.
- Replace any "$9/mo" / "$86/yr" Plus copy with "$29 one-time · lifetime access".

**Dashboard / index / welcome** — sweep all hardcoded "$9", "/mo" near Plus; replace with the new framing. (Search hits above will guide it.)

## 4. Existing Plus subscribers — cancel & convert

One-shot migration script (run via `code--exec` against Paddle + DB):

1. Query `subscriptions` where `price_id IN ('plus_monthly','plus_yearly')` AND `status IN ('active','trialing','past_due')`.
2. For each: call Paddle `POST /subscriptions/{id}/cancel` with `effective_from: 'immediately'`.
3. Insert a new lifetime row: `price_id='plus_lifetime'`, `status='active'`, `current_period_end=NULL`, same `user_id`/`paddle_customer_id`, `paddle_subscription_id` = `legacy_convert_<old_sub_id>`.
4. Send an email (via existing `enqueue_email`) explaining: "Plus is now a one-time purchase. Your subscription was canceled and you have lifetime Plus access — no further charges."

Run separately for sandbox and live after publish.

## 5. Out of scope

- No new features for the investing flow itself — just marketing copy.
- No refunds for prepaid yearly Plus subscribers (they get lifetime Plus instead, which is net positive).
- Pro pricing untouched.

---

## Technical details

- Files touched: `src/lib/tier-features.ts`, `src/components/UpgradeModal.tsx`, `src/routes/pricing.tsx`, `src/routes/dashboard.tsx`, `src/routes/welcome.tsx`, `src/routes/index.tsx`, `src/hooks/useSubscription.ts` (PLUS_PRICES set), `src/routes/api/public/payments/webhook.ts` (handle `transaction.completed` for one-time), possibly small SQL migration for `has_active_subscription`.
- Paddle: `create_price plus_lifetime` (one-time), archive old Plus prices.
- Migration script: separate sandbox + live runs after deploy.
