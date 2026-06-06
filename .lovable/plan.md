## Problem

On `/dashboard`, when a signed-in user with no plans clicks **Start your plan**, the page appears to refresh to itself.

## Root cause

The button is a `<Link to="/">` (in `src/routes/dashboard.tsx`, line 81-94). The home route (`src/routes/index.tsx`, lines 322-332) has a redirect: if a session exists and `?new=1` is not in the URL, it immediately navigates back to `/dashboard`. So the flow is:

`/dashboard` → click → `/` → auto-redirect → `/dashboard` (looks like a refresh).

The intake wizard on `/` is explicitly gated behind `?new=1` to avoid this exact loop for everyone else.

## Fix

In `src/routes/dashboard.tsx`, change the empty-state CTA from:

```tsx
<Link to="/">Start your plan</Link>
```

to:

```tsx
<Link to="/" search={{ new: 1 }}>Start your plan</Link>
```

That's the same convention already used elsewhere in the app for "start a new plan" entry points and satisfies the `isNewPlanFlow` check on the home route, so the wizard runs instead of bouncing.

## Scope

- One-line change in `src/routes/dashboard.tsx`.
- No backend, no styling, no other routes affected.
