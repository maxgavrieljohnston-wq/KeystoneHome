# Demo plan page (`/example`)

Add a public, hardcoded sample plan that the homepage hero's "See an example" button links to. No database row, no auth — just a route that reuses the same rendering as `/p/$slug`.

## What gets built

1. **New route `src/routes/example.tsx`**
   - `head()` with its own title/description and `og:title`/`og:description` (real meta, not `noindex` — this page is meant to be shareable and crawlable).
   - Renders the same layout as `/p/$slug` against a hardcoded `plan` object for **Maya, 29, Austin TX**:
     - `zip: "78704"`, solo (no partner), W-2
     - income $82k, 712 credit, $9,500 saved
     - condo, 2 bed / 2 bath, 3-year timeline, 10% down goal
     - `target_move_in` ≈ 36 months out, `current_savings: 9500`, `title: "Maya's condo plan — Austin"`
   - Loader is synchronous (just returns the object) — no `getSharedPlan` call, so there's zero DB dependency and the page is instant.

2. **Shared rendering helper**
   - Extract the current `SharedPlanPage` body in `src/routes/p.$slug.tsx` into a reusable `PlanView({ plan })` component (same file or `src/components/PlanView.tsx`).
   - `/p/$slug` keeps its current loader + `notFoundComponent` and just renders `<PlanView plan={plan} />`.
   - `/example` renders the same `<PlanView plan={MAYA_PLAN} />`.
   - No visual change to existing shared plans.

3. **Demo-only banner + CTAs (only on `/example`)**
   - Small kicker above the title: `— Example plan · not a real user` (replaces the `— A shared Keystone plan` kicker).
   - Sticky footer bar with: *"This is a sample plan. Yours takes 2 minutes."* + **`Build my plan →`** button linking to `/` (scrolls to the quiz entry).
   - Keep the bottom "Made with Keystone" line.

4. **Wire up the hero button** (`src/routes/index.tsx` line 1638-1661)
   - Replace the `<button onClick={() => scrollTo("how-it-works")}>` with a TanStack `<Link to="/example">` styled identically.
   - Remove the now-unused `scrollTo("how-it-works")` call site (the function itself stays — other buttons may use it; verify before removing).

## What does NOT change

- `getSharedPlan` server fn, `plans` RLS, or any `/p/$slug` behavior.
- No new DB rows, no migrations, no env vars.
- "How it works" section stays where it is; we're just no longer scrolling to it from this specific button.

## Risks / edge cases

- **Maya's numbers must look healthy** — if the math produces an unaffordable monthly or 60-year timeline, the demo undersells the product. I'll tune `saved`, `timelineYears`, and `downGoalPct` so the "Invest @ 7%" path lands in a believable $400–600/mo range.
- **Theme**: Use the default `light` theme so the page matches the home page aesthetic.
- **SEO**: This page IS indexable on purpose (unlike `/p/$slug` which is `noindex`) — it's a marketing surface.

## Out of scope (can do later if you want)

- Interactive sliders on the demo page (option C from earlier).
- Multiple personas / a `/example/$persona` switcher.
- Annotated callouts explaining each section.
