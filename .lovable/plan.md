## Add a "Without investing" panel to Invest vs Save

In `src/components/dashboard/InvestVsSavePanel.tsx`, insert a new panel directly above the existing "Strategy comparison" section (after the slider block, before the `borderTop` strategy block).

### Behavior

- Uses the current slider `monthly` value (dynamic — updates as the user drags).
- Computes time to goal at 0% return using existing `monthsToGoal(metrics.saved, metrics.downPayment, monthly, 0)`.
- Displays just the timeline (no comparison delta), formatted with `fmtMonths`.
- Subtle copy explaining this is the cash-only path (no compounding).

### Visual

A bordered card matching the existing panel aesthetic (`C.inkFaint` border, paper-tone background, small mono eyebrow "— Without investing", larger ink timeline number). Uses existing color tokens; no new dependencies.

### Scope

Single file edit. No changes to math libs, server functions, or persistence.
