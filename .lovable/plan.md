# Keystone Paywall — Plus & Pro

Add a two-tier subscription paywall. Free users still get the basic plan outline; paid users unlock personalized planning, calculators, exports, alerts, and check-ins.

## Tiers & Pricing

| Tier | Monthly | Annual | Audience |
|---|---|---|---|
| Free | $0 | — | Top-of-funnel, exploring |
| **Plus** | $12 | $99 (~31% off) | Active planners, 6–24 mo out |
| **Pro** | $29 | $249 (~28% off) | Near-buyers, 0–6 mo out |

## Feature Matrix

| Feature | Free | Plus | Pro |
|---|---|---|---|
| Basic plan outline | ✓ | ✓ | ✓ |
| Dashboard + saved answers | ✓ | ✓ | ✓ |
| Personalized monthly action plan | — | ✓ | ✓ |
| Affordability calculator (live by-ZIP rates) | — | ✓ | ✓ |
| Down payment tracker w/ milestones | — | ✓ | ✓ |
| Credit score roadmap | — | ✓ | ✓ |
| Monthly progress check-in emails | — | ✓ | ✓ |
| Lender-ready summary PDF export | — | — | ✓ |
| Pre-approval prep checklist + doc upload | — | — | ✓ |
| Rate watch alerts | — | — | ✓ |
| AI advisor chat | — | — | ✓ |

## User Flow

```text
Questionnaire → Email capture → Free plan outline reveal
                                        ↓
                              [Soft paywall section]
                              "Unlock your full plan"
                              ┌──────────┬──────────┐
                              │   Plus   │   Pro    │
                              │  $12/mo  │  $29/mo  │
                              └─────┬────┴────┬─────┘
                                    ↓         ↓
                              Stripe Checkout (test or live)
                                    ↓
                              Success → /dashboard
                                    ↓
                              Premium tabs unlocked
                                    ↓
                              Free users see "Upgrade" lock cards
```

## What we'll build

### 1. Payments setup
- Enable **Lovable's built-in Stripe payments** (no API keys needed).
- Create Plus and Pro products with monthly + annual prices.
- Tax option **2 (calculation only)** by default — fits a US digital subscription without locking us out of international buyers later.

### 2. Subscription schema
- `subscriptions` table: `user_id`, `tier` (`free|plus|pro`), `status`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end`, `cancel_at_period_end`.
- RLS: users read their own row only; service role writes.
- Helper: `get_my_tier()` server function returning `'free' | 'plus' | 'pro'` for use across UI + server gates.

### 3. Stripe webhook
- `/api/public/stripe-webhook` route, signature verified.
- Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → keeps `subscriptions` row in sync.

### 4. Paywall UI on plan reveal (in `src/routes/index.tsx`)
- After the existing free plan outline, append a **pricing section** (Plus / Pro side-by-side, annual toggle).
- "Most popular" badge on Plus annual.
- Each CTA → Stripe Checkout (passes user email + selected price).
- "Maybe later" link → continues to `/dashboard` on Free.

### 5. Dashboard upgrades (`src/routes/dashboard.tsx`)
- New left-rail / tabbed nav:
  - Plan summary (existing)
  - Action plan (Plus+)
  - Affordability (Plus+)
  - Savings tracker (Plus+)
  - Credit roadmap (Plus+)
  - Lender PDF (Pro)
  - Pre-approval (Pro)
  - Rate alerts (Pro)
  - Advisor chat (Pro)
- Locked tabs render a **gated card** with the feature description + upgrade CTA.
- "Manage subscription" button → Stripe customer portal.

### 6. Premium feature implementations (v1)
- **Action plan**: generated via Lovable AI (`google/gemini-2.5-flash`) from saved answers — month-by-month savings/debt/credit moves.
- **Affordability calculator**: client-side form + standard 28/36 DTI math; rate input defaults to a current national avg constant (manual update to start, rate API later).
- **Savings tracker**: simple `savings_progress` table (user_id, current_amount, goal_amount, updated_at), edit form + progress bar + milestone copy.
- **Credit roadmap**: AI-generated ranked actions from credit score + answers.
- **Lender PDF**: server function builds branded PDF (react-pdf) from saved plan, returns download URL.
- **Pre-approval checklist**: static checklist with persistent check state per user (`checklist_items` table) + Lovable Cloud Storage bucket for doc uploads.
- **Rate alerts**: `rate_alert_subscriptions` table (user_id, target_rate, zip). Daily cron compares against stored current rate; sends branded email when triggered. (Rate value updated manually for v1; auto-pull later.)
- **Advisor chat**: Lovable AI chat (`openai/gpt-5-mini`) seeded with user's plan as system context. Stored per-thread in `advisor_messages`.

### 7. Monthly check-in emails (Plus+)
- pg_cron job, monthly per user.
- Branded react-email template (matches existing magic-link style) summarizing progress + next month's focus.

### 8. Server-side gating
- All premium server functions wrap `requireSupabaseAuth` + a `requireTier('plus' | 'pro')` middleware that reads `subscriptions` and 403s if insufficient.
- UI hides/locks but the server is the source of truth.

## Out of scope (follow-ups)
- Live mortgage rate API integration (manual constant in v1).
- Plaid for bank-linked savings tracking.
- Team/family plans.
- Refund/proration UI (Stripe portal handles for now).

## Technical notes

- **Provider**: Lovable's built-in Stripe payments (`enable_stripe_payments`). Test mode auto-provisioned; live requires account claim.
- **New routes**: `src/routes/api/public/stripe-webhook.ts`, `src/routes/api/public/cron/monthly-checkins.ts`, `src/routes/api/public/cron/rate-alerts.ts`, dashboard becomes a layout with child tab routes under `src/routes/dashboard/`.
- **New server fns** in `src/lib/`: `subscription.functions.ts`, `action-plan.functions.ts`, `affordability.functions.ts`, `savings.functions.ts`, `credit.functions.ts`, `lender-pdf.functions.ts`, `advisor.functions.ts`.
- **New tables**: `subscriptions`, `savings_progress`, `checklist_items`, `rate_alert_subscriptions`, `advisor_messages`.
- **New email templates**: `monthly-checkin.tsx`, `rate-alert.tsx`.
- **New deps**: `@react-pdf/renderer` (for lender PDF). Stripe SDK comes with the payments integration.
- **AI**: uses existing `LOVABLE_API_KEY` via Lovable AI Gateway — no extra keys.
- **Cron**: pg_cron hitting the public cron routes on the stable `project--{id}.lovable.app` URL.

## Build order (so each step is shippable)

1. Enable Stripe payments + create Plus/Pro products.
2. `subscriptions` table + webhook + checkout flow + paywall section on index.
3. Dashboard tab layout + gated cards + Stripe portal link.
4. Action plan + savings tracker + affordability calc + credit roadmap (Plus features).
5. Lender PDF + pre-approval checklist + advisor chat (Pro features).
6. Monthly check-in emails + rate alerts cron.
