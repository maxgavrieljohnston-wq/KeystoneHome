import {
  HOME_STYLES,
  styleAdjustments,
  calcMortgage,
  calcRequiredMonthly,
  rateFromCredit,
  rateAddFromDownPct,
  combinedEmploymentAdjustment,
  getPriceByZip,
} from "@/lib/keystone";
import { deriveAssumptions } from "@/lib/plan-assumptions";

export type PlanMetrics = {
  zip: string;
  city: string;
  homeStyleLabel: string;
  targetPrice: number;
  downPct: number;
  downPayment: number;
  mortgageRate: number;
  monthlyMortgage: number;
  taxIns: number;
  pmi: number;
  hoa: number;
  reserve: number;
  totalHousing: number;
  monthlyIncome: number;
  housingRatio: number;
  /** Front-end DTI (housing payment / gross income). Lenders prefer ≤ 28%. */
  frontEndDTI: number;
  /** Back-end DTI ((housing + other debts) / gross income). Lenders prefer ≤ 36%. */
  backEndDTI: number;
  /** Verdict on the front-end (housing) ratio vs the 28%/36% lender preference. */
  frontEndVerdict: "Affordable" | "A stretch" | "Difficult" | "—";
  /** Verdict on the back-end (total debt) ratio vs the 36%/43% lender preference. */
  backEndVerdict: "Affordable" | "A stretch" | "Difficult" | "—";
  /** Combined verdict — the worse of the two. */
  verdict: "Affordable" | "A stretch" | "Difficult" | "—";
  saved: number;
  timelineYears: number;
  monthlyToSave: number;
  monthlyInvested: number;
  expectedReturnRate: number;
  closing: number;
  moving: number;
  cashToClose: number;
  readiness: number;
  readinessLabel: string;
  monthlySavings: number;
};

export type GoalProgress = {
  hasGoal: boolean;
  pctToGoal: number;        // 0..100
  remaining: number;        // dollars still needed
  monthsToGoal: number | null;
  requiredMonthly: number | null; // to hit cashToClose by target_move_in
  statedMonthly: number;    // user's answers.monthlySavings
  paceDeltaMonthly: number | null; // statedMonthly - requiredMonthly (positive = ahead)
};

export function computeGoalProgress(
  m: PlanMetrics,
  currentSavings: number | null | undefined,
  targetMoveIn: string | null | undefined,
): GoalProgress {
  const saved = currentSavings ?? 0;
  const target = m.cashToClose || 0;
  const pctToGoal = target > 0 ? Math.max(0, Math.min(100, (saved / target) * 100)) : 0;
  const remaining = Math.max(0, target - saved);

  let monthsToGoal: number | null = null;
  let requiredMonthly: number | null = null;
  if (targetMoveIn) {
    const t = new Date(targetMoveIn).getTime();
    if (isFinite(t)) {
      const diffMs = t - Date.now();
      const months = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375)));
      monthsToGoal = months;
      requiredMonthly = months > 0 ? Math.ceil(remaining / months) : remaining > 0 ? remaining : 0;
    }
  }

  const statedMonthly = m.monthlySavings;
  const paceDeltaMonthly =
    requiredMonthly != null && statedMonthly > 0
      ? statedMonthly - requiredMonthly
      : null;

  return {
    hasGoal: !!targetMoveIn || (currentSavings != null && currentSavings > 0),
    pctToGoal,
    remaining,
    monthsToGoal,
    requiredMonthly,
    statedMonthly,
    paceDeltaMonthly,
  };
}

/**
 * Time to reach a cash-to-close goal:
 *  - monthsSaveOnly: months at the stated monthly contribution with NO return.
 *  - monthsInvested: months investing at annualReturnRate (compounded monthly).
 *  - timeSavedMonths: difference (positive = investing is faster).
 * Returns nulls when the inputs make the calculation meaningless.
 */
export function computeTimeToGoal(args: {
  cashToClose: number;
  currentSavings: number;
  monthlySavings: number;
  annualReturnRate: number;
}): {
  monthsSaveOnly: number | null;
  monthsInvested: number | null;
  timeSavedMonths: number | null;
} {
  const { cashToClose, currentSavings, monthlySavings, annualReturnRate } = args;
  if (!isFinite(cashToClose) || cashToClose <= 0) {
    return { monthsSaveOnly: null, monthsInvested: null, timeSavedMonths: null };
  }
  if (currentSavings >= cashToClose) {
    return { monthsSaveOnly: 0, monthsInvested: 0, timeSavedMonths: 0 };
  }
  if (monthlySavings <= 0) {
    return { monthsSaveOnly: null, monthsInvested: null, timeSavedMonths: null };
  }
  const remaining = cashToClose - currentSavings;
  const monthsSaveOnly = Math.ceil(remaining / monthlySavings);

  const r = annualReturnRate / 12;
  let monthsInvested: number;
  if (r <= 0) {
    monthsInvested = monthsSaveOnly;
  } else {
    // Solve currentSavings*g + monthlySavings*(g-1)/r = cashToClose, g=(1+r)^n
    const num = cashToClose + monthlySavings / r;
    const den = currentSavings + monthlySavings / r;
    if (den <= 0 || num <= 0) {
      monthsInvested = monthsSaveOnly;
    } else {
      const g = num / den;
      monthsInvested = Math.max(0, Math.ceil(Math.log(g) / Math.log(1 + r)));
    }
  }
  return {
    monthsSaveOnly,
    monthsInvested,
    timeSavedMonths: monthsSaveOnly - monthsInvested,
  };
}

export function formatMonths(m: number | null | undefined): string {
  if (m == null || !isFinite(m)) return "—";
  if (m <= 0) return "0 mo";
  const yrs = Math.floor(m / 12);
  const mo = m % 12;
  if (yrs === 0) return `${mo} mo`;
  if (mo === 0) return `${yrs} yr`;
  return `${yrs} yr ${mo} mo`;
}

export function computePlanMetrics(
  answers: Record<string, unknown>,
  storedAssumptions?: Record<string, number> | null,
): PlanMetrics {
  const a = answers ?? {};
  // Backend always derives defaults from the user's metro (or national fallback).
  // Any stored overrides from the Plus dashboard editor win over the derived values.
  const derived = deriveAssumptions(a);
  const assumptions: Record<string, number> = {
    ...derived,
    ...(storedAssumptions ?? {}),
  };
  const num = (k: string, fb = 0): number => {
    const v = a[k];
    return typeof v === "number" && isFinite(v) ? v : fb;
  };
  const str = (k: string): string | null => {
    const v = a[k];
    return typeof v === "string" && v.length ? v : null;
  };
  const bool = (k: string): boolean => a[k] === true;

  const zip = str("zip") ?? "";
  const zipDataRaw = a.zipData as { city?: string; avg?: number } | undefined;
  const zipData =
    zipDataRaw && typeof zipDataRaw.avg === "number"
      ? { city: zipDataRaw.city ?? "your area", avg: zipDataRaw.avg }
      : zip
        ? getPriceByZip(zip)
        : { city: "your area", avg: 400000 };

  const homeStyleId = str("homeStyle");
  const styleIds = homeStyleId ? [homeStyleId] : [];
  const styleAdj = styleAdjustments(styleIds);
  const styleName =
    HOME_STYLES.find((s) => s.id === homeStyleId)?.label ?? "Home";

  let mult = styleAdj.priceMult;
  mult += Math.max(0, num("beds") - 3) * 0.05;
  mult += Math.max(0, num("baths") - 2) * 0.03;
  // Outdoor/parking inputs were removed from onboarding; tolerate legacy plans
  // by leaving the multipliers behind a backwards-compat check.
  if (str("outdoorSpace") === "patio") mult += 0.02;
  if (str("outdoorSpace") === "yard") mult += 0.05;
  if (str("parking") === "driveway") mult += 0.02;
  if (str("parking") === "garage") mult += 0.05;
  const bumpFromTags = (raw: unknown) => {
    if (Array.isArray(raw)) {
      mult += raw.length * 0.015;
      return;
    }
    if (raw && typeof raw === "object") {
      // Legacy "must"/"nice" record format.
      Object.values(raw as Record<string, unknown>).forEach((v) => {
        mult += v === "must" ? 0.025 : v === "nice" ? 0.01 : 0;
      });
    }
  };
  bumpFromTags(a.lifestyle);
  bumpFromTags(a.neighborhood);

  const overrideRaw = a.targetPriceOverride;
  const targetPriceOverride =
    typeof overrideRaw === "number" && isFinite(overrideRaw) && overrideRaw > 0
      ? Math.round(overrideRaw)
      : null;
  const targetPrice = targetPriceOverride ?? Math.round(zipData.avg * mult);
  const downGoalPct = num("downGoalPct", 9);
  const effectiveDownPct = Math.max(downGoalPct, styleAdj.minDown);
  const downPayment = Math.round((targetPrice * effectiveDownPct) / 100);

  const hasPartner = bool("hasPartner");
  const credit = num("credit", 700);
  const partnerCredit = num("partnerCredit", credit);
  const qCredit = hasPartner ? Math.min(credit, partnerCredit) : credit;
  const empAdj = combinedEmploymentAdjustment(
    str("employment"),
    hasPartner ? str("partnerEmployment") : null,
  );
  const baseRate =
    rateFromCredit(qCredit) +
    empAdj.rateAdd +
    rateAddFromDownPct(effectiveDownPct);
  const mortgageRate =
    assumptions?.mortgageRatePct != null
      ? assumptions.mortgageRatePct / 100
      : baseRate;
  const monthlyMortgage = calcMortgage(targetPrice, effectiveDownPct, mortgageRate);

  // Tax + insurance — honor saved-plan keys (annual % / annual $) first,
  // then wizard keys (decimal rates), else defaults.
  const taxRate =
    assumptions?.propertyTaxPct != null
      ? assumptions.propertyTaxPct / 100
      : (assumptions?.propertyTaxRate ?? 0.012);
  const insuranceMonthly =
    assumptions?.insuranceAnnual != null
      ? assumptions.insuranceAnnual / 12
      : (targetPrice * (assumptions?.insuranceRate ?? 0.006)) / 12;
  const taxIns = (targetPrice * taxRate) / 12 + insuranceMonthly;

  const pmiPct =
    assumptions?.pmiPct != null ? assumptions.pmiPct / 100 : 0.005;
  const pmi =
    effectiveDownPct < 20
      ? (targetPrice * (1 - effectiveDownPct / 100) * pmiPct) / 12
      : 0;
  const hoa = assumptions?.hoaMonthly ?? styleAdj.hoa;
  const reserve = styleAdj.reserve;
  const totalHousing = monthlyMortgage + taxIns + pmi + hoa + reserve;

  const income = num("income");
  const partnerIncome = num("partnerIncome");
  const combinedIncome = income + (hasPartner ? partnerIncome : 0);
  const monthlyIncome = combinedIncome / 12;
  const housingRatio = monthlyIncome > 0 ? totalHousing / monthlyIncome : 0;
  const verdict: PlanMetrics["verdict"] =
    housingRatio === 0
      ? "—"
      : housingRatio <= 0.45
        ? "Affordable"
        : housingRatio <= 0.55
          ? "A stretch"
          : "Difficult";

  const saved = num("saved");
  const timelineYears = num("timelineYears", 3);
  const months = timelineYears * 12;
  const expectedReturnRate =
    assumptions?.expectedReturnPct != null
      ? assumptions.expectedReturnPct / 100
      : 0.07;
  const monthlyToSave = calcRequiredMonthly(saved, downPayment, months, 0);
  const monthlyInvested = calcRequiredMonthly(
    saved,
    downPayment,
    months,
    expectedReturnRate,
  );

  const closingPct =
    assumptions?.closingCostPct != null ? assumptions.closingCostPct : 3;
  const closing = Math.round((targetPrice * closingPct) / 100);
  const moving = assumptions?.movingCost != null ? assumptions.movingCost : 1500;
  const cashToClose = downPayment + closing + moving;

  const debt = num("debt") + (hasPartner ? num("partnerDebt") : 0);
  const creditScoreNorm = Math.max(
    0,
    Math.min(100, ((qCredit - 580) / (820 - 580)) * 100),
  );
  const qMonthlyIncome = monthlyIncome * empAdj.incomeFactor || 1;
  const dti = (debt + totalHousing) / qMonthlyIncome;
  const dtiScore = Math.max(
    0,
    Math.min(100, (1 - (dti - 0.45) / 0.2) * 100),
  );
  const savingsScore = Math.max(
    0,
    Math.min(100, (saved / Math.max(downPayment, 1)) * 100),
  );
  const timelineScore = Math.max(0, Math.min(100, (timelineYears / 5) * 100));
  const readiness = Math.round(
    creditScoreNorm * 0.3 +
      dtiScore * 0.3 +
      savingsScore * 0.25 +
      timelineScore * 0.15,
  );
  const readinessLabel =
    readiness >= 80
      ? "Ready to act"
      : readiness >= 60
        ? "Almost there"
        : readiness >= 40
          ? "Building toward it"
          : "Early days";

  return {
    zip,
    city: zipData.city,
    monthlySavings: num("monthlySavings"),
    homeStyleLabel: styleName,
    targetPrice,
    downPct: effectiveDownPct,
    downPayment,
    mortgageRate,
    monthlyMortgage,
    taxIns,
    pmi,
    hoa,
    reserve,
    totalHousing,
    monthlyIncome,
    housingRatio,
    verdict,
    saved,
    timelineYears,
    monthlyToSave,
    monthlyInvested,
    expectedReturnRate,
    closing,
    moving,
    cashToClose,
    readiness,
    readinessLabel,
  };
}

/**
 * Derive a "comfortable monthly savings capacity" from raw finance answers.
 * Mirrors the onboarding timeline-screen logic: take-home (income * 0.78 / 12),
 * subtract household expenses + debt, then cap at 25% of take-home. Rounded to $100.
 * Returns 0 when income data is missing.
 */
export function computeSavingsCapacity(
  answers: Record<string, unknown> | null | undefined,
): { capacity: number; takeHomeMonthly: number; headroom: number } {
  const num = (k: string): number => {
    const v = answers?.[k];
    return typeof v === "number" && isFinite(v) ? v : 0;
  };
  const hasPartner = answers?.hasPartner === true;
  const householdIncome = num("income") + (hasPartner ? num("partnerIncome") : 0);
  const householdExpenses =
    num("expenses") + (hasPartner ? num("partnerExpenses") : 0) +
    num("monthlyExpenses") + (hasPartner ? num("partnerMonthlyExpenses") : 0);
  const householdDebt = num("debt") + (hasPartner ? num("partnerDebt") : 0);
  const takeHomeMonthly = (householdIncome * 0.78) / 12;
  const headroom = Math.max(0, takeHomeMonthly - householdExpenses - householdDebt);
  const raw = Math.min(takeHomeMonthly * 0.25, headroom);
  const capacity = raw > 0 ? Math.max(100, Math.floor(raw / 100) * 100) : 0;
  return { capacity, takeHomeMonthly, headroom };
}
