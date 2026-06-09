import { Link } from "@tanstack/react-router";
import { FEATURE_KEYS, FEATURE_META, type FeatureKey } from "@/lib/dashboard-features";

const C = {
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
};

export function FeatureIconBar({
  selectedPlanId,
  activeKey,
}: {
  selectedPlanId?: string;
  activeKey?: FeatureKey;
}) {
  return (
    <div
      style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: `1px solid ${C.inkFaint}`,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: C.inkMute,
          textTransform: "uppercase",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        Features
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))",
          gap: 12,
        }}
      >
        {FEATURE_KEYS.map((key) => {
          const meta = FEATURE_META[key];
          const Icon = meta.icon;
          const isActive = activeKey === key;
          const linkProps =
            key === "dashboard"
              ? ({
                  to: "/dashboard",
                  search: selectedPlanId ? { planId: selectedPlanId } : {},
                } as const)
              : ({
                  to: "/features/$key",
                  params: { key },
                  search: selectedPlanId ? { planId: selectedPlanId } : {},
                } as const);
          return (
            <Link
              key={key}
              {...(linkProps as any)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "14px 8px",
                borderRadius: 10,
                background: isActive ? C.ink : "#fff",
                border: `1px solid ${isActive ? C.ink : C.inkFaint}`,
                color: isActive ? "#f5efe6" : C.ink,
                textDecoration: "none",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            >
              <Icon size={22} strokeWidth={1.5} />
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: isActive ? "#f5efe6" : C.inkSoft,
                  textAlign: "center",
                }}
              >
                {meta.short}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
