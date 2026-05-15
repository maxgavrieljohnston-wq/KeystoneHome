I found that the Plus/Pro features do exist, but access is breaking in the published/live path.

Root causes:
- Published app reads only `live` subscriptions; several real user purchases are only recorded as `sandbox`, so the app treats those users as Free after publish.
- Some subscription rows use older product IDs like `plus_plan` / `pro_plan`; some code only recognizes the newer IDs/prices, so Pro checks can fail inconsistently.
- Protected server functions rely on auth headers, but the app is missing the global TanStack server-function auth middleware registration, so dashboard/feature data can fail to load reliably after sign-in.
- Premium panels are present, but the new investment panels only render when a linked plan is visible, making the paid features look like they were never built if plan claiming fails.

Implementation plan:

1. Add reliable server-function auth wiring
- Add the missing TanStack Start startup file.
- Register the existing auth attacher as global function middleware.
- Add root-level auth/query invalidation after sign-in/sign-out so the dashboard refreshes entitlements immediately.

2. Move subscription entitlement lookup to a server function
- Replace the direct client-side subscription table read in `useSubscription` with a small authenticated server function.
- Return only safe entitlement fields: tier, status, price, period end, and cancellation state.
- Normalize legacy/current IDs so Plus and Pro are recognized consistently.

3. Repair live entitlement reconciliation
- Add logic that, after login, can reconcile a user’s subscription by email if the payment row or saved plan was created before/around account setup.
- Ensure server-side premium checks use the same normalized tier logic, not duplicated `price_id === ...` checks.

4. Fix the published payment webhook path
- Keep signature verification intact.
- Handle subscription events using `customData.userId` when present.
- Also support customer-email fallback so plan-first purchases can unlock once the account exists.
- Persist the correct payment environment and normalized product/price identifiers.

5. Make dashboard paid features impossible to miss
- Keep the existing Plus/Pro panels: unlimited plans, PDF/CSV export, sharing, tags/notes/goals, themed reports, reminders, investment projections, recommended accounts, broker waitlist, Pro coach, compare, and rate alerts.
- Show a clear paid-status banner and feature list even if no plan is linked yet.
- If no plan is linked, show a clear “build or recover your plan” state instead of hiding the paid feature area.

6. Repair existing affected data
- Link orphan plans to their matching signed-in users by email.
- For the known affected published users, mirror valid paid entitlements into the live environment where appropriate so published access works.
- Verify `plus@test.keystone.dev` and `pro@test.keystone.dev` have active live entitlements and visible plans.

Validation:
- Confirm the published webhook settings still point to the stable published URL.
- Confirm live subscription rows exist for affected users.
- Confirm login routes directly to `/dashboard`.
- Confirm `/dashboard` shows the paid tier banner and unlocked Plus/Pro features.
- Confirm Plus unlocks investment/account/reminder/export/share features and Pro unlocks coach/compare/rate alerts.