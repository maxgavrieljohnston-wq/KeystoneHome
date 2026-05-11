import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlan } from "@/lib/account.functions";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your plan — Keystone" },
      { name: "description", content: "Your saved homebuying plan." },
    ],
  }),
  beforeLoad: async () => {
    // Supabase session lives in localStorage; only meaningful on the client.
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

function DashboardPage() {
  const navigate = useNavigate();
  const fetchPlan = useServerFn(getMyPlan);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-plan"],
    queryFn: () => fetchPlan(),
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const lead = data?.lead;
  const answers = (lead?.answers ?? {}) as Record<string, unknown>;
  const firstName = (answers.firstName as string | undefined) ?? "";
  const greeting = firstName ? `Welcome back, ${firstName}.` : "Welcome back.";

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
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 14,
            borderBottom: `1px solid ${C.rule}`,
            marginBottom: 40,
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

        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
            marginBottom: 16,
          }}
        >
          — Your dashboard
        </div>

        <h1
          style={{
            fontWeight: 400,
            fontSize: 44,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            margin: "0 0 28px",
          }}
        >
          {greeting}
        </h1>

        {isLoading ? (
          <p style={{ color: C.inkSoft, fontSize: 18 }}>Loading your plan…</p>
        ) : error ? (
          <p style={{ color: C.ember, fontSize: 16 }}>
            Couldn't load your plan. Please refresh.
          </p>
        ) : !lead ? (
          <EmptyState />
        ) : (
          <PlanSummary
            email={lead.email}
            answers={answers}
            completed={lead.completed}
            updatedAt={lead.updated_at}
          />
        )}
      </div>
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
      <div style={{ fontSize: 24, marginBottom: 8 }}>No plan yet.</div>
      <div style={{ color: C.inkSoft, fontSize: 17, marginBottom: 20, lineHeight: 1.45 }}>
        We don't have a plan saved for this account. Take the quick
        questionnaire to build one.
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

function PlanSummary({
  email,
  answers,
  completed,
  updatedAt,
}: {
  email: string;
  answers: Record<string, unknown>;
  completed: boolean;
  updatedAt: string;
}) {
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

  return (
    <>
      <div
        style={{
          padding: 24,
          border: `1.5px solid ${C.ink}`,
          borderRadius: 10,
          background: "#fff",
          marginBottom: 24,
        }}
      >
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
          {completed ? "Plan ready" : "In progress"} · {email}
        </div>

        {rows.length === 0 ? (
          <div style={{ color: C.inkSoft, fontSize: 16 }}>
            We have your account but no questionnaire answers yet.
          </div>
        ) : (
          <dl style={{ margin: 0 }}>
            {rows.map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "10px 0",
                  borderBottom: `1px solid ${C.inkFaint}`,
                  gap: 12,
                }}
              >
                <dt
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                  }}
                >
                  {k}
                </dt>
                <dd style={{ margin: 0, fontSize: 18, color: C.ink, textAlign: "right" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div
          style={{
            marginTop: 16,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.inkFaint,
          }}
        >
          Last updated {new Date(updatedAt).toLocaleDateString()}
        </div>
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
        Retake questionnaire →
      </Link>
    </>
  );
}
