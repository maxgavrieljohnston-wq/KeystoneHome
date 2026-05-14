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

  const yMax = Math.max(...series.flatMap((s) => s.path)) * 1.05;
  const yMin = 0;
  const w = 480;
  const h = 200;
  const pad = { l: 8, r: 8, t: 8, b: 18 };
  const xAt = (i: number, n: number) => pad.l + ((w - pad.l - pad.r) * i) / n;
  const yAt = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - (v - yMin) / (yMax - yMin));

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

      <div style={{ width: "100%", overflow: "hidden", border: `1px solid ${C.inkFaint}`, borderRadius: 8, padding: 8 }}>
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="xMidYMid meet">
          {/* Goal line */}
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={yAt(metrics.downPayment)}
            y2={yAt(metrics.downPayment)}
            stroke={C.ember}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text x={w - pad.r} y={yAt(metrics.downPayment) - 4} textAnchor="end" fontSize="10" fill={C.ember} fontFamily="JetBrains Mono, monospace">
            GOAL {fmt(metrics.downPayment)}
          </text>

          {series.map((s) => {
            const d = s.path
              .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i, s.path.length - 1).toFixed(1)} ${yAt(v).toFixed(1)}`)
              .join(" ");
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} />
                <circle cx={xAt(s.path.length - 1, s.path.length - 1)} cy={yAt(s.end)} r={3} fill={s.color} />
              </g>
            );
          })}
        </svg>
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
