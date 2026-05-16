# Rework the free-plan upgrade prompt on the results page

The current `ReportPaywall` (src/routes/index.tsx, ~L3088) dumps the full Plus + Pro feature list at the very end of the report. Two problems: it's a wall of text, and by the time a free user scrolls there they've already gotten what they came for. Plan below fixes both.

## 1. Trim the end-of-report card to just the highlights

Replace the 10+ bullet `features.map(...)` with **3 curated highlights** (not pulled from `PLUS_FEATURES` wholesale). For free users:

- Save unlimited plans & track progress
- Invest-vs-save projection — reach your goal sooner
- Full PDF + CSV export, themed reports, shareable link

For Plus users (upgrading to Pro): 3 Pro highlights (AI coach, side-by-side compare, stress-test).

Also change the card to show **inline pricing + two buttons** instead of a single "See plans →" link, so the decision happens in place:

```
[ Start Plus — $5/mo ]   [ Go Pro — $11/mo ]
                          Cancel anytime
```

Buttons open the existing `UpgradeModal` (or jump straight into Paddle via `usePaddleCheckout`) — no extra page hop.

## 2. Surface the upgrade earlier — two additions

**a) Mid-report inline teaser** (placed right after the first big result section, well before the end). A small, single-line nudge — not the full card — e.g.:

```
🔒 Save this plan so you can come back and track it →  [ Upgrade ]
```

Quiet styling (paper bg, ember accent, one line). Same modal trigger.

**b) Sticky mobile CTA bar** that appears after the user scrolls past the first result section and stays pinned to the bottom of the viewport on mobile (the user is on a 390px viewport). One line + one button:

```
Save your plan • from $5/mo            [ Upgrade ]
```

Hidden on desktop (≥768px) where the inline card is enough. Hidden for Pro users. Dismissible (session-only) so it's not annoying.

## 3. Keep the bottom card, but as the closer — not the only ask

After the trims above, the end-of-report card becomes the formal "here's the offer" closer rather than the first time the user sees the pitch. By then they've already been gently nudged twice.

## Technical notes

- All edits in `src/routes/index.tsx`. `ReportPaywall` rewrite + two new small components (`InlineUpgradeNudge`, `StickyUpgradeBar`).
- Reuse `useSubscription()` for gating, `useUpgradeGate()` + `UpgradeModal` for the CTA (already wired in the app), and `usePaddleCheckout` if we want one-click checkout from the buttons.
- Sticky bar: `position: fixed; bottom: 0`, show via `IntersectionObserver` on the first result section, hide on `isPro`, hide if dismissed (sessionStorage key `keystone_upsell_dismissed`).
- No backend / schema changes. No new routes. No new packages.
- Highlights are hardcoded short strings in the file (don't try to derive from `PLUS_FEATURES` — those are the long marketing lines).

## Out of scope

- Pricing page redesign
- Changes to `UpgradeModal` itself
- A/B testing infrastructure
