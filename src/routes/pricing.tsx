import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { PLUS_FEATURES, PRO_FEATURES, type TierFeature } from "@/lib/tier-features";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Keystone" },
      { name: "description", content: "Plus and Pro monthly plans for serious homebuyers." },
    ],
  }),
  component: PricingPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

type PlanId = "plus" | "pro";

type Plan = {
  id: PlanId;
  name: string;
  priceId: string;
  monthly: number;
  tagline: string;
  features: TierFeature[];
  highlightIds: string[];
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "plus",
    name: "Plus",
    priceId: "plus_monthly",
    monthly: 5,
    tagline: "The full planner, unlocked.",
    features: PLUS_FEATURES,
    highlightIds: ["accounts", "invest", "action", "tags"],
  },
  {
    id: "pro",
    name: "Pro",
    priceId: "pro_monthly",
    monthly: 11,
    tagline: "Plan, invest, and close with confidence.",
    features: [
      { id: "_plus", short: "Everything in Plus", long: "Everything in Plus" },
      ...PRO_FEATURES,
    ],
    highlightIds: ["_plus", "investing", "stress", "market", "broker"],
    highlight: true,
  },
];

function splitFeatures(plan: Plan) {
  const order = new Map(plan.highlightIds.map((id, i) => [id, i]));
  const highlighted = plan.features
    .filter((f) => order.has(f.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const rest = plan.features.filter((f) => !order.has(f.id));
  return { highlighted, rest };
}

function PricingPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<PlanId, boolean>>({ plus: false, pro: false });
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const { openCheckout, loading } = usePaddleCheckout();
  const sub = useSubscription();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? undefined);
      setUserId(data.user?.id ?? undefined);
    });
  }, []);

  const handleSelect = async (plan: Plan) => {
    if (!userId) {
      navigate({
        to: "/login",
        search: { signup: true, plan: plan.id, billing: "monthly" },
      });
      return;
    }
    await openCheckout({ priceId: plan.priceId, customerEmail: email, userId });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        padding: "48px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <Link
          to="/"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.inkMute,
            textDecoration: "none",
          }}
        >
          ← Keystone
        </Link>

        <header style={{ marginTop: 24, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.ember,
              margin: "0 0 14px",
            }}
          >
            Pricing
          </p>
          <h1
            style={{
              fontSize: "clamp(38px, 7vw, 64px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
              margin: 0,
            }}
          >
            Simple pricing. Serious progress.
          </h1>
          <p
            style={{
              maxWidth: 540,
              margin: "18px auto 0",
              fontSize: 18,
              color: C.inkSoft,
              lineHeight: 1.5,
            }}
          >
            7-day free trial.
          </p>
        </header>

        {/* Plan grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            marginTop: 36,
          }}
        >
          {PLANS.map((plan) => {
            const isCurrent = sub.isActive && sub.tier === plan.id;

            return (
              <div
                key={plan.id}
                style={{
                  background: plan.highlight ? C.ink : "transparent",
                  color: plan.highlight ? C.paper : C.ink,
                  border: `1px solid ${C.ink}`,
                  borderRadius: 14,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 style={{ fontSize: 28, margin: 0, fontWeight: 400 }}>{plan.name}</h2>
                  {plan.highlight && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: C.ember,
                        background: C.paper,
                        padding: "4px 8px",
                        borderRadius: 999,
                      }}
                    >
                      Most popular
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: 15,
                    margin: "8px 0 18px",
                    color: plan.highlight ? "#d6cfc1" : C.inkMute,
                  }}
                >
                  {plan.tagline}
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 48, fontWeight: 400, letterSpacing: "-0.02em" }}>
                    ${plan.monthly}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: plan.highlight ? "#d6cfc1" : C.inkMute,
                    }}
                  >
                    / month
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: plan.highlight ? "#d6cfc1" : C.inkMute,
                    margin: "4px 0 0",
                  }}
                >
                  Billed monthly · cancel anytime
                </p>

                {(() => {
                  const { highlighted, rest } = splitFeatures(plan);
                  const isExpanded = expanded[plan.id];
                  const visible = isExpanded ? [...highlighted, ...rest] : highlighted;
                  const renderRow = (f: TierFeature) => (
                    <li
                      key={f.id}
                      style={{
                        fontSize: 16,
                        lineHeight: 1.45,
                        padding: "8px 0",
                        borderTop: `1px solid ${plan.highlight ? "#3a3a3a" : "#e4dccf"}`,
                        display: "flex",
                        gap: 8,
                        alignItems: "baseline",
                      }}
                    >
                      <span style={{ flex: 1 }}>{f.long}</span>
                      {f.comingSoon && (
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            padding: "3px 6px",
                            borderRadius: 4,
                            background: plan.highlight ? C.paper : C.ink,
                            color: plan.highlight ? C.ink : C.paper,
                            whiteSpace: "nowrap",
                          }}
                        >
                          SOON
                        </span>
                      )}
                    </li>
                  );
                  return (
                    <div style={{ margin: "24px 0", flex: 1 }}>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {visible.map(renderRow)}
                      </ul>
                      {rest.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((s) => ({ ...s, [plan.id]: !s[plan.id] }))
                          }
                          style={{
                            marginTop: 12,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            color: plan.highlight ? "#d6cfc1" : C.inkMute,
                          }}
                        >
                          {isExpanded ? "Show fewer" : `+ ${rest.length} more features`}
                        </button>
                      )}
                    </div>
                  );
                })()}

                <button
                  onClick={() => handleSelect(plan)}
                  disabled={loading || isCurrent}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    padding: "14px 18px",
                    borderRadius: 8,
                    border: "none",
                    cursor: isCurrent ? "default" : "pointer",
                    background: plan.highlight ? C.paper : C.ink,
                    color: plan.highlight ? C.ink : C.paper,
                    opacity: loading || isCurrent ? 0.6 : 1,
                  }}
                >
                  {isCurrent
                    ? "Current plan"
                    : loading
                      ? "Opening…"
                      : `Choose ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 32,
            fontSize: 14,
            color: C.inkMute,
          }}
        >
          Both plans renew monthly — cancel anytime.{" "}
          <Link to="/refunds" style={{ color: C.ink }}>
            Refund policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
