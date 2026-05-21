import { type MouseEvent, useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyPlans,
  renamePlan,
  deletePlan,
  duplicatePlan,
  exportPlanPdf,
  exportPlanCsv,
  updatePlanMeta,
  togglePlanShare,
} from "@/lib/plans.functions";

import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuthReady } from "@/hooks/useAuthReady";
import { InvestVsSavePanel } from "@/components/dashboard/InvestVsSavePanel";
import { RecommendedAccountsPanel } from "@/components/dashboard/RecommendedAccountsPanel";
import { AssumptionsPanel } from "@/components/dashboard/AssumptionsPanel";
import { RiskScenariosPanel } from "@/components/dashboard/RiskScenariosPanel";
import { BrokerWaitlistPanel } from "@/components/dashboard/BrokerWaitlistPanel";
import { generateInvestmentPlanPdf } from "@/lib/investment-pdf.functions";
import { EditablePlanPanel } from "@/components/dashboard/EditablePlanPanel";
import { computePlanMetrics, computeGoalProgress } from "@/lib/plan-metrics";
import { PLAN_THEMES, THEME_IDS, getPlanTheme, type PlanThemeId } from "@/lib/plan-themes";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your plans — Keystone" },
      { name: "description", content: "Your saved homebuying plans." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  rule: "#1a1a1a",
};

const FREE_LIMIT = 1;

type PlanRow = {
  id: string;
  email: string;
  title: string | null;
  answers: Record<string, unknown>;
  created_at: string;
  tags: string[] | null;
  notes: string | null;
  share_slug: string | null;
  share_enabled: boolean;
  assumptions: Record<string, number> | null;
  target_move_in: string | null;
  current_savings: number | null;
  theme: string | null;
  parent_plan_id: string | null;
  version: number | null;
};

function DashboardPage() {
  const navigate = useNavigate();
  const auth = useAuthReady();
  const fetchPlans = useServerFn(getMyPlans);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-plans", auth.user?.id],
    queryFn: () => fetchPlans(),
    enabled: auth.ready && !!auth.user,
  });
  const sub = useSubscription();
  const gate = useUpgradeGate();

  useEffect(() => {
    if (auth.ready && !auth.user) navigate({ to: "/login" });
  }, [auth.ready, auth.user, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const plans = (data?.plans ?? []) as unknown as PlanRow[];
  const firstName = (plans[0]?.answers?.firstName as string | undefined) ?? "";
  const greeting = firstName ? `Welcome back, ${firstName}.` : "Welcome back.";

  const handleNewPlan = () => {
    if (!sub.isPlus && plans.length >= FREE_LIMIT) {
      gate.openUpgrade("plus", "Unlimited saved plans");
      return;
    }
    navigate({ to: "/", search: { new: true } });
  };

  const isPaid = sub.isPlus || sub.isPro;
  const containerMaxWidth = isPaid ? 1180 : 560;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        padding: "36px 24px 60px",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        color: C.ink,
      }}
    >
      <div style={{ maxWidth: containerMaxWidth, margin: "0 auto" }}>
        <DashboardNav isPlus={sub.isPlus} isPro={sub.isPro} onSignOut={handleSignOut} />

        {isPaid ? (
          <PaidHero
            greeting={greeting}
            tierLabel={sub.isPro ? "Pro" : "Plus"}
            firstPlan={plans[0] ?? null}
          />
        ) : (
          <>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: C.ember,
                marginBottom: 14,
              }}
            >
              — Your dashboard
            </div>
            <h1
              style={{
                fontWeight: 400,
                fontSize: 40,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
                margin: "0 0 24px",
              }}
            >
              {greeting}
            </h1>
            <TierBanner isPlus={sub.isPlus} isPro={sub.isPro} loading={sub.loading} hasPlan={plans.length > 0} />
          </>
        )}

        {!auth.ready || (auth.ready && !auth.user) || isLoading ? (
          <p style={{ color: C.inkSoft, fontSize: 18 }}>Loading your plans…</p>
        ) : error ? (
          <p style={{ color: C.ember, fontSize: 16 }}>
            Couldn't load your plans. Please refresh.
          </p>
        ) : plans.length === 0 ? (
          <EmptyState isPlus={sub.isPlus} />
        ) : isPaid ? (
          <div
            style={{
              display: "grid",
              gap: 28,
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            <style>{`
              @media (min-width: 960px) {
                .ks-dash-grid { grid-template-columns: minmax(0, 420px) minmax(0, 1fr) !important; }
              }
            `}</style>
            <div className="ks-dash-grid" style={{ display: "grid", gap: 28, gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <EditablePlanPanel
                  planId={plans[0].id}
                  planTitle={plans[0].title}
                  shareSlug={plans[0].share_slug}
                  shareEnabled={plans[0].share_enabled}
                  answers={plans[0].answers}
                  assumptions={plans[0].assumptions}
                  currentSavings={plans[0].current_savings}
                />
              </div>
              <div id="premium-features" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <InvestmentSection
                  answers={plans[0].answers}
                  assumptions={plans[0].assumptions}
                  planId={plans[0].id}
                  isPlus={sub.isPlus}
                  isPro={sub.isPro}
                />
              </div>
            </div>
            <UnlockedFeaturesGrid isPlus={sub.isPlus} isPro={sub.isPro} />
          </div>
        ) : (
          <>
          <PlansList plans={plans} isPlus={sub.isPlus} onNewPlan={handleNewPlan} />
            <div id="premium-features">
              {plans.length > 0 && (
                <InvestmentSection
                  answers={plans[0].answers}
                  assumptions={plans[0].assumptions}
                  planId={plans[0].id}
                  isPlus={sub.isPlus}
                  isPro={sub.isPro}
                />
              )}
              <PremiumPanel isPlus={sub.isPlus} isPro={sub.isPro} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DashboardNav({ isPlus, isPro, onSignOut }: { isPlus: boolean; isPro: boolean; onSignOut: () => void }) {
  const link = (highlight: boolean) => ({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: highlight ? C.ember : C.inkMute,
    textDecoration: "none" as const,
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 14,
        borderBottom: `1px solid ${C.rule}`,
        marginBottom: 32,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <Link
        to="/"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 22,
          letterSpacing: "-0.01em",
          color: C.ink,
          textDecoration: "none",
        }}
      >
        Keystone
      </Link>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Link to="/coach" style={link(isPro)}>Coach</Link>
        
        <Link to="/rate-alerts" style={link(isPro)}>Rates</Link>
        <Link to="/stress-test" style={link(isPro)}>Stress</Link>
        <Link to="/accounts" style={link(isPlus)}>Accounts</Link>
        <Link to="/market" style={link(isPro)}>Market</Link>
        <Link to="/documents" style={link(isPro)}>Docs</Link>
        <Link to="/broker-match" style={link(isPlus || isPro)}>Match</Link>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkMute,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function PaidHero({
  greeting,
  tierLabel,
  firstPlan,
}: {
  greeting: string;
  tierLabel: "Plus" | "Pro";
  firstPlan: PlanRow | null;
}) {
  const metrics = firstPlan ? computePlanMetrics(firstPlan.answers, firstPlan.assumptions) : null;
  const goal = metrics && firstPlan ? computeGoalProgress(metrics, firstPlan.current_savings, firstPlan.target_move_in) : null;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const kpis: Array<{ k: string; v: string; sub?: string }> = [];
  if (metrics) {
    kpis.push({ k: "Target price", v: fmt(metrics.targetPrice) });
    kpis.push({ k: "Cash to close", v: fmt(metrics.cashToClose) });
    if (goal?.hasGoal) {
      kpis.push({
        k: "Saved",
        v: fmt(firstPlan?.current_savings ?? 0),
        sub: `${goal.pctToGoal.toFixed(0)}% of goal`,
      });
      if (goal.requiredMonthly != null) {
        kpis.push({ k: "Need / month", v: `${fmt(goal.requiredMonthly)}` });
      }
    } else {
      kpis.push({ k: "Monthly income", v: fmt(metrics.monthlyIncome) });
      kpis.push({ k: "Timeline", v: `${metrics.timelineYears} yr` });
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
          }}
        >
          — Your dashboard
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px 4px",
            borderRadius: 999,
            background: C.ink,
            color: C.paper,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "#f0a890" }} />
          {tierLabel} unlocked
        </span>
      </div>

      <h1
        style={{
          fontWeight: 400,
          fontSize: 48,
          lineHeight: 1.02,
          letterSpacing: "-0.025em",
          margin: "0 0 22px",
        }}
      >
        {greeting}
      </h1>

      {kpis.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 0,
            border: `1px solid ${C.ink}`,
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {kpis.map((kpi, i) => (
            <div
              key={kpi.k}
              style={{
                padding: "16px 18px",
                borderLeft: i === 0 ? "none" : `1px solid ${C.inkFaint}`,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.inkMute,
                }}
              >
                {kpi.k}
              </div>
              <div
                style={{
                  fontSize: 24,
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                  color: C.ink,
                }}
              >
                {kpi.v}
              </div>
              {kpi.sub && (
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    color: C.ember,
                  }}
                >
                  {kpi.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UnlockedFeaturesGrid({ isPlus, isPro }: { isPlus: boolean; isPro: boolean }) {
  const gate = useUpgradeGate();
  const tierLabel = isPro ? "Pro" : "Plus";
  return (
    <div
      style={{
        padding: 24,
        border: `1.5px solid ${C.ink}`,
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
          }}
        >
          All your features
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${C.ink}`,
            color: C.ink,
          }}
        >
          {tierLabel} plan
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {PREMIUM_FEATURES.map((f) => {
          const unlocked = f.tier === "plus" ? isPlus : isPro;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                if (!unlocked) gate.openUpgrade(f.tier, f.label);
              }}
              disabled={unlocked}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                border: `1px solid ${unlocked ? C.inkFaint : C.inkFaint}`,
                background: unlocked ? C.paper : "transparent",
                borderRadius: 8,
                cursor: unlocked ? "default" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: 13, color: unlocked ? "#2d7a4f" : C.ember, fontFamily: "'JetBrains Mono', monospace" }}>
                {unlocked ? "✓" : "🔒"}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.25, color: unlocked ? C.ink : C.inkMute }}>
                {f.label}
              </span>
            </button>
          );
        })}
      </div>
      {!isPro && (
        <Link
          to="/pricing"
          style={{
            display: "inline-block",
            marginTop: 18,
            padding: "10px 18px",
            background: C.ink,
            color: C.paper,
            textDecoration: "none",
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {isPlus ? "Upgrade to Pro →" : "See all plans →"}
        </Link>
      )}
    </div>
  );
}

function TierBanner({
  isPlus,
  isPro,
  loading,
  hasPlan,
}: {
  isPlus: boolean;
  isPro: boolean;
  loading: boolean;
  hasPlan: boolean;
}) {
  if (loading) return null;
  if (!isPlus && !isPro) return null;
  const label = isPro ? "Pro" : "Plus";
  const jumpToFeatures = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document
      .getElementById("premium-features")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", "#premium-features");
  };
  const tagline = hasPlan
    ? `Your ${label} features are below — Invest vs. save, recommended accounts${
        isPro ? ", risk scenarios, coach & rate alerts" : ", broker waitlist & more"
      }.`
    : `Build your first plan to unlock your ${label} features — Invest vs. save, recommended accounts${
        isPro ? ", risk scenarios, coach & rate alerts" : ", broker waitlist & more"
      }.`;
  return (
    <a
      href={hasPlan ? "#premium-features" : "/quiz"}
      onClick={hasPlan ? jumpToFeatures : undefined}
      style={{
        display: "block",
        marginBottom: 24,
        padding: "14px 16px",
        background: C.ink,
        color: C.paper,
        borderRadius: 10,
        textDecoration: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#f0a890",
          marginBottom: 4,
        }}
      >
        ◆ {label} unlocked
      </div>
      <div style={{ fontSize: 16, lineHeight: 1.4 }}>
        {tagline}{" "}
        <span style={{ color: "#f0a890", textDecoration: "underline" }}>
          {hasPlan ? "Jump to features →" : "Build my plan →"}
        </span>
      </div>
    </a>
  );
}


function PlansList({
  plans,
  isPlus,
  onNewPlan,
  hideNewPlanButton = false,
}: {
  plans: PlanRow[];
  isPlus: boolean;
  onNewPlan: () => void;
  hideNewPlanButton?: boolean;
}) {
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const allTags = Array.from(new Set(plans.flatMap((p) => p.tags ?? []))).sort();
  const visible = filterTag ? plans.filter((p) => (p.tags ?? []).includes(filterTag)) : plans;
  const used = plans.length;

  return (
    <>
      {!isPlus && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginBottom: 12,
          }}
        >
          {Math.min(used, FREE_LIMIT)} of {FREE_LIMIT} free scenario{FREE_LIMIT === 1 ? "" : "s"} used — upgrade for unlimited
        </div>
      )}

      {allTags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <TagChip label="All" active={!filterTag} onClick={() => setFilterTag(null)} />
          {allTags.map((t) => (
            <TagChip key={t} label={t} active={filterTag === t} onClick={() => setFilterTag(t)} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        {visible.map((p) => (
          <PlanCard key={p.id} plan={p} suggestions={allTags} />
        ))}
      </div>

      {!hideNewPlanButton && (
        <button
          type="button"
          onClick={onNewPlan}
          style={{
            display: "inline-block",
            padding: "12px 22px",
            background: C.ink,
            color: C.paper,
            textDecoration: "none",
            border: "none",
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          + Build new plan
        </button>
      )}
    </>
  );
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${active ? C.ink : C.inkFaint}`,
        background: active ? C.ink : "transparent",
        color: active ? C.paper : C.inkSoft,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function GoalTracker({
  plan,
  isPlus,
  onOpenSettings,
}: {
  plan: PlanRow;
  isPlus: boolean;
  onOpenSettings: () => void;
}) {
  const m = computePlanMetrics(plan.answers, plan.assumptions);
  const g = computeGoalProgress(m, plan.current_savings, plan.target_move_in);
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  // Empty state — nudge Plus users to set a goal
  if (!g.hasGoal) {
    if (!isPlus) return null;
    return (
      <div style={{ marginTop: 14, padding: "10px 12px", borderLeft: `2px dashed ${C.inkFaint}`, background: C.paper, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: C.inkSoft }}>
          Set a target move-in date to track your savings progress.
        </div>
        <button type="button" onClick={onOpenSettings} style={{ background: "transparent", border: "none", color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}>
          Set goal →
        </button>
      </div>
    );
  }

  const pct = g.pctToGoal;
  const barColor = pct >= 100 ? C.ink : pct >= 50 ? C.ember : C.inkFaint;

  return (
    <div style={{ marginTop: 14, padding: "12px 14px", borderLeft: `2px solid ${C.ember}`, background: C.paper }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: C.ember }}>Goal · cash to close</div>
        {plan.target_move_in && (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.inkMute }}>
            Move-in {new Date(plan.target_move_in).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            {g.monthsToGoal != null && <> · {g.monthsToGoal} mo</>}
          </div>
        )}
      </div>
      <div style={{ fontSize: 15, marginBottom: 8 }}>
        <strong>{fmt(plan.current_savings ?? 0)}</strong>
        <span style={{ color: C.inkMute }}> of {fmt(m.cashToClose)}</span>
        <span style={{ color: C.inkMute, marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div style={{ height: 8, background: "#fff", border: `1px solid ${C.inkFaint}`, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width 0.4s ease" }} />
      </div>
      {g.requiredMonthly != null && g.remaining > 0 && (
        <div style={{ marginTop: 10, fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>
          {g.monthsToGoal === 0 ? (
            <span>Goal date is here — <strong>{fmt(g.remaining)}</strong> still needed.</span>
          ) : (
            <>
              You need <strong>{fmt(g.requiredMonthly)}/mo</strong> to hit this by your move-in date.
              {g.statedMonthly > 0 && (
                <span style={{ color: C.inkMute }}>
                  {" "}You said you save <strong style={{ color: C.inkSoft }}>{fmt(g.statedMonthly)}/mo</strong>
                  {g.paceDeltaMonthly != null && (
                    g.paceDeltaMonthly >= 0 ? (
                      <span style={{ color: "#2d7a3d" }}> · ahead by {fmt(g.paceDeltaMonthly)}/mo</span>
                    ) : (
                      <span style={{ color: C.ember }}> · short by {fmt(Math.abs(g.paceDeltaMonthly))}/mo</span>
                    )
                  )}
                </span>
              )}
            </>
          )}
        </div>
      )}
      {g.remaining === 0 && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#2d7a3d", fontWeight: 500 }}>
          You've hit your cash-to-close target. Time to talk to a lender.
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, suggestions = [] }: { plan: PlanRow; suggestions?: string[] }) {
  const qc = useQueryClient();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const renameFn = useServerFn(renamePlan);
  const deleteFn = useServerFn(deletePlan);
  const duplicateFn = useServerFn(duplicatePlan);
  const exportPdfFn = useServerFn(exportPlanPdf);
  const exportCsvFn = useServerFn(exportPlanCsv);
  const updateMetaFn = useServerFn(updatePlanMeta);
  const shareFn = useServerFn(togglePlanShare);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title || defaultTitle(plan));
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState(plan.notes ?? "");
  const [goalDate, setGoalDate] = useState(plan.target_move_in ?? "");
  const [savedAmt, setSavedAmt] = useState(
    plan.current_savings != null ? String(plan.current_savings) : "",
  );

  const env = getStripeEnvironment();
  const tags = plan.tags ?? [];

  const renameM = useMutation({
    mutationFn: (newTitle: string) => renameFn({ data: { planId: plan.id, title: newTitle } }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["my-plans"] });
    },
  });

  const deleteM = useMutation({
    mutationFn: () => deleteFn({ data: { planId: plan.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-plans"] }),
  });

  const duplicateM = useMutation({
    mutationFn: () => duplicateFn({ data: { planId: plan.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-plans"] }),
  });

  type MetaPatch = {
    planId: string;
    title?: string;
    tags?: string[];
    notes?: string | null;
    theme?: PlanThemeId;
    targetMoveIn?: string | null;
    currentSavings?: number | null;
    environment?: "sandbox" | "live";
  };
  const metaM = useMutation({
    mutationFn: (patch: MetaPatch) => updateMetaFn({ data: patch as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-plans"] }),
  });

  const shareM = useMutation({
    mutationFn: (enabled: boolean) =>
      shareFn({ data: { planId: plan.id, enabled, environment: env } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-plans"] }),
  });

  const requirePlus = (feature: string) => {
    if (!sub.isPlus) {
      gate.openUpgrade("plus", feature);
      return false;
    }
    return true;
  };

  const handleExportPdf = async () => {
    if (!requirePlus("PDF export")) return;
    setExporting("pdf");
    try {
      const res = await exportPdfFn({ data: { planId: plan.id, environment: env } });
      downloadBase64(res.base64, res.filename, "application/pdf");
    } catch (e) {
      console.error(e); alert("Couldn't export PDF.");
    } finally { setExporting(null); }
  };

  const handleExportCsv = async () => {
    if (!requirePlus("CSV export")) return;
    setExporting("csv");
    try {
      const res = await exportCsvFn({ data: { planId: plan.id, environment: env } });
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e); alert("Couldn't export CSV.");
    } finally { setExporting(null); }
  };

  const handleShare = () => {
    if (!requirePlus("Shareable plan link")) return;
    setShowShare(true);
    if (!plan.share_enabled) shareM.mutate(true);
  };

  const handleAddTag = (raw?: string) => {
    const t = (raw ?? tagDraft).trim();
    if (!t) return;
    if (!requirePlus("Plan tags")) return;
    const exists = tags.some((x) => x.toLowerCase() === t.toLowerCase());
    if (exists) { setTagDraft(""); return; }
    metaM.mutate({ planId: plan.id, tags: [...tags, t], environment: env });
    setTagDraft("");
  };

  const handleRemoveTag = (t: string) => {
    metaM.mutate({ planId: plan.id, tags: tags.filter((x) => x !== t), environment: env });
  };

  const tagSuggestions = suggestions
    .filter((s) => !tags.some((x) => x.toLowerCase() === s.toLowerCase()))
    .slice(0, 6);

  const handleSaveSettings = () => {
    if (!requirePlus("Plan notes & goal")) return;
    metaM.mutate({
      planId: plan.id,
      notes: notesDraft || null,
      targetMoveIn: goalDate || null,
      currentSavings: savedAmt ? Number(savedAmt) : null,
      environment: env,
    });
    setShowSettings(false);
  };

  const handleTheme = (theme: PlanThemeId) => {
    if (!requirePlus("Themed reports")) return;
    metaM.mutate({ planId: plan.id, theme, environment: env });
  };
  const activeTheme = getPlanTheme(plan.theme);
  const C = {
    paper: activeTheme.paper,
    ink: activeTheme.ink,
    inkSoft: activeTheme.inkSoft,
    inkMute: activeTheme.inkMute,
    inkFaint: activeTheme.faint,
    ember: activeTheme.ember,
    rule: activeTheme.ink,
  };

  const shareUrl = plan.share_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${plan.share_slug}`
    : "";

  return (
    <div style={{ padding: 20, border: `1.5px solid ${C.ink}`, borderRadius: 10, background: C.paper, color: C.ink, transition: "background 200ms ease, border-color 200ms ease, color 200ms ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        {editing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => renameM.mutate(title)}
            onKeyDown={(e) => {
              if (e.key === "Enter") renameM.mutate(title);
              if (e.key === "Escape") {
                setTitle(plan.title || defaultTitle(plan));
                setEditing(false);
              }
            }}
            autoFocus
            style={{
              flex: 1, fontSize: 20, fontFamily: "inherit",
              border: `1px solid ${C.inkFaint}`, borderRadius: 6, padding: "6px 8px", background: C.paper,
            }}
          />
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20, lineHeight: 1.2 }}>{plan.title || defaultTitle(plan)}</span>
              {(plan.version ?? 1) > 1 && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: C.ember, color: C.paper }}>
                  v{plan.version}
                </span>
              )}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.inkMute, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{new Date(plan.created_at).toLocaleDateString()}</span>
              {plan.share_enabled && <span style={{ color: C.ember }}>· Shared</span>}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.inkMute }} title={`Theme: ${activeTheme.label}`}>
                · <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: activeTheme.ember, border: `1px solid ${C.inkFaint}` }} /> {activeTheme.label}
              </span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: C.inkMute, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
        >
          {open ? "Hide" : "View"}
        </button>
      </div>

      {/* Tags row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center" }}>
        {tags.map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: C.paper, border: `1px solid ${C.inkFaint}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkSoft }}>
            {t}
            <button type="button" onClick={() => handleRemoveTag(t)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: C.inkMute, fontSize: 12, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input
          type="text"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
          onBlur={() => handleAddTag()}
          placeholder={sub.isPlus ? "+ tag" : "+ tag (Plus)"}
          style={{ flex: "0 0 auto", minWidth: 70, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", border: `1px dashed ${C.inkFaint}`, borderRadius: 999, padding: "3px 8px", background: "transparent", color: C.ink }}
        />
      </div>
      {tagSuggestions.length > 0 && sub.isPlus && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.inkMute }}>Recent:</span>
          {tagSuggestions.map((t) => (
            <button key={t} type="button" onClick={() => handleAddTag(t)} style={{ padding: "2px 8px", borderRadius: 999, background: "transparent", border: `1px dotted ${C.inkFaint}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkMute, cursor: "pointer" }}>+ {t}</button>
          ))}
        </div>
      )}

      {open && <PlanDetails answers={plan.answers} />}

      {/* Goal tracker */}
      <GoalTracker plan={plan} isPlus={sub.isPlus} onOpenSettings={() => setShowSettings(true)} />

      {/* Notes display */}
      {plan.notes && !showSettings && (
        <div style={{ marginTop: 12, fontSize: 14, color: C.inkSoft, fontStyle: "italic", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          “{plan.notes}”
        </div>
      )}

      {/* Settings panel (notes + goal) */}
      {showSettings && (
        <div style={{ marginTop: 14, padding: 12, background: C.paper, borderRadius: 6, display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute }}>
            Target move-in date
            <input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} style={{ display: "block", marginTop: 4, padding: 6, fontFamily: "inherit", fontSize: 14, border: `1px solid ${C.inkFaint}`, borderRadius: 4, width: "100%", background: "#fff" }} />
          </label>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute }}>
            Current savings ($)
            <input type="number" min="0" value={savedAmt} onChange={(e) => setSavedAmt(e.target.value)} style={{ display: "block", marginTop: 4, padding: 6, fontFamily: "inherit", fontSize: 14, border: `1px solid ${C.inkFaint}`, borderRadius: 4, width: "100%", background: "#fff" }} />
          </label>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute }}>
            Notes
            <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} style={{ display: "block", marginTop: 4, padding: 6, fontFamily: "inherit", fontSize: 14, border: `1px solid ${C.inkFaint}`, borderRadius: 4, width: "100%", background: "#fff", resize: "vertical" }} />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={handleSaveSettings} style={{ padding: "6px 12px", background: C.ink, color: C.paper, border: "none", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Save</button>
            <button type="button" onClick={() => setShowSettings(false)} style={{ padding: "6px 12px", background: "transparent", color: C.inkMute, border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShare && (
        <div onClick={() => setShowShare(false)} style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: 28, borderRadius: 12, maxWidth: 460, width: "100%", border: `1.5px solid ${C.ink}` }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ember, marginBottom: 10 }}>Share this plan</div>
            <h3 style={{ fontWeight: 400, fontSize: 24, margin: "0 0 16px" }}>Read-only public link</h3>
            {shareM.isPending ? (
              <p style={{ color: C.inkMute }}>Generating link…</p>
            ) : shareUrl ? (
              <>
                <input
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{ width: "100%", padding: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, border: `1px solid ${C.inkFaint}`, borderRadius: 6, background: C.paper, color: C.ink, marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ padding: "10px 16px", background: C.ink, color: C.paper, border: "none", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Copy</button>
                  <button type="button" onClick={() => { shareM.mutate(false); setShowShare(false); }} style={{ padding: "10px 16px", background: "transparent", color: C.ember, border: `1px solid ${C.ember}`, borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Revoke</button>
                  <button type="button" onClick={() => setShowShare(false)} style={{ marginLeft: "auto", padding: "10px 16px", background: "transparent", color: C.inkMute, border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>Close</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <ActionLink onClick={() => setEditing(true)}>Rename</ActionLink>
        <ActionLink onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? "Close" : "Goal & notes"}
        </ActionLink>
        <ActionLink onClick={handleShare}>
          {plan.share_enabled ? "Manage share" : "Share"}
        </ActionLink>
        <ActionLink onClick={handleExportPdf} disabled={exporting === "pdf"}>
          {exporting === "pdf" ? "…" : "PDF"}
        </ActionLink>
        <ActionLink onClick={handleExportCsv} disabled={exporting === "csv"}>
          {exporting === "csv" ? "…" : "CSV"}
        </ActionLink>
        <ActionLink
          onClick={() => {
            if (!sub.isPlus) { gate.openUpgrade("plus", "Plan versioning"); return; }
            duplicateM.mutate();
          }}
          disabled={duplicateM.isPending}
        >
          {duplicateM.isPending ? "…" : "Re-run as new version"}
        </ActionLink>
        <ActionLink onClick={() => { if (confirm("Delete this plan?")) deleteM.mutate(); }} danger>
          Delete
        </ActionLink>
      </div>

      {/* Theme picker — surfaced next to exports so it's actually findable */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute }}>
          Report theme {sub.isPlus ? "" : "(Plus)"}
        </span>
        {THEME_IDS.map((id) => {
          const th = PLAN_THEMES[id];
          const isActive = (plan.theme ?? "light") === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTheme(id)}
              title={th.label}
              aria-label={`Use ${th.label} theme`}
              style={{
                width: 22, height: 22, borderRadius: 999, padding: 0, cursor: "pointer",
                background: th.paper,
                border: `2px solid ${isActive ? C.ink : C.inkFaint}`,
                outline: isActive ? `1px solid ${C.ink}` : "none",
                outlineOffset: 1,
                position: "relative",
                opacity: sub.isPlus ? 1 : 0.55,
              }}
            >
              <span style={{ position: "absolute", inset: 4, borderRadius: 999, background: th.ember }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}


function downloadBase64(base64: string, filename: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ActionLink({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        color: danger ? C.ember : C.ink,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function defaultTitle(plan: PlanRow) {
  const name = plan.answers?.firstName as string | undefined;
  return name ? `${name}'s plan` : "Homebuying plan";
}

function PlanDetails({ answers }: { answers: Record<string, unknown> }) {
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: unknown, fmt?: (v: unknown) => string) => {
    if (value === null || value === undefined || value === "") return;
    rows.push([label, fmt ? fmt(value) : String(value)]);
  };
  const money = (n: unknown) =>
    typeof n === "number" ? `$${n.toLocaleString()}` : String(n);
  push("Name", [answers.firstName, answers.lastName].filter(Boolean).join(" "));
  push("State", answers.zip);
  push("Annual income", answers.income, money);
  push("Monthly expenses", answers.expenses, money);
  push("Total debt", answers.debt, money);
  push("Saved so far", answers.saved, money);
  push("Credit score", answers.credit);
  push("Monthly savings", answers.timelineBucket, (v) => `${v}/mo`);
  push("Time to buy", answers.timelineYears, (v) => `${v} ${v === 1 ? "year" : "years"}`);
  push("Down payment goal", answers.downGoalPct, (v) => `${v}%`);

  if (rows.length === 0) return null;

  return (
    <dl style={{ margin: "14px 0 0" }}>
      {rows.map(([k, v]) => (
        <div
          key={k}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "8px 0",
            borderBottom: `1px solid ${C.inkFaint}`,
            gap: 12,
          }}
        >
          <dt
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.inkMute,
            }}
          >
            {k}
          </dt>
          <dd style={{ margin: 0, fontSize: 16, color: C.ink, textAlign: "right" }}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

import { PREMIUM_FEATURES as TIER_FEATURES } from "@/lib/tier-features";

const PREMIUM_FEATURES = TIER_FEATURES.map((f) => ({
  id: f.id,
  label: f.short,
  tier: f.tier,
}));

function PremiumPanel({ isPlus, isPro }: { isPlus: boolean; isPro: boolean }) {
  const tierLabel = isPro ? "Pro" : isPlus ? "Plus" : "Free";
  const gate = useUpgradeGate();
  return (
    <div
      style={{
        marginTop: 32,
        padding: 24,
        border: `1.5px solid ${C.ink}`,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
          }}
        >
          Premium features
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${C.ink}`,
            color: C.ink,
          }}
        >
          {tierLabel} plan
        </span>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {PREMIUM_FEATURES.map((f) => {
          const unlocked = f.tier === "plus" ? isPlus : isPro;
          return (
            <li
              key={f.id}
              style={{
                borderBottom: `1px solid ${C.inkFaint}`,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!unlocked) gate.openUpgrade(f.tier, f.label);
                }}
                disabled={unlocked}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "12px 0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  cursor: unlocked ? "default" : "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 17, color: unlocked ? C.ink : C.inkMute }}>
                  {unlocked ? "✓" : "🔒"} {f.label}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: unlocked ? "#2d7a4f" : C.ember,
                  }}
                >
                  {unlocked ? "Unlocked" : `Unlock ${f.tier} →`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!isPro && (
        <Link
          to="/pricing"
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "12px 22px",
            background: C.ink,
            color: C.paper,
            textDecoration: "none",
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {isPlus ? "Upgrade to Pro →" : "See all plans →"}
        </Link>
      )}
    </div>
  );
}

function EmptyState({ isPlus }: { isPlus: boolean }) {
  return (
    <div
      style={{
        padding: 24,
        border: `1.5px solid ${C.ink}`,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>
        {isPlus ? "Your saved plan isn't linked yet." : "No plans yet."}
      </div>
      <div style={{ color: C.inkSoft, fontSize: 17, marginBottom: 20, lineHeight: 1.45 }}>
        {isPlus
          ? "Build (or rebuild) your plan and we'll attach it to your account automatically — your premium features are still unlocked below."
          : "Take the quick questionnaire to build your first plan."}
      </div>
      <Link
        to="/"
        style={{
          display: "inline-block",
          padding: "12px 22px",
          background: C.ink,
          color: C.paper,
          textDecoration: "none",
          borderRadius: 8,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Build my plan →
      </Link>
    </div>
  );
}

function InvestmentSection({
  answers,
  assumptions,
  planId,
  isPlus,
  isPro,
}: {
  answers: Record<string, unknown>;
  assumptions: Record<string, number> | null;
  planId: string;
  isPlus: boolean;
  isPro: boolean;
}) {
  const gate = useUpgradeGate();
  const generatePdf = useServerFn(generateInvestmentPlanPdf);
  const metrics = computePlanMetrics(answers, assumptions);

  const downloadPdf = async () => {
    if (!isPlus) {
      gate.openUpgrade("plus", "Savings & investing action plan (PDF)");
      return;
    }
    try {
      const res = await generatePdf({ data: { planId } });
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[investment pdf]", e);
      alert("Couldn't generate the PDF. Please try again.");
    }
  };

  return (
    <div>
      <InvestVsSavePanel
        answers={answers}
        assumptions={assumptions}
        planId={planId}
        isPlus={isPlus}
        locked={!isPlus}
        onLockedClick={() => gate.openUpgrade("plus", "Invest vs. save projection")}
      />

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={downloadPdf}
          style={{
            padding: "10px 18px",
            background: isPlus ? C.ink : "transparent",
            color: isPlus ? C.paper : C.inkMute,
            border: `1.5px solid ${C.ink}`,
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {isPlus ? "↓ Download investment plan (PDF)" : "🔒 Download investment plan"}
        </button>
      </div>

      <RecommendedAccountsPanel
        locked={!isPlus}
        onLockedClick={() => gate.openUpgrade("plus", "Recommended accounts")}
        timelineYears={metrics.timelineYears}
      />

      <AssumptionsPanel
        planId={planId}
        answers={answers}
        targetPrice={metrics.targetPrice}
        assumptions={assumptions}
        isPlus={isPlus}
        locked={!isPlus}
        onLockedClick={() => gate.openUpgrade("plus", "Custom assumptions")}
      />

      <RiskScenariosPanel
        answers={answers}
        assumptions={assumptions}
        locked={!isPro}
        onLockedClick={() => gate.openUpgrade("pro", "Risk-adjusted scenarios")}
      />

      <BrokerWaitlistPanel
        isPro={isPro}
        isPlus={isPlus}
        locked={!isPlus}
        onLockedClick={() => gate.openUpgrade("plus", "Broker waitlist")}
      />
    </div>
  );
}
