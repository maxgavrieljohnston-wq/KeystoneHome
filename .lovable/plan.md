# Reposition homepage messaging — investing first, AI coach as bonus

Goal: the landing page should pitch Keystone as a way to **invest your down payment so you can buy years sooner**. The AI coach is no longer a headline feature — it stays in the product, but on the homepage it's mentioned only as a small bonus.

Scope: copy + section emphasis in `src/routes/index.tsx` only. No business logic, no pricing changes, no removed features.

## Edits

### 1. Hero (lines ~1567–1676)
- Eyebrow chip: "A homebuying plan for everyone" → **"Invest your way home"**.
- Subhead under the H1 currently says "Built for first-time home buyers who want a plan, not just another savings account." Tighten to lead with the speed payoff, e.g. **"Stop parking your down payment in a savings account. Invest it the right way and reach your goal years sooner."**
- Keep the H1 ("An investment account for your future home.") — already on-message.
- CTAs unchanged.

### 2. Process / How it works (lines ~1902–1917)
Rewrite the three steps so the middle step is the investing pitch, not just a generic projection:
- 01. **The Audit** — keep, light edit: "See exactly where you stand today across cash, savings, and brokerage accounts."
- 02. **The Plan** — "Pick a target home and we model save-vs-invest side by side, so you can see how many years investing shaves off."
- 03. **The Purchase** — keep.

### 3. Dashboard moment (lines ~2076–2129)
- Section H2 stays ("Watch your timeline shrink.").
- Subcopy: rewrite to emphasize the investment angle, e.g. "Invest your down payment in a portfolio matched to your timeline. As markets move and you contribute, your buy date updates in real time."
- Feature bullets — replace the current three with investing-led ones:
  - "Save vs. invest, side by side"
  - "Risk matched to your timeline"
  - "Live buy-date forecasting"
- Remove "Smart mortgage forecasting" and "Tax-advantaged savings tips" from this list (they're not the headline story anymore). "Market volatility alerts" can stay folded into "Live buy-date forecasting".

### 4. Pricing teaser (lines ~2169–2189)
- Subcopy: drop "and the AI coach" from the main sentence. New copy: "Build your entire roadmap at no cost. Upgrade only when you want unlimited scenarios and plan exports."
- Replace the standalone "Pro plan with the AI coach is $11/mo." line with a smaller, lighter footnote-style line under the CTA: **"Bonus: Pro ($11/mo) adds an AI coach."** Use the existing faint-ink style, smaller font.

### 5. FAQ (lines ~2224+)
Quick pass: if any FAQ entry centers the AI coach, rephrase so the coach is mentioned in passing rather than as a headline feature. No structural changes.

### 6. Anything else not touched
- Wizard/Section 01 ("Save, or invest?") and downstream sections are already investing-led — leave as-is.
- The deeper upgrade-funnel screens (lines ~3824+) still reference the AI coach. That's the in-app upgrade prompt, not the homepage — out of scope for this redesign pass.

## Technical notes
- Pure copy + minor style tweaks. No new components, no new dependencies.
- All edits in `src/routes/index.tsx` inside the `Welcome` component.
- Verify mobile layout after edits with a screenshot at 390px since some strings get longer.
