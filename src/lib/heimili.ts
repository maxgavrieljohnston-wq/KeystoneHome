export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function calcRequiredMonthly(saved: number, target: number, months: number, rate: number) {
  if (months <= 0 || saved >= target) return 0;
  const r = rate / 12;
  if (r === 0) return Math.max(0, Math.ceil((target - saved) / months));
  const g = Math.pow(1 + r, months);
  return Math.max(0, Math.ceil((target - saved * g) / ((g - 1) / r)));
}

export type Risk = { rate: number; label: string; desc: string; color: string };

export function deriveRisk(answers: Record<number, number>): Risk {
  const keys = Object.keys(answers);
  if (!keys.length)
    return { rate: 0.07, label: "Balanced", desc: "Index funds & bonds · ~7%/yr", color: "#a8d5e2" };
  const score = keys.reduce((a, k) => a + answers[Number(k)], 0);
  const pct = score / (keys.length * 3);
  if (pct >= 0.72)
    return { rate: 0.1, label: "Growth", desc: "Equities · ~10%/yr", color: "#fb923c" };
  if (pct >= 0.42)
    return { rate: 0.07, label: "Balanced", desc: "Index funds & bonds · ~7%/yr", color: "#a8d5e2" };
  return { rate: 0.04, label: "Conservative", desc: "Bonds & CDs · ~4%/yr", color: "#86efac" };
}

export const STRATEGIES: Risk[] = [
  { rate: 0.04, label: "Conservative", desc: "Bonds & CDs · ~4%/yr", color: "#86efac" },
  { rate: 0.07, label: "Balanced", desc: "Index funds & bonds · ~7%/yr", color: "#a8d5e2" },
  { rate: 0.1, label: "Growth", desc: "Equities · ~10%/yr", color: "#fb923c" },
];

export function calcMortgage(price: number, downPct: number, rate = 0.07, years = 30) {
  const principal = price * (1 - downPct / 100);
  const r = rate / 12;
  const n = years * 12;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

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

export const HOME_STYLES = [
  { id: "starter", label: "Starter Home", emoji: "🏠" },
  { id: "single", label: "Single Family", emoji: "🏡" },
  { id: "townhouse", label: "Townhouse", emoji: "🏘️" },
  { id: "condo", label: "Condo", emoji: "🏢" },
  { id: "multi", label: "Multi-Family", emoji: "🏬" },
  { id: "fixer", label: "Fixer-Upper", emoji: "🔨" },
];

export const CREDIT_BUCKETS = [
  { label: "Excellent", range: "740–850", value: 795, color: "#4ade80", desc: "Qualifies for the best rates available" },
  { label: "Good", range: "670–739", value: 704, color: "#a8d5e2", desc: "Solid options across most lenders" },
  { label: "Fair", range: "580–669", value: 624, color: "#fbbf24", desc: "Some loan options — rates will be higher" },
  { label: "Poor", range: "300–579", value: 450, color: "#f87171", desc: "Limited options — improving this helps most" },
];

export const RISK_QS = [
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
    q: "Your timeline if markets crash before you buy?",
    opts: [
      { label: "Buy on time no matter what", val: 0 },
      { label: "Delay 6 months", val: 1 },
      { label: "Delay 1–2 years for recovery", val: 2 },
      { label: "Wait as long as it takes", val: 3 },
    ],
  },
];

export const FACTS = {
  fact1: {
    icon: "👤",
    fact: "The average first-time home buyer is now 38 years old",
    context: "It's risen from 28 in 1991. You're not behind — the timeline has shifted.",
    source: "National Association of Realtors, 2024",
  },
  fact2: {
    icon: "🏠",
    fact: "Only 1 in 5 home buyers today is buying for the first time",
    context: "First-time buyers make up just 24% of the market — a historic low.",
    source: "NAR Profile of Home Buyers and Sellers, 2024",
  },
  fact3: {
    icon: "💵",
    fact: "The median first-time down payment is just 9%",
    context: "You don't need 20% to buy. FHA loans can go as low as 3.5%.",
    source: "NAR, 2024",
  },
  fact4: {
    icon: "📈",
    fact: "Investing your savings can cut your timeline in half",
    context: "$500/mo at 7% becomes $43k in 5 years — vs $30k under a mattress.",
    source: "Compound interest, the eighth wonder of the world",
  },
};
