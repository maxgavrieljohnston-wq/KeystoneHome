## Problem

Your signup flow calls `signInWithOtp`. Supabase sends a 6-digit verification code, but which email template is used depends on whether the user already exists:

- **First-time signup** → uses `SignupEmail` template (already shows the code correctly).
- **Existing user / subsequent attempts** → uses `MagicLinkEmail` template, which currently only renders the "Open my plan →" button and **does not display the token**. That's the "login" email you've been seeing with no code.

The webhook already passes `token` to every template (`src/routes/lovable/email/auth/webhook.ts`, line 140) — the magic-link template just isn't rendering it.

## Fix

Update `src/lib/email-templates/magic-link.tsx` to:

1. Add `token?: string` to `MagicLinkEmailProps`.
2. Render the 6-digit code in a styled code box above the button (matching the existing `codeBox` / `codeText` styling already used in `signup.tsx` so it stays on-brand).
3. Update the body copy to say something like "Enter this code to sign in, or tap the button below."
4. Keep the magic-link button as a fallback.

No webhook changes, no other templates touched, no backend/database work.

## Result

Whether it's a first-time signup or a returning sign-in, the email will always contain the 6-digit code prominently displayed.
