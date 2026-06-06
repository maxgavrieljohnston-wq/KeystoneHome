## Change
On the "Picture your place" dashboard panel (`src/components/dashboard/PicturePlacePanel.tsx`), replace the free-form ZIP code text input with a State dropdown, matching how the initial onboarding flow in `src/routes/index.tsx` already collects location.

### Why this is consistent
The onboarding flow already stores a 2-letter state code in `answers.zip` (per the back-compat note in `src/data/states.ts`) and prices it via `priceByState(code)` from `src/data/states.ts`. The dashboard panel currently diverges by asking for a numeric ZIP and pricing via `getPriceByZip` in `src/lib/keystone.ts`, which gives a different number than what the user saw at signup. Switching to the state dropdown + `priceByState` makes the live preview and the saved value match the onboarding pricing exactly.

### What to change in `PicturePlacePanel.tsx`
- Replace the `import { ..., getPriceByZip } from "@/lib/keystone"` with `import { US_STATES, priceByState } from "@/data/states"` (keep `HOME_STYLES`).
- Rename the local `zip` state to hold the selected state code (still saved as `answers.zip` for back-compat). Initialize from `str(answers, "zip")`.
- In `liveAnswers`, set `next.zipData = priceByState(zip)` whenever a state is selected (instead of the `zip.length >= 3` ZIP check).
- In the mutation payload, keep `zip` as the state code (no other key changes).
- Replace the ZIP `<input>` inside `<Field label="ZIP code">` with a `<Field label="State">` containing a styled `<select>` populated from `US_STATES`, sorted alphabetically by `name`, options shaped `<option value={code}>{name}</option>` with an empty "Select a state…" placeholder.

No backend, schema, or onboarding changes — `answers.zip` continues to store the state code and `priceByState` is the same function used at signup, so the target price stays consistent across both flows.