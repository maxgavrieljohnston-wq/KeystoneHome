import { useMemo, useState } from "react";
import {
  projectScenarios,
  scenarioMonthsForContribution,
  investEdge,
  SCENARIOS,
} from "@/lib/invest-projection";
import { computePlanMetrics } from "@/lib/plan-metrics";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#5a8a5c",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function InvestVsSavePanel({
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
  const baseMonths = Math.max(1, Math.round(metrics.timelineYears * 12));
  const baseScenarios = useMemo(
    () => projectScenarios({ saved: metrics.saved, target: metrics.downPayment, months: baseMonths }),
    [metrics.saved, metrics.downPayment, baseMonths],
  );
  const investedBaseline = baseScenarios.find((s) => s.scenario.id === "invested")!;
  const [monthly, setMonthly] = useState(() => investedBaseline.monthly);

  const acc = useMemo(
    () => scenarioMonthsForContribution({ saved: metrics.saved, target: metrics.downPayment, monthly }),
    [metrics.saved, metrics.downPayment, monthly],
  );
  const edge = useMemo(
    () => investEdge({ saved: metrics.saved, target: metrics.downPayment, monthly }),
    [metrics.saved, metrics.downPayment, monthly],
  );

  return (
    <Section
      eyebrow="— Invest vs. save"
      title="Your money can do the work."
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta="Unlock with Plus"
      requiredTier="plus"
    >
      <p style={{ color: C.inkSoft, fontSize: 16, lineHeight: 1.5, margin: "0 0 18px" }}>
        Same goal, three paths. Here's how long each takes — and what your dollars do for you along the way.
      </p>

      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        {baseScenarios.map((s) => {
          const accent = s.scenario.id === "invested" ? C.ember : s.scenario.id === "hysa" ? C.ink : C.inkMute;
          return (
            <div
              key={s.scenario.id}
              style={{
                border: `1px solid ${s.scenario.id === "invested" ? C.ember : C.inkFaint}`,
                borderRadius: 8,
                padding: "12px 14px",
                background: s.scenario.id === "invested" ? "rgba(196,69,45,0.04)" : "transparent",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 16, color: C.ink, fontWeight: 500 }}>{s.scenario.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.inkMute }}>
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
          Accelerator
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
            return (
              <div key={row.scenario.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.inkSoft }}>{sc.label}</span>
                <span style={{ color: row.scenario.id === "invested" ? C.ember : C.ink, fontVariantNumeric: "tabular-nums" }}>
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
