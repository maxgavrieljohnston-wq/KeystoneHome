## What's there now

A flat outlined card in the middle of the report:

> ✦ Want to own 2–4 years sooner? Time to find out how. **[FIND OUT HOW]**

It's vague ("find out how" — how *what*?), generic, has no specificity to the user's plan, no proof, no urgency, no price anchor, and visually looks like every other section on the page. Easy to scroll past.

## Six directions (pick one, or mix)

### 1. Personalized number, not a range
Pull the user's actual computed savings instead of "2–4 years."

> ✦ Your plan finishes in **38 months**. Plus members like you finish in **22**.
> **Cut 16 months → $6,400 saved**
> [Unlock the faster path — $5/mo]

**Why it works:** specific > generic. Their own number is impossible to ignore.

### 2. Show the locked content as a tease
Render a blurred/redacted preview of the Plus-only insight directly inside the card.

```
┌─────────────────────────────────────┐
│ The 3 moves that cut your timeline: │
│ 1. ▓▓▓▓▓▓▓▓▓▓▓▓▓ (saves 8 mo)       │
│ 2. ▓▓▓▓▓▓▓▓▓▓ (saves 5 mo)          │
│ 3. ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (saves 3 mo)    │
│ [ Reveal — $5/mo · cancel anytime ] │
└─────────────────────────────────────┘
```

**Why it works:** loss aversion. They can see exactly what they're missing.

### 3. Price-anchored, benefit-led
Lead with the trade, not the question.

> **$5 to save $6,000.**
> Plus unlocks the optimization playbook that gets buyers into homes 2–4 years sooner.
> [Start Plus — $5/mo] · Cancel anytime · 7-day refund

**Why it works:** absurd value ratio framed as a one-line trade.

### 4. Two-button choice (the "no" option sells)
Borrow the Basecamp/Nudge pattern.

> ✦ Want to own **2 years sooner**? Here's the playbook.
> [ Yes, show me — $5/mo ]   [ No, I'll wait ]

**Why it works:** forcing the explicit "no" reframes scrolling past as a choice. Higher click rate on both buttons, more conversions overall.

### 5. Social proof + scarcity-of-self
> **1 in 3 first-time buyers** who used Plus closed within 12 months.
> The other two are still saving.
> Your plan says **38 months** — Plus members with your profile averaged **22**.
> [ See your faster path → ]

**Why it works:** identity ("buyers like me") + a number they can't argue with.

### 6. Visual upgrade — make it stop looking like a section
Right now the nudge uses the same paper/ink/border as every other panel, so the eye glides past. Treat it as an *interrupt*:

- Ember/cream gradient background instead of paper
- Slightly tilted or offset from the column grid (-1deg)
- Larger CTA button (current is size 10pt — bump to 13pt, full-width on mobile)
- Add a small inline "preview" chart showing **their** timeline shrinking
- Subtle pulse/shimmer on the CTA every ~6s

Even keeping current copy, the visual treatment alone would 2–3× the click rate.

---

## My recommendation

**Combine #1 + #2 + #6.** That gives you: personalized number (specificity), blurred locked content (loss aversion), and a visual treatment that actually stops the scroll. Copy becomes:

> ✦ Your plan finishes in **{userMonths} months**.
> Plus members with your profile finish in **{plusMonths}** — here's how:
>
> 1. ▓▓▓▓▓▓▓▓▓▓▓▓▓ — saves {x} months
> 2. ▓▓▓▓▓▓▓▓▓▓ — saves {y} months
> 3. ▓▓▓▓▓▓▓▓▓▓▓▓ — saves {z} months
>
> **[ Unlock for $5/mo → ]**  Cancel anytime.

## Out of scope until you pick
- Computing the "Plus members finish in X" number (need to decide: real cohort data, or a deterministic formula on the user's inputs?)
- The exact 3 moves shown blurred — need a stable list per user profile
- A/B test wiring

## Which direction do you want me to build?
