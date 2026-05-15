## Goal
Tighten the AI Coach (Pro feature #1) before building the remaining two Pro features. Three focused turns.

---

## Turn 1 — Coach polish

**1. Streaming responses**
- Convert `sendCoachMessage` in `src/lib/coach.functions.ts` to an `async function*` handler that yields `{ delta }` chunks parsed from the gateway's SSE stream, then a final `{ done: true, chips, planId }`.
- Keep the rolling-summary refresh (non-streaming) before the main call.
- Persist `user` + `assistant` rows in `coach_messages` only after the upstream stream completes — preserves the "no orphan rows on failure" invariant.
- Frontend `src/routes/coach.tsx`: replace the `useMutation` with an async-iterator loop that appends deltas to the last assistant bubble in local state, then invalidates the history query on completion.

**2. Optimistic user message**
- On submit, append the user's message to local state immediately and clear the input. Reconcile from the `coach-messages` query after the stream ends.

**3. Plan-aware starter prompts**
- New `getCoachStarters` server fn: takes optional `planId`, loads the plan, runs `computePlanMetrics` + `investEdge`, returns 3 plan-specific starter strings (e.g. "Is my 18-month timeline realistic at $1,200/mo?", "What if I invest the down payment instead?", "What lender questions should I ask first?").
- Empty-state in `coach.tsx` renders these as chips — clicking sends the message.
- Falls back to 3 generic starters when no plan exists.

**4. Plan tag on user bubbles**
- When `messages.length > 1` plans and a user message has `meta.plan_id`, show a small `mono` caption above the bubble: `About: {plan.title}`.

**5. Mobile header trim (390px)**
- Replace the "Clear" text button with an icon-only button (×) on the right.
- Let the plan picker wrap cleanly below the title row.

No DB migration. No new dependencies.

---

## Turn 2 — Pro #2: Side-by-side scenario compare (up to 3 plans)

- New route `src/routes/compare.tsx` (Pro-gated like `coach.tsx`).
- Multi-select plan picker (up to 3); URL state `?plans=id1,id2,id3` for shareable Pro-only links.
- Server fn `getComparePlans` returns `{ plans: [{ id, title, metrics, scenarios, edge }] }` using existing `computePlanMetrics` + `projectScenarios` + `investEdge`.
- Render a 3-column comparison table on desktop, vertically stacked cards on mobile, with rows: target home price, down payment, timeline, monthly required (saved vs invested), invest-vs-save delta (months sooner, dollars saved), savings gap.
- Highlight the "winning" cell per row (e.g. shortest timeline, smallest monthly).
- Link entry from dashboard "What you get" card (Pro tier).

---

## Turn 3 — Pro #3: Live mortgage rate alerts

**Data source decision** — needs user input:
- Option A: Free public source (e.g. FRED `MORTGAGE30US` weekly series, Mon-only update). No key needed, conservative SLA.
- Option B: Paid real-time provider (Mortgage News Daily, Optimal Blue) — needs API key + budget.
- I'll recommend FRED weekly + a simple delta-trigger; revisit if Pro users ask for intraday.

**Implementation (assuming FRED)**:
- Migration: `rate_alerts` table (`user_id`, `direction` enum `up|down|either`, `threshold_bps`, `last_notified_rate`, `active`, `created_at`); `mortgage_rates_history` table (`fetched_at`, `rate_30y_fixed`, `source`).
- Daily cron via `/api/public/rates/refresh` (Bearer-protected, like reminders): pulls FRED, inserts row, evaluates active alerts, enqueues an email when threshold crossed.
- New route `src/routes/rates.tsx` (Pro-gated): current rate + 90-day sparkline, "Alert me when 30-yr fixed moves ±25 bps" form.
- Reuse `enqueue_email` RPC + the existing email queue processor.

---

## Out of scope across all three turns
- Switching coach to a reasoning model (revisit only if quality issues).
- Voice/file input on coach.
- Cross-plan questions inside the coach (compare route handles that).
- Intraday rate updates.
