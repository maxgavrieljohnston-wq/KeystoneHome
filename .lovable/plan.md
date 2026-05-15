## Feature #6 — Email reminders

### Current state (honest read)

**Toggle UI** — `RemindersToggle` on the dashboard. Plus-gated. On enable, `setReminderPrefs` writes `profiles.reminders_enabled = true` and `next_reminder_at = now + 30d`. Disable nulls them. That's it for user controls.

**Dispatch endpoint** — `POST /api/public/reminders/dispatch` (service-role-bearer-protected) selects up to 100 due profiles, re-checks subscription, looks up auth email, checks suppression, pulls last 10 plans, renders an HTML+text "monthly check-in" digest, enqueues to `transactional_emails` queue, advances the schedule.

**What's actually missing**:

1. **Nothing calls the dispatcher.** No `pg_cron` schedule, no external scheduler. The endpoint exists but never fires. The toggle works, the email never arrives. This is a shipped-but-broken feature.
2. **No cadence choice.** Hard-coded 30 days. Not exposed in UI, not stored per-user.
3. **No "reminder due soon" preview** for the user — they enable it and have no idea what they'll get or when.
4. **No unsubscribe link in the email.** Infrastructure exists (`email_unsubscribe_tokens` table, suppression flow) but the digest template doesn't include a token URL or a List-Unsubscribe header.
5. **No re-engagement variants.** Same template every month regardless of stale plan, missed savings, big rate move, hit-the-deposit-goal, etc. The new goal-progress data is sitting right there and not used.
6. **`last_reminder_at` is set but never displayed.** User has no proof the system is working.
7. **Email lookup uses `auth.users` directly** via the schema-cast hack — fragile and has happened to silently skip users when the lookup fails.

### Verdict

The hardest part (queue, suppression, sub re-check, template) is built. The product is broken because the cron isn't wired and the email is generic.

### Proposed improvements (ranked)

1. **Wire `pg_cron` to call the dispatcher daily.** Without this, none of the other improvements matter. Use the documented stable URL `project--{project-id}.lovable.app/api/public/reminders/dispatch` with `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`. Once a day at a sane hour (e.g. 14:00 UTC = 9am ET / 6am PT). Migration only.
2. **Pull goal-progress + rate-delta into the digest body.** For each plan, show: % to cash-to-close, months to move-in, ahead/behind pace, and (if `mortgageRate` from the latest scrape differs from the plan's stored rate by ≥0.25pp) a "rates moved" line. Reuses `computePlanMetrics` + `computeGoalProgress`. This is the actual reason to send the email.
3. **Add unsubscribe link + List-Unsubscribe header.** Issue/lookup a token in `email_unsubscribe_tokens`, render `https://keystonehomeowners.com/unsubscribe?token=…`, set `List-Unsubscribe: <mailto:…>, <https…>` headers on the queued payload. We already have the suppression table; we just don't link to it.
4. **Show "Last sent / Next due" in the toggle UI.** `getReminderPrefs` already returns `lastAt` and `nextAt` — render them. Closes the trust loop.
5. **Cadence picker (monthly / quarterly).** Add `reminder_cadence_days INT DEFAULT 30` to `profiles`, expose in the toggle. People don't all want monthly; some want a quarterly check-in. Simple migration + 2 lines of UI.

### Skip
- **Per-plan reminders**: nice idea, scope creep — single-user-cadence is enough.
- **AI-written copy variants**: too expensive per send for marginal value.
- **Rate-move trigger as separate email**: that's Feature #9 (rate alerts), don't bleed it in here.

### What I'd ship

**#1 + #2 + #3 + #4.** Skip #5 — cadence choice is real but not load-bearing; if users complain, add later.

### Files I'd touch

- `supabase/migrations/<new>.sql` — `cron.schedule('reminders-dispatch', '0 14 * * *', ...net.http_post(...))` calling the stable preview URL with service-role bearer. Idempotent (`cron.unschedule` first).
- `src/routes/api/public/reminders/dispatch.ts` — call `computePlanMetrics` + `computeGoalProgress` per plan, enrich digest with progress/pace; mint or reuse unsubscribe token; pass `list_unsubscribe` and unsubscribe URL to the email payload; replace the `auth.users` schema-cast lookup with `supabaseAdmin.auth.admin.getUserById(userId)` (cleaner, supported API).
- `src/routes/dashboard.tsx` — render `lastAt` and `nextAt` in `RemindersToggle`.
- `src/routes/unsubscribe.tsx` — confirm the route exists and accepts `?token=`; if missing, add a minimal page that POSTs to a server fn which marks the token used and inserts into `suppressed_emails`.

### Open questions

1. **Production URL for cron.** I'll target the stable `project--{project-id}.lovable.app` URL — confirm that's the right deployment. (Custom domain `keystonehomeowners.com` exists but isn't in `project_urls`; safer to use the stable Lovable URL for cron.)
2. **Unsubscribe page**: I should check whether `src/routes/unsubscribe.tsx` already exists before scaffolding one. (Would do this during build.)
3. **Email queue worker cadence.** Out of scope for this feature, but if `process.ts` isn't itself on a cron, the dispatcher will enqueue and nothing will send. Worth a quick check before declaring victory.

Want me to proceed with #1+#2+#3+#4? I'll verify the unsubscribe route and queue worker schedule as I go.