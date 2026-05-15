## Goal
On `/pricing`, show a curated set of 4 highlights per plan instead of the full feature list. All features remain delivered — we're only changing what the card displays. Pro continues to show "Everything in Plus" as the first line.

## Highlight picks (and why)

**Plus — 4 highlights:**
1. **Unlimited saved plans** — the headline upgrade vs. free; the clearest "what do I get" answer.
2. **Invest-vs-save projection** — Keystone's signature "aha" feature; nothing else on the page tells this story.
3. **Full plan export (PDF + CSV)** — a tangible deliverable people can hand to a partner / advisor; concrete value.
4. **Shareable plan link** — drives viral reach and is the one feature couples ask for first.

Skipped from the card (still included): action-plan PDF, tags/notes, themed reports, email reminders, recommended accounts. These are great but overlap with the four above or read as "nice-to-have" in a scan.

**Pro — "Everything in Plus" + 4 highlights:**
1. **AI homebuying coach** — the flagship Pro reason-to-buy; most-requested.
2. **Affordability stress-test** — analytical depth that justifies a recurring price.
3. **Live mortgage rate alerts** — time-sensitive, actionable, recurring value (matches the subscription model).
4. **Realtor & broker matching** — closes the loop from planning to action; concrete outcome.

Skipped from the card (still included): scenario compare, city market intelligence, lender doc vault, auto-invest (coming soon). Compare and market intel are powerful but harder to grasp at a glance; doc vault and auto-invest read as supporting features.

## UI changes (single file: `src/routes/pricing.tsx`)

1. Add a `highlightIds` array on each `Plan` entry in the `PLANS` constant listing the 4 IDs above. For Pro, keep the synthetic `_plus` ("Everything in Plus") item pinned to the top.
2. In the card render, split `plan.features` into `highlighted` (matches `highlightIds` in the order specified, with `_plus` first for Pro) and `rest` (everything else, preserving original order).
3. Render `highlighted` as today. Below the list, render a `"+ N more features"` toggle button (mono, uppercase, same type system as existing chrome). Local `useState<Record<PlanId, boolean>>` tracks expanded state per card.
4. When expanded, render `rest` underneath with the same row styling and switch the button label to `"Show fewer"`. Coming-soon badges continue to render where applicable.
5. No copy or pricing changes. No business-logic, entitlement, or backend changes — `PLUS_FEATURES` / `PRO_FEATURES` in `src/lib/tier-features.ts` stay the source of truth and other consumers (UpgradeModal, dashboard "Premium features" panel) keep showing the full list.

## Out of scope
- `tier-features.ts` data model
- UpgradeModal / dashboard panels
- Entitlement logic (`useSubscription`, `useUpgradeGate`)
- A separate full comparison page (can come later if you want one)
