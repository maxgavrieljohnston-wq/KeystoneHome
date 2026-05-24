// Single source of truth for what's in Plus and Pro.
// Used by: pricing page, upgrade modal, dashboard "Premium features" panel,
// and the report paywall on the index page. Update here, not in callsites.

export type TierFeature = {
  id: string;
  /** Compact label for checklists / dashboards. */
  short: string;
  /** Marketing-grade copy for pricing & upsell cards. */
  long: string;
  /** When true, render with a "Coming soon" badge — feature not yet shipped. */
  comingSoon?: boolean;
};

export const PLUS_FEATURES: TierFeature[] = [
  {
    id: "invest",
    short: "Invest-vs-save projection",
    long: "Invest-vs-save projection — see how investing the down payment gets you there sooner",
  },
  {
    id: "action",
    short: "Monthly action plan",
    long: "Monthly action plan — themed PDF report (Light, Dark, Sepia, Navy, Terracotta) you can download or share via link",
  },
  {
    id: "assumptions",
    short: "Custom assumptions",
    long: "Override the auto-filled tax, insurance, closing, mortgage rate, and expected return for any plan",
  },
  {
    id: "picture",
    short: "Live home preview",
    long: "Live home preview — tweak ZIP, beds/baths, style, and must-haves to watch your target price update instantly",
  },
  {
    id: "reminders",
    short: "Email reminders",
    long: "Email reminders & milestones",
  },
  {
    id: "accounts",
    short: "Recommended accounts",
    long: "Curated investment & savings accounts to grow your down payment faster",
  },
];

export const PRO_FEATURES: TierFeature[] = [
  {
    id: "investing",
    short: "Auto-invest your down payment (coming soon)",
    long: "Auto-invest your down payment — we're partnering with a brokerage to invest your savings and reach your goal faster",
    comingSoon: true,
  },
  {
    id: "coach",
    short: "AI homebuying coach",
    long: "AI homebuying coach — plan-aware, with smart follow-ups",
  },
  {
    id: "alerts",
    short: "Live mortgage rate alerts",
    long: "Live mortgage rate alerts",
  },
  {
    id: "stress",
    short: "Affordability stress-test",
    long: "Stress-test your plan against rate shocks, income drops, and price changes",
  },
  {
    id: "market",
    short: "City market intelligence",
    long: "Live local market data: median price, price-to-income, trend",
  },
  {
    id: "docs",
    short: "Lender pre-qual doc vault",
    long: "Guided checklist + secure storage for your mortgage application",
  },
  {
    id: "broker",
    short: "Realtor & broker matching",
    long: "Get matched with vetted realtors and mortgage brokers in your market (priority for Pro)",
  },
];

export const PREMIUM_FEATURES: Array<TierFeature & { tier: "plus" | "pro" }> = [
  ...PLUS_FEATURES.map((f) => ({ ...f, tier: "plus" as const })),
  ...PRO_FEATURES.map((f) => ({ ...f, tier: "pro" as const })),
];
