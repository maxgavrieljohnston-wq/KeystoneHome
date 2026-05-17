## TL;DR

You have **decent breadth, weak depth.** Five upsell surfaces exist (inline nudge, end-of-report dark section, mobile sticky bar, modal itself, scattered locked panels). What's missing is the *persuasion stack* — social proof, risk reversal, urgency, and a single dominant CTA per screen. Right now every button competes for attention and the copy varies wildly.

## What you have today

| Surface | Where | Strength | Weakness |
|---|---|---|---|
| InlineUpgradeNudge | Mid-report | Personalized number + blurred tease — best in class | Only fires once |
| Dark "Unlock the full plan" | End of report | Strong visual | Shows **both** Plus + Pro buttons → choice paralysis |
| StickyUpgradeBar | Mobile, after 600px scroll | Persistent reminder | Generic copy ("Own years sooner") — same for everyone |
| UpgradeModal | On gate | Highlights + collapse (just shipped) | No social proof, no guarantee, no scarcity |
| Locked feature cards | Dashboard, coach, compare, etc. | Functional gates | Passive — wait for user to click |

## Are CTAs good enough? No.

Three problems:

1. **Inconsistent voice.** "Start Plus — $5/mo" / "Unlock for $5/mo →" / "See how" / "Find out how" / "Go Pro — $11/mo" — five different verbs across five buttons. Pick one pattern: **outcome verb + price**. e.g. "Cut 16 months — $5/mo".
2. **Two buttons at once kills conversion.** The end-of-report block shows Plus *and* Pro side by side. Lead with Plus as the hero, make Pro a text link underneath ("Need the AI coach? Go Pro →"). Single dominant CTA always beats two.
3. **"Go Pro" is transactional, not aspirational.** Sell the outcome: "Add your AI coach — $11/mo" or "Hand off the investing — $11/mo".

## The 9 highest-leverage additions, ranked

### Tier A — ship first (biggest lift, low effort)

**1. Social proof strip above every upgrade card.**
"**2,431 plans built this month.** 1 in 3 first-time buyers who used Plus closed within 12 months."
Numbers can be approximate or live from the DB. Trust > everything else for a $5 SaaS.

**2. Money-back guarantee, prominent.**
"**7-day money-back, no questions.**" — bigger than "cancel anytime." Risk reversal is the #1 conversion lever for sub-$20 SaaS.

**3. Personalize the sticky bar.**
Today: "Own years sooner · $5/mo".
Better: "**Cut 16 months off your plan → $5/mo**" (reuse the same `monthsSooner` math from `InlineUpgradeNudge`). Persistent personalized number is hard to ignore.

**4. Collapse the end-of-report dual-CTA into one hero CTA + secondary link.**
Hero: "Start Plus — $5/mo · 7-day refund"
Below: "Want the AI coach too? See Pro →"

### Tier B — strong adds (medium effort)

**5. Annual price anchor with real savings.**
Today: $5/mo or $60/yr (identical). Make annual cheaper: **$50/yr (save $10)** or **$48/yr (2 months free)**. Without a discount, "yearly" does nothing.

**6. Exit-intent modal (desktop).**
On mouse-to-close-tab: "Wait — your plan finishes 16 months sooner with Plus. Want me to email it?" Capture email if not already + offer 1-click upgrade link.

**7. Second inline nudge near the Pro-locked section.**
You have one mid-report Plus nudge. Add a second one introducing the AI coach with a sample exchange ("Ask anything — *Can I really afford this?* *What if rates drop?*"). Show, don't tell.

**8. "Last 7 days" peer pressure (if data allows).**
"**12 buyers in {their_zip}** started Plus this week." Or "**47 plans** built in {city} this month." Localized social proof outperforms global. Needs aggregate count from `leads` or `plans` table.

### Tier C — bigger bets

**9. Free 7-day trial, no card.**
Removes the only real friction. You're using Paddle so this is configurable. Conversion lift typically 30–80% vs. pay-to-start, at the cost of some freeloaders. Worth A/B testing.

## Smaller copy fixes worth doing alongside

- "Less than one coffee" → "**Less than $0.17 a day**" or "**Less than 1 day of rent**" — coffee is consumed, rent is the pain you're solving.
- "Pays for itself if it saves one month" — strong, keep it.
- "The market won't wait. Neither should your plan." — strong, keep it.
- "Every month you wait is compounding you don't get back." — strong, keep it.
- All Plus CTAs → standardize on **"Start Plus — $5/mo"**.
- All Pro CTAs → standardize on **"Add your AI coach — $11/mo"**.

## My recommendation

Ship **Tier A (#1–#4) in one batch.** That's the social proof strip, money-back badge, personalized sticky bar, and collapsing the dual-CTA. ~30 min of work, biggest expected lift. Then look at trial/exit-intent.

## Which to build?

Pick a number or set:
- **A1–A4** (recommended starting point)
- **All of A + #5 annual discount**
- **All of A + #7 second nudge for Pro**
- Custom — tell me which ones
