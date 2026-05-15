## Feature #7 — Themed reports

### Current state (honest read)

**What exists.** Three themes (`light`, `dark`, `sepia`) defined in `src/lib/plan-pdf.server.ts` (`THEMES` with bg/ink/mute/faint/ember/sage/gold). Persisted as `plans.theme`. Plus-gated via `requirePlus("Themed reports")` in `handleTheme`. Re-rendered in:
- PDF (`buildPlanPdfBytes`) — full theme honoured.
- Public share page (`src/routes/p.$slug.tsx`) — has its **own duplicate** `THEMES` map with a different shape (`paper/ink/soft/mute/ember`).

**What's weak.**
1. **Only 3 themes**, and they're generic. The marketing copy says "themed reports" but you get light, dark, or sepia — same tonal family the rest of the internet ships. No brand‑forward option (navy/trust, emerald/prestige, terracotta/sage) — exactly the kind of palettes the design system already curates.
2. **Picker is buried.** Theme buttons live at the bottom of the per‑plan "Settings" panel (`dashboard.tsx` line ~837), under target date / current savings / notes. Users open Settings to edit a goal, never to pick a theme. Most Plus users will never find it.
3. **No live preview.** The picker mutates `plan.theme` and… nothing on the dashboard changes. To see the theme you have to export the PDF or open the share link. Picking blind kills the upsell.
4. **Two sources of truth for themes.** PDF defines `bg/ink/mute/faint/ember/sage/gold`. Share page defines `paper/ink/soft/mute/ember`. Different keys, different hex values, no shared module. Add a fourth theme and you'll do it twice and they'll drift.
5. **No swatch indicator on the card.** Once theme is set, nothing on the `PlanCard` tells you which one. Users will toggle, forget, re‑download to verify.

### Verdict

Themed reports is shipped but unfindable, undifferentiated, and duplicated across two renderers. Cheap to fix.

### Proposed improvements (ranked)

1. **Single source of truth.** Extract a shared `PLAN_THEMES` module (e.g. `src/lib/plan-themes.ts`) with one normalized shape (paper/ink/inkSoft/inkMute/faint/ember/sage/gold). Both `plan-pdf.server.ts` and `p.$slug.tsx` import it. Eliminates drift; required before adding more themes.
2. **Add 2 brand‑forward themes.** `navy` (deep navy + warm white, finance/trust) and `terracotta` (terracotta + sage, warmer/lifestyle). Five total: light / dark / sepia / navy / terracotta. Update the `theme` enum in `src/lib/plans.functions.ts` validator and DB column comment if any.
3. **Move the picker out of Settings into the export row.** Render the swatches inline next to "Export PDF / CSV" on the `PlanCard`, with the active swatch highlighted. Keeps Plus‑gating; drops 1 click; makes the feature discoverable.
4. **Show the active theme on the card** even when picker is closed — tiny colored dot + name ("Sepia") next to the title or in the export row. Costs ~5 lines, closes the trust loop.
5. **Mini live preview.** Render a small (180×100) themed swatch card next to the picker — header bar, ember accent, mute body line — so the user sees the palette before downloading. Pure CSS, no PDF round‑trip.

### Skip

- **Custom user colors** — scope creep, support burden, and 99% of outputs would be ugly. Curated set only.
- **Per‑section accent overrides** — same reason.
- **Typography variants** (serif vs sans report) — real feature but separate from "themed".
- **OG image / share‑page screenshot in theme** — Feature #6/social adjacent, not here.

### What I'd ship

**#1 + #2 + #3 + #4.** Skip #5 (mini preview) for this pass — nice but not load‑bearing once #3 puts swatches in front of the user; revisit if upgrade conversion on this lever stays flat.

### Files I'd touch

- **New** `src/lib/plan-themes.ts` — exported `PLAN_THEMES` record + `PlanTheme` type + `THEME_IDS` array.
- `src/lib/plan-pdf.server.ts` — replace local `THEMES` with import from `plan-themes`; map `[r,g,b]` once at top.
- `src/routes/p.$slug.tsx` — replace local `THEMES` with import from `plan-themes` (adapter for the slightly different keys it currently uses).
- `src/routes/dashboard.tsx` — move theme picker from Settings panel (~line 837) to the export row in `PlanCard`; render small active‑theme dot/label on the card header; keep `handleTheme` + `requirePlus` exactly as is.
- `src/lib/plans.functions.ts` — extend `theme` Zod enum (line ~285) to include the two new IDs.
- (Optional) `supabase/migrations/<new>.sql` — only if the column has a CHECK constraint on theme values; quick `read_query` against `information_schema` will confirm. If it's a plain `text` column (likely), no migration needed.

### Open questions

1. **Two new theme IDs okay?** I'm proposing `navy` and `terracotta`. If you'd rather pick from the curated palette list (e.g. `emerald`, `noir-gold`), name them now and I'll wire those instead.
2. **Picker placement on `PlanCard` export row** — small swatches (5 dots) is my plan. If you'd rather a dropdown, say so; otherwise swatches.

Want me to proceed with #1+#2+#3+#4 as scoped?