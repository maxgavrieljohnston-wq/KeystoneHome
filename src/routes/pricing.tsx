import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { PLUS_FEATURES, PRO_FEATURES } from "@/lib/tier-features";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Keystone" },
      { name: "description", content: "Plus and Pro plans for serious homebuyers." },
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

const PLANS: Array<{
  id: PlanId;
  name: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  monthly: number;
  yearly: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}> = [
  {
    id: "plus",
    name: "Plus",
    monthlyPriceId: "plus_monthly",
    yearlyPriceId: "plus_yearly",
    monthly: 9,
    yearly: 86,
    tagline: "For the serious saver.",
    features: [
      "Save unlimited scenarios (different cities, timelines, down payments)",
      "Invest vs. save projection",
      "Savings & investing action plan (PDF) — what to do each month",
      "Full plan export (PDF + CSV) — everything in your plan, portable",
      "Tags, notes & goal tracker",
      "Themed reports (light, dark, sepia)",
      "Shareable plan link",
      "Email reminders & milestones",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceId: "pro_monthly",
    yearlyPriceId: "pro_yearly",
    monthly: 19,
    yearly: 182,
    tagline: "Your personal homebuying coach.",
    features: [
      "Everything in Plus",
      "AI homebuying coach",
      "Side-by-side scenario comparison (up to 3 plans)",
      "Live mortgage rate alerts",
    ],
    highlight: true,
  },
];

function PricingPage() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
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

  const handleSelect = async (plan: typeof PLANS[number]) => {
    if (!userId) {
      navigate({
        to: "/login",
        search: { signup: true, plan: plan.id, billing },
      });
      return;
    }
    const priceId = billing === "monthly" ? plan.monthlyPriceId : plan.yearlyPriceId;
    await openCheckout({ priceId, customerEmail: email, userId });
  };

  const yearlyHint = useMemo(
    () => `Save 20% — about 2 months free`,
    [],
  );

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
            One plan stays free. Two go further.
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
            Use Keystone forever at no cost. Upgrade when you want to save more, plan with a partner,
            or get personalized coaching.
          </p>
        </header>

        {/* Billing toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
          <div
            style={{
              display: "inline-flex",
              padding: 4,
              border: `1px solid ${C.ink}`,
              borderRadius: 999,
              background: "transparent",
            }}
          >
            {(["monthly", "yearly"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: billing === b ? C.ink : "transparent",
                  color: billing === b ? C.paper : C.ink,
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        {billing === "yearly" && (
          <p
            style={{
              textAlign: "center",
              marginTop: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.ember,
            }}
          >
            {yearlyHint}
          </p>
        )}

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
            const price = billing === "monthly" ? plan.monthly : Math.round(plan.yearly / 12);
            const isCurrent =
              sub.isActive && (sub.tier === plan.id);

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
                    ${price}
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
                {billing === "yearly" && (
                  <p
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      color: plan.highlight ? "#d6cfc1" : C.inkMute,
                      margin: "4px 0 0",
                    }}
                  >
                    ${plan.yearly} billed yearly
                  </p>
                )}

                <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", flex: 1 }}>
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        fontSize: 16,
                        lineHeight: 1.45,
                        padding: "8px 0",
                        borderTop: `1px solid ${plan.highlight ? "#3a3a3a" : "#e4dccf"}`,
                      }}
                    >
                      {f}
                    </li>
                  ))}
                </ul>

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
                  {isCurrent ? "Current plan" : loading ? "Opening…" : `Choose ${plan.name}`}
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
          Cancel anytime. Plans renew automatically.{" "}
          <Link to="/refunds" style={{ color: C.ink }}>
            Refund policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
