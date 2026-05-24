import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlans, getDashboardExtras } from "@/lib/plans.functions";

import { computePlanMetrics, computeTimeToGoal, formatMonths } from "@/lib/plan-metrics";
import { FeatureIconBar } from "@/components/dashboard/FeatureIconBar";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s) =>
    z.object({ planId: z.string().uuid().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Your dashboard — Keystone" },
      { name: "description", content: "Your homebuying plan, month by month." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
});

type PlanRow = {
  id: string;
  title: string | null;
  answers: Record<string, unknown>;
  assumptions: Record<string, number> | null;
  current_savings: number | null;
  target_move_in: string | null;
  share_slug: string | null;
  share_enabled: boolean;
  created_at: string;
  action_plan_progress: unknown;
};

function DashboardPage() {
  const navigate = useNavigate();
  const { planId: selectedId } = Route.useSearch();
  

  const plansFn = useServerFn(getMyPlans);
  const extrasFn = useServerFn(getDashboardExtras);

  const plansQ = useQuery({ queryKey: ["my-plans"], queryFn: () => plansFn() });
  const extrasQ = useQuery({ queryKey: ["dash-extras"], queryFn: () => extrasFn() });

  const plans = (plansQ.data?.plans ?? []) as unknown as PlanRow[];

  const selected = useMemo(() => {
    if (!plans.length) return null;
    if (selectedId) return plans.find((p) => p.id === selectedId) ?? plans[0];
    return plans[0];
  }, [plans, selectedId]);

  if (plansQ.isLoading || extrasQ.isLoading) {
    return <Centered>Loading your plan…</Centered>;
  }

  if (!plans.length) {
    return (
      <Centered>
        <p style={{ color: C.inkSoft, marginBottom: 16 }}>
          You don't have a plan yet.
        </p>
        <Link
          to="/"
          style={{
            background: C.ink,
            color: C.paper,
            padding: "10px 18px",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 14,
            letterSpacing: "0.04em",
          }}
        >
          Start your plan
        </Link>
      </Centered>
    );
  }

  if (!selected) return <Centered>No plan selected.</Centered>;

  const metrics = computePlanMetrics(selected.answers, selected.assumptions);
  const firstName = (selected.title || "").split(" ")[0] || "there";

  return (
    <div
      style={{
        background: C.paper,
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: C.ink,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "32px 24px 64px",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: `1px solid ${C.inkFaint}`,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                color: C.inkMute,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Dashboard
            </div>
            {plans.length > 1 ? (
              <select
                value={selected.id}
                onChange={(e) =>
                  navigate({ to: "/dashboard", search: { planId: e.target.value } })
                }
                style={{
                  fontFamily: "'Cormorant Garamond', 'Georgia', serif",
                  fontSize: 26,
                  fontWeight: 500,
                  background: "transparent",
                  border: "none",
                  color: C.ink,
                  cursor: "pointer",
                }}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || "Untitled plan"}
                  </option>
                ))}
              </select>
            ) : (
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', 'Georgia', serif",
                  fontSize: 32,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                {selected.title || "Your homebuying plan"}
              </h1>
            )}
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            style={{
              border: `1px solid ${C.inkFaint}`,
              color: C.inkMute,
              background: "transparent",
              padding: "8px 14px",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Log out
          </button>
        </header>

        {/* Greeting */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', 'Georgia', serif",
              fontSize: 24,
              fontWeight: 500,
              color: C.ink,
              marginBottom: 4,
            }}
          >
            Welcome back{firstName !== "there" ? `, ${firstName}` : ""}.
          </div>
          <div style={{ fontSize: 14, color: C.inkMute }}>
            Here are your numbers. Tap an icon below for any feature.
          </div>
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <NumbersSummary metrics={metrics} currentSavings={selected.current_savings} />
        </div>


        {/* Feature icon bar */}
        <FeatureIconBar selectedPlanId={selectedId} />
      </div>
    </div>
  );
}



function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        background: C.paper,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 24,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function fmtCurrency(n: number): string {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function NumbersSummary({
  metrics,
  currentSavings,
}: {
  metrics: ReturnType<typeof computePlanMetrics>;
  currentSavings: number | null;
}) {
  const saved = currentSavings ?? 0;
  const pctSaved = metrics.cashToClose > 0 ? Math.min(100, (saved / metrics.cashToClose) * 100) : 0;

  const statedMonthly = metrics.monthlySavings || 0;
  const returnRate = metrics.expectedReturnRate || 0;
  const time = computeTimeToGoal({
    cashToClose: metrics.cashToClose,
    currentSavings: saved,
    monthlySavings: statedMonthly,
    annualReturnRate: returnRate,
  });
  const ratePct = (returnRate * 100).toFixed(1);

  const rows = [
    { label: "Target price", value: fmtCurrency(metrics.targetPrice) },
    { label: "Down payment", value: fmtCurrency(metrics.downPayment) },
    { label: "Cash to close", value: fmtCurrency(metrics.cashToClose) },
    { label: "Monthly housing cost", value: fmtCurrency(metrics.totalHousing) },
  ];

  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${C.ink}`,
        borderRadius: 12,
        padding: "28px 24px",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: C.inkMute,
          textTransform: "uppercase",
          marginBottom: 20,
        }}
      >
        Your numbers
      </div>

      {/* Savings comparison */}
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {/* Save-only row */}
        <ComparisonRow
          label="Monthly savings"
          value={fmtCurrency(statedMonthly)}
          rightLabel="Time to goal (no investing)"
          rightValue={formatMonths(time.monthsSaveOnly)}
        />
        {/* Invested row — highlighted */}
        <ComparisonRow
          highlight
          label={`Same amount invested @ ${ratePct}%`}
          value={fmtCurrency(statedMonthly)}
          rightLabel="Time to goal (investing)"
          rightValue={formatMonths(time.monthsInvested)}
          footnote={
            time.timeSavedMonths && time.timeSavedMonths > 0
              ? `Investing gets you there ${formatMonths(time.timeSavedMonths)} sooner.`
              : undefined
          }
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "20px 16px",
        }}
      >
        {rows.map((r) => (
          <div key={r.label}>
            <div
              style={{
                fontSize: 11,
                color: C.inkMute,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', 'Georgia', serif",
                fontSize: 28,
                fontWeight: 600,
                color: C.ink,
                lineHeight: 1.1,
              }}
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>


      {/* Readiness + progress */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: `1px solid ${C.inkFaint}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.inkMute,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Readiness
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', 'Georgia', serif",
              fontSize: 22,
              fontWeight: 600,
              color: C.ink,
            }}
          >
            {metrics.readinessLabel}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 11,
              color: C.inkMute,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Saved toward goal
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', 'Georgia', serif",
              fontSize: 22,
              fontWeight: 600,
              color: C.ink,
            }}
          >
            {pctSaved.toFixed(0)}%
          </div>
          <div style={{ fontSize: 12, color: C.inkMute, marginTop: 2 }}>
            {fmtCurrency(saved)} of {fmtCurrency(metrics.cashToClose)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 12,
          height: 4,
          background: "#ebe2d3",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pctSaved}%`,
            background: C.ember,
            borderRadius: 2,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}
