import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  futureValue,
  projectScenarios,
  scenarioMonthsForContribution,
  investEdge,
  SCENARIOS,
  type Scenario,
} from "@/lib/invest-projection";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { updatePlanMeta } from "@/lib/plans.functions";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#5a8a5c",
};

const SCENARIO_COLOR: Record<Scenario["id"], string> = {
  savings: "#a39888",
  hysa: "#1a1a1a",
  blended: "#5a8a5c",
  invested: "#c4452d",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);

type RiskBand = {
  level: "high" | "medium" | "low";
  label: string;
  body: string;
  color: string;
};

function riskBandForYears(years: number): RiskBand {
  if (years < 3) {
    return {
      level: "high",
      label: "Short timeline — market risk",
      body: "With less than 3 years to go, a downturn could leave you short. Most planners suggest sticking with HYSA or a blended mix for short horizons.",
      color: C.ember,
    };
  }
  if (years < 5) {
    return {
      level: "medium",
      label: "Medium timeline — consider blended",
      body: "3 to 5 years is the gray zone. A blended (50/50 HYSA + invested) approach captures some upside while limiting downside risk.",
      color: "#b58a2a",
    };
  }
  return {
    level: "low",
    label: "Long timeline — invested makes sense",
    body: "5+ years gives the market time to recover from downturns. Investing historically beats saving meaningfully over this horizon.",
    color: C.sage,
  };
}

export function InvestVsSavePanel({
  answers,
  assumptions,
  planId,
  isPlus,
  locked,
  onLockedClick,
}: {
  answers: Record<string, unknown>;
  assumptions?: Record<string, number> | null;
  planId?: string;
  isPlus?: boolean;
  locked: boolean;
  onLockedClick: () => void;
}) {
  const metrics = useMemo(() => computePlanMetrics(answers, assumptions ?? null), [answers, assumptions]);
  const baseMonths = Math.max(1, Math.round(metrics.timelineYears * 12));
  const baseScenarios = useMemo(
    () => projectScenarios({ saved: metrics.saved, target: metrics.downPayment, months: baseMonths }),
    [metrics.saved, metrics.downPayment, baseMonths],
  );
  const investedBaseline = baseScenarios.find((s) => s.scenario.id === "invested")!;

  const persistedMonthly = (assumptions?.investMonthly as number | undefined) ?? null;
  const [monthly, setMonthly] = useState<number>(persistedMonthly ?? investedBaseline.monthly);

  // Resync when underlying plan changes (e.g. user picks a different plan in dashboard).
  useEffect(() => {
    setMonthly(persistedMonthly ?? investedBaseline.monthly);
  }, [persistedMonthly, investedBaseline.monthly]);

  const acc = useMemo(
    () => scenarioMonthsForContribution({ saved: metrics.saved, target: metrics.downPayment, monthly }),
    [metrics.saved, metrics.downPayment, monthly],
  );
  const edge = useMemo(
    () => investEdge({ saved: metrics.saved, target: metrics.downPayment, monthly }),
    [metrics.saved, metrics.downPayment, monthly],
  );

  // Debounced persistence of slider value.
  const updateMeta = useServerFn(updatePlanMeta);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!planId || !isPlus || locked) return;
    if (Math.round(monthly) === Math.round(persistedMonthly ?? investedBaseline.monthly)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const nextAssumptions = { ...(assumptions ?? {}), investMonthly: Math.round(monthly) };
      updateMeta({ data: { planId, assumptions: nextAssumptions } }).catch((e) => {
        console.warn("[invest panel] persist failed", e);
      });
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [monthly, planId, isPlus, locked, persistedMonthly, investedBaseline.monthly, assumptions, updateMeta]);

  const risk = riskBandForYears(metrics.timelineYears);

  // Chart horizon: out to whichever scenario takes longest (capped at 2× baseline).
  const horizonMonths = useMemo(() => {
    const longest = Math.max(...acc.map((r) => (isFinite(r.months) ? r.months : 0)));
    return Math.max(baseMonths, Math.min(longest || baseMonths, baseMonths * 2));
  }, [acc, baseMonths]);

  return (
    <Section
      eyebrow="— Invest vs. save"
      title="Your money can do the work."
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta="Unlock with Plus"
      requiredTier="plus"
    >
      <p style={{ color: C.inkSoft, fontSize: 16, lineHeight: 1.5, margin: "0 0 14px" }}>
        Same goal, four paths. Here's how long each takes — and what your dollars do for you along the way.
      </p>

      {/* Risk-aware framing */}
      <div
        style={{
          padding: "10px 14px",
          borderLeft: `3px solid ${risk.color}`,
          background: "rgba(0,0,0,0.02)",
          borderRadius: 4,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: risk.color,
            marginBottom: 4,
          }}
        >
          {risk.label} • {metrics.timelineYears.toFixed(1)} yr horizon
        </div>
        <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.45 }}>{risk.body}</div>
      </div>

      {/* Growth chart */}
      <GrowthChart
        saved={metrics.saved}
        target={metrics.downPayment}
        monthly={monthly}
        months={horizonMonths}
        baseMonths={baseMonths}
      />

      <div style={{ display: "grid", gap: 10, margin: "18px 0" }}>
        {baseScenarios.map((s) => {
          const accent = SCENARIO_COLOR[s.scenario.id];
          const recommended =
            (risk.level === "high" && s.scenario.id === "hysa") ||
            (risk.level === "medium" && s.scenario.id === "blended") ||
            (risk.level === "low" && s.scenario.id === "invested");
          return (
            <div
              key={s.scenario.id}
              style={{
                border: `1px solid ${recommended ? accent : C.inkFaint}`,
                borderRadius: 8,
                padding: "12px 14px",
                background: recommended ? `${accent}0d` : "transparent",
                position: "relative",
              }}
            >
              {recommended && (
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    left: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#fff",
                    background: accent,
                    padding: "2px 6px",
                    borderRadius: 3,
                  }}
                >
                  Suggested
                </span>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, background: accent, borderRadius: 2, display: "inline-block" }} />
                    <span style={{ fontSize: 16, color: C.ink, fontWeight: 500 }}>{s.scenario.label}</span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.inkMute, marginTop: 2 }}>
                    {s.scenario.blurb}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: accent, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(s.monthly)}<span style={{ fontSize: 11, color: C.inkMute }}> /mo</span>
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: C.inkMute, display: "flex", justifyContent: "space-between" }}>
                <span>You contribute {fmt(s.totalContributed)}</span>
                <span style={{ color: s.growth > 0 ? C.sage : C.inkMute }}>+ {fmt(s.growth)} growth</span>
              </div>
            </div>
          );
        })}
      </div>

      {edge.monthsSooner > 0 && (
        <div
          style={{
            padding: "14px 16px",
            background: C.ink,
            color: C.paper,
            borderRadius: 8,
            fontSize: 15,
            lineHeight: 1.45,
            marginBottom: 22,
          }}
        >
          Investing the same {fmt(monthly)}/mo gets you there{" "}
          <strong style={{ color: "#f0a890" }}>{edge.monthsSooner} months sooner</strong> — and your money does{" "}
          <strong style={{ color: "#f0a890" }}>{fmt(edge.dollarsSaved)}</strong> of the work for you.
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.inkFaint}`, paddingTop: 18 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.ember,
            marginBottom: 10,
          }}
        >
          Accelerator {planId && isPlus && !locked ? "· auto-saved" : ""}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: C.inkSoft }}>If I contribute</span>
          <span style={{ fontSize: 22, color: C.ink, fontWeight: 500 }}>{fmt(monthly)}<span style={{ fontSize: 11, color: C.inkMute }}> /mo</span></span>
        </div>
        <input
          type="range"
          min={50}
          max={Math.max(2000, Math.ceil(investedBaseline.monthly * 2))}
          step={25}
          value={monthly}
          onChange={(e) => setMonthly(Number(e.target.value))}
          style={{ width: "100%", accentColor: C.ember }}
        />
        <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
          {acc.map((row) => {
            const sc = SCENARIOS.find((s) => s.id === row.scenario.id)!;
            const reachable = isFinite(row.months);
            const color = SCENARIO_COLOR[row.scenario.id];
            return (
              <div key={row.scenario.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: color, borderRadius: 2, display: "inline-block" }} />
                  {sc.label}
                </span>
                <span style={{ color, fontVariantNumeric: "tabular-nums" }}>
                  {reachable ? `${row.months} months` : "Won't reach"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function GrowthChart({
  saved,
  target,
  monthly,
  months,
  baseMonths,
}: {
  saved: number;
  target: number;
  monthly: number;
  months: number;
  baseMonths: number;
}) {
  const W = 600;
  const H = 220;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 28;

  const STEP = Math.max(1, Math.ceil(months / 60));
  const xs: number[] = [];
  for (let m = 0; m <= months; m += STEP) xs.push(m);
  if (xs[xs.length - 1] !== months) xs.push(months);

  const series = SCENARIOS.map((s) => ({
    scenario: s,
    points: xs.map((m) => ({ m, v: futureValue(saved, monthly, s.rate, m) })),
  }));

  const yMax = Math.max(target * 1.15, ...series.flatMap((s) => s.points.map((p) => p.v)));
  const yMin = 0;

  const x = (m: number) => padL + ((W - padL - padR) * m) / months;
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - yMin) / (yMax - yMin));

  const path = (pts: { m: number; v: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

  const yTicks = [0, target * 0.5, target, yMax];

  return (
    <div style={{ width: "100%", overflow: "hidden", border: `1px solid ${C.inkFaint}`, borderRadius: 8, padding: 8, background: "#fff" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Growth comparison chart">
        {/* y-axis grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={v === target ? C.ember : "#eee"} strokeDasharray={v === target ? "4 3" : "2 4"} />
            <text x={4} y={y(v) + 4} fontSize="10" fontFamily="'JetBrains Mono', monospace" fill={v === target ? C.ember : C.inkMute}>
              {fmtCompact(v)}
            </text>
          </g>
        ))}

        {/* target label */}
        <text x={W - padR} y={y(target) - 4} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill={C.ember} textAnchor="end">
          GOAL · {fmtCompact(target)}
        </text>

        {/* baseline timeline marker (today's plan) */}
        <line
          x1={x(baseMonths)}
          x2={x(baseMonths)}
          y1={padT}
          y2={H - padB}
          stroke={C.inkMute}
          strokeDasharray="2 4"
        />
        <text x={x(baseMonths) + 4} y={padT + 10} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill={C.inkMute}>
          target date
        </text>

        {/* x-axis */}
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="#ccc" />
        {[0, Math.round(months / 2), months].map((m, i) => (
          <text key={i} x={x(m)} y={H - 8} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill={C.inkMute} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
            {Math.round(m / 12 * 10) / 10}y
          </text>
        ))}

        {/* curves */}
        {series.map((s) => (
          <path
            key={s.scenario.id}
            d={path(s.points)}
            fill="none"
            stroke={SCENARIO_COLOR[s.scenario.id]}
            strokeWidth={s.scenario.id === "invested" ? 2.4 : 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.scenario.id === "savings" ? 0.7 : 1}
          />
        ))}
      </svg>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
  locked,
  onLockedClick,
  lockedCta,
  requiredTier,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  locked: boolean;
  onLockedClick: () => void;
  lockedCta: string;
  requiredTier: "plus" | "pro";
}) {
  return (
    <div
      style={{
        marginTop: 28,
        padding: 24,
        border: `1.5px solid ${C.ink}`,
        borderRadius: 10,
        background: "#fff",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
          }}
        >
          {eyebrow}
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${C.ink}`,
            color: C.ink,
            background: requiredTier === "pro" ? C.ink : "transparent",
            ...(requiredTier === "pro" ? { color: C.paper } : {}),
          }}
        >
          {requiredTier}
        </span>
      </div>
      <h2 style={{ fontWeight: 400, fontSize: 26, letterSpacing: "-0.01em", margin: "0 0 14px", color: C.ink }}>{title}</h2>
      <div style={{ filter: locked ? "blur(4px)" : "none", pointerEvents: locked ? "none" : "auto", userSelect: locked ? "none" : "auto" }}>
        {children}
      </div>
      {locked && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: "rgba(245,239,230,0.6)",
          }}
        >
          <button
            type="button"
            onClick={onLockedClick}
            style={{
              padding: "12px 22px",
              background: C.ink,
              color: C.paper,
              border: "none",
              borderRadius: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            🔒 {lockedCta}
          </button>
        </div>
      )}
    </div>
  );
}

export { Section as InvestSection };
