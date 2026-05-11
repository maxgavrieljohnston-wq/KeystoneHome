## What's happening

The flow itself doesn't require login — Welcome → quiz questions → Handoff → free results page (`Report`) is fully anonymous. There's no auth gate on the results page.

The "Something went wrong" page you saw earlier was a runtime crash when the results screen tried to render, **not** a paywall or login redirect. Cause: the `useSubscription` hook on the results page uses React Query (`useQuery`), but the app didn't have a `QueryClientProvider` mounted, so the component threw the moment it rendered — which the global error boundary then caught and showed as "Something went wrong".

That fix already shipped in the previous turn (added `QueryClientProvider` in `src/routes/__root.tsx`).

## Plan

1. **Verify the fix in the running preview**
   - Reload the preview (the error boundary may still be holding the previous render).
   - Walk through the quiz end-to-end as an anonymous user and confirm the results page renders, with the upgrade CTA visible at the bottom.

2. **If it still errors, capture the real cause**
   - Read browser console + the runtime error stack (now that the QueryClient error is out of the way, any remaining error will surface clearly).
   - Fix that specific error.

3. **Tighten the anonymous path (small hardening, only if needed)**
   - `useSubscription` already gates its query on `!!userId`, so anonymous users skip the Supabase call and fall through to `tier: "free"`. No change expected.
   - The "Continue" button on the email screen is already enabled with just `@` in the field, but `upsertLead` rejects non-emails server-side and we ignore that error — so the flow proceeds either way. No change expected.

No code changes are planned in step 1; steps 2–3 are conditional on what the reload shows.