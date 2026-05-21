import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyPlans } from "@/lib/plans.functions";
import { getComparePlans } from "@/lib/compare.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getStripeEnvironment } from "@/lib/stripe";
import { computePlanMetrics, type PlanMetrics } from "@/lib/plan-metrics";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare scenarios — Keystone" },
      { name: "description", content: "Side-by-side scenario comparison." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: ComparePage,
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

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;

function ComparePage() {
  const auth = useAuthReady();
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const navigate = useNavigate();
  const fetchPlans = useServerFn(getMyPlans);
  const fetchCompare = useServerFn(getComparePlans);
  const [selected, setSelected] = useState<string[]>([]);

  const proLocked = !sub.loading && !sub.isPro;

  const plansQ = useQuery({
    queryKey: ["my-plans", auth.user?.id],
    queryFn: () => fetchPlans(),
    enabled: auth.ready && !!auth.user && !proLocked,
  });

  const compareQ = useQuery({
    queryKey: ["compare", auth.user?.id, selected],
    queryFn: () => fetchCompare({ data: { planIds: selected, environment: getStripeEnvironment() } }),
    enabled: auth.ready && !!auth.user && !proLocked && selected.length >= 2,
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const metrics = useMemo(() => {
    if (!compareQ.data) return [];
    return compareQ.data.plans.map((p) => ({
      id: p.id,
      title: p.title || "Untitled plan",
      version: p.version ?? 1,
      m: computePlanMetrics(
        (p.answers ?? {}) as Record<string, unknown>,
        (p.assumptions ?? {}) as Record<string, number>,
      ),
    }));
  }, [compareQ.data]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        padding: "28px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 14,
            borderBottom: `1px solid ${C.ink}`,
            marginBottom: 32,
          }}
        >
          <Link
            to="/dashboard"
            style={{
              color: C.inkMute,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            ← Dashboard
          </Link>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.ember,
            }}
          >
            Scenario Compare
          </div>
        </div>

        <h1
          style={{
            fontWeight: 400,
            fontSize: 40,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
          }}
        >
          Compare your scenarios
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, marginBottom: 28 }}>
          Pick 2 or 3 plans to see how the numbers differ side by side.
        </p>

        {proLocked ? (
          <div
            style={{
              border: `1.5px solid ${C.ink}`,
              borderRadius: 12,
              padding: 28,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: C.ember,
                marginBottom: 8,
              }}
            >
              Pro feature
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 12px" }}>
              Run your "what ifs" side by side
            </h2>
            <p style={{ color: C.inkSoft, marginBottom: 18 }}>
              Compare different ZIPs, home styles, timelines or down payments at a glance.
            </p>
            <button
              type="button"
              onClick={() => gate.openUpgrade("pro", "Scenario compare")}
              style={{
                background: C.ink,
                color: C.paper,
                padding: "14px 22px",
                border: "none",
                borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Upgrade to Pro →
            </button>
          </div>
        ) : plansQ.isLoading ? (
          <p style={{ color: C.inkMute }}>Loading your plans…</p>
        ) : (plansQ.data?.plans?.length ?? 0) < 2 ? (
          <div style={{ border: `1px solid ${C.inkFaint}`, padding: 22, borderRadius: 10 }}>
            <p style={{ margin: 0, color: C.inkSoft }}>
              You need at least two saved plans to compare.{" "}
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.ember,
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                Create another plan →
              </button>
            </p>
          </div>
        ) : (
          <>
            <PlanPicker
              plans={(plansQ.data?.plans ?? []) as Array<{
                id: string;
                title: string | null;
                version: number | null;
                created_at: string;
              }>}
              selected={selected}
              onToggle={toggle}
            />

            {selected.length < 2 ? (
              <p style={{ color: C.inkMute, marginTop: 24, fontSize: 15 }}>
                Select {2 - selected.length} more plan{2 - selected.length === 1 ? "" : "s"} to compare.
              </p>
            ) : compareQ.isLoading ? (
              <p style={{ color: C.inkMute, marginTop: 24 }}>Crunching numbers…</p>
            ) : compareQ.isError ? (
              <p style={{ color: C.ember, marginTop: 24 }}>
                Couldn't load comparison. Refresh and try again.
              </p>
            ) : (
              <ComparisonGrid items={metrics} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlanPicker({
  plans,
  selected,
  onToggle,
}: {
  plans: Array<{ id: string; title: string | null; version: number | null; created_at: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}
    >
      {plans.map((p) => {
        const isSel = selected.includes(p.id);
        const idx = selected.indexOf(p.id);
        const disabled = !isSel && selected.length >= 3;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            disabled={disabled}
            style={{
              border: `1.5px solid ${isSel ? C.ink : C.inkFaint}`,
              background: isSel ? C.ink : "transparent",
              color: isSel ? C.paper : C.ink,
              borderRadius: 10,
              padding: "14px 14px",
              textAlign: "left",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.45 : 1,
              fontFamily: "inherit",
              position: "relative",
            }}
          >
            {isSel && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  background: C.ember,
                  color: C.paper,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                #{idx + 1}
              </div>
            )}
            <div style={{ fontSize: 18, marginBottom: 4 }}>
              {p.title || "Untitled plan"}
              {p.version && p.version > 1 ? (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    marginLeft: 6,
                    opacity: 0.7,
                  }}
                >
                  v{p.version}
                </span>
              ) : null}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
                opacity: 0.7,
                textTransform: "uppercase",
              }}
            >
              {new Date(p.created_at).toLocaleDateString()}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ComparisonGrid({
  items,
}: {
  items: Array<{ id: string; title: string; version: number; m: PlanMetrics }>;
}) {
  if (items.length === 0) return null;

  const verdictColor = (v: PlanMetrics["verdict"]) =>
    v === "Affordable" ? C.sage : v === "A stretch" ? C.gold : v === "Difficult" ? C.ember : C.inkMute;

  const rows: Array<{ label: string; render: (m: PlanMetrics) => React.ReactNode; mono?: boolean }> = [
    { label: "Location", render: (m) => m.city || m.zip || "—" },
    { label: "Home style", render: (m) => m.homeStyleLabel },
    { label: "Target price", render: (m) => money(m.targetPrice), mono: true },
    { label: "Down payment", render: (m) => `${money(m.downPayment)} · ${m.downPct}%`, mono: true },
    { label: "Mortgage rate", render: (m) => pct(m.mortgageRate), mono: true },
    { label: "Mortgage P&I", render: (m) => `${money(m.monthlyMortgage)}/mo`, mono: true },
    { label: "Tax + insurance", render: (m) => `${money(m.taxIns)}/mo`, mono: true },
    { label: "PMI", render: (m) => (m.pmi > 0 ? `${money(m.pmi)}/mo` : "—"), mono: true },
    { label: "HOA + reserve", render: (m) => `${money(m.hoa + m.reserve)}/mo`, mono: true },
    { label: "Total housing", render: (m) => `${money(m.totalHousing)}/mo`, mono: true },
    {
      label: "Affordability",
      render: (m) => (
        <span style={{ color: verdictColor(m.verdict), fontWeight: 600 }}>
          {m.verdict} {m.housingRatio > 0 ? `· ${(m.housingRatio * 100).toFixed(0)}%` : ""}
        </span>
      ),
    },
    { label: "Timeline", render: (m) => `${m.timelineYears} yr` },
    {
      label: "Monthly to save",
      render: (m) => `${money(m.monthlyToSave)}`,
      mono: true,
    },
    {
      label: "Invested @ 7%",
      render: (m) => `${money(m.monthlyInvested)}`,
      mono: true,
    },
    {
      label: "Readiness",
      render: (m) => `${m.readiness} · ${m.readinessLabel}`,
    },
  ];

  return (
    <div
      style={{
        marginTop: 32,
        border: `1px solid ${C.ink}`,
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `180px repeat(${items.length}, minmax(0, 1fr))`,
          background: C.ink,
          color: C.paper,
        }}
      >
        <div style={{ padding: "14px 16px" }} />
        {items.map((it, i) => (
          <div key={it.id} style={{ padding: "14px 16px", borderLeft: `1px solid ${C.inkSoft}` }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: C.inkFaint,
                marginBottom: 4,
              }}
            >
              Plan #{i + 1}
            </div>
            <div style={{ fontSize: 18 }}>
              {it.title}
              {it.version > 1 ? (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    marginLeft: 6,
                    opacity: 0.7,
                  }}
                >
                  v{it.version}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div
          key={r.label}
          style={{
            display: "grid",
            gridTemplateColumns: `180px repeat(${items.length}, minmax(0, 1fr))`,
            borderTop: ri === 0 ? "none" : `1px solid ${C.inkFaint}`,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.inkMute,
              background: C.paper,
            }}
          >
            {r.label}
          </div>
          {items.map((it, i) => (
            <div
              key={it.id}
              style={{
                padding: "12px 16px",
                borderLeft: `1px solid ${C.inkFaint}`,
                fontFamily: r.mono ? "'JetBrains Mono', monospace" : "inherit",
                fontSize: r.mono ? 13 : 16,
                color: C.ink,
              }}
            >
              {r.render(it.m)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
