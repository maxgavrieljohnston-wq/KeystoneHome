/**
 * Monthly Action Plan generator.
 *
 * Pure function. Given a user's plan (answers, assumptions, computed metrics),
 * their profile signals (credit band, lender doc count, reminders/share state),
 * and any previously checked items, returns a structured action plan:
 *   - summary (progress + pace)
 *   - thisMonth (3-5 personalized items for the current calendar month)
 *   - phases (Foundation → Build → Approach → Buy) with milestones
 *     AND a month-by-month drilldown for the months that fall in each phase.
 *
 * Used by the dashboard panel AND (in a follow-up) by the themed PDF.
 */
import type { PlanMetrics, GoalProgress } from "@/lib/plan-metrics";

export type ActionItem = {
  id: string;          // stable, e.g. "foundation.open_hysa", "month.3.transfer"
  label: string;
  detail?: string;
  cta?: { label: string; href: string };
  required?: boolean;  // can't be dismissed
};

export type PhaseId = "foundation" | "build" | "approach" | "buy";

export type Phase = {
  id: PhaseId;
  label: string;
  monthRange: string;
  isCurrent: boolean;
  milestones: ActionItem[];
  monthlyRows: {
    monthIndex: number;       // 0-based from today
    dateLabel: string;        // "Jun 2026"
    tasks: ActionItem[];
  }[];
};

export type ActionPlanSummary = {
  saved: number;
  goal: number;
  pctToGoal: number;
  monthsToGoal: number | null;
  paceStatus: "ahead" | "on_track" | "behind" | "unknown";
  paceDeltaMonths: number | null;     // negative = behind, positive = ahead
  statedMonthly: number;
  requiredMonthly: number | null;
  monthsElapsed: number | null;        // since plan created
};

export type ActionPlanProgress = {
  checked: string[];
  dismissed: string[];
  updatedAt: string | null;
};

export type ActionPlanSignals = {
  creditBand: "excellent" | "good" | "fair" | "poor" | "unknown";
  lenderDocCount: number;
  remindersEnabled: boolean;
  shareEnabled: boolean;
  hasPartner: boolean;
  city: string | null;
  state: string | null;
  planCreatedAt: string | null;
};

export type ActionPlan = {
  generatedAt: string;
  summary: ActionPlanSummary;
  thisMonth: ActionItem[];
  phases: Phase[];
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

const monthLabel = (offset: number, now: Date) => {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

function inferCreditBand(score: number | null | undefined): ActionPlanSignals["creditBand"] {
  if (typeof score !== "number" || !isFinite(score)) return "unknown";
  if (score >= 760) return "excellent";
  if (score >= 700) return "good";
  if (score >= 640) return "fair";
  return "poor";
}

export function deriveSignals(args: {
  answers: Record<string, unknown>;
  lenderDocCount: number;
  remindersEnabled: boolean;
  shareEnabled: boolean;
  planCreatedAt: string | null;
}): ActionPlanSignals {
  const a = args.answers ?? {};
  const credit = typeof a.credit === "number" ? (a.credit as number) : null;
  const zipData = (a.zipData as { city?: string; state?: string } | undefined) ?? undefined;
  return {
    creditBand: inferCreditBand(credit),
    lenderDocCount: args.lenderDocCount,
    remindersEnabled: args.remindersEnabled,
    shareEnabled: args.shareEnabled,
    hasPartner: a.hasPartner === true,
    city: zipData?.city ?? null,
    state: zipData?.state ?? null,
    planCreatedAt: args.planCreatedAt,
  };
}

function classifyPhase(monthsToGoal: number | null): PhaseId {
  if (monthsToGoal == null) return "foundation";
  if (monthsToGoal >= 12) return "foundation";
  if (monthsToGoal >= 6) return "build";
  if (monthsToGoal >= 3) return "approach";
  return "buy";
}

function phaseMonthRange(phase: PhaseId): string {
  switch (phase) {
    case "foundation": return "12+ months to close";
    case "build": return "6–12 months to close";
    case "approach": return "3–6 months to close";
    case "buy": return "0–3 months to close";
  }
}

function phaseLabel(phase: PhaseId): string {
  switch (phase) {
    case "foundation": return "Foundation";
    case "build": return "Build";
    case "approach": return "Approach";
    case "buy": return "Buy";
  }
}

/**
 * The big one. Builds the full plan deterministically.
 *
 * Stable IDs are critical — checkbox state is keyed by these. Don't rename
 * without a migration of saved progress.
 */
export function buildActionPlan(args: {
  metrics: PlanMetrics;
  goal: GoalProgress;
  signals: ActionPlanSignals;
  now?: Date;
}): ActionPlan {
  const now = args.now ?? new Date();
  const m = args.metrics;
  const g = args.goal;
  const s = args.signals;

  const monthsToGoal = g.monthsToGoal;
  const currentPhase = classifyPhase(monthsToGoal);

  // Pace
  let paceStatus: ActionPlanSummary["paceStatus"] = "unknown";
  let paceDeltaMonths: number | null = null;
  if (g.requiredMonthly != null && g.statedMonthly > 0 && monthsToGoal != null) {
    const ratio = g.statedMonthly / Math.max(1, g.requiredMonthly);
    paceStatus = ratio >= 1.1 ? "ahead" : ratio >= 0.9 ? "on_track" : "behind";
    if (ratio < 1 && g.statedMonthly > 0) {
      // Months they'll actually take at their stated pace:
      const projectedMonths = Math.ceil(g.remaining / g.statedMonthly);
      paceDeltaMonths = monthsToGoal - projectedMonths; // negative if behind
    } else {
      paceDeltaMonths = Math.round((ratio - 1) * monthsToGoal);
    }
  }

  let monthsElapsed: number | null = null;
  if (s.planCreatedAt) {
    const created = new Date(s.planCreatedAt).getTime();
    if (isFinite(created)) {
      monthsElapsed = Math.max(
        0,
        Math.round((now.getTime() - created) / (1000 * 60 * 60 * 24 * 30.4375)),
      );
    }
  }

  const summary: ActionPlanSummary = {
    saved: m.saved,
    goal: m.cashToClose,
    pctToGoal: g.pctToGoal,
    monthsToGoal,
    paceStatus,
    paceDeltaMonths,
    statedMonthly: g.statedMonthly,
    requiredMonthly: g.requiredMonthly,
    monthsElapsed,
  };

  // Split monthly contribution: invested portion vs HYSA.
  // If the user has an invest_pct in answers, honor it; otherwise default 60/40 to invest.
  const totalMonthly = Math.max(0, Math.round(g.statedMonthly || m.monthlyInvested || 0));
  const investedMonthly = Math.max(0, Math.round(m.monthlyInvested));
  const hysaMonthly = Math.max(0, totalMonthly - investedMonthly);
  const investRatePct = +(m.expectedReturnRate * 100).toFixed(1);

  // ---------- THIS MONTH ----------
  const thisMonth: ActionItem[] = [];

  if (hysaMonthly > 0) {
    thisMonth.push({
      id: `month.${now.getFullYear()}-${now.getMonth() + 1}.transfer_hysa`,
      label: `Transfer ${fmtUsd(hysaMonthly)} to your high-yield savings`,
      detail: "Your monthly down-payment contribution.",
      required: true,
    });
  }
  if (investedMonthly > 0) {
    thisMonth.push({
      id: `month.${now.getFullYear()}-${now.getMonth() + 1}.contribute_invest`,
      label: `Contribute ${fmtUsd(investedMonthly)} to your invested account`,
      detail: `Targeting ${investRatePct}% expected return.`,
      required: true,
    });
  }

  if (paceStatus === "behind" && g.requiredMonthly != null) {
    const gap = Math.max(0, g.requiredMonthly - g.statedMonthly);
    if (gap > 0) {
      thisMonth.push({
        id: "thismonth.catch_up",
        label: `You're behind pace — add ${fmtUsd(gap)}/mo or push move-in${
          paceDeltaMonths != null ? ` by ${Math.abs(paceDeltaMonths)} mo` : ""
        }`,
        detail: "Tighten budget, automate the bump, or revisit your timeline.",
      });
    }
  }

  if (!s.remindersEnabled) {
    thisMonth.push({
      id: "thismonth.enable_reminders",
      label: "Turn on monthly email reminders",
      cta: { label: "Manage reminders", href: "/rate-alerts" },
    });
  }

  if (s.creditBand === "fair" || s.creditBand === "poor" || s.creditBand === "unknown") {
    thisMonth.push({
      id: "thismonth.credit_report",
      label: "Pull your free credit report",
      detail: "annualcreditreport.com — disputes take 30+ days, start now.",
      cta: { label: "Open AnnualCreditReport", href: "https://www.annualcreditreport.com/" },
    });
  }

  if (currentPhase === "approach" || currentPhase === "buy") {
    if (s.lenderDocCount === 0) {
      thisMonth.push({
        id: "thismonth.first_lender_doc",
        label: "Upload your first lender document",
        detail: "Pay stub or W-2 to start your file.",
        cta: { label: "Upload now", href: "/documents" },
      });
    }
  }

  if (currentPhase === "foundation" && (monthsElapsed ?? 0) <= 1) {
    thisMonth.push({
      id: "thismonth.open_hysa",
      label: "Open a high-yield savings account",
      detail: "See your recommended accounts list.",
      cta: { label: "View accounts", href: "/accounts" },
    });
  }

  if (currentPhase === "approach" && !s.shareEnabled && s.hasPartner) {
    thisMonth.push({
      id: "thismonth.share_with_partner",
      label: "Share this plan with your partner",
    });
  }

  // Keep this card scannable.
  const TRIMMED_THIS_MONTH = thisMonth.slice(0, 6);

  // ---------- PHASE MILESTONES ----------
  const cityLabel = s.city ?? "your area";

  const foundationMilestones: ActionItem[] = [
    { id: "foundation.open_hysa", label: "Open a high-yield savings account",
      cta: { label: "Accounts", href: "/accounts" } },
    { id: "foundation.auto_transfer", label: "Set up auto-transfer to that HYSA every payday" },
    ...(investedMonthly > 0
      ? [{ id: "foundation.open_brokerage", label: "Open a brokerage or robo-advisor account",
          cta: { label: "Accounts", href: "/accounts" } } as ActionItem]
      : []),
    { id: "foundation.credit_baseline", label: "Pull a free credit report and note your baseline",
      cta: { label: "AnnualCreditReport", href: "https://www.annualcreditreport.com/" } },
    { id: "foundation.efund", label: "Confirm you have 3 months of expenses in an emergency fund (separate from down payment)" },
  ];

  const buildMilestones: ActionItem[] = [
    { id: "build.50pct", label: `Hit 50% of your down payment goal (${fmtUsd(m.cashToClose / 2)})` },
    { id: "build.shortlist_lenders", label: "Shortlist 2–3 lenders to compare" },
    { id: "build.prequal", label: "Get pre-qualified (soft credit pull — no commitment)" },
    ...(s.creditBand === "fair" || s.creditBand === "poor"
      ? [{ id: "build.dispute_credit", label: "Dispute any credit report errors you found" } as ActionItem]
      : []),
    { id: "build.first_lender_doc", label: "Start a lender doc folder (pay stubs, W-2s, bank statements)",
      cta: { label: "Documents", href: "/documents" } },
  ];

  const approachMilestones: ActionItem[] = [
    { id: "approach.preapproval", label: "Get pre-approval letter (hard pull, good for 60–90 days)" },
    { id: "approach.interview_agents", label: `Interview 2 agents in ${cityLabel}`,
      cta: { label: "Find brokers", href: "/broker-match" } },
    { id: "approach.earmark_cash", label: `Move closing-cost cash (${fmtUsd(m.closing + m.moving)}) into the HYSA, separate from emergency fund` },
    { id: "approach.rate_strategy", label: "Decide on rate-lock strategy with your lender" },
    { id: "approach.docs_complete",
      label: `Complete your lender doc folder${s.lenderDocCount > 0 ? ` (${s.lenderDocCount} uploaded)` : ""}`,
      cta: { label: "Documents", href: "/documents" } },
  ];

  const buyMilestones: ActionItem[] = [
    { id: "buy.house_hunt", label: `Active house hunting in ${cityLabel}` },
    { id: "buy.offer", label: "Make offer & negotiate" },
    { id: "buy.inspection", label: "Schedule inspection" },
    { id: "buy.appraisal", label: "Appraisal" },
    { id: "buy.rate_lock", label: "Lock your rate" },
    { id: "buy.close", label: "Close & get keys" },
  ];

  // ---------- MONTHLY ROWS ----------
  // Generate from now through monthsToGoal (cap at 36 months to keep things reasonable).
  const totalMonths = Math.min(36, Math.max(1, monthsToGoal ?? 12));

  const monthlyRowsByPhase: Record<PhaseId, Phase["monthlyRows"]> = {
    foundation: [],
    build: [],
    approach: [],
    buy: [],
  };

  for (let i = 0; i < totalMonths; i++) {
    const remaining = (monthsToGoal ?? totalMonths) - i;
    const rowPhase = classifyPhase(remaining);
    const dateLabel = monthLabel(i, now);
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1 + i).padStart(2, "0")}`;
    const tasks: ActionItem[] = [];
    if (hysaMonthly > 0) {
      tasks.push({
        id: `month.${ym}.transfer_hysa`,
        label: `Transfer ${fmtUsd(hysaMonthly)} → HYSA`,
        required: true,
      });
    }
    if (investedMonthly > 0) {
      tasks.push({
        id: `month.${ym}.contribute_invest`,
        label: `Contribute ${fmtUsd(investedMonthly)} → invested`,
        required: true,
      });
    }
    // Phase-flavored monthly nudge (every 3 months)
    if (i > 0 && i % 3 === 0) {
      if (rowPhase === "foundation") {
        tasks.push({ id: `month.${ym}.check_in`, label: "Quarterly check-in: review pace + adjust auto-transfer" });
      } else if (rowPhase === "build") {
        tasks.push({ id: `month.${ym}.lender_call`, label: "Check in with one lender — ask about current rates" });
      } else if (rowPhase === "approach") {
        tasks.push({ id: `month.${ym}.market_pulse`, label: `Tour 1–2 homes in ${cityLabel} to stay calibrated` });
      }
    }
    monthlyRowsByPhase[rowPhase].push({ monthIndex: i, dateLabel, tasks });
  }

  const phases: Phase[] = [
    {
      id: "foundation",
      label: phaseLabel("foundation"),
      monthRange: phaseMonthRange("foundation"),
      isCurrent: currentPhase === "foundation",
      milestones: foundationMilestones,
      monthlyRows: monthlyRowsByPhase.foundation,
    },
    {
      id: "build",
      label: phaseLabel("build"),
      monthRange: phaseMonthRange("build"),
      isCurrent: currentPhase === "build",
      milestones: buildMilestones,
      monthlyRows: monthlyRowsByPhase.build,
    },
    {
      id: "approach",
      label: phaseLabel("approach"),
      monthRange: phaseMonthRange("approach"),
      isCurrent: currentPhase === "approach",
      milestones: approachMilestones,
      monthlyRows: monthlyRowsByPhase.approach,
    },
    {
      id: "buy",
      label: phaseLabel("buy"),
      monthRange: phaseMonthRange("buy"),
      isCurrent: currentPhase === "buy",
      milestones: buyMilestones,
      monthlyRows: monthlyRowsByPhase.buy,
    },
  ];

  return {
    generatedAt: now.toISOString(),
    summary,
    thisMonth: TRIMMED_THIS_MONTH,
    phases,
  };
}
