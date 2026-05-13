## Feature 1: Unlimited saved plans (Plus)

### Current state
Most of this feature already exists:

- DB function `create_plan_with_limit` enforces a 3-plan cap for non-paid users, unlimited for Plus/Pro.
- `getMyPlans` server fn merges owned + orphan plans by email and adopts orphans on first sign-in.
- `dashboard.tsx` shows plans, lets free users view 1 plan + locks the rest as `LockedPlanCard` with an upgrade CTA.
- `submitPlan` returns `{ reason: "limit_reached", used, limit }` when the cap is hit.

### Gaps to fix

1. **Inconsistent limits.** DB caps creation at **3**, but dashboard only reveals **1** to free users and locks the other 2. Either the user gets 3 free plans, or they get 1 — not both. Recommendation: align on **3 free plans, all viewable**, and gate creation of the 4th. Locking already-created plans behind a paywall feels like a bait-and-switch.

2. **`limit_reached` not surfaced to the user.** In `src/routes/index.tsx`, when `submitPlan` returns `limit_reached`, we need to verify the upgrade modal opens (`gate.openUpgrade("plus", "Unlimited saved plans")`) instead of silently failing. Need to read index.tsx to confirm.

3. **Dashboard "New plan" button** correctly gates on `plans.length >= FREE_LIMIT (3)`, which matches the DB. Good.

### Proposed changes

```text
src/routes/dashboard.tsx
  - PlansList: show ALL plans for free users (remove LockedPlanCard slicing)
  - Keep "X of 3 free plans used" counter
  - Keep handleNewPlan gate at >= 3

src/routes/index.tsx (verify, edit if needed)
  - On submitPlan { reason: "limit_reached" }: open upgrade modal with
    feature name "Unlimited saved plans"

(no DB changes — limit stays at 3)
```

### Open question for you

Pick the model:

- **A** — 3 free plans, all viewable, paywall the 4th creation. (Recommended; matches the DB and feels honest.)
- **B** — 1 free plan viewable, others locked-but-visible after creation. (Current dashboard UX; requires lowering the DB cap to 1 to be coherent.)
- **C** — Different number (tell me).

Once you pick, I'll implement in one pass and verify the upgrade modal triggers correctly on both the dashboard "New plan" button and the onboarding flow's submit path.
