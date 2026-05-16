// Derive default plan assumptions from the user's answers (mainly ZIP/metro).
// Used by computePlanMetrics so the backend always has sensible values without
// asking the user during signup. Plus members can override on the dashboard;
// those overrides win over the values returned here.

import { metroByZip } from "@/data/metros";

export type DerivedAssumptions = {
  /** Annual property tax as a decimal (e.g. 0.012 = 1.2%). */
  propertyTaxRate: number;
  /** Annual homeowners insurance as a decimal of price. */
  insuranceRate: number;
  /** Closing costs as a percent of price (storage format used by updatePlanMeta). */
  closingCostPct: number;
  /** Flat moving budget in dollars. */
  movingCost: number;
};

// National fallbacks — match what `plan-metrics.ts` used to default to.
const FALLBACK: DerivedAssumptions = {
  propertyTaxRate: 0.012,
  insuranceRate: 0.006,
  closingCostPct: 3,
  movingCost: 1500,
};

export function deriveAssumptions(
  answers: Record<string, unknown> | null | undefined,
): DerivedAssumptions {
  const zip =
    answers && typeof answers.zip === "string" ? (answers.zip as string) : "";
  const metro = zip ? metroByZip(zip) : undefined;
  return {
    propertyTaxRate: metro?.propertyTaxRate ?? FALLBACK.propertyTaxRate,
    insuranceRate: metro?.insuranceRate ?? FALLBACK.insuranceRate,
    closingCostPct: FALLBACK.closingCostPct,
    movingCost: FALLBACK.movingCost,
  };
}
