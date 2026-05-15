import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getMyPlans } from "@/lib/plans.functions";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { monthsToGoal } from "@/lib/invest-projection";
import { calcMortgage } from "@/lib/keystone";

export const Route = createFileRoute("/stress-test")({
  head: () => ({
    meta: [
      { title: "Stress-test — Keystone" },
      { name: "description", content: "See how rate shocks, income drops, and price swings change your plan." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: StressTestPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#527f5c",
  gold: "#c79933",
};

const mono = "'JetBrains Mono', monospace";
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function StressTestPage() {
  const auth = useAuthReady();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const fetchPlans = useServerFn(getMyPlans);
  const proLocked = !sub.loading && !sub.isPro;

  const { data, isLoading } = useQuery({
    queryKey: ["my-plans", auth.user?.id],
    queryFn: () => fetchPlans(),
    enabled: auth.ready && !!auth.user && !proLocked,
  });

  const plans = (data?.plans ?? []) as Array<{ id: string; title: string | null; answers: Record<string, unknown>; assumptions: Record<string, number> | null }>;
  const [planId, setPlanId] = useState<string | null>(null);
  const activePlan = plans.find((p) => p.id === planId) ?? plans[0];

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Cormorant Garamond', Georgia, serif", padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Header />
        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
          Pressure-test your plan
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, marginBottom: 28 }}>
          Slide the dials and watch your move-in date shift in real time.
        </p>

        {proLocked ? (
          <LockedCard onUpgrade={() => gate.openUpgrade("pro", "Affordability stress-test")} />
        ) : isLoading ? (
          <p style={{ color: C.inkMute }}>Loading your plans…</p>
        ) : !activePlan ? (
          <NoPlanCard />
        ) : (
          <>
            {plans.length > 1 && (
              <PlanPicker plans={plans} activeId={activePlan.id} onPick={setPlanId} />
            )}
            <Simulator plan={activePlan} />
          </>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.ink}`, marginBottom: 32 }}>
      <Link to="/dashboard" style={{ color: C.inkMute, fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
        ← Dashboard
      </Link>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember }}>
        Stress-test · Pro
      </div>
    </div>
  );
}

function LockedCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember, marginBottom: 8 }}>Pro feature</div>
      <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 12px" }}>What if rates jump 1%?</h2>
      <p style={{ color: C.inkSoft, marginBottom: 18 }}>
        Stress-test your plan against rate shocks, income drops, and price swings — instantly.
      </p>
      <button type="button" onClick={onUpgrade} style={{ background: C.ink, color: C.paper, padding: "14px 22px", border: "none", borderRadius: 8, fontFamily: mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>
        Upgrade to Pro →
      </button>
    </div>
  );
}

function NoPlanCard() {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22 }}>
      <p style={{ color: C.inkSoft, marginBottom: 14 }}>You don't have a saved plan yet — build one and we'll let you stress-test it here.</p>
      <Link to="/" style={{ display: "inline-block", padding: "10px 18px", background: C.ink, color: C.paper, textDecoration: "none", borderRadius: 8, fontFamily: mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Build my plan →
      </Link>
    </div>
  );
}

function PlanPicker({ plans, activeId, onPick }: { plans: Array<{ id: string; title: string | null }>; activeId: string; onPick: (id: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {plans.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: `1px solid ${p.id === activeId ? C.ink : C.inkFaint}`,
            background: p.id === activeId ? C.ink : "transparent",
            color: p.id === activeId ? C.paper : C.inkSoft,
            fontFamily: mono,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {p.title || "Untitled plan"}
        </button>
      ))}
    </div>
  );
}

function Simulator({ plan }: { plan: { answers: Record<string, unknown>; assumptions: Record<string, number> | null } }) {
  const [rateShock, setRateShock] = useState(0);
  const [incomeShock, setIncomeShock] = useState(0);
  const [expenseShock, setExpenseShock] = useState(0);
  const [priceShock, setPriceShock] = useState(0);

  const baseline = useMemo(() => computePlanMetrics(plan.answers, plan.assumptions), [plan]);

  const stressed = useMemo(() => {
    const scaledIncome = (typeof plan.answers.income === "number" ? plan.answers.income : 0) * (1 + incomeShock / 100);
    const scaledPartnerIncome = (typeof plan.answers.partnerIncome === "number" ? plan.answers.partnerIncome : 0) * (1 + incomeShock / 100);

    const scaledAnswers = {
      ...plan.answers,
      income: scaledIncome,
      partnerIncome: scaledPartnerIncome,
    };

    const baseAssumptions = plan.assumptions ?? {};
    const baseRatePct = baseline.mortgageRate * 100;
    const scaledAssumptions: Record<string, number> = {
      ...baseAssumptions,
      mortgageRatePct: baseRatePct + rateShock,
    };

    const m = computePlanMetrics(scaledAnswers, scaledAssumptions);

    const priceMult = 1 + priceShock / 100;
    const newPrice = Math.round(m.targetPrice * priceMult);
    const newDown = Math.round((newPrice * m.downPct) / 100);
    const newMortgage = calcMortgage(newPrice, m.downPct, m.mortgageRate);
    const newTaxIns = m.taxIns * priceMult;
    const newPmi = m.pmi * priceMult;
    const newHousing = newMortgage + newTaxIns + newPmi + m.hoa + m.reserve;
    const newRatio = m.monthlyIncome > 0 ? newHousing / m.monthlyIncome : 0;
    const newCashToClose = newDown + Math.round((newPrice * 3) / 100) + 1500;

    const availableMonthly = Math.max(0, m.monthlySavings - expenseShock);

    const months = monthsToGoal(m.saved, newCashToClose, availableMonthly, 0.04);
    const moveIn = isFinite(months)
      ? new Date(Date.now() + months * 30.4375 * 24 * 3600 * 1000)
      : null;

    return {
      targetPrice: newPrice,
      downPayment: newDown,
      monthlyMortgage: newMortgage,
      totalHousing: newHousing,
      housingRatio: newRatio,
      cashToClose: newCashToClose,
      monthsToGoal: months,
      moveIn,
      availableMonthly,
    };
  }, [plan, baseline, rateShock, incomeShock, expenseShock, priceShock]);

  const baselineMonths = useMemo(
    () => monthsToGoal(baseline.saved, baseline.cashToClose, baseline.monthlySavings, 0.04),
    [baseline],
  );

  const monthsDelta = isFinite(stressed.monthsToGoal) && isFinite(baselineMonths)
    ? stressed.monthsToGoal - baselineMonths
    : null;

  const survivesRateShock = useMemo(() => {
    const m = computePlanMetrics(plan.answers, { ...(plan.assumptions ?? {}), mortgageRatePct: baseline.mortgageRate * 100 + 1 });
    return m.housingRatio <= 0.5;
  }, [plan, baseline]);
  const survivesIncomeDrop = useMemo(() => {
    const scaled = { ...plan.answers, income: (typeof plan.answers.income === "number" ? plan.answers.income : 0) * 0.9, partnerIncome: (typeof plan.answers.partnerIncome === "number" ? plan.answers.partnerIncome : 0) * 0.9 };
    const m = computePlanMetrics(scaled, plan.assumptions);
    return m.housingRatio <= 0.5;
  }, [plan]);

  return (
    <>
      <div style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22, marginBottom: 18 }}>
        <SectionLabel>Shocks</SectionLabel>
        <Slider label="Mortgage rate shock" value={rateShock} setValue={setRateShock} min={-2} max={3} step={0.25} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} pp`} />
        <Slider label="Income change" value={incomeShock} setValue={setIncomeShock} min={-30} max={20} step={1} format={(v) => `${v >= 0 ? "+" : ""}${v}%`} />
        <Slider label="Extra monthly expenses" value={expenseShock} setValue={setExpenseShock} min={-200} max={1000} step={25} format={(v) => `${v >= 0 ? "+" : "-"}${money(Math.abs(v))}/mo`} />
        <Slider label="Home price change" value={priceShock} setValue={setPriceShock} min={-20} max={20} step={1} format={(v) => `${v >= 0 ? "+" : ""}${v}%`} />
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => { setRateShock(0); setIncomeShock(0); setExpenseShock(0); setPriceShock(0); }}
            style={{ background: "transparent", border: `1px solid ${C.inkFaint}`, color: C.inkSoft, padding: "6px 12px", borderRadius: 6, fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}
          >
            Reset
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22, marginBottom: 18 }}>
        <SectionLabel>Result</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Stat label="Move-in" value={stressed.moveIn ? stressed.moveIn.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"} hint={monthsDelta == null ? "" : monthsDelta === 0 ? "Same as baseline" : monthsDelta > 0 ? `${monthsDelta} mo later` : `${Math.abs(monthsDelta)} mo sooner`} accent={monthsDelta == null ? undefined : monthsDelta > 0 ? C.ember : monthsDelta < 0 ? C.sage : undefined} />
          <Stat label="Cash to close" value={money(stressed.cashToClose)} hint={`Was ${money(baseline.cashToClose)}`} accent={stressed.cashToClose > baseline.cashToClose ? C.ember : stressed.cashToClose < baseline.cashToClose ? C.sage : undefined} />
          <Stat label="Monthly housing" value={money(stressed.totalHousing)} hint={`Was ${money(baseline.totalHousing)}`} accent={stressed.totalHousing > baseline.totalHousing ? C.ember : C.sage} />
          <Stat label="Housing ratio" value={`${Math.round(stressed.housingRatio * 100)}%`} hint={stressed.housingRatio <= 0.45 ? "Affordable" : stressed.housingRatio <= 0.55 ? "A stretch" : "Difficult"} accent={stressed.housingRatio <= 0.45 ? C.sage : stressed.housingRatio <= 0.55 ? C.gold : C.ember} />
        </div>
        {stressed.availableMonthly < baseline.monthlySavings && (
          <p style={{ marginTop: 14, color: C.inkSoft, fontSize: 14 }}>
            Effective monthly savings: <strong>{money(stressed.availableMonthly)}</strong> (was {money(baseline.monthlySavings)}).
          </p>
        )}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22 }}>
        <SectionLabel>Resilience</SectionLabel>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge ok={survivesRateShock} label="+1% rate shock" />
          <Badge ok={survivesIncomeDrop} label="10% income loss" />
        </div>
        <p style={{ color: C.inkMute, fontSize: 13, marginTop: 12 }}>
          A plan "survives" if your housing ratio stays under 50% of gross income.
        </p>
      </div>
    </>
  );
}

function Slider({ label, value, setValue, min, max, step, format }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number; step: number; format: (v: number) => string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.inkMute }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color: value === 0 ? C.inkSoft : C.ember }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.ember }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.ember, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, color: accent ?? C.ink }}>{value}</div>
      {hint && <div style={{ fontFamily: mono, fontSize: 10, color: accent ?? C.inkMute, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid ${ok ? C.sage : C.ember}`, background: ok ? "rgba(82,127,92,0.08)" : "rgba(196,69,45,0.08)", color: ok ? C.sage : C.ember, fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}
