Move the existing "Without investing" cash-only panel in `InvestVsSavePanel.tsx` so it sits directly beneath the "You're contributing..." descriptive paragraph and above the dark headline box. Also relabel the panel eyebrow from "— Without investing" to "Cash only, no compounding".

### Changes
1. **Reorder JSX** — Cut the `/* Without investing */` block (currently after the slider) and paste it immediately after the `<p>` tag on line 162, before the `/* Headline */` block on line 165.
2. **Relabel eyebrow** — Change the eyebrow text inside the moved block from `"— Without investing"` to `"Cash only, no compounding"`.
3. **Remove old location** — Ensure the block no longer renders below the slider / above the strategy comparison section.

### Why
This keeps the cash-only baseline closer to the user's current plan summary (the paragraph + the panel), making the contrast between compounding and non-compounding more immediate before they start adjusting the slider.