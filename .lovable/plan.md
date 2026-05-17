## Quick-win conversion pack (~30 min)

Focused on driving more paid signups by removing friction in the funnel and adding trust/urgency where users hesitate. All small, surgical edits.

### 1. Auth friction (signup drop-off)

- **Google sign-in** on `/login` (top of both Sign In and Sign Up tabs) via the Lovable broker. Also enable provider with `configure_social_auth(["google"])`. Removes the OTP+password gauntlet for ~40% of users.
- **Resend code** link on the OTP step (60s cooldown) — currently no way to recover from a lost code except restarting.
- **Show/hide password** toggle on the Create Password step.
- **Auto-focus** the OTP input on step change, and accept paste of "12345678" with auto-strip of spaces/dashes.
- **Error copy**: replace `auth/invalid-credentials` style messages with "That email or password didn't match. Try again or reset." (already partially done; sweep the rest).

### 2. Paywall / pricing trust signals

- **Social proof line** above the Plus/Pro buttons in `UpgradeModal` and on `/pricing`: "Join 1,200+ buyers planning with Keystone" (use a real number once we have one; placeholder fine for now).
- **Money-back guarantee chip** on both tier cards: "Cancel anytime · 14-day refund". This is the single highest-leverage paywall change.
- **Annual savings badge** on the Pro yearly toggle: "Save 2 months" with the actual % calculated from prices.
- **"Most popular" ribbon** on Pro (if not already present) — visual anchor that pulls eyes off Plus.

### 3. Sticky bar & inline nudge urgency

- Add a **dynamic value line** to the sticky bar based on what the user is looking at: e.g. on `/dashboard` show "Unlock your full plan + lender match — $X/mo"; on `/coach` show "Ask unlimited questions with Pro".
- Show the sticky bar **only after 8s of scroll or 30% scroll depth** (instead of immediately) — reduces dismissal rate.
- After dismissal, suppress for 24h via `localStorage`, not session-only.

### 4. Post-checkout activation

- On `/welcome`, if the user has no password set (came in via checkout email), surface a single **"Set a password to sign in next time"** card with inline form. Today they have to discover this through the login flow.

### 5. Admin funnel polish

- Add **conversion-rate columns** (click→open %, open→signup %, click→signup %) to `/admin/upgrade-funnel` — currently only raw counts.
- Add **"Top source"** stat at the top: "Sticky bar drives 47% of paid signups."
- Sort rows by signups desc by default (already does, confirm).

### Out of scope (will propose separately if you want)

- Testimonials section, exit-intent modal, A/B testing framework, email re-engagement sequences, FAQ rewrite. All bigger than 30 min.

### Files touched

- `src/routes/login.tsx` (Google button, resend, show/hide, paste handling)
- `src/components/UpgradeModal.tsx` (guarantee, social proof, savings badge)
- `src/routes/pricing.tsx` (same trust signals)
- `src/routes/index.tsx` + sticky bar component (scroll-trigger, 24h dismiss, dynamic copy)
- `src/routes/welcome.tsx` (set-password card)
- `src/routes/admin.upgrade-funnel.tsx` (rate columns + top-source stat)
- `supabase--configure_social_auth(["google"])`

### Recommended priority if you only ship 3 things

1. **Google sign-in** — biggest funnel impact
2. **Money-back guarantee + social proof on paywall** — biggest checkout impact
3. **Sticky bar scroll trigger + 24h dismiss** — biggest "don't annoy" impact
