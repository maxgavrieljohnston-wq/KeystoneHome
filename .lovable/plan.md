## Why "Download PDF" fails for a paid user

The dashboard unlocks the **Download PDF** button using `getDashboardExtras`, which considers the user paid if they have an active subscription in **either** Stripe environment (sandbox OR live):

```ts
hasActiveSubscription: isPaidSandbox || isPaidLive
```

But `exportPlanPdf` (and every other Plus/Pro-gated server function) only checks the **single** environment derived from the client's publishable key:

```ts
const allowed = await userHasActiveSub(context.userId, data.environment); // "live" or "sandbox", not both
if (!allowed) throw new Response("Upgrade required", { status: 403 });
```

Result: a user whose paid subscription lives in the opposite environment (typical when a tester paid via the sandbox/test flow but the published custom domain ships the live publishable key, or vice versa) sees the unlocked button but gets the alert "Couldn't generate your PDF. (PDF export requires a paid plan.)" on click. This matches exactly what you're seeing on the published site.

## Fix

Make the server-side entitlement check match the dashboard's "paid in any environment" rule. A real Plus/Pro subscriber should be unblocked regardless of which Stripe environment they purchased in.

### Changes

1. **`src/lib/plans.functions.ts`**
   - Add a helper `userHasAnyActiveSub(userId)` that runs `userHasActiveSub` for `"sandbox"` and `"live"` in parallel and returns true if either succeeds.
   - Replace the four `userHasActiveSub(context.userId, data.environment)` gates (lines 266, 352, 408, 460 — `exportPlanPdf`, `updatePlanMeta`, `applyAssumptionsPreset`, `setLivePreview`) with `userHasAnyActiveSub(context.userId)`.
   - Update `getDashboardExtras` to use the same helper for consistency (keeps the single source of truth).
   - The `data.environment` input stays in the schemas (no client change needed) but is no longer used for entitlement.

2. **`src/lib/coach.functions.ts`**
   - Same swap inside the file-local `userHasActiveSub` usage (line 30 and the call at line 779) so the AI coach is reachable from either environment for paid users.

3. **`src/lib/reminders.functions.ts`**
   - Same swap at line 45 so reminders enable/disable matches dashboard gating.

4. **Client copy nit (`src/routes/dashboard.tsx`)**
   - Change the catch-all alert from "PDF export requires a paid plan" to a neutral "Couldn't generate your PDF — please try again or contact support." The paid-plan message is misleading now that the real cause is almost always a transient generator error, not entitlement.

### Out of scope
- No DB / RLS / migration changes.
- No changes to webhook recording or to the publishable key environment detection.
- No changes to the `has_active_subscription` RPC.

### Verification
- On the published `johnstonsmagnolias.com` site, signed in with the Plus/Pro account, clicking **Download PDF** produces a PDF.
- A genuinely free account (no active sub in either env) still gets 403 and the upgrade alert.
- AI coach send and reminders toggle work for the same paid account on the live site.
