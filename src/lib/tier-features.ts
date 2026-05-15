// Single source of truth for what's in Plus and Pro.
// Used by: pricing page, upgrade modal, dashboard "Premium features" panel,
// and the report paywall on the index page. Update here, not in callsites.

export type TierFeature = {
  id: string;
  /** Compact label for checklists / dashboards. */
  short: string;
  /** Marketing-grade copy for pricing & upsell cards. */
  long: string;
};

export const PLUS_FEATURES: TierFeature[] = [
  {
    id: "save",
    short: "Unlimited saved plans",
    long: "Save unlimited scenarios (cities, timelines, down payments)",
  },
  {
    id: "invest",
    short: "Invest-vs-save projection",
    long: "Invest-vs-save projection — see how investing the down payment gets you there sooner",
  },
  {
    id: "action",
    short: "Monthly action plan (PDF)",
    long: "Savings & investing action plan (PDF) — what to do each month",
  },
  {
    id: "pdf",
    short: "Full plan export (PDF + CSV)",
    long: "Full plan export (PDF + CSV) — everything in your plan, portable",
  },
  {
    id: "tags",
    short: "Tags, notes & goal tracker",
    long: "Tags, notes & goal tracker",
  },
  {
    id: "theme",
    short: "Themed reports",
    long: "Themed reports (Light, Dark, Sepia, Navy, Terracotta)",
  },
  {
    id: "share",
    short: "Shareable plan link",
    long: "Shareable plan link",
  },
  {
    id: "reminders",
    short: "Email reminders",
    long: "Email reminders & milestones",
  },
];

export const PRO_FEATURES: TierFeature[] = [
  {
    id: "coach",
    short: "AI homebuying coach",
    long: "AI homebuying coach — plan-aware, with smart follow-ups",
  },
  {
    id: "compare",
    short: "Side-by-side scenario compare",
    long: "Side-by-side scenario comparison (up to 3 plans)",
  },
  {
    id: "alerts",
    short: "Live mortgage rate alerts",
    long: "Live mortgage rate alerts",
  },
];

export const PREMIUM_FEATURES: Array<TierFeature & { tier: "plus" | "pro" }> = [
  ...PLUS_FEATURES.map((f) => ({ ...f, tier: "plus" as const })),
  ...PRO_FEATURES.map((f) => ({ ...f, tier: "pro" as const })),
];
