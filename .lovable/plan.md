## Goal

When a user clicks a theme swatch on the dashboard, show a live miniature preview of how their plan's share page (and, by proxy, the PDF) will look in that theme — updating instantly as they hover/click, before any save round-trip.

## Approach

Reuse the existing `PlanView` component from `src/routes/p.$slug.tsx` — it already renders the full themed share page from a `PlanViewPlan` shape, and `plan.theme` flows straight through to `getPlanTheme()`. No new rendering logic needed.

### What changes

**One file: `src/routes/dashboard.tsx`**

1. Import `PlanView` from `@/routes/p.$slug`.
2. Add local state `previewTheme` inside `PlanCard` (defaults to `plan.theme`).
3. Modify the theme swatches:
   - `onMouseEnter` / `onFocus` → `setPreviewTheme(id)` (instant visual feedback, no save)
   - `onMouseLeave` / `onBlur` → reset to `plan.theme`
   - `onClick` → still calls `handleTheme(id)` to persist (existing behavior)
4. Render a new `<ThemePreviewFrame>` directly under the theme picker row, only when the plan card is expanded. It contains:
   - A small caption: "Live preview — {themeLabel}"
   - A fixed-size box (e.g. `width: 100%, maxWidth: 360, height: 480, overflow: hidden, border: 1px dashed inkFaint, borderRadius: 8`)
   - Inside: a `<div>` containing `<PlanView plan={{...plan, theme: previewTheme}} kicker="— Preview" />` with CSS `transform: scale(0.45); transform-origin: top left; width: 222%;` so the full 640px-wide share layout fits visually.
   - `pointer-events: none` on the inner wrapper so the preview is non-interactive.
5. Mobile (390px viewport): the preview frame collapses to full card width and uses `scale(0.4)`. Same component, just responsive sizing via a `useIsMobile` hook (already in the repo at `src/hooks/use-mobile`).

### Why this works

- `PlanView` already accepts the plan + theme and is a pure function of props — no auth, no data fetching, no router dependencies beyond the `<Link to="/">` footer (which still works inside an authenticated route).
- The PDF and share page share the same palette tokens via `getPlanTheme`, so the share-page preview is a faithful proxy for the PDF appearance. We don't need to render an actual PDF in the browser.
- No backend/schema changes. No new server fn. No new dependencies.

### Out of scope

- Rendering an actual PDF preview (would require shipping pdf-lib + a viewer to the client; share-page preview gives the same visual confidence).
- Persisting the hover-preview theme.
- Changing the swatch UI itself beyond adding hover handlers.

## Technical notes

- `PlanView` is already exported from `src/routes/p.$slug.tsx` alongside the route — safe to import.
- The footer's `<Link to="/">` inside `PlanView` renders fine in the dashboard tree (TanStack Router context is available app-wide).
- Wrap the preview in a div with `aria-hidden="true"` and `pointer-events: none` so it doesn't trap focus or get picked up by screen readers (the picker itself is the accessible control).
