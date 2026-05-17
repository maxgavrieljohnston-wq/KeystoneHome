## Goal

Fix the cramped, awkward Plus/Pro upgrade modal on mobile (current issue visible in screenshot: two narrow columns force every feature line to wrap 4–6 times, the "SOON" badge breaks mid-word, and the parenthetical "(coming soon)" duplicates the badge).

## Changes — `src/components/UpgradeModal.tsx` only

1. **Stack tiers vertically on mobile, side-by-side on larger screens**
   - Replace the fixed `gridTemplateColumns: "1fr 1fr"` with a responsive layout: single column under ~520px, two columns above. Use a CSS media query injected via a `<style>` tag scoped to the modal, since this file uses inline styles (no Tailwind here).
   - Result on mobile: each tier card gets the full modal width, so feature lines no longer wrap every 2 words.

2. **Tighten the feature list**
   - Bump feature font-size from 14 → 15, line-height to ~1.45, padding per item 4 → 6.
   - Use `display: flex; gap: 8px` with the check mark as a separate `<span>` so wrapped lines indent under the text (not under the ✓).
   - Remove the redundant `(coming soon)` suffix from the Pro "Auto-invest" feature label when the `SOON` badge is shown — strip it client-side in the modal (do NOT edit `tier-features.ts`, since that copy is used elsewhere). The badge alone communicates it.
   - Make the `SOON` badge `white-space: nowrap` and `flex-shrink: 0` so it never breaks across lines.

3. **Modal chrome polish**
   - Reduce modal padding on mobile (28 → 20) to give content more room.
   - Headline: reduce from 28 → 24 on mobile for better balance with the body copy.
   - Slightly increase intro paragraph line-height (1.5 → 1.55) and reduce its bottom margin so the cards sit closer.

4. **Card internals**
   - Reduce card padding 18 → 16 on mobile.
   - Price row: keep size, but reduce gap between cards from 12 → 10 when two-column.

## Out of scope
- No changes to `tier-features.ts`, pricing page, paywall logic, Paddle integration, or any feature gating.
- No copy rewrites beyond stripping the redundant "(coming soon)" in the modal display layer.
- No new dependencies; keep inline-style approach consistent with rest of file.

## Confirm before I build
- OK to stack the two tier cards vertically on mobile (Plus on top, Pro below)? This is the biggest legibility win but changes the side-by-side comparison on phones.
