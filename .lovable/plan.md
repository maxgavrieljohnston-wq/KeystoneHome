## Goal
Turn `src/components/UpgradeModal.tsx` from a tasteful feature menu into a focused pitch. No new dependencies, no backend changes, no edits to `tier-features.ts`. Mobile-first (390px).

## Concrete copy + structure changes

### 1. Headline — lead with outcome, not feature name
Replace:
> Premium feature
> **Unlock {featureName}**
> "This feature is part of Pro…" / "Upgrade to Plus or Pro to unlock this and more."

With (Plus context):
> Your plan, accelerated
> **Reach your home 2–4 years sooner.**
> {featureName} is part of Plus — plus the tools to actually shave years off your timeline.

With (Pro context):
> Your personal homebuying coach
> **Stop guessing. Get a plan that adapts.**
> {featureName} is part of Pro — AI coach, stress-tests, and live market data working for you.

Keep `featureName` referenced so the modal still feels contextual to what they clicked.

### 2. Price framing — anchor the number
Under each price, add a one-line frame in mono caps:
- Plus `$5/mo` → "LESS THAN ONE COFFEE · CANCEL ANYTIME"
- Pro `$11/mo` → "PAYS FOR ITSELF IF IT SAVES ONE MONTH"

Add annual equivalence as a secondary line in small ink-mute text:
- "$60/yr" under Plus, "$132/yr" under Pro.

### 3. Recommended badge + visual hierarchy
- Add a "MOST POPULAR" ribbon on the Pro card (when both tiers are visible).
- Keep Pro filled-dark (already done), but bump its border to 2px and add a subtle 1px ember outer ring so the eye lands there first.
- When `requiredTier === "pro"`, no ribbon needed (Pro is the only card).

### 4. Reorder Pro features — bury "SOON"
Current Pro list leads with "Auto-invest (SOON)". That's a conversion killer. In the modal display only (not `tier-features.ts`), reorder so shipped features lead:
1. Everything in Plus
2. AI homebuying coach
3. Affordability stress-test
4. Side-by-side scenario compare
5. City market intelligence
6. Live mortgage rate alerts
7. Lender pre-qual doc vault
8. Realtor & broker matching
9. Auto-invest your down payment (SOON) ← last

Implementation: add a small `proDisplayOrder` array of feature ids inside the modal file and sort accordingly. No edits to the source data.

### 5. Urgency line — one sentence, above the CTA
Single italic line, ink-soft, 13px, centered above each card's button:
- Plus: *"Every month you wait is compounding you don't get back."*
- Pro: *"The market won't wait. Neither should your plan."*

Keep it to one line — more reads as pressure-y.

### 6. CTA — action verbs, not "Choose"
- Plus button: **"Start saving years →"**
- Pro button: **"Unlock my coach →"**
- Loading state: "Opening checkout…"

### 7. Trust row — replace lone "Cancel anytime"
A single row of three mono-caps items separated by `·`, centered, 10px, ink-faint:
> CANCEL ANYTIME · SECURE CHECKOUT · 7-DAY REFUND

(Only add "7-day refund" if you actually want to honor it — confirm before I ship. If not, swap for "INSTANT ACCESS".)

### 8. Optional micro-polish
- On the Pro card, add one short testimonial-style line above the feature list, italic 13px:
  > *"Saw I could buy 18 months sooner. Worth it."*
  Mark as a placeholder — replace with a real quote when you have one. If you'd rather not ship fake social proof, skip this entirely.

## Out of scope
- No changes to `tier-features.ts`, pricing page, Paddle, paywall logic, or feature gating.
- No new routes, no analytics events (can add later).
- No A/B testing infra — this replaces the current modal outright.

## Confirm before I build
1. **Refund policy** — OK to put "7-DAY REFUND" in the trust row? If not, I'll use "INSTANT ACCESS".
2. **Testimonial line** — Include the placeholder quote on Pro, or skip until you have a real one? (My vote: skip.)
3. **Headline numbers** — "2–4 years sooner" — is that defensible from the invest-vs-save projection, or should I soften to "months or years sooner"?
