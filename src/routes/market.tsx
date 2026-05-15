import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getMyPlans } from "@/lib/plans.functions";
import { getMarketSnapshot } from "@/lib/market.functions";
import { computePlanMetrics } from "@/lib/plan-metrics";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market intel — Keystone" },
      { name: "description", content: "Live local housing market data — median price, price-to-income ratio, and verdict." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: MarketPage,
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
const money = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

function MarketPage() {
  const auth = useAuthReady();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const proLocked = !sub.loading && !sub.isPro;
  const fetchPlans = useServerFn(getMyPlans);
  const fetchSnapshot = useServerFn(getMarketSnapshot);

  const { data: plansData } = useQuery({
    queryKey: ["my-plans", auth.user?.id],
    queryFn: () => fetchPlans(),
    enabled: auth.ready && !!auth.user && !proLocked,
  });
  const firstPlan = (plansData?.plans ?? [])[0] as { answers: Record<string, unknown>; assumptions: Record<string, number> | null } | undefined;
  const planMetrics = firstPlan ? computePlanMetrics(firstPlan.answers, firstPlan.assumptions) : null;

  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    if (planMetrics?.city && city === "") {
      // Plan's "city" is what we have — leave state for user to type since
      // we don't reliably know it from the quiz.
      setCity(planMetrics.city);
    }
  }, [planMetrics?.city, city]);

  const lookup = useMutation({
    mutationFn: (vars: { city: string; state: string }) => fetchSnapshot({ data: vars }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !state.trim()) return;
    lookup.mutate({ city: city.trim(), state: state.trim() });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Cormorant Garamond', Georgia, serif", padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Header />
        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
          Is your city actually buyable?
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, marginBottom: 28 }}>
          Local median home value, median household income, and the price-to-income ratio that tells you the truth.
        </p>

        {proLocked ? (
          <LockedCard onUpgrade={() => gate.openUpgrade("pro", "City market intelligence")} />
        ) : (
          <>
            <form onSubmit={submit} style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22, marginBottom: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="City">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Austin" style={inputStyle} />
              </Field>
              <Field label="State (2-letter code)">
                <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} placeholder="TX" style={{ ...inputStyle, textTransform: "uppercase" }} />
              </Field>
              <button type="submit" disabled={lookup.isPending || !city.trim() || !state.trim()} style={{ background: C.ink, color: C.paper, padding: "12px 18px", border: "none", borderRadius: 8, fontFamily: mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: lookup.isPending ? "default" : "pointer", opacity: lookup.isPending ? 0.5 : 1 }}>
                {lookup.isPending ? "Looking up…" : "Look up market"}
              </button>
            </form>

            {lookup.data?.error && (
              <div style={{ background: "#fff", border: `1px solid ${C.ember}`, borderRadius: 10, padding: 14, color: C.ember, marginBottom: 18 }}>
                {lookup.data.error}
              </div>
            )}

            {lookup.data?.snapshot && (
              <ResultCard snap={lookup.data.snapshot} cached={Boolean(lookup.data.cached)} planTargetPrice={planMetrics?.targetPrice ?? null} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.inkFaint}`,
  borderRadius: 8,
  fontFamily: mono,
  fontSize: 14,
  background: C.paper,
  color: C.ink,
};

function Header() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${C.ink}`, marginBottom: 32 }}>
      <Link to="/dashboard" style={{ color: C.inkMute, fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", textDecoration: "none" }}>
        ← Dashboard
      </Link>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember }}>
        Market intel · Pro
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.inkMute, marginBottom: 6, display: "block" }}>{label}</span>
      {children}
    </label>
  );
}

function LockedCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ border: `1.5px solid ${C.ink}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
      <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember, marginBottom: 8 }}>Pro feature</div>
      <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 12px" }}>Real numbers for your real city</h2>
      <p style={{ color: C.inkSoft, marginBottom: 18 }}>
        Live local market data so you know if your city is realistic before you start saving.
      </p>
      <button type="button" onClick={onUpgrade} style={{ background: C.ink, color: C.paper, padding: "14px 22px", border: "none", borderRadius: 8, fontFamily: mono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>
        Upgrade to Pro →
      </button>
    </div>
  );
}

function ResultCard({ snap, cached, planTargetPrice }: { snap: { matchedName: string; medianHomeValue: number | null; medianHouseholdIncome: number | null; priceToIncome: number | null; verdict: string; source: string; asOf: string }; cached: boolean; planTargetPrice: number | null }) {
  const verdictColor = snap.verdict === "Affordable" ? C.sage : snap.verdict === "Stretched" ? C.gold : snap.verdict === "Unaffordable" ? C.ember : C.inkMute;
  const planDelta = planTargetPrice && snap.medianHomeValue ? planTargetPrice - snap.medianHomeValue : null;

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 12, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h3 style={{ fontWeight: 500, fontSize: 22, margin: 0 }}>{snap.matchedName}</h3>
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.inkMute }}>
          {cached ? "Cached" : "Fresh"}
        </span>
      </div>
      <div style={{ color: C.inkMute, fontSize: 13, marginBottom: 18 }}>{snap.source}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <Stat label="Median home value" value={money(snap.medianHomeValue)} />
        <Stat label="Median household income" value={money(snap.medianHouseholdIncome)} />
        <Stat label="Price-to-income" value={snap.priceToIncome ? `${snap.priceToIncome.toFixed(1)}×` : "—"} hint={`A ratio of 3× is the classic "affordable" threshold.`} />
        <Stat label="Verdict" value={snap.verdict} accent={verdictColor} />
      </div>

      {planDelta != null && planTargetPrice != null && snap.medianHomeValue != null && (
        <div style={{ background: C.paper, borderRadius: 8, padding: "12px 14px", color: C.inkSoft, fontSize: 14, lineHeight: 1.5 }}>
          Your plan target of <strong>{money(planTargetPrice)}</strong> is{" "}
          <strong style={{ color: planDelta > 0 ? C.ember : C.sage }}>
            {planDelta > 0 ? "above" : "below"}
          </strong>{" "}
          the city median by <strong>{money(Math.abs(planDelta))}</strong>{" "}
          ({Math.abs(Math.round((planDelta / snap.medianHomeValue) * 100))}%).
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, color: accent ?? C.ink }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: C.inkMute, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
