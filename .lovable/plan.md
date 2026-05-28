## Goal

On the live app, every Pro upgrade entry point shows **"Coming Soon"** instead of opening checkout. A single allowlisted test account continues to see Pro CTAs and keeps full access to Pro features for QA.

## Approach

One central flag + a tiny allowlist, checked everywhere a Pro purchase or Pro CTA is rendered. Existing Pro entitlement logic (`useSubscription`) is untouched — the seeded test Pro subscription keeps working for the test user; non-allowlisted users simply can never start a new Pro checkout.

### 1. New module: `src/lib/pro-availability.ts`

- Exports `PRO_COMING_SOON = true` (single toggle to flip when Pro launches).
- Exports `PRO_TEST_EMAILS: string[]` — hardcoded allowlist (1 email, the seeded pro test account). Comparison is lowercase-trim.
- Exports `useProAvailable()` hook:
  - Reads current Supabase user.
  - Returns `{ proAvailable: boolean, isTester: boolean }`.
  - `proAvailable = !PRO_COMING_SOON || isTester`.

### 2. UI gating (frontend only — no visual redesign)

Every place that currently renders a Pro purchase CTA or routes the user toward Pro checkout gets the same treatment: if `proAvailable` is false, render the existing button/card but with the label **"Coming Soon"**, disabled styling (existing disabled token), and no click handler. Layout, spacing, typography untouched.

Touched files:
- `src/components/UpgradeModal.tsx` — Pro tier card: replace CTA + disable `handlePick` for Pro; when `requiredTier === "pro"` and Pro isn't available, swap the headline subtext to "Pro is launching soon — we'll email you when it's ready." Plus tier untouched.
- `src/routes/pricing.tsx` — Pro plan card CTA → "Coming Soon", disabled.
- `src/routes/index.tsx` — any paywall/report upsell that links to Pro (Plus paywall stays).
- `src/routes/coach.tsx`, `src/routes/market.tsx`, `src/routes/documents.tsx`, `src/routes/broker-match.tsx`, `src/routes/features.$key.tsx` — Pro feature pages already gate via `useUpgradeGate`. Update those upgrade screens to show "Coming Soon" copy + disabled CTA when not a tester.
- `src/hooks/useUpgradeGate.tsx` — when `requireTier("pro", …)` is called and user isn't a tester, the modal still opens but only shows the "Coming Soon" state (handled inside `UpgradeModal` via the same flag — no API change to callers).

### 3. Server-side hard stop

`src/lib/payments.functions.ts` `createCheckoutSession`:
- After auth, if `priceId` starts with `pro_` and `user.email` not in `PRO_TEST_EMAILS`, return `{ error: "Pro is coming soon." }`.
- Allowlist constant lives in `src/lib/pro-availability.ts` and is imported on both client and server (it's safe — emails only).
- Prevents anyone bypassing UI via direct RPC.

### 4. Existing test account

No DB changes needed. The account seeded by `scripts/create-pro-test.ts` already has an active Pro subscription row; add its email to `PRO_TEST_EMAILS`. You (the user) tell me the email to allowlist, or I'll leave a `// TODO add email` placeholder you fill in. The dev-only `dev_bypass_pro` localStorage flag in `useSubscription` is left as-is for local preview.

### 5. To flip Pro live later

Set `PRO_COMING_SOON = false` in one file. Everything reverts.

## Out of scope

- No DB migrations.
- No changes to `useSubscription`, webhook handler, or tier resolution.
- No changes to Plus tier — Plus stays fully purchasable.
- No copy/visual redesign beyond swapping CTA label and one subtitle.

## One question before I build

Which email should I hardcode into `PRO_TEST_EMAILS`? (e.g. your personal email, or do you want me to create a fresh `keystone-pro-tester@…` via the existing seed script and use that?)
