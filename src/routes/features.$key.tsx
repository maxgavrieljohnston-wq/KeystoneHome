import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlans, getDashboardExtras } from "@/lib/plans.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { EditablePlanPanel } from "@/components/dashboard/EditablePlanPanel";
import { InvestVsSavePanel } from "@/components/dashboard/InvestVsSavePanel";
import { AssumptionsPanel } from "@/components/dashboard/AssumptionsPanel";
import { PicturePlacePanel } from "@/components/dashboard/PicturePlacePanel";
import { RecommendedAccountsPanel } from "@/components/dashboard/RecommendedAccountsPanel";

import { BrokerWaitlistPanel } from "@/components/dashboard/BrokerWaitlistPanel";
import { MonthlyActionPlan } from "@/components/dashboard/MonthlyActionPlan";
import { computePlanMetrics } from "@/lib/plan-metrics";
import { FEATURE_KEYS, FEATURE_META, type FeatureKey } from "@/lib/dashboard-features";
import { FeatureIconBar } from "@/components/dashboard/FeatureIconBar";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
};

export const Route = createFileRoute("/features/$key")({
  validateSearch: (s) =>
    z.object({ planId: z.string().uuid().optional() }).parse(s),
  beforeLoad: async ({ params, search }) => {
    if (params.key === "picture" || params.key === "assumptions") {
      throw redirect({
        to: "/features/$key",
        params: { key: "home" },
        search: search as { planId?: string },
      });
    }
    if (!FEATURE_KEYS.includes(params.key as FeatureKey)) {
      throw redirect({ to: "/dashboard" });
    }
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  head: ({ params }) => {
    const meta = FEATURE_META[params.key as FeatureKey];
    return {
      meta: [
        { title: `${meta?.label ?? "Feature"} — Keystone` },
        { name: "description", content: meta?.label ?? "" },
      ],
    };
  },
  component: FeaturePage,
});

function FeaturePage() {
  const { key } = Route.useParams();
  const { planId: selectedId } = Route.useSearch();
  const navigate = useNavigate();
  const sub = useSubscription();
  const gate = useUpgradeGate();

  const plansFn = useServerFn(getMyPlans);
  const extrasFn = useServerFn(getDashboardExtras);

  const plansQ = useQuery({ queryKey: ["my-plans"], queryFn: () => plansFn() });
  const extrasQ = useQuery({ queryKey: ["dash-extras"], queryFn: () => extrasFn() });

  const plans = (plansQ.data?.plans ?? []) as any[];
  const selected = useMemo(() => {
    if (!plans.length) return null;
    if (selectedId) return plans.find((p) => p.id === selectedId) ?? plans[0];
    return plans[0];
  }, [plans, selectedId]);

  if (plansQ.isLoading || extrasQ.isLoading) {
    return <Centered>Loading…</Centered>;
  }
  if (!selected) {
    return (
      <Centered>
        <p style={{ color: C.inkSoft, marginBottom: 16 }}>No plan found.</p>
        <Link to="/dashboard" style={linkBtn}>Back to dashboard</Link>
      </Centered>
    );
  }

  const meta = FEATURE_META[key as FeatureKey];
  const isPlus = sub.isPlus;
  const isPro = sub.isPro;
  const onLockedClick = () => gate.openUpgrade("plus", `feature-${key}`);
  const metrics = computePlanMetrics(selected.answers, selected.assumptions);

  let panel: React.ReactNode = null;
  switch (key as FeatureKey) {
    case "plan":
      panel = (
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
          initialProgress={selected.action_plan_progress ?? null}
        />
      );
      break;
    case "editable":
      panel = (
        <EditablePlanPanel
          planId={selected.id}
          planTitle={selected.title}
          shareSlug={selected.share_slug}
          shareEnabled={selected.share_enabled}
          answers={selected.answers}
          assumptions={selected.assumptions}
          currentSavings={selected.current_savings}
        />
      );
      break;
    case "invest":
      panel = (
        <InvestVsSavePanel
          answers={selected.answers}
          assumptions={selected.assumptions}
          planId={selected.id}
          isPlus={isPlus}
          locked={!isPlus}
          onLockedClick={onLockedClick}
        />
      );
      break;
    case "home":
      panel = (
        <>
          <PicturePlacePanel
            planId={selected.id}
            answers={selected.answers}
            assumptions={selected.assumptions}
            locked={!isPlus}
            onLockedClick={onLockedClick}
          />
          <div style={{ height: 24 }} />
          <AssumptionsPanel
            planId={selected.id}
            answers={selected.answers}
            targetPrice={metrics.targetPrice}
            assumptions={selected.assumptions ?? {}}
            isPlus={isPlus}
            locked={!isPlus}
            onLockedClick={onLockedClick}
          />
        </>
      );
      break;
    case "accounts":
      panel = (
        <RecommendedAccountsPanel
          locked={!isPlus}
          onLockedClick={onLockedClick}
          timelineYears={metrics.timelineYears}
        />
      );
      break;
    case "broker":
      panel = (
        <BrokerWaitlistPanel
          isPro={isPro}
          isPlus={isPlus}
          locked={!isPlus && !isPro}
          onLockedClick={onLockedClick}
        />
      );
      break;
  }

  return (
    <div
      style={{
        background: C.paper,
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: C.ink,
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 64px" }}>
        <button
          onClick={() =>
            navigate({
              to: "/dashboard",
              search: selectedId ? { planId: selectedId } : {},
            })
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: C.inkMute,
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            marginBottom: 20,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </button>
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
          Feature
        </div>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', 'Georgia', serif",
            fontSize: 32,
            fontWeight: 500,
            margin: "0 0 24px",
          }}
        >
          {meta?.label}
        </h1>
        {panel}
        <FeatureIconBar selectedPlanId={selected.id} activeKey={key as FeatureKey} />
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: C.ink,
  color: C.paper,
  padding: "10px 18px",
  borderRadius: 6,
  textDecoration: "none",
  fontSize: 14,
  letterSpacing: "0.04em",
};

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
