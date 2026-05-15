// Curated list of account types we plan to recommend to first-time buyers.
// Affiliate URLs are intentionally null — swap in real partner links + UTM
// tracking once partnerships are signed. Categories are ordered by what's
// most useful for a 1-3 year homebuying horizon.

export type AccountCategory = {
  id: string;
  title: string;
  why: string;
  goodFor: string;
  providers: AccountProvider[];
};

export type AccountProvider = {
  name: string;
  blurb: string;
  affiliateUrl: string | null;
};

export const ACCOUNT_CATEGORIES: AccountCategory[] = [
  {
    id: "hysa",
    title: "High-yield savings (HYSA)",
    why: "FDIC-insured, ~10x the rate of a big-bank checking account. The default place to park your down payment.",
    goodFor: "Money you'll need within 1–3 years.",
    providers: [
      { name: "Marcus by Goldman Sachs", blurb: "Reliable, simple, no minimums.", affiliateUrl: null },
      { name: "Ally Bank Online Savings", blurb: "Easy buckets feature for goal tracking.", affiliateUrl: null },
      { name: "Wealthfront Cash", blurb: "Higher rate, integrated with their investing side.", affiliateUrl: null },
    ],
  },
  {
    id: "treasuries",
    title: "Treasury bills (T-bills)",
    why: "Backed by the U.S. government. Often beats HYSA on yield and is exempt from state income tax.",
    goodFor: "Lump sums you won't touch for 4–52 weeks.",
    providers: [
      { name: "TreasuryDirect", blurb: "Buy directly from the government, no fees.", affiliateUrl: null },
      { name: "Public.com Treasury", blurb: "Easier UX, auto-rolls maturing bills.", affiliateUrl: null },
    ],
  },
  {
    id: "roth-ira",
    title: "Roth IRA (first-time-buyer withdrawal)",
    why: "First-time buyers can pull up to $10,000 of earnings tax-free toward a home, plus all contributions any time.",
    goodFor: "Long-horizon savers (4+ years) who want tax-free growth.",
    providers: [
      { name: "Fidelity", blurb: "$0 fees, full fund selection, strong app.", affiliateUrl: null },
      { name: "Charles Schwab", blurb: "Excellent customer support, strong index funds.", affiliateUrl: null },
      { name: "Vanguard", blurb: "The original index-fund shop, lowest costs.", affiliateUrl: null },
    ],
  },
  {
    id: "taxable",
    title: "Taxable brokerage",
    why: "Maximum flexibility — pull money any time. Best when retirement accounts are already maxed.",
    goodFor: "Down-payment funds in a 3–5 year window.",
    providers: [
      { name: "Fidelity", blurb: "Free trades, fractional shares, great for index funds.", affiliateUrl: null },
      { name: "Charles Schwab", blurb: "Same idea, slightly different UX.", affiliateUrl: null },
      { name: "M1 Finance", blurb: "Great if you want a fixed allocation that auto-rebalances.", affiliateUrl: null },
    ],
  },
  {
    id: "hsa",
    title: "HSA (if you have a high-deductible plan)",
    why: "Triple tax-free if used for medical bills — and the cash you'd otherwise spend can go to your down payment.",
    goodFor: "Buyers with a HDHP who can pay current medical bills out of pocket.",
    providers: [
      { name: "Fidelity HSA", blurb: "$0 fees, full investing options.", affiliateUrl: null },
      { name: "Lively", blurb: "Modern UI, easy to manage and invest.", affiliateUrl: null },
    ],
  },
];
