## Changes to `src/routes/index.tsx`

### 1. Mid-report inline nudge (lines ~3228 and ~3246)

- Replace nudge text:
  - From: `Want to own 2–4 years sooner? See your invest-vs-save projection.`
  - To: `Want to own 2–4 years sooner? Time to find out how.`
- Replace button label:
  - From: `Unlock — $5/mo`
  - To: `Find out how`

### 2. Remove "§02 Your down payment options" from the report (lines ~2828–2899)

Delete the entire IIFE block — the leading comment, `computeOfferedDownOpts(d)` call, and the `<Section number="02" title="Your down payment options.">…</Section>` it renders. After removal, the next section (`<Section number="03" title="What it costs to live there.">`) becomes the section that follows `<InlineUpgradeNudge />`.

Note: the existing section numbers 03/04/… are hard-coded strings, not derived from order. Leaving them as-is keeps the diff minimal but the report will jump §01 → §03. **Question for confirmation: renumber 03→02, 04→03, etc., or leave the numbers as-is?** Default assumption if not specified: renumber so the report reads §01, §02, §03… without a gap.

The shared helper `computeOfferedDownOpts` stays — it's still used by the wizard question screen at line 1041.

### Out of scope
- No copy changes elsewhere (end-of-report cards, sticky bar, headlines).
- No changes to `tier-features.ts`, pricing page, UpgradeModal, or any backend/schema.
- The wizard's down-payment question screen is untouched.
