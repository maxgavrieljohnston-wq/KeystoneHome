## Goal

Insert a 5-second "calculating your plan" screen between the last risk question and the dashboard/results — but only for first-time users (their first plan). Show a progress bar with a fast-then-slow fill curve, and rotate inspiring homeownership facts above it.

## Changes

### 1. Flow change (`src/routes/index.tsx`)
- Add `"calculating"` to the `FLOW` array between `"risk3"` and `"dashboard"`.
- Add a screen renderer `if (screen === "calculating") return <CalculatingScreen ... />`.
- After the last risk question, instead of jumping straight to `dashboard`, advance to `calculating`.
- Decide first-time vs returning at flow time:
  - **First-time** = user has zero saved plans before this submit. Detect by calling the existing `getMyPlans` server fn once on mount of the calculating step (or checking the user's session — if not signed in yet, treat as first-time, which covers the lead-capture path).
  - If the user is **not** first-time, skip the calculating screen entirely (advance straight to dashboard). No flicker.
- The screen runs `submitPlan` in parallel with the 5s animation. Whichever finishes last gates the transition — so the bar always completes visually, and a slow network never gets cut off mid-progress.

### 2. New `CalculatingScreen` component (inline in `src/routes/index.tsx`)
- Full-bleed, same paper/ink palette as the rest of the wizard.
- Headline: "Calculating your plan." Subtitle: "Crunching the numbers on your timeline, market, and risk profile."
- Progress bar (custom, not shadcn):
  - Width 100%, height ~8px, ink-on-paper, with a single filled span using the ember accent.
  - Fast-then-slow curve via `easeOutQuart`: `1 - (1 - t)^4`. Drives a `useEffect` requestAnimationFrame loop over ~5000 ms.
  - Numeric % label beside it (monospace, "12%").
- Rotating facts:
  - Render the current fact above the bar; fade/slide-swap every ~1500 ms (so ~3 facts visible across 5s).
  - Use `animate-fade-in` from the project's existing animation set for the swap.
  - Pick a random ordering on mount so consecutive plans show different facts.
- When `progress === 1` AND `submitPlan` has resolved, advance to dashboard (or in the not-signed-in path, the same post-submit destination today's flow goes to).

### 3. New facts data file (`src/lib/homeownership-facts.ts`)
- Export `HOMEOWNERSHIP_FACTS: { headline: string; sub: string }[]` with ~12 curated, sourced-feeling lines. Example tone:
  - "Homeowners build ~$255K more wealth than renters by retirement." / "Source: Federal Reserve SCF."
  - "Every mortgage payment pays down principal — your future down payment for the next home."
  - "Home equity is the #1 source of wealth for middle-class Americans."
  - "The average homeowner stays put 13 years — long enough to ride out any market cycle."
  - "Fixed-rate mortgages turn rent inflation into a flat line for 30 years."
  - …etc. (10–12 total, mix of financial + emotional/lifestyle).
- Plain TS data, no DB, no fetch.

### 4. Wire-up details
- The existing submit path (the code that today fires `submitPlan` when entering the dashboard screen) gets moved into / coordinated with the calculating screen for first-time users, so we don't double-submit. For returning users it stays exactly as it is today.
- If `submitPlan` fails: keep the existing error handling (whatever the dashboard transition currently does on error). We just surface it after the animation completes.

## Out of scope
- No backend changes — purely a presentational screen plus a static facts file.
- No accessibility prompt to skip (5s feels short; add later if requested).
- No per-metro personalization for this iteration — pure static facts as confirmed.

## Notes
- The fast-then-slow curve plus rotating facts together do the heavy lifting on "feels substantive." A linear bar with no facts feels fake; this combo reads as "real work, worth waiting for."
- Reusing the existing paper/ink/ember palette keeps it cohesive with the rest of the wizard — no new visual primitives introduced.
