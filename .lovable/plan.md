## Make every first-time signup route through the same flow with an emailed verification code

### Current state

The canonical signup flow already lives at `/login?signup=true` in `src/routes/login.tsx`:

1. **Email step** — user enters email; `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` sends an 8-digit code.
2. **OTP step** — user enters the code; `supabase.auth.verifyOtp({ email, token, type: "email" })` creates and authenticates the account.
3. **Password step** — user picks a password; `supabase.auth.updateUser({ password })`.
4. **Post-signup** — if `?plan=...` was on the URL, auto-open Stripe checkout; otherwise go to `/dashboard`.

Entry points today:

- `/pricing` "Start Plus/Pro" — already redirects logged-out users to `/login?signup=true&plan=...`. ✅ canonical flow.
- Homepage/results-page sign-in links — all go to `/login`. ✅
- `UpgradeModal` (used by paywalls inside the dashboard/results) — calls `openCheckout(...)` immediately for **anonymous users**, opening Stripe checkout without creating a Supabase account. ❌ This is the only path that skips the verification flow today.
- Google OAuth via `lovable.auth.signInWithOAuth("google", ...)` — Google already verifies the email at the provider level, so no in-app OTP is needed (industry-standard). Out of scope.

Nothing in the codebase calls `supabase.auth.signUp(...)` directly, so there is no alternate path that silently creates unverified accounts.

### Fix

Single change: route `UpgradeModal`'s anonymous-user path through the canonical flow instead of straight to checkout.

In `src/components/UpgradeModal.tsx` `handlePick`:

- Before calling `openCheckout`, check `userId`.
- If `userId` is falsy: `navigate({ to: "/login", search: { signup: true, plan: tier.id } })`, close the modal, and still emit `trackUpgradeEvent({ event_type: "checkout_open", source, tier, email })` so the existing funnel analytics keep firing (the actual checkout opens automatically after signup).
- If `userId` is present: behavior unchanged — open checkout immediately.

After signup completes, `login.tsx`'s existing `handleSetPassword` already reads `search.plan`/`search.billing` and auto-opens the right checkout, so the user lands in Stripe with a real Supabase account that received and verified an email code.

### Files touched

- `src/components/UpgradeModal.tsx` — `handlePick` gets the anon-user redirect branch and a `useNavigate` import from `@tanstack/react-router`.

### Out of scope

- Changes to the canonical `/login` signup UI/flow — it already does emailed-code verification.
- Google OAuth — provider already verifies email.
- The pricing/price-ID unification work from the prior turn — that is a separate refactor.
- Any Supabase Auth config change (auto-confirm is irrelevant here; `signInWithOtp` always issues a one-time code that the user must enter before being signed in).