# Invest-vs-Save Tier Features

Reinforces the core thesis (invest → reach down payment faster) inside Plus and Pro tiers, and lays groundwork for a future broker integration.

---

## Plus tier

### 1. Invest vs. Save projection (dashboard)
A hero panel on the dashboard, gated by `isPlus`, showing three side-by-side timelines to reach the down payment goal:

- **Savings account** (~0.5% APY)
- **High-yield savings** (~4% APY)
- **Invested** (~7% blended return)

Each card displays months to goal, total contributed, and dollars earned via growth. Headline stat: *"Investing gets you there X months sooner and saves you $Y in contributions."* Reuses the existing `calcRequiredMonthly` math from `lib/keystone.ts`.

### 2. Time-to-Down-Payment Accelerator
Interactive slider directly under the projection: "If you invested $X/mo at Y% return…" Live recompute of months-to-goal as the user drags. No persistence — purely educational.

### 3. Monthly Investment Plan PDF
"Download Investment Plan" button on the dashboard. Server function generates a branded one-pager via `@react-pdf/renderer` (or jsPDF — will pick whichever is already in deps, otherwise jsPDF for zero added native deps):

- Goal, timeline, target down payment
- Recommended monthly contribution at each return scenario
- Allocation guidance by timeline (HYSA / conservative mix / growth)
- Plain-English disclaimer ("educational, not advice")

### 4. Recommended accounts section
A "Where to put your money" panel on the dashboard. For now, a stylish placeholder card explaining: *"We're curating account recommendations — coming soon. As a Plus member you'll get our shortlist of HYSAs, brokerages, and robo-advisors matched to your timeline."* Structured so we can later swap in a `RECOMMENDED_ACCOUNTS` data file without touching layout.

---

## Pro tier

### 5. Risk-adjusted scenarios
Pro-only expansion of the projection panel: Conservative (4%), Balanced (6%), Growth (8%) with downside bands (±2% on the projected end balance). Rendered as a small SVG chart (no chart lib needed) showing the three trajectories.

### 6. Coach context: invest-vs-save delta
Augment `coach.functions.ts` system prompt with the user's current invest-vs-save delta (months saved, dollars saved) so the coach can naturally reference it in answers.

### 7. Broker waitlist
- New table `broker_waitlist` (email, user_id, tier_at_signup, priority, notes, created_at) — RLS on, written via SECURITY DEFINER RPC `join_broker_waitlist`.
- Plus users see "Join broker waitlist" button.
- Pro users see "Priority access — you're at the front of the line" with one-click join.
- Simple confirmation toast; no admin UI yet.

---

## Technical notes

**Files added**
- `src/lib/invest-projection.ts` — pure math: `projectScenarios({ saved, target, years })` returning months/contributions/growth for 0.5/4/7%.
- `src/components/dashboard/InvestVsSavePanel.tsx` — Plus-gated projection + accelerator slider.
- `src/components/dashboard/RecommendedAccountsPanel.tsx` — Plus-gated placeholder, data-driven for future.
- `src/components/dashboard/RiskScenariosPanel.tsx` — Pro-gated scenario chart.
- `src/components/dashboard/BrokerWaitlistPanel.tsx` — Plus/Pro CTA, calls `joinBrokerWaitlist`.
- `src/lib/broker-waitlist.functions.ts` — `joinBrokerWaitlist`, `getMyWaitlistStatus`.
- `src/lib/investment-pdf.functions.ts` — `generateInvestmentPlanPdf` server fn returning a base64 PDF.
- `src/data/recommended-accounts.ts` — empty exported `RECOMMENDED_ACCOUNTS = []` plus type, ready for future content.

**Files edited**
- `src/routes/dashboard.tsx` — mount the new panels under existing summary, ordered Plus → Pro.
- `src/lib/coach.functions.ts` — inject invest-vs-save delta into the system prompt.

**DB migration**
- `broker_waitlist` table + `join_broker_waitlist` RPC (SECURITY DEFINER, validates auth.uid()/email).

**Gating**
- All UI uses `useSubscription()` (`isPlus` / `isPro`) and `useUpgradeGate()` to open the existing upgrade modal for free users who click a locked CTA.

**Dependencies**
- PDF: prefer `jspdf` (small, no native deps, Worker-safe) — `bun add jspdf` if not present.
- No other new deps.

**Out of scope for this pass**
- Real broker API integration.
- Actual curated account list (data-only swap later).
- Admin view for waitlist (query DB directly for now).
- Email notification when waitlist opens.
