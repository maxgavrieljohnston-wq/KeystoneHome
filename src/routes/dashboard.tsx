import { useEffect, useMemo } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlans } from "@/lib/plans.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { useAuthReady } from "@/hooks/useAuthReady";
import { EditablePlanPanel } from "@/components/dashboard/EditablePlanPanel";
import {
  computePlanMetrics,
  computeGoalProgress,
  computeTimeToGoal,
  formatMonths,
} from "@/lib/plan-metrics";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — Keystone" },
      { name: "description", content: "Your homebuying command center." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DashboardPage,
});

// ── Tokens (calm editorial) ─────────────────────────────────────────────
const C = {
  paper: "#f7f3eb",
  paperSoft: "#efe9dc",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  rule: "#1a1a1a",
  ruleSoft: "rgba(26,26,26,0.1)",
  ember: "#c4452d",
  sage: "#4a6b4f",
};

const SERIF = "'Cormorant Garamond', 'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

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

// ── Page ─────────────────────────────────────────────────────────────────

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

  const plans = (data?.plans ?? []) as unknown as PlanRow[];
  const plan = plans[0] ?? null;
  const firstName = (plan?.answers?.firstName as string | undefined) ?? "";
  const isPaid = sub.isPlus || sub.isPro;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const handleNewPlan = () => {
    if (!sub.isPlus && plans.length >= 1) {
      gate.openUpgrade("plus", "Unlimited saved plans");
      return;
    }
    navigate({ to: "/", search: { new: true } });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: SERIF,
      }}
    >
      <style>{`
        .ks-grid { display: grid; gap: 48px; grid-template-columns: minmax(0,1fr); }
        @media (min-width: 1000px) { .ks-grid { grid-template-columns: minmax(0,1fr) 320px; gap: 56px; } }
        .ks-kpis { display: grid; gap: 32px; grid-template-columns: minmax(0,1fr); }
        @media (min-width: 700px) { .ks-kpis { grid-template-columns: repeat(3, minmax(0,1fr)); } }
        .ks-nav a:hover { color: ${C.ink} !important; }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 80px" }}>
        <TopNav onSignOut={handleSignOut} isPaid={isPaid} tier={sub.isPro ? "Pro" : sub.isPlus ? "Plus" : "Free"} />

        <Header firstName={firstName} hasPlan={!!plan} />

        {!auth.ready || isLoading ? (
          <Loading />
        ) : error ? (
          <p style={{ color: C.ember, fontSize: 16 }}>Couldn't load your plan. Please refresh.</p>
        ) : !plan ? (
          <EmptyState onNewPlan={handleNewPlan} />
        ) : (
          <>
            <KpiStrip plan={plan} />

            <div className="ks-grid" style={{ marginTop: 56 }}>
              <div>
                {isPaid ? (
                  <EditablePlanPanel
                    planId={plan.id}
                    planTitle={plan.title}
                    shareSlug={plan.share_slug}
                    shareEnabled={plan.share_enabled}
                    answers={plan.answers}
                    assumptions={plan.assumptions}
                    currentSavings={plan.current_savings}
                  />
                ) : (
                  <LockedEditor plan={plan} onUpgrade={() => gate.openUpgrade("plus", "Live plan editing")} />
                )}
              </div>

              <aside style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                <NextActions plan={plan} isPaid={isPaid} onNewPlan={handleNewPlan} />
                <MarketContext plan={plan} />
                <FeatureLinks isPaid={isPaid} />
              </aside>
            </div>
          </>
        )}

        <Footer />
      </div>
    </div>
  );
}

// ── Top nav ──────────────────────────────────────────────────────────────

function TopNav({
  onSignOut,
  isPaid,
  tier,
}: {
  onSignOut: () => void;
  isPaid: boolean;
  tier: "Free" | "Plus" | "Pro";
}) {
  const linkStyle = {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: C.inkMute,
    textDecoration: "none" as const,
    transition: "color 150ms",
  };
  return (
    <header
      className="ks-nav"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        flexWrap: "wrap",
        paddingBottom: 18,
        borderBottom: `1px solid ${C.ruleSoft}`,
        marginBottom: 56,
      }}
    >
      <Link
        to="/"
        style={{
          fontFamily: SERIF,
          fontSize: 26,
          letterSpacing: "-0.01em",
          color: C.ink,
          textDecoration: "none",
        }}
      >
        Keystone
      </Link>
      <nav style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/coach" style={linkStyle}>Coach</Link>
        <Link to="/rate-alerts" style={linkStyle}>Rates</Link>
        <Link to="/market" style={linkStyle}>Market</Link>
        <Link to="/accounts" style={linkStyle}>Accounts</Link>
        <Link to="/documents" style={linkStyle}>Docs</Link>
        <Link to="/broker-match" style={linkStyle}>Broker</Link>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            padding: "4px 10px",
            border: `1px solid ${isPaid ? C.ink : C.inkFaint}`,
            color: isPaid ? C.ink : C.inkMute,
            borderRadius: 999,
          }}
        >
          {tier}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            ...linkStyle,
          }}
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}

// ── Header ───────────────────────────────────────────────────────────────

function Header({ firstName, hasPlan }: { firstName: string; hasPlan: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 20,
        flexWrap: "wrap",
        marginBottom: 48,
        borderBottom: `1px solid ${C.ruleSoft}`,
        paddingBottom: 24,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.inkMute,
            marginBottom: 10,
          }}
        >
          Dashboard / Phase 01
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(40px, 6vw, 64px)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {firstName ? `Welcome back, ${firstName}.` : "Your command center."}
        </h1>
      </div>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkMute,
        }}
      >
        Status: {hasPlan ? "Active track" : "Awaiting first plan"}
      </span>
    </div>
  );
}

// ── KPI strip ────────────────────────────────────────────────────────────

function KpiStrip({ plan }: { plan: PlanRow }) {
  const m = useMemo(() => computePlanMetrics(plan.answers, plan.assumptions), [plan]);
  const goal = useMemo(
    () => computeGoalProgress(m, plan.current_savings, plan.target_move_in),
    [m, plan.current_savings, plan.target_move_in],
  );
  const ttg = useMemo(
    () =>
      computeTimeToGoal({
        cashToClose: m.cashToClose,
        currentSavings: plan.current_savings ?? 0,
        monthlySavings: m.monthlySavings,
        annualReturnRate: 0,
      }),
    [m, plan.current_savings],
  );

  const pct = goal.pctToGoal;
  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const pace = goal.requiredMonthly;
  const stated = m.monthlySavings;
  const paceDelta = pace != null && stated > 0 ? stated - pace : null;

  return (
    <section className="ks-kpis">
      <Kpi
        eyebrow="Cash-to-close goal"
        value={`${Math.round(pct)}%`}
        sub={`${fmt$(plan.current_savings ?? 0)} of ${fmt$(m.cashToClose)}`}
        progress={pct}
      />
      <Kpi
        eyebrow="Time to horizon"
        value={ttg.monthsSaveOnly != null ? formatMonths(ttg.monthsSaveOnly) : "—"}
        valueItalic
        sub={
          plan.target_move_in
            ? `Target: ${new Date(plan.target_move_in).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
            : "No target date set"
        }
      />
      <Kpi
        eyebrow="Monthly pace"
        value={stated > 0 ? fmt$(stated) : "—"}
        valueColor={paceDelta != null ? (paceDelta >= 0 ? C.sage : C.ember) : C.ink}
        sub={
          paceDelta == null
            ? pace != null
              ? `${fmt$(pace)} required`
              : "Set a goal to compare"
            : paceDelta >= 0
              ? `+${fmt$(paceDelta)} above required`
              : `${fmt$(Math.abs(paceDelta))} short of required`
        }
      />
    </section>
  );
}

function Kpi({
  eyebrow,
  value,
  sub,
  progress,
  valueItalic,
  valueColor,
}: {
  eyebrow: string;
  value: string;
  sub: string;
  progress?: number;
  valueItalic?: boolean;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkMute,
        }}
      >
        {eyebrow}
      </span>
      <div
        style={{
          fontFamily: SERIF,
          fontStyle: valueItalic ? "italic" : "normal",
          fontWeight: 400,
          fontSize: "clamp(48px, 6vw, 72px)",
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: valueColor ?? C.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {progress != null && (
        <div style={{ height: 2, background: C.ruleSoft, marginTop: 2 }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: "100%",
              background: C.ink,
              transition: "width 400ms ease",
            }}
          />
        </div>
      )}
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: C.inkMute,
          letterSpacing: "0.02em",
        }}
      >
        {sub}
      </span>
    </div>
  );
}

// ── Next Actions ─────────────────────────────────────────────────────────

type Action = { title: string; detail: string; done?: boolean; locked?: boolean };

function buildActions(plan: PlanRow, isPaid: boolean): Action[] {
  const m = computePlanMetrics(plan.answers, plan.assumptions);
  const goal = computeGoalProgress(m, plan.current_savings, plan.target_move_in);
  const credit = (plan.answers.credit as number | undefined) ?? 0;
  const monthly = m.monthlySavings;

  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const actions: Action[] = [];

  if (goal.requiredMonthly != null && monthly > 0) {
    actions.push({
      title: "Monthly savings target",
      detail:
        monthly >= goal.requiredMonthly
          ? `On pace at ${fmt$(monthly)}/mo. Transfer this month's contribution.`
          : `Increase to ${fmt$(goal.requiredMonthly)}/mo to hit your move-in date.`,
      done: monthly >= goal.requiredMonthly,
    });
  } else if (monthly > 0) {
    actions.push({
      title: "Monthly savings target",
      detail: `Transfer ${fmt$(monthly)} to your home fund this month.`,
    });
  } else {
    actions.push({
      title: "Set a monthly contribution",
      detail: "A regular transfer is the single biggest accelerator.",
    });
  }

  if (credit < 740) {
    actions.push({
      title: "Improve credit score",
      detail:
        credit >= 680
          ? "You're close to the 740 tier — review utilization and dispute any errors."
          : "Pull your free report and dispute errors. Pay down revolving balances.",
    });
  }

  if (m.readiness >= 70) {
    actions.push({
      title: "Soft pre-approval",
      detail: "Your readiness is strong. Get a soft pre-approval to lock in your buying power.",
    });
  } else {
    actions.push({
      title: "Soft pre-approval",
      detail: `Locked until readiness reaches 70 (you're at ${m.readiness}).`,
      locked: true,
    });
  }

  if (!plan.target_move_in) {
    actions.push({
      title: "Set a target move-in date",
      detail: isPaid
        ? "Adjust timeline in your plan editor to unlock pacing math."
        : "Upgrade to set a goal date and track pacing.",
      locked: !isPaid,
    });
  }

  return actions.slice(0, 4);
}

function NextActions({
  plan,
  isPaid,
  onNewPlan,
}: {
  plan: PlanRow;
  isPaid: boolean;
  onNewPlan: () => void;
}) {
  const actions = buildActions(plan, isPaid);
  return (
    <div>
      <SidebarHeader title="Next actions" />
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 22 }}>
        {actions.map((a, i) => (
          <li key={i} style={{ display: "flex", gap: 14, opacity: a.locked ? 0.45 : 1 }}>
            <Checkbox checked={!!a.done} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.3, color: C.ink }}>
                {a.title}
              </div>
              <div style={{ fontSize: 12, fontFamily: MONO, color: C.inkMute, marginTop: 4, lineHeight: 1.5 }}>
                {a.detail}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onNewPlan}
        style={{
          marginTop: 24,
          width: "100%",
          padding: "12px 16px",
          background: "transparent",
          border: `1px solid ${C.ink}`,
          color: C.ink,
          cursor: "pointer",
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          transition: "background 150ms, color 150ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = C.ink;
          e.currentTarget.style.color = C.paper;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = C.ink;
        }}
      >
        + New scenario
      </button>
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        border: `1px solid ${C.ink}`,
        flexShrink: 0,
        marginTop: 5,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: checked ? C.ink : "transparent",
      }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1 4.5L3.5 7L8 1.5" stroke={C.paper} strokeWidth="1.5" />
        </svg>
      )}
    </span>
  );
}

// ── Market context ───────────────────────────────────────────────────────

function MarketContext({ plan }: { plan: PlanRow }) {
  const m = computePlanMetrics(plan.answers, plan.assumptions);
  return (
    <div>
      <SidebarHeader title="Market context" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Row label="Your est. rate" value={`${(m.mortgageRate * 100).toFixed(2)}%`} />
        <Row label="Est. monthly P&I" value={`$${Math.round(m.monthlyMortgage).toLocaleString()}`} />
        <Row label="Total housing/mo" value={`$${Math.round(m.totalHousing).toLocaleString()}`} />
        <Row label="Affordability" value={m.verdict} italic />
        <Row
          label="Local median"
          value={m.city ? `${m.city}` : "—"}
          sub={`$${Math.round(m.targetPrice).toLocaleString()} target`}
        />
      </div>
      <Link
        to="/market"
        style={{
          display: "inline-block",
          marginTop: 18,
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ember,
          textDecoration: "none",
          borderBottom: `1px solid ${C.ember}`,
          paddingBottom: 2,
        }}
      >
        Open market view →
      </Link>
    </div>
  );
}

function Row({ label, value, sub, italic }: { label: string; value: string; sub?: string; italic?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        borderBottom: `1px solid ${C.ruleSoft}`,
        paddingBottom: 6,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute }}>
        {label}
      </span>
      <span style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            fontStyle: italic ? "italic" : "normal",
            color: C.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        {sub && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkFaint, marginTop: 2 }}>{sub}</div>
        )}
      </span>
    </div>
  );
}

// ── Feature links ────────────────────────────────────────────────────────

function FeatureLinks({ isPaid }: { isPaid: boolean }) {
  const items = [
    { to: "/coach", label: "Coach" },
    { to: "/rate-alerts", label: "Rate alerts" },
    { to: "/stress-test", label: "Stress test" },
    { to: "/documents", label: "Documents" },
  ] as const;
  return (
    <div>
      <SidebarHeader title="Tools" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            style={{
              padding: "10px 0",
              borderBottom: `1px solid ${C.ruleSoft}`,
              fontFamily: SERIF,
              fontSize: 16,
              color: C.ink,
              textDecoration: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{it.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.inkFaint }}>
              {isPaid ? "→" : "🔒"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Sidebar header ───────────────────────────────────────────────────────

function SidebarHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: C.inkMute,
        paddingBottom: 12,
        marginBottom: 18,
        borderBottom: `1px solid ${C.rule}`,
      }}
    >
      {title}
    </div>
  );
}

// ── Locked editor (free tier) ────────────────────────────────────────────

function LockedEditor({ plan, onUpgrade }: { plan: PlanRow; onUpgrade: () => void }) {
  const m = computePlanMetrics(plan.answers, plan.assumptions);
  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const rows: Array<[string, string]> = [
    ["Target home price", fmt$(m.targetPrice)],
    ["Down payment", `${m.downPct.toFixed(1)}% · ${fmt$(m.downPayment)}`],
    ["Cash to close", fmt$(m.cashToClose)],
    ["Current savings", fmt$(plan.current_savings ?? 0)],
    ["Monthly contribution", fmt$(m.monthlySavings)],
    ["Combined income", `$${Math.round(m.monthlyIncome * 12).toLocaleString()}/yr`],
    ["Est. mortgage rate", `${(m.mortgageRate * 100).toFixed(2)}%`],
    ["Total housing/mo", fmt$(m.totalHousing)],
  ];
  return (
    <div>
      <SidebarHeader title="Your plan" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
        {rows.map(([k, v]) => (
          <Row key={k} label={k} value={v} />
        ))}
      </div>
      <div
        style={{
          border: `1px solid ${C.ink}`,
          padding: 22,
          background: C.paperSoft,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
          }}
        >
          ◆ Plus
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 22, lineHeight: 1.2, color: C.ink }}>
          Tweak any input and watch the numbers update live.
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.inkMute, lineHeight: 1.6 }}>
          Edit price, savings, income, credit, timeline. Export PDF / CSV. Share a link. Save unlimited scenarios.
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          style={{
            marginTop: 6,
            alignSelf: "flex-start",
            padding: "12px 22px",
            background: C.ink,
            color: C.paper,
            border: "none",
            cursor: "pointer",
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          Upgrade to edit
        </button>
      </div>
    </div>
  );
}

// ── Empty / loading ──────────────────────────────────────────────────────

function EmptyState({ onNewPlan }: { onNewPlan: () => void }) {
  return (
    <div
      style={{
        border: `1px solid ${C.ruleSoft}`,
        padding: "64px 32px",
        textAlign: "center",
        background: C.paperSoft,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.inkMute,
          marginBottom: 14,
        }}
      >
        No plan yet
      </div>
      <h2
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: 36,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          margin: "0 0 12px",
        }}
      >
        Build your first plan.
      </h2>
      <p style={{ fontFamily: MONO, fontSize: 12, color: C.inkMute, margin: "0 0 24px" }}>
        Three minutes. We'll handle the math.
      </p>
      <button
        type="button"
        onClick={onNewPlan}
        style={{
          padding: "14px 28px",
          background: C.ink,
          color: C.paper,
          border: "none",
          cursor: "pointer",
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}
      >
        Start the wizard →
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.inkMute }}>
        Loading
      </div>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 28, color: C.inkSoft }}>
        Composing your numbers…
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        marginTop: 96,
        paddingTop: 24,
        borderTop: `1px solid ${C.ruleSoft}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: C.inkFaint,
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <span>Keystone Planning Engine</span>
      <span>Calm decisions, clear math.</span>
    </footer>
  );
}
