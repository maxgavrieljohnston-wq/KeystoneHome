## Goal

1. Plus: change to **$4.99/month, billed annually at $49.99/year**.
2. Pro: hide the dollar price and "/mo" label; replace with a "Coming soon" placeholder. Keep the Pro card and feature list visible.

## 1. Create the new annual Plus price

Use the payments tool to add a `plus_yearly` price ($49.99/year) on the existing `plus_plan` product. We'll switch checkout to use this price ID instead of `plus_monthly`. The `useSubscription` hook already recognizes `plus_yearly` as Plus tier, so no DB or webhook changes needed.

## 2. Pricing page — `src/routes/pricing.tsx`

- Plus plan entry:
  - `priceId: "plus_yearly"`
  - Display `$4.99` with `/ month` label.
  - Replace "Billed monthly · cancel anytime" with **"Billed annually at $49.99 · cancel anytime"**.
- Pro plan entry:
  - Replace the `$11 / month` block and the `Billed monthly...` line with a single **"Coming soon"** placeholder (mono uppercase, same vertical space).
  - The existing `proLocked`/"Coming Soon" button already disables checkout — keep behavior.
- Footer line "Both plans renew monthly" → "Plus renews annually — cancel anytime."

## 3. Upgrade modal — `src/components/UpgradeModal.tsx`

- Plus tier: `priceId: "plus_yearly"`, display `$4.99/mo`, and update `priceFrame` to **"$49.99/yr · billed annually"** (replaces "Less than $0.25 a day").
- Pro tier: replace the `$11 /mo` price block + `priceFrame` with a single **"Coming soon"** label (same style as pricing page). Keep features and CTA disabled state.

## 4. Out of scope

- No changes to `useSubscription`, webhook handler, or DB schema — `plus_yearly` is already recognized as Plus.
- No changes to Pro feature list, gating, or `proAvailable` logic.
- Coach gating (`pro_monthly`/`pro_yearly` check) untouched.

## Technical notes

- `payments--create_price` with `id: "plus_yearly"`, `product_id: "plus_plan"`, `amount: 4999`, `currency: "usd"`, `recurring_interval: "year"`, `quantity_min: 1`, `quantity_max: 1`.
- Both UI files share an inline-styles design system (Cormorant Garamond serif + JetBrains Mono for meta lines); the "Coming soon" placeholder will reuse the mono micro-caps style already used for "/ month" labels.
