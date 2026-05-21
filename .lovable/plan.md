Make the savings-progress demo card on the homepage interactive.

## Current state
The "Your projection" card inside the `Welcome` component (`src/routes/index.tsx`) is fully static: `$540,000` home price, `Oct 2026` target date, `42%` savings progress, and a static note about increasing contributions.

## Changes

### 1. Add local state to `Welcome`
Three `useState` values:
- `homePrice` — default `540000`
- `currentSavings` — default `22680` (keeps the original 42% of a 10% down-payment target)
- `monthlyContribution` — default `1200`

Plus one derived constant for the demo down-payment rate (10%).

### 2. Replace static read-only values with editable inputs
- **Home price** → `<input type="number">` with `$` prefix, styled to match the existing serif 32px value.
- **Savings** → `<input type="number">` with `$` prefix, placed next to the progress bar (new row).
- **Monthly contribution** → `<input type="number">` with `$` prefix, placed next to the note section.

Inputs use inline styles consistent with the card’s editorial palette (no custom colors outside the existing `C` tokens).

### 3. Real-time derived values
On every keystroke, recompute:
- `downPaymentTarget = homePrice * 0.10`
- `progressPct = Math.min(100, Math.round((currentSavings / downPaymentTarget) * 100))`
- `monthsRemaining = Math.max(0, Math.ceil((downPaymentTarget - currentSavings) / monthlyContribution))`
- `targetDate = new Date(now + monthsRemaining months)` → formatted as e.g. "Oct 2026"

The progress bar width updates from `progressPct`.

### 4. Dynamic note
Replace the static note with a contextual message derived from the live numbers, e.g.:
> "At this pace you’ll reach your down-payment goal in {monthsRemaining} months. Increasing your monthly contribution by $250 moves your purchase date forward by ~X months."

If savings already exceed the target, the message switches to a "You’ve hit your goal" state.

### 5. Visual polish
- Inputs get a subtle bottom border (`1px dashed ${C.inkFaint}`) instead of a full box to keep the editorial card aesthetic.
- `pointer-events: auto` on inputs, `pointer-events: none` on the rest of the preview card (already the case).
- No layout shift: the card size stays fixed because the input heights match the previous text heights.

## Out of scope
- No backend changes.
- No new dependencies.
- No changes to the wizard flow or the real dashboard plan card.
- No persistence of the demo values.