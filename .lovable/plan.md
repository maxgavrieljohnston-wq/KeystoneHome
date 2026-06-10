## Plan

1. **Delete** `src/routes/accounts.tsx`. The route tree (`src/routeTree.gen.ts`) regenerates automatically.

2. **Update `src/lib/action-plan.ts`** — change the three `href: "/accounts"` CTAs to `href: "/features/accounts"` so all action-plan links in the dashboard route to the Accounts feature page.

No other files reference `/accounts`. Out of scope: visual changes, business logic on the Accounts feature page itself.