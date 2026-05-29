## Goal
Remove the "Picture your place" (`homePicture`) screen from the onboarding flow.

## Why this is safe
The `homePicture` fields (`homeStyle`, `beds`, `baths`, `lifestyle`, `neighborhood`) all have safe defaults in `INITIAL`:
- `homeStyle: null` → downstream code uses `styleAdjustments([])` which provides a sensible baseline multiplier.
- `beds: 2`, `baths: 2` → `computeFeatureMult` applies zero premium for these defaults.
- `lifestyle: []`, `neighborhood: []` → zero tag bumps.

So timeline, report, and dashboard pricing will still work using a generic home baseline.

## Changes

### 1. Remove from flow order
In `src/routes/index.tsx`:
- Delete `"homePicture"` from the `FLOW` array (was between `"zip"` and `"downGoal"`).
- Delete `"homePicture"` from the `PROGRESS_SCREENS` array.

### 2. Remove the screen JSX
Delete the entire `if (screen === "homePicture")` block that renders the "Picture your place." Question with home-style grid, bedroom/bathroom steppers, and lifestyle/neighborhood tag toggles.

### 3. Remove stale comment
Delete the `// homeFeatures merged into homePicture (above).` comment.

### 4. Keep everything else untouched
- **Keep** `homeStyle`, `beds`, `baths`, `lifestyle`, `neighborhood` in the `Data` type and `INITIAL` — downstream code still references them.
- **Keep** the `HOME_STYLES` import — it's still used in the report/dashboard for displaying the chosen home style name.
- **Keep** `computeFeatureMult` and `styleAdjustments` usage — legacy plans and defaults still rely on them.

## Result
Users will move directly from ZIP code entry into the down-payment goal screen. Pricing will use a generic baseline home since no style/features are selected.
