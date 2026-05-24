import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlans, getDashboardExtras } from "@/lib/plans.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { MonthlyActionPlan } from "@/components/dashboard/MonthlyActionPlan";
import { EditablePlanPanel } from "@/components/dashboard/EditablePlanPanel";
import { InvestVsSavePanel } from "@/components/dashboard/InvestVsSavePanel";
import { AssumptionsPanel } from "@/components/dashboard/AssumptionsPanel";
import { PicturePlacePanel } from "@/components/dashboard/PicturePlacePanel";
import { RecommendedAccountsPanel } from "@/components/dashboard/RecommendedAccountsPanel";
import { RiskScenariosPanel } from "@/components/dashboard/RiskScenariosPanel";
import { BrokerWaitlistPanel } from "@/components/dashboard/BrokerWaitlistPanel";
import { computePlanMetrics } from "@/lib/plan-metrics";
import type { ActionPlanProgress } from "@/lib/action-plan";

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
  action_plan_progress: ActionPlanProgress | null;
};

function DashboardPage() {
  const navigate = useNavigate();
  const { planId: selectedId } = Route.useSearch();
  const sub = useSubscription();
  const gate = useUpgradeGate();

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

  const isPlus = sub.isPlus;
  const isPro = sub.isPro;
  const onLockedClick = () => gate.openUpgrade("plus", "dashboard-panel");

  const metrics = computePlanMetrics(selected.answers, selected.assumptions);

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

        <div style={{ display: "grid", gap: 24 }}>
          {/* 1. Monthly Action Plan */}
          <MonthlyActionPlan
            planId={selected.id}
            planCreatedAt={selected.created_at}
            answers={selected.answers}
            assumptions={selected.assumptions}
            currentSavings={selected.current_savings}
            targetMoveIn={selected.target_move_in}
            shareEnabled={selected.share_enabled}
            remindersEnabled={extrasQ.data?.remindersEnabled ?? false}
            lenderDocCount={extrasQ.data?.lenderDocCount ?? 0}
            initialProgress={selected.action_plan_progress}
          />

          {/* 2. Editable plan + share/PDF */}
          <EditablePlanPanel
            planId={selected.id}
            planTitle={selected.title}
            shareSlug={selected.share_slug}
            shareEnabled={selected.share_enabled}
            answers={selected.answers}
            assumptions={selected.assumptions}
            currentSavings={selected.current_savings}
          />

          {/* 3. Invest vs save */}
          <InvestVsSavePanel
            answers={selected.answers}
            assumptions={selected.assumptions}
            planId={selected.id}
            isPlus={isPlus}
            locked={!isPlus}
            onLockedClick={onLockedClick}
          />

          {/* 4. Assumptions */}
          <AssumptionsPanel
            planId={selected.id}
            answers={selected.answers}
            targetPrice={metrics.targetPrice}
            assumptions={selected.assumptions ?? {}}
            isPlus={isPlus}
            locked={!isPlus}
            onLockedClick={onLockedClick}
          />

          {/* 4b. Picture your place — live home preview */}
          <PicturePlacePanel
            planId={selected.id}
            answers={selected.answers}
            assumptions={selected.assumptions}
            locked={!isPlus}
            onLockedClick={onLockedClick}
          />

          {/* 5. Recommended accounts */}
          <RecommendedAccountsPanel
            locked={!isPlus}
            onLockedClick={onLockedClick}
            timelineYears={metrics.timelineYears}
          />

          {/* 6. Risk scenarios */}
          <RiskScenariosPanel
            answers={selected.answers}
            assumptions={selected.assumptions}
            locked={!isPlus}
            onLockedClick={onLockedClick}
          />

          {/* 7. Broker waitlist */}
          <BrokerWaitlistPanel
            isPro={isPro}
            isPlus={isPlus}
            locked={!isPlus && !isPro}
            onLockedClick={onLockedClick}
          />
        </div>
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
