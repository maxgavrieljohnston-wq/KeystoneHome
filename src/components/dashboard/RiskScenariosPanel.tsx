import { useMemo } from "react";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { futureValue } from "@/lib/invest-projection";
import { InvestSection } from "./InvestVsSavePanel";

const C = {
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#5a8a5c",
  steel: "#4a5568",
};

const RISK_RATES = [
  { id: "conservative", label: "Conservative", rate: 0.04, color: "#5a8a5c" },
  { id: "balanced", label: "Balanced", rate: 0.06, color: "#1a1a1a" },
  { id: "growth", label: "Growth", rate: 0.08, color: "#c4452d" },
] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function RiskScenariosPanel({
  answers,
  assumptions,
  locked,
  onLockedClick,
}: {
  answers: Record<string, unknown>;
  assumptions?: Record<string, number> | null;
  locked: boolean;
  onLockedClick: () => void;
}) {
  const metrics = useMemo(() => computePlanMetrics(answers, assumptions ?? null), [answers, assumptions]);
  const months = Math.max(1, Math.round(metrics.timelineYears * 12));
  // Use 10% of monthly income as illustrative monthly contribution if no other anchor.
  const monthly = Math.max(100, Math.round(metrics.monthlyIncome * 0.1));

  const series = useMemo(() => {
    const points = 24;
    const step = months / points;
    return RISK_RATES.map((r) => {
      const path: number[] = [];
      for (let i = 0; i <= points; i++) {
        path.push(futureValue(metrics.saved, monthly, r.rate, Math.round(step * i)));
      }
      const end = path[path.length - 1];
      return {
        ...r,
        path,
        end,
        endLow: end * 0.85,
        endHigh: end * 1.15,
      };
    });
  }, [metrics.saved, monthly, months]);

  const goalLabel = fmt(metrics.downPayment);

  return (
    <InvestSection
      eyebrow="— Risk scenarios"
      title="What if returns shift?"
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta="Unlock with Pro"
      requiredTier="pro"
    >
      <p style={{ color: C.inkSoft, fontSize: 16, lineHeight: 1.5, margin: "0 0 12px" }}>
        Same monthly contribution ({fmt(monthly)}), three return assumptions, over {metrics.timelineYears} year
        {metrics.timelineYears === 1 ? "" : "s"}. Bands show ±15% on the projected end balance.
      </p>

      <div style={{ fontSize: 12, color: C.inkMute, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
        GOAL {goalLabel}
      </div>


      <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
        {series.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.inkSoft }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
              {s.label} <span style={{ color: C.inkMute, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>~{Math.round(s.rate * 100)}%</span>
            </span>
            <span style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>
              {fmt(s.end)} <span style={{ color: C.inkMute, fontSize: 11 }}>({fmt(s.endLow)} – {fmt(s.endHigh)})</span>
            </span>
          </div>
        ))}
      </div>
    </InvestSection>
  );
}
