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
    q: "You check your account and see it dropped a bit this month. Nothing drastic — just a temporary dip.",
    sub: "What feels closest to your reaction?",
    opts: [
      { label: "That makes me uneasy — I'd want things to be more stable", val: 0 },
      { label: "I'd probably leave it alone and check back later", val: 2 },
      { label: "I'd see it as normal and stay focused on the long-term", val: 3 },
    ],
  },
  {
    q: "You hear that your plan could grow faster over time, but it might come with some ups and downs along the way.",
    sub: "What feels right to you?",
    opts: [
      { label: "I'd rather keep things predictable", val: 0 },
      { label: "I'd be open to some growth with a balance", val: 2 },
      { label: "I'm okay with ups and downs if it helps me get there faster", val: 3 },
    ],
  },
  {
    q: "You're tracking your savings month-to-month.",
    sub: "Which would feel better?",
    opts: [
      { label: "Slow, steady progress you can count on", val: 0 },
      { label: "Steady progress with some stronger months", val: 2 },
      { label: "Bigger jumps — even if some months are slower", val: 3 },
    ],
  },
  {
    q: "At night, thinking about your savings…",
    sub: "Which would help you sleep better?",
    opts: [
      { label: "Knowing your money is stable and protected", val: 0 },
      { label: "Knowing it's growing at a balanced pace", val: 2 },
      { label: "Knowing it's working hard to grow as much as possible", val: 3 },
    ],
  },
];

// ── Timeline buckets ───────────────────────────────────────────────────────
export const TIMELINE_BUCKETS = [
  { id: "now",     label: "Right away",     years: 1, desc: "Within the next year" },
  { id: "near",    label: "Near future",    years: 3, desc: "1 to 3 years out" },
  { id: "planning", label: "Planning ahead", years: 5, desc: "3 to 5+ years from now" },
];

// ── Down payment buckets (shown at the end, not asked) ─────────────────────
export const DOWN_BUCKETS = [
  { pct: 3.5, label: "3.5%", tag: "FHA",      desc: "Lowest barrier · PMI for a while" },
  { pct: 5,   label: "5%",   tag: "Conventional", desc: "Lower upfront · faster PMI drop" },
  { pct: 10,  label: "10%",  tag: "Solid",    desc: "Strong middle ground" },
  { pct: 20,  label: "20%",  tag: "Best",     desc: "No PMI · best rates" },
];

// ── Employment ─────────────────────────────────────────────────────────────
export const EMPLOYMENT_TYPES = [
  { id: "w2",       label: "W-2 employee",   desc: "Salaried or hourly." },
  { id: "self",     label: "Self-employed",  desc: "1099 or freelance income." },
  { id: "owner",    label: "Business owner", desc: "K-1 or S-corp income." },
  { id: "contract", label: "Contractor",     desc: "Project-based work." },
];

// ── Editorial fact cards ───────────────────────────────────────────────────
export const FACTS = {
  factDemo: {
    kicker: "",
    fact: "The average first-time buyer is now 38 years old.",
    context: "Up from 28 in 1991. The timeline has shifted — you're not behind.",
    source: "National Association of Realtors, 2024",
  },
  factDown: {
    kicker: "No. 02 — Down Payments",
    fact: "The median first-time down payment is just 9%.",
    context: "You don't need 20% to buy. Most first-time buyers put down far less than people think.",
    source: "National Association of Realtors, 2024",
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
  introHousehold: {
    chapter: "Chapter II",
    kicker: "Next, the household",
    title: "Are you buying on your own, or with a partner?",
    body: "Two incomes — and two credit scores — can change the math entirely. We'll start here so the rest of the questions make sense.",
  },
  introFinances: {
    chapter: "Chapter I",
    kicker: "First, the foundation",
    title: "Let's gather a few key pieces of your financial picture.",
    body: "Age, work, income, expenses, debt, savings, credit. Quick sliders — no documents, no commitments. Everything stays on this device.",
  },
  introHome: {
    chapter: "Chapter III",
    kicker: "Then, the home",
    title: "Where you're buying, and what you're buying.",
    body: "Your location sets the local price benchmark. The home style shifts the monthly cost. A timeline turns it into a real plan.",
  },
  introRisk: {
    chapter: "Chapter IV",
    kicker: "Compounding — the eighth wonder of the world",
    title: "Time to put your money to work.",
    body: "Answer the next four questions and we'll match you with a strategy to grow your down payment faster. There are no right answers — just what feels right to you.",
  },
  introPartnerSummary: {
    chapter: "Interlude",
    kicker: "Two on the loan",
    title: "Got it — we'll run the numbers as a household.",
    body: "From here on, income, debt, and credit are combined. Lenders will qualify you on the lower of the two credit scores, so we'll use that for your rate.",
  },
};

