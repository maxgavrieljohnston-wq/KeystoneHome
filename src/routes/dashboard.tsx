import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlans, getDashboardExtras, revertPlanToInitial, exportPlanPdf } from "@/lib/plans.functions";
import { getStripeEnvironment } from "@/lib/stripe";

import { FeatureIconBar } from "@/components/dashboard/FeatureIconBar";
import { PlanView, type PlanViewPlan } from "./p.$slug";

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
          search={{ new: true }}
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

  const firstName = (selected.title || "").split(" ")[0] || "there";

  const planForView: PlanViewPlan = {
    title: selected.title,
    theme: null,
    answers: selected.answers,
    assumptions: selected.assumptions,
    current_savings: selected.current_savings,
    target_move_in: selected.target_move_in,
    created_at: selected.created_at,
  };

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
          padding: "32px 24px 24px",
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
                {selected.title || `Welcome back${firstName !== "there" ? `, ${firstName}` : ""}`}
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

        <DashboardActions planId={selected.id} />
      </div>

      <PlanView plan={planForView} kicker="— Your plan, dialed in" />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 64px" }}>
        <FeatureIconBar selectedPlanId={selectedId} />
      </div>
    </div>
  );
}

function DashboardActions({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const env = getStripeEnvironment();
  const revertFn = useServerFn(revertPlanToInitial);
  const exportFn = useServerFn(exportPlanPdf);
  const [reverting, setReverting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleRevert = async () => {
    const ok = window.confirm(
      "Reset every figure on your plan back to the values you entered during onboarding? Any edits you've made will be lost.",
    );
    if (!ok) return;
    setReverting(true);
    try {
      await revertFn({ data: { planId } });
      await qc.invalidateQueries({ queryKey: ["my-plans"] });
    } catch (e) {
      console.warn("[revert]", e);
      alert("Couldn't reset your plan. Please try again.");
    } finally {
      setReverting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await exportFn({ data: { planId, environment: env } });
      if (!res?.ok) throw new Error("export failed");
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || "plan.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("[pdf]", e);
      alert("Couldn't generate your PDF — please try again or contact support.");
    } finally {
      setDownloading(false);
    }
  };

  const btn: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 6,
    border: `1px solid ${C.ink}`,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    background: "transparent",
    color: C.ink,
  };

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        style={{ ...btn, background: C.ink, color: C.paper, opacity: downloading ? 0.6 : 1 }}
      >
        {downloading ? "Preparing…" : "Download PDF"}
      </button>
      <button
        type="button"
        onClick={handleRevert}
        disabled={reverting}
        style={{ ...btn, opacity: reverting ? 0.6 : 1 }}
      >
        {reverting ? "Resetting…" : "Reset to original plan"}
      </button>
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

