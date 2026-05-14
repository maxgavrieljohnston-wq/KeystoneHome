## Plan to fix the full first-time user → paid account → dashboard flow

### What’s broken
- The app can save leads and plans, but the paid-account path is fragmented.
- Dashboard access depends on subscription rows and saved plans being linked to the signed-in user.
- The payment webhook currently only links subscriptions when `userId` exists in checkout custom data, so purchases that happen before a real account/password exists can fail to unlock Plus/Pro.
- The dashboard’s paid panels only render when at least one plan is visible; if plan linking or auth attachment fails, users see no meaningful paid features.
- The project has an auth-attacher file, but no `src/start.ts` registration file is present, so protected server functions may not reliably receive the signed-in user token.

### User-facing behavior to implement
1. **Home screen choice**
   - Keep the first screen simple: `Build My Plan` and `Sign In`.
   - `Build My Plan` starts the questionnaire.
   - `Sign In` goes to email/password login.

2. **First-time user path**
   - During the questionnaire, save name, email, phone, and partial answers to the backend.
   - At the final report, save the completed plan to the backend using the provided email.
   - After the plan is built, the user can choose Plus/Pro and purchase.
   - After purchase, route them to account setup so they can verify email and create a password.
   - Once the password is created, send them to `/dashboard`.

3. **Returning user path**
   - User clicks `Sign In`, enters email and password.
   - On successful login, redirect immediately to `/dashboard`.
   - Dashboard automatically claims any saved plan rows matching that email and attaches them to the signed-in user.
   - Dashboard shows their saved plan plus the Plus/Pro features they paid for.

### Technical implementation
1. **Auth/server-function reliability**
   - Add the missing TanStack Start `src/start.ts` file and register `attachSupabaseAuth` as global function middleware.
   - Add root-level auth cache invalidation so route/query data refreshes after login/logout.

2. **Subscription lookup hardening**
   - Replace direct client-side subscription reads in `useSubscription` with a server function that:
     - uses the authenticated user id,
     - reads the latest subscription with admin access,
     - returns only entitlement-safe fields.
   - This avoids RLS/session timing issues and makes Plus/Pro detection consistent.

3. **Payment webhook linking**
   - Update `/api/public/payments/webhook` to handle both account-first and plan-first purchases:
     - prefer `customData.userId` when present,
     - otherwise use customer email from the payment event,
     - find or create/link by matching saved lead/plan email where appropriate,
     - store enough information to activate Plus/Pro after account creation.
   - Keep webhook signature verification intact.

4. **Plan claiming after login/account setup**
   - Keep `getMyPlans` email-based claiming, but make it more robust:
     - normalize email matching,
     - claim orphan plans for the user,
     - return a clear latest plan list.
   - Add a similar entitlement reconciliation if a subscription was created against the same email before the account existed.

5. **Dashboard visibility**
   - Ensure the Plus/Pro feature area is visible and explicit after login.
   - If no plan is found, show a clear state that says the account is signed in but no saved plan is linked, with a `Build My Plan` action.
   - If a Plus/Pro subscription exists, show unlocked feature panels rather than hiding everything behind an empty plan state.

6. **Test account repair**
   - Repair `plus@test.keystone.dev` data so it has:
     - an active Plus subscription in the current environment,
     - at least one linked saved plan,
     - dashboard panels visible immediately after login.

### Validation
- Verify the database has a linked plan and active subscription for the test Plus account.
- Verify login redirects to `/dashboard`.
- Verify `/dashboard` loads saved plans and reports Plus/Pro entitlements.
- Verify the new Plus panels are visible for Plus and Pro accounts.