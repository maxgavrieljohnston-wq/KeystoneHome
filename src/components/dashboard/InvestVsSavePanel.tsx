import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { monthsToGoal, futureValue } from "@/lib/invest-projection";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { updatePlanMeta } from "@/lib/plans.functions";
import { STRATEGIES } from "@/lib/keystone";

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
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtMonths = (m: number): string => {
  if (!isFinite(m) || m <= 0) return "—";
  if (m < 12) return `${m} mo`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r === 0 ? `${y} yr` : `${y} yr ${r} mo`;
};




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
  const metrics = useMemo(
    () => computePlanMetrics(answers, assumptions ?? null),
    [answers, assumptions],
  );

  const userRate = metrics.expectedReturnRate || 0.07;
  const realistic = realisticRate(userRate);
  const statedMonthly = Math.max(50, Math.round(metrics.monthlySavings || 0));

  // Slider defaults to persisted investMonthly, else user's stated monthly.
  const persistedMonthly = (assumptions?.investMonthly as number | undefined) ?? null;
  const [monthly, setMonthly] = useState<number>(persistedMonthly ?? statedMonthly);

  useEffect(() => {
    setMonthly(persistedMonthly ?? statedMonthly);
  }, [persistedMonthly, statedMonthly]);

  // Baseline: time to goal at their CURRENT stated monthly + their chosen rate.
  const baselineMonths = useMemo(
    () => monthsToGoal(metrics.saved, metrics.downPayment, statedMonthly, userRate),
    [metrics.saved, metrics.downPayment, statedMonthly, userRate],
  );

  // Slider scenario: time to goal at chosen monthly + their rate.
  const sliderMonths = useMemo(
    () => monthsToGoal(metrics.saved, metrics.downPayment, monthly, userRate),
    [metrics.saved, metrics.downPayment, monthly, userRate],
  );

  // Realistic scenario at the slider monthly.
  const realisticMonths = useMemo(
    () => monthsToGoal(metrics.saved, metrics.downPayment, monthly, realistic),
    [metrics.saved, metrics.downPayment, monthly, realistic],
  );

  // Total growth at slider monthly + user rate, evaluated at sliderMonths.
  const projectedGrowth = useMemo(() => {
    if (!isFinite(sliderMonths) || sliderMonths <= 0) return 0;
    const end = futureValue(metrics.saved, monthly, userRate, sliderMonths);
    const contributed = monthly * sliderMonths + metrics.saved;
    return Math.max(0, Math.round(end - contributed));
  }, [metrics.saved, monthly, userRate, sliderMonths]);

  // Delta vs baseline.
  const delta = useMemo(() => {
    if (!isFinite(sliderMonths) || !isFinite(baselineMonths)) return 0;
    return baselineMonths - sliderMonths; // positive = sooner
  }, [sliderMonths, baselineMonths]);

  const sliderMax = Math.max(2000, Math.round(statedMonthly * 3));

  // Manual persist via Save button (no autosave).
  const updateMeta = useServerFn(updatePlanMeta);
  const [saving, setSaving] = useState(false);
  const dirty =
    Boolean(planId && isPlus && !locked) &&
    Math.round(monthly) !== Math.round(persistedMonthly ?? statedMonthly);

  const handleSave = async () => {
    if (!planId || !isPlus || locked || !dirty) return;
    setSaving(true);
    try {
      const nextAssumptions = { ...(assumptions ?? {}), investMonthly: Math.round(monthly) };
      await updateMeta({ data: { planId, assumptions: nextAssumptions } });
    } catch (e) {
      console.warn("[invest panel] persist failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      eyebrow="— Invest vs. save"
      title="Your plan, dialed in."
      locked={locked}
      onLockedClick={onLockedClick}
      lockedCta="Unlock with Plus"
      requiredTier="plus"
    >
      <p style={{ color: C.inkSoft, fontSize: 15, lineHeight: 1.5, margin: "0 0 22px" }}>
        You're contributing <strong style={{ color: C.ink }}>{fmt(statedMonthly)}/mo</strong> at a{" "}
        <strong style={{ color: C.ink }}>{(userRate * 100).toFixed(1)}%</strong> return. Move the
        slider to see how a different monthly changes your timeline.
      </p>

      {/* Headline: months to goal at slider value */}
      <div
        style={{
          padding: "20px 22px",
          background: C.ink,
          color: C.paper,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#f0a890",
            marginBottom: 8,
          }}
        >
          At {fmt(monthly)}/mo · {(userRate * 100).toFixed(1)}%
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtMonths(sliderMonths)} to goal
        </div>
        {delta !== 0 && isFinite(delta) && (
          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              color: delta > 0 ? "#9fd49f" : "#f0a890",
              lineHeight: 1.4,
            }}
          >
            {delta > 0 ? "↓" : "↑"} {Math.abs(delta)} months{" "}
            {delta > 0 ? "sooner" : "later"} than your current {fmt(statedMonthly)}/mo plan
          </div>
        )}
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.ember,
            }}
          >
            Monthly contribution
          </span>
          <span
            style={{
              fontSize: 22,
              color: C.ink,
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(monthly)}
            <span style={{ fontSize: 11, color: C.inkMute }}> /mo</span>
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={sliderMax}
          step={25}
          value={monthly}
          onChange={(e) => setMonthly(Number(e.target.value))}
          style={{ width: "100%", accentColor: C.ember }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginTop: 4,
          }}
        >
          <span>{fmt(50)}</span>
          <button
            type="button"
            onClick={() => setMonthly(statedMonthly)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "inherit",
              fontSize: "inherit",
              letterSpacing: "inherit",
              textTransform: "inherit",
              color: C.ember,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Reset to your {fmt(statedMonthly)}
          </button>
          <span>{fmt(sliderMax)}</span>
        </div>
        {planId && isPlus && (
          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || locked}
              style={{
                padding: "9px 20px",
                background: dirty ? C.ink : "transparent",
                color: dirty ? "#f5efe6" : C.inkMute,
                border: `1.5px solid ${dirty ? C.ink : C.inkFaint}`,
                borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: dirty && !saving ? "pointer" : "default",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : "Save contribution"}
            </button>
          </div>
        )}
      </div>

      {/* All strategy tiers — same monthly contribution, different rates */}
      <div style={{ borderTop: `1px solid ${C.inkFaint}`, paddingTop: 18 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginBottom: 12,
          }}
        >
          Strategy comparison · {fmt(monthly)}/mo
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {STRATEGIES.map((s) => {
            const isYours = Math.abs(s.rate - userRate) < 0.0025;
            const months = monthsToGoal(metrics.saved, metrics.downPayment, monthly, s.rate);
            return (
              <RateRow
                key={s.label}
                label={isYours ? `${s.label} · your profile` : s.label}
                sub={s.desc}
                months={months}
                accent={isYours ? C.ember : C.inkSoft}
                primary={isYours}
              />
            );
          })}
        </div>
        {projectedGrowth > 0 && isFinite(sliderMonths) && (
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              color: C.inkSoft,
              lineHeight: 1.5,
            }}
          >
            At your {(userRate * 100).toFixed(1)}% profile, your money earns roughly{" "}
            <strong style={{ color: C.sage }}>{fmt(projectedGrowth)}</strong> in growth along the
            way — work you don't have to do.
          </div>
        )}
      </div>
    </Section>
  );
}

function RateRow({
  label,
  sub,
  months,
  accent,
  primary = false,
}: {
  label: string;
  sub: string;
  months: number;
  accent: string;
  primary?: boolean;
}) {
  const reachable = isFinite(months);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 14px",
        border: `1px solid ${primary ? accent : C.inkFaint}`,
        borderRadius: 8,
        background: primary ? `${accent}0d` : "transparent",
      }}
    >
      <div>
        <div style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>{label}</div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
      <div
        style={{
          fontSize: 18,
          color: accent,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {reachable ? fmtMonths(months) : "Won't reach"}
      </div>
    </div>
  );
}

export { Section as InvestSection };

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
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
            color: requiredTier === "pro" ? C.paper : C.ink,
            background: requiredTier === "pro" ? C.ink : "transparent",
          }}
        >
          {requiredTier}
        </span>
      </div>
      <h2
        style={{
          fontWeight: 400,
          fontSize: 26,
          letterSpacing: "-0.01em",
          margin: "0 0 14px",
          color: C.ink,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          filter: locked ? "blur(4px)" : "none",
          pointerEvents: locked ? "none" : "auto",
          userSelect: locked ? "none" : "auto",
        }}
      >
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
