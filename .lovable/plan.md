## Goal
Make facts on the "calculating" interstitial actually readable. Currently 5s total with rotation every 1.5s — facts flash by before users can read them.

## Change — `src/routes/index.tsx`, `CalculatingScreen` only

Two constants:
- `DURATION_MS`: 5000 → **8000**
- `ROTATE_MS`: 1500 → **4000**

Result: 2 facts shown, ~4 seconds each — enough to read headline + sub comfortably.

The existing easeOutQuart progress curve already feels "fast then slow," which pairs well with the longer hold at the end. No other logic changes.

## Out of scope
- No changes to the facts content (`homeownership-facts.ts`).
- No new UI (pause-on-hover, tap-to-advance, Continue button).
- No changes to skip logic for returning users — they still bypass the screen entirely.
