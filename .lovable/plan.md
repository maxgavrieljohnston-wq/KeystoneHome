## Goal

Right now the app is a one-shot intake — anyone landing on the page fills out the questionnaire, drops their email, and gets a plan. There's no way for a returning user to come back and see the plan they already created. This adds that.

## What returning users will experience

1. They open the app (web or installed from App Store).
2. They tap **"Sign in"** — either from the top of the landing page or from the email-capture step ("Already have an account? Sign in").
3. They choose how to sign in:
   - Continue with Google
   - Continue with Apple
   - Email me a sign-in link (magic link — no password to remember)
4. They land on a simple **dashboard** showing their saved plan, with options to retake the questionnaire or update their info.

## What we'll build

### 1. New `/login` page
A clean sign-in screen with three options: Google, Apple, and "Email me a magic link." Matches the design of the existing email-capture step. Includes a "← Back to home" link.

### 2. Sign-in entry points
- **Top nav on landing page**: small "Sign in" link in the header (visible on the marketing/intake page).
- **Email-capture step**: small "Already have an account? Sign in" link below the existing Google/Apple/email options.

### 3. New `/dashboard` page (protected)
Shown after login. Displays:
- Greeting with the user's name
- Their saved plan summary (pulled from the `leads` table, matched by email)
- "Retake questionnaire" button → restarts the intake flow
- "Sign out" button

If a logged-in user has no saved plan yet, the dashboard prompts them to take the questionnaire.

### 4. Auth callback handling
When users come back from Google/Apple/magic-link, they land on a callback route that completes sign-in and forwards them to `/dashboard`.

### 5. Magic link emails
Magic-link sign-in needs to send a branded email. We'll set up Lovable's auth email templates so the link comes from your domain and matches your branding.

## Technical details

- **Auth methods**: Google + Apple via Lovable Cloud managed OAuth (already wired up). Magic link via Supabase `signInWithOtp`.
- **Routes added**: `src/routes/login.tsx`, `src/routes/dashboard.tsx`, `src/routes/auth.callback.tsx`.
- **Dashboard data**: server function with `requireSupabaseAuth` middleware that looks up the `leads` row by the authenticated user's email and returns the saved answers.
- **Profile linking**: the `profiles` table + `handle_new_user` trigger already exist, so each new sign-in auto-creates a profile row. No schema changes needed.
- **Magic-link email setup**: scaffold Lovable's auth email templates so the magic-link email is branded. Requires an email domain — if none is configured yet, we'll prompt you to set one up.
- **Session gating**: `/dashboard` uses `beforeLoad` to redirect unauthenticated users to `/login`.

## Out of scope (can be follow-ups)

- Editing individual answers on the dashboard (only retake-from-scratch for now).
- Account settings page (change email, delete account).
- Linking a logged-in user's existing `leads` row if they originally submitted with a different email than they now sign in with.
