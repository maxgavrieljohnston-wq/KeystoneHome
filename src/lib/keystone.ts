// Keystone — financial engine & content constants for the homebuyer planner.

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);

// ── Investment / savings math ──────────────────────────────────────────────
export function calcRequiredMonthly(
  saved: number,
  target: number,
  months: number,
  rate: number,
) {
  if (months <= 0 || saved >= target) return 0;
  const r = rate / 12;
  if (r === 0) return Math.max(0, Math.ceil((target - saved) / months));
  const g = Math.pow(1 + r, months);
  return Math.max(0, Math.ceil((target - saved * g) / ((g - 1) / r)));
}

export type Risk = { rate: number; label: string; desc: string; tone: string };

export const STRATEGIES: Risk[] = [
  { rate: 0.04, label: "Conservative", desc: "Bonds & CDs · ~4%/yr", tone: "sage" },
  { rate: 0.07, label: "Balanced",     desc: "Index funds & bonds · ~7%/yr", tone: "ink" },
  { rate: 0.1,  label: "Growth",       desc: "Equities · ~10%/yr", tone: "ember" },
];

export function deriveRisk(answers: Record<number, number>): Risk {
  const keys = Object.keys(answers);
  if (!keys.length) return STRATEGIES[1];
  const score = keys.reduce((a, k) => a + answers[Number(k)], 0);
  const pct = score / (keys.length * 3);
  if (pct >= 0.72) return STRATEGIES[2];
  if (pct >= 0.42) return STRATEGIES[1];
  return STRATEGIES[0];
}

// ── Mortgage ───────────────────────────────────────────────────────────────
export function calcMortgage(price: number, downPct: number, rate = 0.07, years = 30) {
  const principal = price * (1 - downPct / 100);
  const r = rate / 12;
  const n = years * 12;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

/** 30-yr fixed mortgage rate by FICO. Illustrative tiers, not live quotes. */
export function rateFromCredit(score?: number | null): number {
  if (!score) return 0.07;
  if (score >= 740) return 0.0625;
  if (score >= 670) return 0.07;
  if (score >= 580) return 0.08;
  return 0.0925;
}

// ── ZIP → city + price ─────────────────────────────────────────────────────
export function getPriceByZip(zip: string): { city: string; avg: number } {
  const p = parseInt(zip.slice(0, 3));
  if (p >= 100 && p <= 119) return { city: "New York, NY", avg: 780000 };
  if (p >= 900 && p <= 918) return { city: "Los Angeles, CA", avg: 820000 };
  if (p >= 606 && p <= 608) return { city: "Chicago, IL", avg: 340000 };
  if (p >= 770 && p <= 774) return { city: "Houston, TX", avg: 310000 };
  if (p >= 850 && p <= 853) return { city: "Phoenix, AZ", avg: 380000 };
  if (p >= 191 && p <= 196) return { city: "Philadelphia, PA", avg: 350000 };
  if (p >= 750 && p <= 753) return { city: "Dallas, TX", avg: 380000 };
  if (p >= 951 && p <= 953) return { city: "San Jose, CA", avg: 1100000 };
  if (p >= 303 && p <= 304) return { city: "Atlanta, GA", avg: 360000 };
  if (p >= 802 && p <= 804) return { city: "Denver, CO", avg: 530000 };
  if (p >= 371 && p <= 372) return { city: "Nashville, TN", avg: 415000 };
  if (p >= 980 && p <= 981) return { city: "Seattle, WA", avg: 690000 };
  if (p >= 282 && p <= 283) return { city: "Charlotte, NC", avg: 370000 };
  if (p >= 336 && p <= 337) return { city: "Tampa, FL", avg: 360000 };
  if (p >= 331 && p <= 333) return { city: "Miami, FL", avg: 580000 };
  if (p >= 617 && p <= 621) return { city: "Boston, MA", avg: 660000 };
  if (p >= 670 && p <= 672) return { city: "Kansas City, MO", avg: 285000 };
  if (p >= 481 && p <= 482) return { city: "Detroit, MI", avg: 210000 };
  if (p >= 200 && p <= 205) return { city: "Washington, DC", avg: 620000 };
  if (p >= 297 && p <= 299) return { city: "Charleston, SC", avg: 470000 };
  return { city: "your area", avg: 400000 };
}

// ── Home styles ────────────────────────────────────────────────────────────
export type HomeStyle = {
  id: string;
  label: string;
  /** Multiplier vs. ZIP's average price */
  priceMult: number;
  /** Typical monthly HOA dues */
  hoa: number;
  /** Monthly maintenance / renovation reserve */
  reserve: number;
  /** Minimum down payment % */
  minDown: number;
  /** Short editorial note */
  note: string;
};

export const HOME_STYLES: HomeStyle[] = [
  { id: "starter",   label: "Starter",       priceMult: 0.80, hoa: 0,   reserve: 150, minDown: 3.5, note: "Smaller footprint, smaller price." },
  { id: "single",    label: "Single Family", priceMult: 1.10, hoa: 0,   reserve: 250, minDown: 3.5, note: "More space, more upkeep." },
  { id: "townhouse", label: "Townhouse",     priceMult: 0.90, hoa: 200, reserve: 100, minDown: 3.5, note: "Shared walls, modest dues." },
  { id: "condo",     label: "Condo",         priceMult: 0.75, hoa: 400, reserve: 50,  minDown: 3.5, note: "Lower price, real HOA." },
  { id: "multi",     label: "Multi-Family",  priceMult: 1.40, hoa: 0,   reserve: 350, minDown: 15,  note: "Income unit. 15% min down." },
  { id: "fixer",     label: "Fixer-Upper",   priceMult: 0.70, hoa: 0,   reserve: 500, minDown: 3.5, note: "Discount up front, work after." },
];

export function styleAdjustments(ids: string[]) {
  const picks = HOME_STYLES.filter((s) => ids.includes(s.id));
  if (picks.length === 0) return { priceMult: 1, hoa: 0, reserve: 0, minDown: 3.5 };
  const avg = (k: "priceMult" | "hoa" | "reserve") =>
    picks.reduce((a, p) => a + p[k], 0) / picks.length;
  return {
    priceMult: avg("priceMult"),
    hoa: avg("hoa"),
    reserve: avg("reserve"),
    minDown: Math.max(...picks.map((p) => p.minDown)),
  };
}

// ── Credit ─────────────────────────────────────────────────────────────────
export const CREDIT_BUCKETS = [
  { label: "Excellent", range: "740–850", value: 795, desc: "Best rates available", rate: 0.0625 },
  { label: "Good",      range: "670–739", value: 704, desc: "Solid lender options", rate: 0.07 },
  { label: "Fair",      range: "580–669", value: 624, desc: "Higher rates, still doable", rate: 0.08 },
  { label: "Poor",      range: "300–579", value: 450, desc: "Limited options today", rate: 0.0925 },
];

// ── Risk quiz ──────────────────────────────────────────────────────────────
export const RISK_QS = [
  {
    q: "How would you describe your investing experience?",
    opts: [
      { label: "Never invested before", val: 0 },
      { label: "A little — savings account mostly", val: 1 },
      { label: "Some — index funds or 401k", val: 2 },
      { label: "Lots — I trade actively", val: 3 },
    ],
  },
  {
    q: "What matters more to you?",
    opts: [
      { label: "Never losing principal", val: 0 },
      { label: "Mostly safety, a little growth", val: 1 },
      { label: "Balanced growth and safety", val: 2 },
      { label: "Maximum long-term growth", val: 3 },
    ],
  },
  {
    q: "If your investments dropped 20% in a month, you'd…",
    opts: [
      { label: "Sell everything immediately", val: 0 },
      { label: "Sell some to limit losses", val: 1 },
      { label: "Hold steady and wait", val: 2 },
      { label: "Buy more at the lower price", val: 3 },
    ],
  },
  {
    q: "Outside this home goal, how do you invest for retirement?",
    opts: [
      { label: "I don't yet", val: 0 },
      { label: "A default 401(k), set and forget", val: 1 },
      { label: "Regular contributions to index funds", val: 2 },
      { label: "Actively managed portfolio", val: 3 },
    ],
  },
];

// ── Employment ─────────────────────────────────────────────────────────────
export const EMPLOYMENT_TYPES = [
  { id: "w2",       label: "W-2 employee",   desc: "Salaried or hourly. Lenders love 2+ years steady." },
  { id: "self",     label: "Self-employed",  desc: "1099 / freelance. Plan for 2 years of tax returns." },
  { id: "owner",    label: "Business owner", desc: "K-1 / S-corp income. Underwriting is stricter." },
  { id: "contract", label: "Contractor",     desc: "Project-based. Document the income trail." },
  { id: "other",    label: "Other",          desc: "Retired, student, between roles." },
];

// ── Editorial fact cards ───────────────────────────────────────────────────
export const FACTS = {
  factDemo: {
    kicker: "No. 01 — Demographics",
    fact: "The average first-time buyer is now 38 years old.",
    context: "Up from 28 in 1991. The timeline has shifted — you're not behind.",
    source: "National Association of Realtors, 2024",
  },
  factDown: {
    kicker: "No. 02 — Down Payments",
    fact: "The median first-time down payment is just 9%.",
    context: "You don't need 20%. FHA loans can go as low as 3.5%.",
    source: "NAR, 2024",
  },
  factCompound: {
    kicker: "No. 03 — Compounding",
    fact: "Investing your savings can cut your timeline in half.",
    context: "$500/mo at 7% becomes $43k in five years — vs. $30k under a mattress.",
    source: "Compound interest, the eighth wonder of the world",
  },
};

// ── Section intro pages ────────────────────────────────────────────────────
export const INTROS = {
  introFinances: {
    chapter: "Chapter I",
    kicker: "First, the foundation",
    title: "Let's gather a few key pieces of your financial picture.",
    body: "Age, work, income, expenses, debt, credit, savings. Quick sliders — no documents, no commitments. Everything stays on this device.",
  },
  introHousehold: {
    chapter: "Chapter II",
    kicker: "Next, the household",
    title: "Who's on the loan with you?",
    body: "If you're buying with a partner, two incomes — and two credit scores — change the math. We'll only ask if it applies.",
  },
  introHome: {
    chapter: "Chapter III",
    kicker: "Then, the home",
    title: "Where you're buying, and what you're buying.",
    body: "ZIP code sets the local price benchmark. The home style shifts the monthly cost. A timeline turns it into a real plan.",
  },
  introRisk: {
    chapter: "Chapter IV",
    kicker: "Last, your style",
    title: "How you feel about risk decides how your savings grow.",
    body: "Four short questions. We'll match you to a Conservative, Balanced, or Growth strategy.",
  },
};

