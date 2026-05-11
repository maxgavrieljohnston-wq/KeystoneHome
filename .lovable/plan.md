## Premium Features Plan

Build out the three feature groups you selected, all gated behind a single shared upgrade modal that respects the existing Plus/Pro split.

### 1. Shared upgrade modal (paywall)

Create `src/components/UpgradeModal.tsx` — a reusable modal triggered when a free user clicks any locked feature.
- Props: `open`, `onClose`, `requiredTier: "plus" | "pro"`, `featureName`.
- Shows feature name, which tier unlocks it, monthly/yearly price, and two CTAs: "Choose Plus" / "Choose Pro" that open Paddle checkout via the existing `usePaddleCheckout` hook (so users never leave the page).
- Helper hook `useUpgradeGate()` returns `{ requireTier(tier, featureName, action) }` so any button can wrap its handler in one call.

Update `PremiumPanel` in `src/routes/dashboard.tsx` so each locked feature row becomes a clickable button that opens the modal instead of just showing a lock icon.

### 2. Unlimited plans + saved plans (Plus)

Backend
- New migration: update `create_plan_with_limit` so Plus and Pro users both bypass the 3-plan cap (already correct — just verify), and add a `title` column on `plans` (nullable text, defaults from `answers.firstName`'s plan + date).
- Add `renamePlan` and `deletePlan` server functions in `src/lib/plans.functions.ts`, both behind `requireSupabaseAuth` and scoped to `user_id`.

Frontend
- Replace single-plan `PlanSummary` on `/dashboard` with a saved-plans list using the existing `getMyPlans` server function.
- Each row: title, last updated, "View", "Rename", "Duplicate", "Delete".
- Free users see only their most recent plan + a counter ("2 of 3 free plans used"). Older rows show a lock with `requireTier("plus", "Saved plans", …)` opening the modal.
- "Build new plan" button — for free users at the cap, click triggers the upgrade modal instead of routing to `/`.

### 3. PDF export (Plus)

- Add `pdf-lib` (Worker-safe, pure JS).
- New server function `exportPlanPdf` in `src/lib/plans.functions.ts`:
  - `requireSupabaseAuth`, takes `planId`.
  - Verifies the user owns the plan AND has an active Plus/Pro subscription via `has_active_subscription(uid, env)`. Returns 403 otherwise.
  - Renders a single-page branded PDF (Keystone wordmark, plan answers, generated date) and returns base64 bytes.
- Frontend "Export as PDF" button on each plan row. Free users → modal. Plus/Pro → triggers download via a Blob.

### 4. AI homebuying coach (Pro)

- New route `src/routes/coach.tsx` (under `_authenticated` gate or with same `beforeLoad` session check as `/dashboard`).
- Server function `coachChat` in `src/lib/coach.functions.ts`:
  - `requireSupabaseAuth`, server-side checks active Pro subscription. Free/Plus → 403.
  - Loads the user's latest plan answers, prepends them as system context, then streams a completion from Lovable AI Gateway (`google/gemini-2.5-flash` for cost; upgradeable later) using the `LOVABLE_API_KEY` secret.
  - Persists messages to a new `coach_messages` table (`id, user_id, role, content, created_at`) with RLS so users only see their own.
- UI: simple chat layout with `react-markdown` rendering, message list, input box, "thinking" indicator. Empty state explains the coach uses their plan as context.
- Add a "Coach" link in the dashboard header for Pro users; locked card for Plus/Free that opens the upgrade modal with `requiredTier: "pro"`.

### 5. Email reminders & milestones (Pro) — deferred

Not in this batch. Can ship after the above are live; would use the existing email queue (`enqueue_email`) plus a pg_cron job hitting an `/api/public/cron/reminders` route. Mention this to user when handing off.

### Database changes (one migration)

```sql
alter table public.plans add column if not exists title text;

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index on public.coach_messages(user_id, created_at);
alter table public.coach_messages enable row level security;
create policy "users read own coach messages"
  on public.coach_messages for select using (auth.uid() = user_id);
create policy "service role manages coach messages"
  on public.coach_messages for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
```

### Files added / changed

- New: `src/components/UpgradeModal.tsx`, `src/hooks/useUpgradeGate.ts`, `src/routes/coach.tsx`, `src/lib/coach.functions.ts`
- New migration for `plans.title` + `coach_messages`
- Edit: `src/routes/dashboard.tsx` (saved-plans list, premium panel buttons), `src/lib/plans.functions.ts` (rename/delete/exportPdf)
- Add dep: `pdf-lib`

### Out of scope this round

- Email reminders & milestones (queued for next batch)
- Partner/household mode and scenario compare (you didn't select these)
- Live mortgage rate alerts
