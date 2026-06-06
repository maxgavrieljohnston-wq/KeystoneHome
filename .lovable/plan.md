## Plan

1. **Stop the dashboard CTA from reopening the same empty dashboard loop**
   - Update the empty-dashboard button so it intentionally starts the new-plan flow at `/?new=1`.
   - Keep the existing signed-in dashboard protection intact.

2. **Make the homepage accessible again**
   - Adjust the home page’s signed-in redirect logic so users can view the main homepage instead of always being forced back to `/dashboard`.
   - Preserve the explicit new-plan flow so `/?new=1` still opens the intake wizard.

3. **Add a clear dashboard escape path if needed**
   - If the dashboard has no plans, provide a second link for the main homepage so “Start your plan” and “homepage” are not the same action.

## Technical details

- The loop is caused by `/dashboard` showing an empty state, while `/` redirects signed-in users back to `/dashboard` unless the URL includes `new=1`.
- I’ll make a minimal route/CTA change in `src/routes/dashboard.tsx` and `src/routes/index.tsx` only, with no backend or payment changes.