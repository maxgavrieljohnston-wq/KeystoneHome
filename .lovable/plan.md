## Goal

Track which upgrade surface (modal / sticky / paywall / pro_link / inline_nudge) drives signups. Last-click attribution, in-app data with a small admin view.

## Surfaces being instrumented

| `source` value | Where |
|---|---|
| `paywall_plus` | End-of-report "Start Plus" CTA (`ReportPaywall`) |
| `paywall_pro_link` | "See Pro" secondary text link under that CTA |
| `paywall_pro_card` | Pro lock card lower on the paywall |
| `inline_nudge` | `InlineUpgradeNudge` (mid-flow) |
| `sticky_bar` | `StickyUpgradeBar` (mobile bottom bar) |
| `modal_plus` / `modal_pro` | Tier buttons inside `UpgradeModal` |

## Data model

New table `upgrade_events` (RLS on, service-role writes only):

- `id uuid pk`
- `event_type text` — `cta_click` | `checkout_open` | `checkout_success`
- `source text` — one of the values above
- `tier text` — `plus` | `pro`
- `user_id uuid null`, `email text null`, `session_id text null` (anon cookie/localStorage UUID for pre-auth attribution)
- `plan_id uuid null` (when known)
- `metadata jsonb`
- `created_at timestamptz default now()`
- Indexes on `(source, created_at)` and `(session_id)`

Service-role-only ALL policy. A SECURITY DEFINER RPC `log_upgrade_event(...)` lets anon/authenticated clients insert validated events without exposing the table (matches the existing pattern for `leads` / `upsert_lead`).

## Client flow

1. New util `src/lib/upgrade-tracking.ts`:
   - `getOrCreateSessionId()` — UUID in `localStorage`.
   - `trackUpgradeEvent({ event_type, source, tier, ... })` — calls the `log_upgrade_event` RPC; fire-and-forget, swallows errors.
2. Extend `useUpgradeGate.openUpgrade(tier, feature, source)` with a required `source` arg, store it in state, log `cta_click` immediately, and forward it to `<UpgradeModal />`.
3. Update every call site in `src/routes/index.tsx` (paywall Plus CTA, Pro link, Pro card, inline nudge, sticky bar) to pass its `source`.
4. `UpgradeModal`'s tier button handler logs `cta_click` with `source: modal_plus|modal_pro` (when the user clicks a tier inside the modal — distinct from the surface that opened it). Then before `openCheckout`, log `checkout_open` and pass `source` into `customData`.
5. `usePaddleCheckout.openCheckout` accepts and forwards `source` in `customData`; `successUrl` gets `?src={source}` so the `/welcome` page can log `checkout_success` client-side as a backup.

## Server-side attribution

- `src/routes/api/public/payments/webhook.ts`: in `handleSubscriptionCreated` and `handleTransactionCompleted`, read `data.customData?.source` and insert a `checkout_success` row into `upgrade_events` linked to `user_id`. This is the authoritative signup event.
- Store `source` on the `subscriptions` row too via a new nullable `attribution_source text` column, so the admin view can join cleanly.

## Admin view

- New protected route `src/routes/_authenticated/admin/upgrade-funnel.tsx` (gated behind a server fn that checks the caller's email against an allowlist env var `ADMIN_EMAILS`).
- Server fn `getUpgradeFunnel({ since })` aggregates from `upgrade_events`:
  - clicks, checkout opens, paid signups, click→paid % per `source`, 7 / 30 day windows.
- Simple table UI, no charts.

## Out of scope

- No third-party analytics (PostHog/GA) — can be layered later by also calling `track()` inside `trackUpgradeEvent`.
- No first-touch attribution.
- No A/B test framework.

## Files touched

- migration: create `upgrade_events`, `log_upgrade_event` RPC, add `attribution_source` to `subscriptions`
- new: `src/lib/upgrade-tracking.ts`, `src/lib/upgrade-funnel.functions.ts`, `src/routes/_authenticated/admin/upgrade-funnel.tsx`
- edit: `src/hooks/useUpgradeGate.tsx`, `src/hooks/usePaddleCheckout.ts`, `src/components/UpgradeModal.tsx`, `src/routes/index.tsx`, `src/routes/api/public/payments/webhook.ts`, `src/routes/welcome.tsx`
