import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyPlans,
  renamePlan,
  deletePlan,
  exportPlanPdf,
  exportPlanCsv,
  updatePlanMeta,
  togglePlanShare,
} from "@/lib/plans.functions";
import { getReminderPrefs, setReminderPrefs } from "@/lib/reminders.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { getPaddleEnvironment } from "@/lib/paddle";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your plans — Keystone" },
      { name: "description", content: "Your saved homebuying plans." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
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

const FREE_LIMIT = 3;

type PlanRow = {
  id: string;
  email: string;
  title: string | null;
  answers: Record<string, unknown>;
  created_at: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const fetchPlans = useServerFn(getMyPlans);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-plans"],
    queryFn: () => fetchPlans(),
  });
  const sub = useSubscription();
  const gate = useUpgradeGate();

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
    navigate({ to: "/" });
  };

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
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 14,
            borderBottom: `1px solid ${C.rule}`,
            marginBottom: 32,
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
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link
              to="/coach"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: sub.isPro ? C.ember : C.inkMute,
                textDecoration: "none",
              }}
            >
              Coach
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
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

        {isLoading ? (
          <p style={{ color: C.inkSoft, fontSize: 18 }}>Loading your plans…</p>
        ) : error ? (
          <p style={{ color: C.ember, fontSize: 16 }}>
            Couldn't load your plans. Please refresh.
          </p>
        ) : plans.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <RemindersToggle hasPlans={plans.length > 0} />
            <PlansList plans={plans} isPlus={sub.isPlus} onNewPlan={handleNewPlan} />
          </>
        )}

        <PremiumPanel
          isPlus={sub.isPlus}
          isPro={sub.isPro}
        />
      </div>
    </div>
  );
}

function RemindersToggle({ hasPlans }: { hasPlans: boolean }) {
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const qc = useQueryClient();
  const fetchPrefs = useServerFn(getReminderPrefs);
  const updatePrefs = useServerFn(setReminderPrefs);

  const { data: prefs } = useQuery({
    queryKey: ["reminder-prefs"],
    queryFn: () => fetchPrefs(),
    enabled: sub.isPlus,
  });

  const toggleM = useMutation({
    mutationFn: (enabled: boolean) => updatePrefs({ data: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminder-prefs"] }),
  });

  const enabled = Boolean(prefs?.enabled);

  const onClick = () => {
    if (!sub.isPlus) {
      gate.openUpgrade("plus", "Email reminders");
      return;
    }
    toggleM.mutate(!enabled);
  };

  if (!hasPlans) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        border: `1px solid ${C.ink}`,
        borderRadius: 8,
        marginBottom: 14,
        background: enabled ? C.ink : "transparent",
        color: enabled ? C.paper : C.ink,
      }}
    >
      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: enabled ? C.inkFaint : C.ember, marginBottom: 4 }}>
          Monthly check-in{sub.isPlus ? "" : " · Plus"}
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 16 }}>
          {enabled ? "On — we'll email you a digest each month." : "Get a monthly recap of your plans by email."}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={toggleM.isPending}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          padding: "8px 14px",
          borderRadius: 6,
          border: `1px solid ${enabled ? C.paper : C.ink}`,
          background: enabled ? C.paper : "transparent",
          color: C.ink,
          cursor: toggleM.isPending ? "default" : "pointer",
          opacity: toggleM.isPending ? 0.5 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {toggleM.isPending ? "…" : enabled ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}

function PlansList({
  plans,
  isPlus,
  onNewPlan,
}: {
  plans: PlanRow[];
  isPlus: boolean;
  onNewPlan: () => void;
}) {
  const visible = plans;
  const locked: PlanRow[] = [];
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
          {Math.min(used, FREE_LIMIT)} of {FREE_LIMIT} free plans used
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        {visible.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
        {locked.map((p) => (
          <LockedPlanCard key={p.id} plan={p} />
        ))}
      </div>

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
    </>
  );
}

function PlanCard({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const renameFn = useServerFn(renamePlan);
  const deleteFn = useServerFn(deletePlan);
  const exportFn = useServerFn(exportPlanPdf);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title || defaultTitle(plan));
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    if (!sub.isPlus) {
      gate.openUpgrade("plus", "PDF export");
      return;
    }
    setExporting(true);
    try {
      const res = await exportFn({
        data: { planId: plan.id, environment: getPaddleEnvironment() },
      });
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Couldn't export PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = () => {
    if (confirm("Delete this plan? This cannot be undone.")) deleteM.mutate();
  };

  return (
    <div
      style={{
        padding: 20,
        border: `1.5px solid ${C.ink}`,
        borderRadius: 10,
        background: "#fff",
      }}
    >
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
              flex: 1,
              fontSize: 20,
              fontFamily: "inherit",
              border: `1px solid ${C.inkFaint}`,
              borderRadius: 6,
              padding: "6px 8px",
              background: C.paper,
            }}
          />
        ) : (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, lineHeight: 1.2 }}>{plan.title || defaultTitle(plan)}</div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.inkMute,
                marginTop: 4,
              }}
            >
              {new Date(plan.created_at).toLocaleDateString()}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: C.inkMute,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {open ? "Hide" : "View"}
        </button>
      </div>

      {open && <PlanDetails answers={plan.answers} />}

      <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <ActionLink onClick={() => setEditing(true)}>Rename</ActionLink>
        <ActionLink onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export PDF"}
        </ActionLink>
        <ActionLink onClick={handleDelete} danger>
          Delete
        </ActionLink>
      </div>
    </div>
  );
}

function LockedPlanCard({ plan }: { plan: PlanRow }) {
  const gate = useUpgradeGate();
  return (
    <button
      type="button"
      onClick={() => gate.openUpgrade("plus", "Saved plans")}
      style={{
        textAlign: "left",
        padding: 16,
        border: `1px dashed ${C.inkFaint}`,
        borderRadius: 10,
        background: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        color: C.inkMute,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 17 }}>🔒 {plan.title || defaultTitle(plan)}</div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {new Date(plan.created_at).toLocaleDateString()} · Plus to unlock
        </div>
      </div>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.ember,
        }}
      >
        Upgrade →
      </span>
    </button>
  );
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
  push("ZIP", answers.zip);
  push("Annual income", answers.income, money);
  push("Monthly expenses", answers.expenses, money);
  push("Total debt", answers.debt, money);
  push("Saved so far", answers.saved, money);
  push("Credit score", answers.credit);
  push("Timeline", answers.timelineBucket);
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

const PREMIUM_FEATURES: Array<{
  id: string;
  label: string;
  tier: "plus" | "pro";
}> = [
  { id: "save", label: "Unlimited saved plans", tier: "plus" },
  { id: "pdf", label: "Export plan as PDF", tier: "plus" },
  { id: "partner", label: "Partner / household mode", tier: "plus" },
  { id: "coach", label: "AI homebuying coach", tier: "pro" },
  { id: "compare", label: "Side-by-side scenario compare", tier: "pro" },
  { id: "alerts", label: "Live mortgage rate alerts", tier: "pro" },
];

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

function EmptyState() {
  return (
    <div
      style={{
        padding: 24,
        border: `1.5px solid ${C.ink}`,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>No plans yet.</div>
      <div style={{ color: C.inkSoft, fontSize: 17, marginBottom: 20, lineHeight: 1.45 }}>
        Take the quick questionnaire to build your first plan.
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
