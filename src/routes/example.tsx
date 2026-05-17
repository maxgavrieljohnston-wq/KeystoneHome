import { createFileRoute, Link } from "@tanstack/react-router";
import { PlanView, type PlanViewPlan } from "./p.$slug";

const MAYA_PLAN: PlanViewPlan = {
  title: "Maya's condo plan — Austin",
  theme: "light",
  current_savings: 9500,
  target_move_in: new Date(Date.now() + 36 * 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10),
  created_at: null,
  assumptions: {},
  answers: {
    zip: "78704",
    zipData: { city: "Austin, TX", avg: 420000 },
    homeStyle: "condo",
    beds: 1,
    baths: 1,
    downGoalPct: 10,
    credit: 712,
    hasPartner: false,
    employment: "w2",
    timelineYears: 3,
    saved: 9500,
  },
};

export const Route = createFileRoute("/example")({
  head: () => ({
    meta: [
      { title: "See an example plan — Keystone" },
      {
        name: "description",
        content:
          "A sample Keystone homebuying plan: target price, monthly cost, and the path to your down payment. Build your own in 2 minutes.",
      },
      { property: "og:title", content: "See an example plan — Keystone" },
      {
        property: "og:description",
        content:
          "What a Keystone plan looks like — for Maya, a 29-year-old buyer in Austin.",
      },
      {
        property: "og:url",
        content: "https://keystonehomeowner.lovable.app/example",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://keystonehomeowner.lovable.app/example",
      },
    ],
  }),
  component: ExamplePage,
});

function ExamplePage() {
  return (
    <>
      <PlanView
        plan={MAYA_PLAN}
        kicker="— Example plan · not a real user"
        footer={
          <div
            style={{
              marginTop: 40,
              padding: "20px 22px",
              border: "1.5px solid #1a1a1a",
              borderRadius: 12,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#c4452d",
              }}
            >
              Your turn
            </div>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 22,
                lineHeight: 1.2,
                color: "#1a1a1a",
              }}
            >
              This is a sample plan. Yours takes about 2 minutes.
            </div>
            <Link
              to="/"
              style={{
                marginTop: 4,
                background: "#1a1a1a",
                color: "#f5efe6",
                padding: "14px 22px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Build my plan →
            </Link>
          </div>
        }
      />
      {/* Sticky bottom bar on mobile */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "12px 16px",
          background: "rgba(245,239,230,0.96)",
          borderTop: "1px solid #1a1a1a22",
          display: "flex",
          justifyContent: "center",
          zIndex: 50,
          backdropFilter: "blur(8px)",
        }}
      >
        <Link
          to="/"
          style={{
            background: "#1a1a1a",
            color: "#f5efe6",
            padding: "12px 20px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Build my plan →
        </Link>
      </div>
    </>
  );
}
