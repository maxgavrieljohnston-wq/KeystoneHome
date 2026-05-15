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
};

export function computePlanMetrics(
  answers: Record<string, unknown>,
  assumptions?: Record<string, number> | null,
): PlanMetrics {
  const a = answers ?? {};
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
  if (str("outdoorSpace") === "patio") mult += 0.02;
  if (str("outdoorSpace") === "yard") mult += 0.05;
  if (str("parking") === "driveway") mult += 0.02;
  if (str("parking") === "garage") mult += 0.05;
  const w = (v: unknown) => (v === "must" ? 0.025 : v === "nice" ? 0.01 : 0);
  Object.values((a.lifestyle as Record<string, unknown>) ?? {}).forEach(
    (v) => (mult += w(v)),
  );
  Object.values((a.neighborhood as Record<string, unknown>) ?? {}).forEach(
    (v) => (mult += w(v)),
  );

  const targetPrice = Math.round(zipData.avg * mult);
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
