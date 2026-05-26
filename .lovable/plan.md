
# Keystone Onboarding & Results Optimization

All work lives in `src/routes/index.tsx` (the wizard + Report) plus a small new component file, `src/lib/keystone.ts` (style list), and `src/lib/plan-metrics.ts` (readiness already exists; we'll reuse). No visual identity, palette, or typography changes.

## 1. Shorten the flow (combine + trim)

**Combine `homeStyle` + `homeFeatures` into one screen: `homePicture`.**
New `FLOW`:
```
welcome → email → introFinances → partner → age → employment → finances →
insightIncome → credit → insightCredit → [partner branch] → factDemo →
zip → homePicture → downGoal → timeline → introMoveIn → introRisk →
risk0…risk3 → calculating → dashboard
```

`homePicture` screen content (single scroll, mobile-first, current type/spacing):
- Home type chips: **Single family, Condo, Townhouse, Multi-family** (drop split-level, ranch).
- Bed / Bath steppers (kept).
- One combined "What matters most" multi-select (no must/nice, matches the existing PicturePlacePanel pattern): Walkable area, Good schools, Near work, Home office, Room for a dog, Space for kids, Quiet suburb, Restaurants & nightlife, Parks & nature.
- Remove: outdoor space, parking, split-level, ranch, detailed outdoor prefs.

Data model: keep `outdoorSpace`/`parking` fields but stop collecting them (default `null`); `lifestyle`/`neighborhood` become `string[]` (mirrors the dashboard change already shipped). `priceMult` in `index.tsx` and `plan-metrics.ts` updated to treat each selected tag as a flat +0.015 bump and ignore removed fields.

Net: ~3 screens removed, fewer inputs per screen → ~25% shorter.

## 2. Micro-insight cards between sections

New lightweight `InsightCard` component (cream card, rust accent rule, one-line headline + one-line subtext, "Based on regional market data" footnote). Inserted as standalone screens:
- `insightIncome` (after `finances`): "You're within range for many first-time buyers in your area."
- `insightCredit` (after `credit`): "Your credit range could qualify for competitive mortgage rates."
- `insightSavings` shown inline on the existing `downGoal` screen as a small note: "You already have more saved than many buyers starting their journey."
- `insightDebt` shown inline on `finances` results step or on `insightIncome` if DTI healthy.

Copy is conditional on the user's numbers (simple thresholds) but always reassuring; never exaggerated. Auto-advance disabled — user taps "Continue."

## 3. Future-visualization transition

New screen `introMoveIn` placed right before `introRisk`:
- Title: **Picture move-in day.**
- Body: "You unlock the front door. Boxes everywhere. Nothing's fully set up yet — but it's yours."
- Subtext: "Now let's build the fastest realistic path to get there."
- Uses the existing intro-screen layout (same as `introFinances`/`introRisk`) for visual consistency.

## 4. Trust & credibility anchors

Add a reusable `<TrustNote>` (small caps, muted, current type scale). Placed under:
- Affordability verdict on Report → "Mortgage estimates are educational, not lender approvals."
- Target price on `homePicture` → "Based on regional market data."
- Rate on timeline → "Updated using current average market rates."
- Readiness score → "Typical ranges sourced from national housing data."

No legalistic blocks, just one-liners.

## 5. Results: add "Your biggest timeline lever" before the paywall

New `BiggestLeverPanel` rendered in `Report` immediately before `<ReportPaywall />`.

Compute 4 candidate levers from the user's plan and surface the single highest-impact one (plus the runner-up as a smaller chip):
- +$250/mo savings → months saved (using `computeTimeToGoal`).
- Credit +40 pts → new rate via `rateFromCredit`, monthly delta.
- Target price −10% → cash-to-close + monthly delta + months saved.
- Down payment 10% vs current → months sooner.

Tone: "Saving $250 more each month gets you in 14 months sooner." Plus a secondary "Other levers" row with 2 muted options. This is the last free aha before the upsell.

## 6. Reframe the Plus paywall

Rewrite `ReportPaywall` copy (no pricing change, same component, same CTA wiring):
- Eyebrow: **Keystone Plus**
- Headline: **Your plan adapts as life changes.**
- Body (3 short lines, not a feature bullet list):
  - "Rates move, income shifts, life happens. Plus keeps your path honest."
  - "Adjust assumptions, track progress, and recover from setbacks without starting over."
  - "Built to stay with you from today through closing."
- Replace the current feature-checklist with 3 calm value pillars: **Stay on track · Adapt in real time · Move faster when you can.**
- Keep monthsSooner figure as a quiet supporting line, not the hero.

## 7. Homebuyer Readiness component

New `<ReadinessPanel>` on the Report (above BiggestLever, after the affordability verdict). Reuses the existing `readiness` score in `plan-metrics.ts` but presents it as:
- Big score (0–100) + tier label: *Early days / Building / Almost there / Ready to act*.
- **Helping you (top 3)** and **Slowing you down (top 3)** lists, derived from the same sub-scores (credit, DTI, savings vs target, timeline, income stability via employment).
- One-line empowering caption: "This isn't a credit score — it's a snapshot of how close you are to a confident offer."
- TrustNote underneath.

Tone strictly constructive (e.g. "Credit in a competitive band" / "Savings still building toward your down payment").

## 8. Paywall ordering

Final Report order:
1. Hero affordability summary (existing)
2. Timeline saving vs investing (existing)
3. **Homebuyer Readiness** (new)
4. **Your biggest timeline lever** (new)
5. **Plus paywall** (reframed)
6. Everything currently below paywall stays.

This delays the paywall by two emotionally rewarding sections.

---

## Technical notes

- All changes are presentation + flow logic; no DB schema, no server function, no auth changes.
- `FLOW` and `PROGRESS_SCREENS` updated together so the progress bar percentage stays accurate after combining/removing screens.
- `priceMult` updated in both `src/routes/index.tsx` and `src/lib/plan-metrics.ts` to drop must/nice weighting and ignore `outdoorSpace`/`parking`.
- New components colocated in `src/routes/index.tsx` for now (matches current file convention); if `BiggestLever` or `ReadinessPanel` grow beyond ~80 lines we extract to `src/components/dashboard/`.
- Lifestyle/neighborhood storage migrates from `Record<string,"must"|"nice">` to `string[]` — already done on the dashboard; we mirror it on the onboarding side. A small `normalizeLifestyle()` helper handles legacy plans loaded from the DB.
- No changes to Stripe, subscription tiers, or pricing.

## Out of scope

- Visual redesign, palette, typography, spacing tokens.
- Backend / RLS / server function changes.
- A/B testing infrastructure (can be added later).
