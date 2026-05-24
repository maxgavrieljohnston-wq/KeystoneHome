/**
 * Coach context builder.
 *
 * Turns a plan row into a compact, human-readable digest that the AI coach
 * uses instead of the raw `answers` JSON. Cheaper on tokens, easier for the
 * model to reason about, and ensures the model sees the same numbers the
 * dashboard shows (housing ratio, verdict, invest-vs-save delta, etc.).
 */
import { computePlanMetrics, computeGoalProgress } from "@/lib/plan-metrics";
import { investEdge, projectScenarios } from "@/lib/invest-projection";

type PlanRow = {
  id?: string;
  title?: string | null;
  version?: number | null;
  answers: Record<string, unknown>;
  assumptions?: Record<string, number> | null;
  current_savings?: number | null;
  target_move_in?: string | null;
};

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Build the structured plan digest. Returns "" if the plan is empty enough
 * that the digest would be misleading.
 */
export function buildPlanDigest(plan: PlanRow | null | undefined): string {
  if (!plan) return "";
  let m;
  try {
    m = computePlanMetrics(plan.answers ?? {}, plan.assumptions ?? null);
  } catch {
    return "";
  }

  const a = plan.answers ?? {};
  const hasPartner = a.hasPartner === true;
  const income = typeof a.income === "number" ? a.income : 0;
  const partnerIncome = typeof a.partnerIncome === "number" ? a.partnerIncome : 0;
  const combinedIncome = income + (hasPartner ? partnerIncome : 0);

  const months = Math.max(1, Math.round(m.timelineYears * 12));
  let edgeLine = "";
  try {
    const scenarios = projectScenarios({
      saved: m.saved,
      target: m.downPayment,
      months,
    });
    const invested = scenarios.find((s) => s.scenario.id === "invested");
    if (invested) {
      const edge = investEdge({
        saved: m.saved,
        target: m.downPayment,
        monthly: invested.monthly,
      });
      edgeLine = `Invest-vs-save delta: investing at the same monthly contribution arrives ${edge.monthsSooner} months sooner and saves ${usd(edge.dollarsSaved)} in contributions.`;
    }
  } catch {
    /* noop */
  }

  const goal = computeGoalProgress(
    m,
    plan.current_savings ?? m.saved,
    plan.target_move_in ?? null,
  );

  const lines: string[] = [];
  lines.push(`## Plan: ${plan.title ?? "Untitled plan"}${plan.version && plan.version > 1 ? ` (v${plan.version})` : ""}`);
  lines.push(
    `Household: ${hasPartner ? "Two-income" : "Single"} | Combined gross income: ${usd(combinedIncome)}/yr`,
  );
  lines.push(
    `Target: ${m.homeStyleLabel} in ${m.city}${m.zip ? ` (ZIP ${m.zip})` : ""}`,
  );
  lines.push("");
  lines.push(`### The numbers`);
  lines.push(
    `- Target price: ${usd(m.targetPrice)} | Down ${m.downPct}% = ${usd(m.downPayment)} | Cash to close: ${usd(m.cashToClose)}`,
  );
  lines.push(
    `- Monthly housing: ${usd(m.totalHousing)} (mortgage ${usd(m.monthlyMortgage)} + taxes/ins ${usd(m.taxIns)}${m.pmi > 0 ? ` + PMI ${usd(m.pmi)}` : ""}${m.hoa > 0 ? ` + HOA ${usd(m.hoa)}` : ""})`,
  );
  lines.push(
    `- Housing ratio: ${pct(m.housingRatio)} of gross — **${m.verdict}**`,
  );
  lines.push(
    `- Mortgage rate used: ${(m.mortgageRate * 100).toFixed(2)}%`,
  );
  lines.push("");
  lines.push(`### Savings path`);
  lines.push(
    `- Currently saved: ${usd(m.saved)} of ${usd(m.downPayment)} down-payment goal (${Math.round(goal.pctToGoal)}% there)`,
  );
  lines.push(
    `- Timeline: ${m.timelineYears} year${m.timelineYears === 1 ? "" : "s"}`,
  );
  lines.push(
    `- Stated monthly savings: ${usd(m.monthlySavings)} | Required at 0% return: ${usd(m.monthlyToSave)}/mo | Required at ${pct(m.expectedReturnRate)} invested: ${usd(m.monthlyInvested)}/mo`,
  );
  if (goal.monthsToGoal != null && goal.requiredMonthly != null) {
    lines.push(
      `- Target move-in: ${plan.target_move_in} → needs ${usd(goal.requiredMonthly)}/mo over ${goal.monthsToGoal} months`,
    );
  }
  if (edgeLine) {
    lines.push("");
    lines.push(`### Keystone thesis`);
    lines.push(`- ${edgeLine}`);
  }
  lines.push("");
  lines.push(
    `Readiness score: ${m.readiness}/100 — "${m.readinessLabel}"`,
  );

  return lines.join("\n");
}

/**
 * Heuristic: should the model use higher reasoning effort?
 * Triggers on what-if / scenario / tradeoff phrasing.
 */
export function shouldUseExtendedReasoning(userMessage: string): boolean {
  const s = userMessage.toLowerCase();
  return (
    /\bwhat if\b/.test(s) ||
    /\bif i\b/.test(s) ||
    /\binstead of\b/.test(s) ||
    /\bstress[- ]?test\b/.test(s) ||
    /\bcompare\b/.test(s) ||
    /\bvs\.?\b/.test(s) ||
    /\btradeoff/.test(s) ||
    /\boptim(ize|al)/.test(s)
  );
}
