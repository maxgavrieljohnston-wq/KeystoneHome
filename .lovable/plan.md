## Goal
Remove the user's employment-type screen from the onboarding flow while keeping all downstream calculations intact.

## Why this is safe
The `employment` field defaults to `null` in `INITIAL`. When `employmentAdjustment(null)` runs, it already falls through to the W-2 default (`incomeFactor: 1.0`, `dtiCap: 0.43`, `rateAdd: 0`). So every mortgage calculation, readiness score, and report that reads `d.employment` will continue to work exactly as before.

## Changes

### 1. Remove from flow order
In `src/routes/index.tsx`:
- Delete `"employment"` from the `FLOW` array (currently between `"partner"` and `"finances"`).
- Delete `"employment"` from the `PROGRESS_SCREENS` array.

### 2. Remove the screen JSX
Delete the entire `if (screen === "employment")` block (lines 589-609) that renders the Question with title `"How do you earn your income?"`.

### 3. Keep everything else untouched
- **Keep** `employment` in the `Data` type and `INITIAL` object — downstream code still references it.
- **Keep** the `EMPLOYMENT_TYPES` import — the partner employment screen (`partnerEmployment`) still needs it.
- **Keep** the partner employment screen and all calculation/report code — no logic changes needed.

## Result
Users will move directly from the partner question (or intro, if no partner) into the finances screen. The report will still assume W-2-style income treatment, which is the most permissive default.