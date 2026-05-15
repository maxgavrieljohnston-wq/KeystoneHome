# Plan: Plus placeholder + 4 new Pro features

Five routes total. Each gated by the right tier in `tier-features.ts`. All follow existing patterns (server fns + supabaseAdmin, Pro/Plus gating, themed pages, dashboard tile).

---

## 0. Plus tier — `/accounts` (placeholder, back-burner)

New Plus feature `accounts` ("Recommended investment accounts"). Static page listing categories with "Coming soon" cards where affiliate links will go:
- High-yield savings (Marcus, Ally, Wealthfront Cash)
- Roth IRA brokerages (Fidelity, Schwab, Vanguard)
- Taxable brokerages (Fidelity, Schwab, M1)
- Treasury / T-bill platforms (TreasuryDirect, Public)
- HSA providers (Fidelity HSA, Lively)

No backend. Just typed config array in `src/lib/recommended-accounts.ts` with `{ category, name, blurb, affiliateUrl: null }`. When you have partners I swap the `null`s and add UTM tracking.

**Files:** `src/routes/accounts.tsx`, `src/lib/recommended-accounts.ts`. Update `tier-features.ts` and dashboard tile.

---

## 1. Pro — `/stress-test` (Affordability stress-test simulator)

Plan-aware page with sliders:
- Mortgage rate: −2% to +2% (default 0)
- Income: −20% to +20%
- Monthly expenses: −$500 to +$500
- Home price: −15% to +15%

Live recompute via existing `computePlanMetrics` + `projectScenarios`. Output:
- New estimated move-in date
- Required monthly savings to hit original target
- Δ vs baseline (red/green chips)
- "Survives a 1% rate shock?" / "Survives 10% income loss?" badges

All client-side math. No new server fn — reuses existing helpers.

**Files:** `src/routes/stress-test.tsx`, `src/lib/stress-test.ts` (helper).

---

## 2. Pro — `/market` (City/market intelligence)

Pulls market stats for the user's target city from a free public API. Recommended source: **Census Bureau ACS API** (no key, free) for median home value + median household income → price-to-income ratio. Supplement with **FRED** (already used for rates) for state-level home price index trend.

For ZIP-level granularity later: RentCast API ($0/100 calls/mo free tier) — defer until needed.

Output card per plan:
- Median home price (city)
- Median household income (city)
- Price-to-income ratio + verdict ("affordable / stretched / unaffordable")
- 1-yr state HPI change (sparkline)
- "Your target price vs city median" delta

Server fn `getMarketSnapshot({ city, state })` with 24h cache in a new `market_snapshots` table (city+state composite key, JSON payload, fetched_at).

**Files:** `src/routes/market.tsx`, `src/lib/market.functions.ts`. Migration: `market_snapshots` table.

---

## 4. Pro — `/documents` (Lender pre-qual checklist + doc vault)

Guided checklist with file upload to private Supabase storage:
- W-2s (last 2 yrs)
- Tax returns (last 2 yrs)
- Pay stubs (last 30 days)
- Bank statements (last 2 months)
- ID
- Gift letter (optional)
- Employment verification letter (optional)

Each row: status (missing / uploaded / verified), file count, upload button. Files go to private `lender-docs` bucket scoped by `user_id/checklist_item/filename`. Server fns for upload URL signing, list, delete.

Migration:
- `lender_documents` table (user_id, checklist_item enum, file_path, file_name, file_size, mime_type, status)
- Private storage bucket `lender-docs` with RLS scoping objects to `auth.uid()` folder prefix

Pro-gated. Foundation for future broker handoff (broker can request access, you grant a signed URL).

**Files:** `src/routes/documents.tsx`, `src/lib/documents.functions.ts`. Migration: table + bucket + RLS.

---

## 8. Pro — Promote `broker_waitlist` → `/broker-match`

The `broker_waitlist` table already exists with `priority` flag for Pro. Convert the existing waitlist UX into a real matching flow:

- Page: `/broker-match` (Pro-gated)
- User fills form: target city/state, budget range, timeline, financing preference (conventional/FHA/VA), language preference
- We store the request in a new `broker_match_requests` table
- Status states: `pending → matched → introduced → closed`
- Pro users see `priority: true` and "We'll match you within 48h" copy
- Admin email fires to you when a Pro request comes in (using existing `enqueue_email`)
- For now no actual broker DB — you manually match and update status. Can promote to a `brokers` table + automated matching later.

Migration:
- `broker_match_requests` table (user_id, plan_id nullable, target_city, target_state, budget_min, budget_max, timeline_months, loan_type, language, status, matched_broker_name nullable, matched_broker_contact nullable, notes, created_at)
- RLS: users see own requests; service role manages

**Files:** `src/routes/broker-match.tsx`, `src/lib/broker-match.functions.ts`. Migration. Replace existing waitlist CTA with the new flow.

---

## tier-features.ts updates

```ts
PLUS_FEATURES: add { id: "accounts", short: "Recommended accounts", long: "Curated investment & savings accounts to grow your down payment faster" }

PRO_FEATURES: add
  { id: "stress", short: "Affordability stress-test", long: "Stress-test your plan against rate shocks, income drops, and price changes" }
  { id: "market", short: "City market intelligence", long: "Live local market data: median price, price-to-income, trend" }
  { id: "docs", short: "Lender pre-qual doc vault", long: "Guided checklist + secure storage for your mortgage application" }
  { id: "broker", short: "Realtor & broker matching", long: "Get matched with vetted realtors and mortgage brokers in your market (priority for Pro)" }
```

That brings Pro to 7 features (coach, compare, alerts, stress, market, docs, broker).

---

## Build order (3 turns)

**Turn 1:** Updates to `tier-features.ts`, dashboard tiles, `/accounts` placeholder, `/stress-test` (no migrations).

**Turn 2:** Migration for `market_snapshots` + `/market`. Migration for `lender_documents` + `lender-docs` bucket + `/documents`.

**Turn 3:** Migration for `broker_match_requests` + `/broker-match`. Hook in admin email notification.

---

## Out of scope (call out now)

- Actual affiliate links for `/accounts` — placeholders only until you provide partners
- Real broker database / automated matching — manual matching for now
- Document OCR / verification automation — future
- ZIP-level market data — Census city-level only for now
- File preview in doc vault — just upload/download

OK to proceed?
