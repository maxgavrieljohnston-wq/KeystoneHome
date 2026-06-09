## Goal
Combine the "Picture your place" and "Assumptions" (Tune) features into a single feature titled **Home**.

## Changes

### 1. `src/lib/dashboard-features.ts`
- Remove `"assumptions"` and `"picture"` from `FEATURE_KEYS`.
- Add a single `"home"` key in their place.
- Update `FEATURE_META`:
  - `home`: `{ label: "Your home", short: "Home", icon: Home }`
- Drop the `assumptions`/`picture` entries and the now-unused `Sliders` import.

### 2. `src/routes/features.$key.tsx`
- Replace the `case "picture"` and `case "assumptions"` branches with a single `case "home"` branch that renders both panels stacked: `PicturePlacePanel` first, then `AssumptionsPanel` below it (same props as today).
- Both panels keep their existing locked/Plus behavior.

### 3. Backwards compatibility for old links
- In the route's `beforeLoad`, if `params.key` is `"picture"` or `"assumptions"`, redirect to `/features/home` preserving `planId` search.

### 4. Sweep references
- `rg` for `"picture"` / `"assumptions"` feature-key string usage (e.g. `FEATURE_META.picture`, hard-coded `to="/features/$key"` params, upgrade-funnel tracking strings, `.lovable/plan.md`) and update to `"home"` where they refer to the feature key. Leave unrelated uses of the words alone (e.g. the `assumptions` column on `plans`, `PicturePlacePanel` internal copy).

## Out of scope
- No changes to the panels' internal UI or to server functions / schema.
- The `assumptions` DB column and `updatePlanMeta` stay as-is.
