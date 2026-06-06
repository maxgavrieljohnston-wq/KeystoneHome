## Goal
Make `max.license.to.trade@gmail.com` and future Plus buyers unlock Plus features immediately after purchase instead of staying locked.

## Findings so far
- The user account exists in auth: `max.license.to.trade@gmail.com`.
- That account has a saved plan.
- There is no matching row in the app’s `subscriptions` table, so the app currently reads the user as free.
- Plus feature locking depends on `useSubscription()`, which only reads the local `subscriptions` table.
- The payment webhook currently only updates the table from `customer.subscription.*` events, so if the webhook is delayed, missed, misconfigured, or the purchase event shape differs, Plus remains locked.
- The welcome page has a “poll” effect, but it does not actually refetch subscription status, so it cannot recover from webhook timing delays.

## Plan
1. **Confirm the payment record**
   - Check the payment provider data for `max.license.to.trade@gmail.com` to confirm the Plus purchase exists and identify whether it is sandbox or live.
   - If a paid subscription exists, backfill the missing `subscriptions` row for this test account so Plus unlocks right away.

2. **Harden webhook handling**
   - Update the payment webhook to upsert subscription rows for both subscription-created/updated events and checkout completion events when subscription data is present.
   - Add safer logging for ignored events and failed subscription upserts so future payment sync failures are visible.

3. **Add a server-side subscription sync fallback**
   - Add an authenticated server function that can look up the current signed-in user’s payment status from the payment provider by user id/email and upsert the local `subscriptions` row.
   - Use the existing shared payment gateway utility; do not expose secrets to the browser.

4. **Fix post-checkout polling**
   - Update `/welcome?checkout=success` to actually refetch/sync subscription status for a short window after payment.
   - If the webhook is just late, the page will unlock automatically.
   - If the webhook never arrives but the provider shows an active Plus subscription, the sync fallback will repair the local row.

5. **Make feature gates recover gracefully**
   - Ensure feature pages/dashboard refetch subscription state after returning from checkout and after the sync fallback succeeds.
   - Keep server-side entitlement checks for PDF export based on active subscription rows.

## Technical notes
- No database schema change should be needed.
- Code changes will likely touch:
  - `src/lib/payments.functions.ts`
  - `src/routes/api/public/payments/webhook.ts`
  - `src/hooks/useSubscription.ts`
  - `src/routes/welcome.tsx`
- One data repair may be needed for `max.license.to.trade@gmail.com` after confirming the payment provider’s source of truth.