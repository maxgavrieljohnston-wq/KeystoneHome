
# Coach v2 — bigger brain, real actions, live data, real threads

Four improvements, sequenced so each phase ships something useful on its own. End state: the coach knows your full plan (not just raw answers), can actually change things in one click, cites current rates and market data, and remembers conversations per plan.

---

## Phase 1 — Smarter context + model

**Goal:** stop pasting the raw `answers` JSON and give the model a structured digest. Use a stronger default model with light reasoning.

- New helper `buildPlanDigest(plan)` in `src/lib/coach-context.ts` that returns a compact, labeled block including:
  - Identity: title, version, household, target city + ZIP
  - Money math from `computePlanMetrics`: target price, down payment %, cash-to-close, monthly housing, **housing ratio + verdict**, monthly savings, months-to-goal
  - Invest-vs-save delta (already computed today)
  - Top 3 items from the monthly `action-plan.ts` shortlist
  - Recent assumption overrides (last 5 edits) if present
  - Recommended-account names the user picked
- Replace `JSON.stringify(plan.answers)` in the system prompt with this digest. Keeps tokens lower and gives the model the numbers it currently has to re-derive.
- Switch model from `google/gemini-2.5-flash` → `google/gemini-3-flash-preview` with `reasoning: { effort: "low" }`. Bump to `"medium"` when the user message matches what-if patterns (regex on "what if", "stress", "if I", "instead of").
- Tighten the system prompt: drop the brittle `<<FOLLOWUPS>>` text marker (Phase 2 replaces it with a proper tool call).

---

## Phase 2 — Actionable coach (tool calling)

**Goal:** the coach can propose concrete changes that the user applies in one tap. Replaces the free-text follow-ups hack with real OpenAI-style tools on the gateway.

Switch `sendCoachMessage` to a two-pass loop:
1. Stream the assistant reply as today.
2. If the model emits `tool_calls`, run them server-side, then either auto-apply (safe ones) or surface as an inline "action card" in the chat.

Tools (all validated with Zod before execution):

| Tool | What it does | Auto-apply? |
|---|---|---|
| `suggest_followups({chips})` | Replaces the `<<FOLLOWUPS>>` marker | Yes (UI only) |
| `propose_assumption_change({key, value, reason})` | e.g. bump savings rate, drop down %, change rate | No — renders Apply card calling existing `updatePlanMeta` |
| `propose_target_price({price, reason})` | Sets `targetPriceOverride` | No — Apply card |
| `draft_lender_email({subject, body, recipient_hint})` | Returns email text | No — renders "Copy email" card |
| `explain_math({label, breakdown[]})` | Annotates a numeric paragraph | Yes — renders as collapsible "Show the math" block under the message |

New table `coach_message_actions` (migration in Phase 4) stores proposed actions with status `proposed | applied | dismissed` so cards persist across reloads.

Client (`src/routes/coach.tsx`): action cards render below the assistant message. Apply calls the existing `updatePlanMeta` server fn, then invalidates plan + metrics queries so the dashboard updates live.

---

## Phase 3 — Live data grounding

**Goal:** real numbers for current mortgage rates and local market, with citations.

Requires the **Perplexity connector** (`PERPLEXITY_API_KEY`). I'll ask you to connect it before this phase.

Two new server-only tools the model can call:

- `lookup_mortgage_rates({loan_type: "30yr_fixed" | "15yr_fixed" | "fha" })` → calls Perplexity `sonar` with a structured-output schema, returns `{rate, asOfDate, sources[]}`. Cached 1h in a new `coach_data_cache` table to avoid burning credits.
- `lookup_market({zip})` → returns `{medianPrice, priceToIncome, trend, asOfDate, sources[]}`, cached 24h.

Both responses are passed back to the model so it can weave them into the reply, **and** surfaced in the UI as a "Sources" chip row under the message (3 favicons + domain). The coach's system prompt is updated to prefer calling these tools over guessing.

---

## Phase 4 — Threads, pinning & better chat UX

**Goal:** stop the one-infinite-thread experience.

**Schema (single migration):**
- `coach_threads(id, user_id, plan_id nullable, title, summary, archived, created_at, updated_at)` with RLS scoped to `auth.uid() = user_id`
- `coach_messages.thread_id` (uuid, FK, indexed). One-time backfill: create one default thread per existing user, point all their current messages at it; move `profiles.coach_summary` into that thread's `summary`
- `coach_message_actions(id, message_id FK, kind, payload jsonb, status, created_at, applied_at)`

**Server fns (new / updated):**
- `listThreads`, `createThread`, `renameThread`, `archiveThread`
- `getCoachMessages` accepts `threadId`
- `sendCoachMessage` accepts `threadId` (creates one if missing, using current plan), updates that thread's summary instead of `profiles.coach_summary`
- Auto-title: after the first user turn in a thread, call gateway once with a tiny prompt to produce a 4-word title

**UI:**
- Replace the plan dropdown header with a left rail (desktop) / top sheet (mobile) listing threads grouped by plan
- Per-message: copy button, regenerate (re-send last user turn, discarding prior assistant reply), `Show the math` collapsible when `explain_math` payload is present
- Empty-thread state still uses the existing `getCoachStarters`, now per-plan

---

## Sequencing

1. **Phase 1** (small, no migration): digest + model swap — ships in one pass.
2. **Phase 4 schema migration first** so Phases 2 and 3 can persist actions/threads cleanly. (Migration is presented for approval before any code.)
3. **Phase 2** tool calling on top of the new schema.
4. **Phase 3** after you connect Perplexity — I'll prompt for that connector at the right moment, not now.

Each phase is independently shippable; you can stop after any one.

---

## Technical notes

- The current `<<FOLLOWUPS>>` text marker and its streaming hold-back logic in `sendCoachMessage` get replaced by a real `tool_calls` SSE handler; the buffer-and-strip code goes away.
- Gateway tool-call SSE: deltas may stream `tool_calls[].function.arguments` in fragments — accumulate by `tool_call_id`, parse JSON once `finish_reason === "tool_calls"`.
- Reasoning effort costs more — `"low"` is the default, `"medium"` only on what-if queries, never `"high"`.
- Perplexity calls go through `process.env.PERPLEXITY_API_KEY` server-side only.
- The `coach_messages` backfill must run inside the migration transaction so we never have orphan rows without a `thread_id`.

