## Feature #5 — Tags, notes & goal tracker

### Current state (honest read)

**Tags**
- Stored as `text[]` on `plans`. UI renders pill row + inline input that adds on Enter/blur. Remove via `×`. Filter chip on the dashboard top toolbar (`allTags` → `filterTag`).
- Validated (max 20 tags, 40 chars each). No duplicate enforcement beyond the in-memory check.
- No suggestions, no color, no typeahead, no rename, no bulk actions.

**Notes**
- Single `text` column (max 2000 chars). One textarea inside the "Goal & notes" panel. Renders as italic blockquote when collapsed.
- No formatting, no timestamps, no per-section attachment (one note per plan).

**Goal tracker**
- Two fields: `target_move_in` (date) and `current_savings` (numeric). Rendered as a one-line "Target move-in: X · Saved: $Y" strip with an ember bar.
- That's it. No progress %, no countdown, no comparison to the deposit goal, no momentum signal, no celebration on milestones.

### Verdict

The plumbing is solid. The product surface is anemic — especially the **goal tracker**, which is just two stored values displayed back to the user with zero computation. Notes are a single field, and tags have no discoverability.

### Proposed improvements (ranked)

1. **Real goal progress bar** — compute `current_savings / cashToClose` (we already have `cashToClose` from the unified metrics engine). Show % to goal, dollars remaining, and on-track/behind signal vs `target_move_in` (compare required monthly savings to user's actual `monthlySavings` answer). This turns the goal block from a label into a live status. Highest impact.
2. **Countdown + pace badge** — "8 months to move-in · $1,240/mo needed · you're saving $900/mo → behind by $340/mo." Pulls from existing answers + savings. No new storage.
3. **Tag suggestions / recents** — show a small chip row of previously-used tags under the input ("Recent: starter-home, 2026, Austin"). Click to add. Reduces friction; no schema change. Also de-dup case-insensitively.
4. **Notes: timestamp + light formatting** — append-only timeline OR a single field with last-updated stamp (`notes_updated_at`). Pick the lighter option (stamp only) — full timeline is over-scope. Render line breaks (already does via `pre-wrap`); add a subtle "edited 3d ago" line.
5. **Empty-state nudge** — when a Plus user has no goal/notes set, show a one-line CTA inside the card ("Set a target move-in date to track progress") instead of hiding the panel entirely. Currently the goal block doesn't render at all without `target_move_in`, so users don't discover the feature.
6. **Goal milestones in PDF + CSV** — surface `targetMoveIn`, `currentSavings`, % to goal, and pace verdict in the existing exports (already wired to read `assumptions`; just add 3 rows).

### Skip for now
- Per-section notes, rich text, tag colors, drag-reorder tags, shared goal with a partner. All real features but scope creep.

### What I'd ship

**#1 + #2 + #3 + #5 + #6.** Skip #4 — the timestamp adds clutter without much value while the field is single-use.

### Files I'd touch

- `src/routes/dashboard.tsx` — `PlanCard` goal block (progress bar, countdown, pace), tag input (suggestions row, case-insensitive dedup), empty-state CTA.
- `src/lib/plan-metrics.ts` — add `goalProgress` helper: `{ pctToGoal, remaining, monthsToGoal, requiredMonthly, paceVerdict }` derived from `cashToClose`, `current_savings`, `target_move_in`, and `answers.monthlySavings`.
- `src/lib/plan-pdf.server.ts` — add a "Goal tracker" line to section 02 (Cash to Close) when goal fields exist.
- `src/lib/plans.functions.ts` — `exportPlanCsv`: 3 extra rows in `## SUMMARY` (target move-in, current savings, % to goal).

No DB migration needed. No new server fns.

### Open question

For the **pace verdict**, should I read `answers.monthlySavings` (what the user *said* they save) or compute required monthly only (and let the user judge)? The first is more useful but assumes that answer is accurate; if it was the median bucket from onboarding it'll be off. I'd lean toward computing required monthly + showing user's stated savings side-by-side rather than rendering a verdict — less risk of wrongly telling someone they're behind.

Want me to proceed with #1 + #2 + #3 + #5 + #6 on those files?