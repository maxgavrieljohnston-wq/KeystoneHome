## Switch sign-in to email + password

Replace the magic-link-only flow with standard email/password auth, while keeping the experience email-only (no Google/Apple).

### 1. Auth backend
- Call `configure_auth` to keep email signups enabled, **without** auto-confirming email (users must verify their email before first sign-in). Leave anonymous sign-ins disabled and HIBP password check enabled.
- No schema changes — Supabase already handles email/password on `auth.users`.

### 2. `src/routes/login.tsx` (rewrite the form)
- Remove the magic-link-only UI.
- Add a tabbed/toggled form with two modes: **Sign in** and **Create account**.
  - **Sign in:** email + password → `supabase.auth.signInWithPassword`. On success → `/dashboard`.
  - **Create account:** email + password (min 8 chars) → `supabase.auth.signUp` with `emailRedirectTo: ${origin}/dashboard`. Show "Check your inbox to verify your email" confirmation state.
- Add a **"Forgot password?"** link that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/reset-password })` and shows a confirmation state.
- Surface friendly errors for: invalid credentials, unverified email, weak password, email already registered.

### 3. New `src/routes/reset-password.tsx`
- Public route. Detects the recovery session from the URL hash, shows a "Set new password" form, calls `supabase.auth.updateUser({ password })`, then redirects to `/dashboard`.
- Required so the reset email link actually lets users change their password instead of silently logging them in.

### 4. `src/routes/index.tsx` `EmailScreen` (quiz capture)
- Keep the email-only capture for first-time users (it just stores a lead — no password needed there).
- After the report, when the paywall converts and they need an account, route them to `/login` in **Create account** mode (prefill email via `?email=` search param) so they set a password once.

### Out of scope
- No changes to plans/limits, paywall, Paddle, or email infra.
- Magic link is removed from the UI; the underlying capability stays available in Supabase but isn't surfaced.

### Open question
Do you want to **keep magic-link as a secondary option** (small "Email me a link instead" button under the password form), or fully remove it? Default: fully remove it per your request.
