## 1. Email-only sign-in (drop Google + Apple)

- **`src/routes/index.tsx` `EmailScreen`** — remove the "Continue with Google" and "Continue with Apple" buttons, the `handleGoogle` / `handleApple` handlers, the OAuth-return `useEffect`, and the divider. Keep only the email input + Continue button. Drop the now-unused `lovable` and `supabase` imports if nothing else uses them in that file.
- **`src/routes/login.tsx`** — remove both OAuth buttons and the `lovable.auth.signInWithOAuth` calls. Keep the magic-link form as the only sign-in path. Tighten copy ("Email me a sign-in link").
- No backend auth-provider config change needed; we just stop calling Google/Apple.

## 2. Persist answers across sign-in (resume after upgrade)

Today `leads` already stores `answers` keyed by email, and `Report` upserts on mount. We need to surface those answers when the user signs in later (typically after paying).

- **New server fn `getMyLatestPlan`** in `src/lib/account.functions.ts` (extend the existing file). Uses `requireSupabaseAuth`, looks up `leads` (and the new `plans` table from §3) by the auth email, returns the most recent answers blob.
- **`src/routes/dashboard.tsx`** — on mount, call `getMyLatestPlan`. If answers exist, render a "Resume your plan" card with a "View report" button that pushes the answers into the report renderer. If none, show the existing empty state.
- **Optional resume on `/`** — if a user lands on `/` already authenticated and has saved answers, offer "Pick up where you left off" instead of restarting the quiz.

## 3. Free-plan limit (3/email) + auto-email each plan

The current `leads` table is one-row-per-email, so it can't count plans. Introduce a dedicated `plans` table.

### Schema (migration)

```sql
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  answers jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index plans_email_idx on public.plans(lower(email));
alter table public.plans enable row level security;
create policy "owner reads own plans" on public.plans
  for select using (auth.uid() = user_id);
-- writes happen via SECURITY DEFINER RPC only
```

### Server function `submitPlan` (replaces the current `upsertLead` call from `Report`)

In `src/lib/plans.functions.ts`:
1. Validate input (Zod: email + answers).
2. Look up active subscription by email (join `auth.users` → `subscriptions`, env-aware via `getPaddleEnvironment` equivalent on the server, status active/trialing/canceled-with-grace).
3. If not subscribed: count rows in `plans` for that email. If `>= 3` → return `{ ok: false, reason: "limit_reached" }`. Frontend shows an upgrade prompt instead of the report.
4. Insert a new `plans` row.
5. Enqueue an email via the existing `enqueue_email` RPC → `transactional_emails` queue with a new template `plan_summary` that renders the plan (link to `/dashboard?plan=<id>` + key numbers).
6. Keep `upsertLead` for the mid-quiz draft save (email-only, before the report) so we still capture leads who drop off.

### Email template

- Add `src/lib/email-templates/plan-summary.tsx` (React Email).
- Wire into `process-email-queue` template registry the same way auth/transactional templates are wired today.

### Frontend wiring

- **`Report` component (`src/routes/index.tsx`)** — replace the current `upsertLead({completed:true})` call with `submitPlan`. If response is `limit_reached`, render a "You've used your 3 free plans" gate that swaps the report body for the existing `ReportPaywall` upgrade CTA.
- **Dashboard** — list all `plans` rows for the signed-in user (newest first), with "Create new plan" button that just routes to `/`.

## Out of scope / non-goals

- No change to Paddle pricing, webhook, or subscription tier logic.
- No change to email infrastructure (queue, cron, domain) beyond adding one template.
- Existing `leads` table stays for drop-off capture; not deleted.

## Open question

When an anonymous user submits their 4th plan with the same email, should we (a) block the report entirely behind the paywall, or (b) still show the report but watermark/limit it? I'll default to (a) — fully gated — unless you say otherwise.
