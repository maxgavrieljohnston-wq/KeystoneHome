import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/useSubscription";
import { trackUpgradeEvent } from "@/lib/upgrade-tracking";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome — Keystone" },
      { name: "description", content: "Your premium plan is unlocked." },
    ],
  }),
  component: WelcomePage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  ember: "#c4452d",
};

function WelcomePage() {
  const sub = useSubscription();
  const navigate = useNavigate();

  // Poll briefly: webhook may take a few seconds after checkout.
  useEffect(() => {
    if (sub.isActive) return;
    const t = setInterval(() => {
      // useSubscription has its own realtime + query; nothing to manually do here
    }, 1500);
    return () => clearInterval(t);
  }, [sub.isActive]);

  const tierName = sub.tier === "pro" ? "Pro" : sub.tier === "plus" ? "Plus" : "premium";

  const features = sub.tier === "pro"
    ? [
        "Everything in Plus",
        "Chat with the AI homebuying coach",
        "Compare up to 3 plans side-by-side",
        "Live mortgage rate alerts",
      ]
    : [
        "Save unlimited scenarios (cities, timelines, down payments)",
        "Invest vs. save projection & savings/investing action plan (PDF)",
        "Full plan export (PDF + CSV)",
        "Tags, notes, goal tracker & themed reports",
        "Shareable plan link & email reminders",
      ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
      }}
    >
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.ember,
            margin: 0,
          }}
        >
          {sub.isActive ? `Welcome to Keystone ${tierName}` : "Finishing setup…"}
        </p>
        <h1
          style={{
            fontSize: "clamp(40px, 7vw, 64px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.02,
            margin: "16px 0 14px",
          }}
        >
          You're in.
        </h1>
        <p style={{ fontSize: 18, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 28px" }}>
          {sub.isActive
            ? "Your premium features are unlocked. Here's what's new:"
            : "Your payment is processing. This page will update in a moment."}
        </p>

        <ul
          style={{
            listStyle: "none",
            padding: 24,
            margin: "0 auto 28px",
            border: `1px solid ${C.ink}`,
            borderRadius: 14,
            textAlign: "left",
          }}
        >
          {features.map((f, i) => (
            <li
              key={f}
              style={{
                fontSize: 17,
                lineHeight: 1.5,
                padding: "12px 0",
                borderTop: i === 0 ? "none" : "1px solid #e4dccf",
              }}
            >
              · {f}
            </li>
          ))}
        </ul>

        <button
          onClick={() => navigate({ to: "/dashboard" })}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding: "14px 22px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: C.ink,
            color: C.paper,
          }}
        >
          Open my plan →
        </button>

        <p style={{ marginTop: 22, fontSize: 13, color: C.inkMute }}>
          Manage your plan anytime from{" "}
          <Link to="/dashboard" style={{ color: C.ink }}>
            your dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
