# Plus tier expansion — 9 new features

Replacing the partner offer with substantial Plus value. Grouped into 3 phases so each ships as a coherent unit.

## Phase 1 — Plan management (foundation)

**1. Plan history & versioning**
- Add `parent_plan_id uuid` and `version int` to `plans` table.
- When a signed-in Plus user re-runs the wizard with the same title, save as a new version of the existing plan instead of a new row.
- Dashboard plan card gets a "History" disclosure showing target price / deposit / monthly over time as a small inline chart + list.

**9. Plan tags & notes**
- Add `tags text[]` and `notes text` to `plans`.
- Edit modal on each dashboard card: chip input for tags, textarea for notes.
- Filter bar above plan list: filter by tag.

## Phase 2 — Sharing & power inputs

**2. Shareable read-only plan link**
- Add `share_slug text unique` and `share_enabled bool default false` to `plans`.
- Server fn `togglePlanShare(planId)` (Plus-gated) generates a 10-char nanoid slug.
- New public route `/p/$slug` renders a read-only version of the report with no nav, no CTAs to edit, "Made with Keystone" footer link.
- Dashboard: "Share" button on each card → modal with copyable link + toggle to revoke.

**4. Custom assumptions**
- Add an `assumptions jsonb` column on `plans` storing user overrides for: property tax %, insurance $/yr, HOA $/mo, expected investment return %, mortgage rate %, PMI %.
- Wizard gets a new optional "Advanced" step (skippable, Plus-gated — free users see a locked card with upgrade CTA).
- `keystone.ts` calculation reads from `assumptions` first, falls back to defaults.

**3. CSV export**
- Server fn `exportPlanCsv(planId)` (Plus-gated) returns CSV with headline stats, monthly cost breakdown, and the path-to-deposit month-by-month table.
- New "↓ CSV" button next to existing PDF button on the report.

## Phase 3 — Goal, presets, costs, polish

**5. Goal tracker**
- Add `target_move_in date` and `current_savings numeric` to `plans`.
- New "Goal" panel on report: progress bar (current_savings / total_deposit), "save $X/mo to hit [date]" calculation, "you're ahead/behind by N months" verdict.
- Editable inline (Plus-gated). Feeds into the existing reminder digest email.

**6. City / ZIP presets**
- Hard-coded JSON of top ~50 US metros with median home price, property tax %, insurance estimate (no external API — keep it simple, refresh manually).
- Wizard location step: "Use city defaults?" autocomplete. Selecting one pre-fills assumptions.
- Free users can pick a city; Plus users get the auto-populated assumptions written to their plan.

**8. Closing-cost & moving-cost estimator**
- Add to `keystone.ts`: closing costs ≈ 2-5% of price (use 3% default), moving costs $1.5k flat (override-able via assumptions).
- New "True cash to close" line on the report: deposit + closing + moving, with breakdown tooltip.
- Available to all users (it's a calc improvement, not a paywalled feature) — but the override knobs are Plus-only via #4.

**10. Themed report**
- Add `theme` column on `plans` (`light` | `dark` | `sepia`).
- Theme switcher on the report (Plus-gated). Persists per plan. Applies to the shareable `/p/$slug` view too.

---

## Updated pricing copy

`src/routes/pricing.tsx` and `src/components/UpgradeModal.tsx` Plus features list becomes:

- Save unlimited plans with version history
- Custom assumptions (rate, taxes, insurance, return)
- Goal tracker with savings target
- Shareable plan link
- PDF & CSV export
- Themed reports
- Email reminders & milestones

## Out of scope

- Real-time city data API (using static JSON; refresh manually).
- Multi-income modeling (idea #7, deliberately skipped per user).
- Pro features (AI coach, scenario compare, rate alerts) — untouched.

## Technical notes

- One migration per phase to keep changes reviewable: phase 1 adds versioning + tags/notes; phase 2 adds share + assumptions; phase 3 adds goal + theme.
- All new write server functions go through `requireSupabaseAuth` + `userHasActiveSub` entitlement check (same pattern as `setReminderPrefs`).
- Shareable `/p/$slug` route uses `supabaseAdmin` server-side to fetch only when `share_enabled = true`. Returns 404 otherwise.
- City presets live in `src/data/metros.ts` as a typed const — no DB table needed.
- `keystone.ts` refactored once to accept an `assumptions` override object so #4, #6, and #8 all flow through one calc path.

## Suggested order

Phase 1 → Phase 2 → Phase 3, shipping each phase end-to-end (DB → server fn → UI → pricing copy update at the end of phase 3). Confirm and I'll start with Phase 1.
