# Heimili — Homebuyer Path Planner MVP

Build a single-page onboarding flow + dashboard, matching the React spec in your uploaded PDF. The app walks a user through ~25 short screens, then renders a personalized "Your Path Home" dashboard.

## Flow (in order)

1. **Welcome** → Get Started
2. **Email** capture
3. **Age** slider
4. **Fact card 1**: "The average first-time buyer is 40"
5. **Income** (annual gross, slider)
6. **Monthly expenses** (slider)
7. **Monthly debt payments** (slider)
8. **Credit score** (4 buckets: Excellent / Good / Fair / Poor)
9. **Current savings** (slider)
10. **Fact card 2**: "Only 1 in 5 buyers today is a first-timer"
11. **Partner?** (yes/no)
12. **Partner income / expenses / debt / credit** (skipped if no partner)
13. **Fact card 3**: "Median down payment for first-timers is 9%"
14. **ZIP code** → resolves to city + average home price (lookup table for ~20 metros, fallback $400k)
15. **Home style** (multi-select: Starter, Single Family, Townhouse, Condo, etc.)
16. **Timeline** (years until purchase)
17. **Down payment %** (3.5% FHA / 5% / 10% / 20%)
18. **Fact card 4**: "Investing your savings gets you there faster"
19. **Risk questions** (4 questions, 4 options each → derives Conservative 4% / Balanced 7% / Growth 10%)
20. **Dashboard**

A progress bar shows position across input steps (welcome/facts/dashboard excluded).

## Dashboard

Header: "{Home styles} in {City}" · avg price · down payment %.

Three tabs:

- **Investment Plan**
  - Recommended monthly contribution to reach the down-payment target in the timeline, using the user's risk-derived rate.
  - Comparison of all three strategies (Conservative / Balanced / Growth) with the matched one highlighted.
  - "Save alone" comparison showing how much investing saves per month.
- **Affordability**
  - Verdict badge (Affordable / Stretch / Difficult) based on monthly housing cost vs. ~28% of income.
  - Breakdown grid: Principal & Interest, PMI (if down < 20%), Tax & Insurance.
  - Emergency fund check vs. 3–6 months of expenses, with a progress bar.
  - Combined income, total debt, DTI.
- **Readiness**
  - 0–100 score from credit, DTI, savings vs. target, timeline realism.
  - Short coaching message keyed to the score band.
  - Credit score card (qualifying score = lower of two if partnered).

## Calculations

- **Required monthly investment**: future-value of annuity solved for PMT, given current savings, target, months, and annual rate.
- **Mortgage P&I**: standard amortization at 7% / 30y on `price × (1 - downPct/100)`.
- **Risk derivation**: average score across 4 risk questions → Conservative / Balanced / Growth.
- **DTI**: (debts + estimated housing) / gross monthly income.
- **Emergency fund target**: 3–6 × monthly expenses.

## Design

- Dark theme, deep navy background (`#0a1628`-ish) with soft blue accent `#a8d5e2` and gradient CTA `linear-gradient(135deg,#4a8fa8,#a8d5e2)`.
- Fonts: Playfair Display (display headings), DM Sans (UI), DM Mono (numbers) — loaded from Google Fonts.
- Sliders: large value display above a custom track with gradient fill.
- Fact cards: full-screen takeover with big icon, headline stat, context line, source line, Continue button.
- Smooth fade/slide transition between screens.

## Tech notes

- TanStack Start, single route `/` containing the whole flow; state held in one `useState` object, screen index drives `FLOW` array.
- Pure client-side; no DB or auth needed for MVP. Email is captured but only stored in component state (we can wire to Lovable Cloud later if you want lead capture).
- Constants (`HOME_STYLES`, `STRATEGIES`, `CREDIT_BUCKETS`, `RISK_QS`, `ZIP_TABLE`) co-located in the route file or a `src/lib/heimili.ts` helper.

## Out of scope for v1

- Saving sessions across reloads
- Real MLS / live mortgage rate APIs
- Account creation, sharing, PDF export

Let me know if you want lead capture (save email + answers to a database) included now, or to keep v1 fully client-side.
