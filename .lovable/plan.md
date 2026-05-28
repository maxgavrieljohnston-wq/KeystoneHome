## Goal

On the "A quick read" screen after the finances step, show **only one** insight — the most impressive/reassuring one for that specific user — instead of stacking up to three.

## Logic (all three scored in the background)

Compute from current inputs (`income`, `partnerIncome`, `expenses`, `partnerExpenses`, `debt`, `partnerDebt`, `hasPartner`, already in context):

1. **Income-in-range** — score = how comfortably household income sits inside the typical first-time-buyer band for the an average home price of $400,000.
2. **Healthy debt load** — score based on monthly debt / take-home. Excellent ≤8%, good ≤15%, neutral ≤25%, weak above. Higher score = lower ratio.
3. **Budget headroom** — score based on `headroom = takeHome − expenses − debt`. Excellent ≥ $2,000/mo, strong ≥ $1,000, ok ≥ $400, weak below.

Normalize each to 0–100, then pick the highest. Ties broken in this priority: headroom > debt > income-in-range (headroom is most concrete/personalized).

If none of the three score above a minimum floor (e.g. all weak), fall back to the income-in-range copy (always safe/reassuring) rather than showing something that feels off.

## Implementation

Single file change: `src/routes/index.tsx`, in the `if (screen === "insightIncome")` block (~lines 835–861).

- Replace the array-push pattern with a `candidates` array of `{ headline, sub, score }`.
- Sort by score desc with the tie-break priority above.
- Pass a single-item `lines` array (`[best]`) to `<InsightScreen />` so the layout/component stays unchanged.

No changes to `InsightScreen`, copy, styling, or any other file. Visual identity preserved.