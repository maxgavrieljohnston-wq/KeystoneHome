// Pure math for invest-vs-save projections.
// All return values are dollars unless noted.

export type Scenario = {
  id: "savings" | "hysa" | "blended" | "invested";
  label: string;
  blurb: string;
  rate: number; // annual decimal
};

export const SCENARIOS: Scenario[] = [
  { id: "savings", label: "Savings account", blurb: "~0.5% APY", rate: 0.005 },
  { id: "hysa", label: "High-yield savings", blurb: "~4% APY", rate: 0.04 },
  { id: "blended", label: "Blended (50/50)", blurb: "Half HYSA, half invested", rate: 0.055 },
  { id: "invested", label: "Invested", blurb: "~7% blended return", rate: 0.07 },
];

// Months required to grow `saved` to `target` contributing `monthly` at annual `rate`.
// Returns Infinity if unreachable.
export function monthsToGoal(
  saved: number,
  target: number,
  monthly: number,
  rate: number,
): number {
  if (saved >= target) return 0;
  if (monthly <= 0 && rate <= 0) return Infinity;
  const r = rate / 12;
  // Closed form: target = saved*(1+r)^n + monthly * ((1+r)^n - 1)/r
  if (r === 0) return Math.ceil((target - saved) / monthly);
  const num = target * r + monthly;
  const den = saved * r + monthly;
  if (den <= 0 || num / den <= 0) return Infinity;
  const n = Math.log(num / den) / Math.log(1 + r);
  if (!isFinite(n) || n < 0) return Infinity;
  return Math.ceil(n);
}

// Future value at n months given monthly contribution.
export function futureValue(saved: number, monthly: number, rate: number, months: number) {
  if (months <= 0) return saved;
  const r = rate / 12;
  if (r === 0) return saved + monthly * months;
  const g = Math.pow(1 + r, months);
  return saved * g + monthly * ((g - 1) / r);
}

// Monthly required to hit target in fixed months at given rate.
export function requiredMonthly(
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

export type ScenarioResult = {
  scenario: Scenario;
  monthly: number;       // contribution needed at baseline timeline
  months: number;        // months to goal at that contribution
  totalContributed: number;
  growth: number;        // dollars from interest/return
};

// For a fixed timeline (months), compute required monthly + growth for each scenario.
export function projectScenarios({
  saved,
  target,
  months,
}: {
  saved: number;
  target: number;
  months: number;
}): ScenarioResult[] {
  return SCENARIOS.map((s) => {
    const monthly = requiredMonthly(saved, target, months, s.rate);
    const totalContributed = monthly * months;
    const endValue = futureValue(saved, monthly, s.rate, months);
    const growth = Math.max(0, Math.round(endValue - saved - totalContributed));
    return {
      scenario: s,
      monthly,
      months,
      totalContributed: Math.round(totalContributed),
      growth,
    };
  });
}

// Given a fixed monthly amount, how many months under each scenario to hit target.
export function scenarioMonthsForContribution({
  saved,
  target,
  monthly,
}: {
  saved: number;
  target: number;
  monthly: number;
}) {
  return SCENARIOS.map((s) => ({
    scenario: s,
    months: monthsToGoal(saved, target, monthly, s.rate),
  }));
}

// Headline stat: difference between savings (0.5%) and invested (7%) timeline
// for the same monthly contribution.
export function investEdge({
  saved,
  target,
  monthly,
}: {
  saved: number;
  target: number;
  monthly: number;
}) {
  const mSavings = monthsToGoal(saved, target, monthly, 0.005);
  const mInvested = monthsToGoal(saved, target, monthly, 0.07);
  if (!isFinite(mSavings) || !isFinite(mInvested)) {
    return { monthsSooner: 0, dollarsSaved: 0 };
  }
  const monthsSooner = Math.max(0, mSavings - mInvested);
  const dollarsSaved = Math.max(0, Math.round(monthly * monthsSooner));
  return { monthsSooner, dollarsSaved };
}
