import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PLUS_FEATURES, PRO_FEATURES } from "@/lib/tier-features";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

export type RequiredTier = "plus" | "pro";

// Strip a trailing "(coming soon)" / "(coming-soon)" from a label — the SOON
// badge already communicates this, and the duplicate text wraps awkwardly.
function cleanLabel(label: string): string {
  return label.replace(/\s*\(coming[\s-]?soon\)\s*$/i, "");
}

export function UpgradeModal({
  open,
  onClose,
  requiredTier,
  featureName,
}: {
  open: boolean;
  onClose: () => void;
  requiredTier: RequiredTier;
  featureName: string;
}) {
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const { openCheckout, loading } = usePaddleCheckout();

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? undefined);
      setUserId(data.user?.id ?? undefined);
    });
  }, [open]);

  if (!open) return null;

  const tiers = [
    {
      id: "plus" as const,
      name: "Plus",
      priceId: "plus_monthly",
      monthly: 5,
      features: PLUS_FEATURES,
      highlight: false,
    },
    {
      id: "pro" as const,
      name: "Pro",
      priceId: "pro_monthly",
      monthly: 11,
      features: [
        { id: "_plus", short: "Everything in Plus", long: "Everything in Plus" } as const,
        ...PRO_FEATURES,
      ],
      highlight: true,
    },
  ];

  // If feature requires Pro, hide Plus option
  const visible = requiredTier === "pro" ? tiers.filter((t) => t.id === "pro") : tiers;

  const handlePick = async (tier: typeof tiers[number]) => {
    await openCheckout({ priceId: tier.priceId, customerEmail: email, userId });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,26,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Scoped responsive styles — inline-style file, so we inject CSS for breakpoints */}
      <style>{`
        .km-upgrade-modal { padding: 20px; }
        .km-upgrade-headline { font-size: 24px; }
        .km-upgrade-tiers {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .km-upgrade-card { padding: 16px; }
        @media (min-width: 560px) {
          .km-upgrade-modal { padding: 28px; }
          .km-upgrade-headline { font-size: 28px; }
          .km-upgrade-tiers.km-two { grid-template-columns: 1fr 1fr; gap: 10px; }
          .km-upgrade-card { padding: 18px; }
        }
      `}</style>
      <div
        className="km-upgrade-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          color: C.ink,
          borderRadius: 14,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          boxShadow: "0 30px 80px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
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
              Premium feature
            </div>
            <h2
              className="km-upgrade-headline"
              style={{ margin: 0, fontWeight: 400, letterSpacing: "-0.01em" }}
            >
              Unlock {featureName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 28,
              cursor: "pointer",
              color: C.inkMute,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ color: C.inkSoft, fontSize: 16, margin: "12px 0 16px", lineHeight: 1.55 }}>
          {requiredTier === "pro"
            ? "This feature is part of Pro — your personal homebuying coach."
            : "Upgrade to Plus or Pro to unlock this and more."}
        </p>

        <div className={`km-upgrade-tiers ${visible.length > 1 ? "km-two" : ""}`}>
          {visible.map((tier) => {
            return (
              <div
                key={tier.id}
                className="km-upgrade-card"
                style={{
                  border: `1.5px solid ${C.ink}`,
                  borderRadius: 10,
                  background: tier.highlight ? C.ink : "transparent",
                  color: tier.highlight ? C.paper : C.ink,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 400 }}>{tier.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 32, fontWeight: 400 }}>${tier.monthly}</span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      opacity: 0.7,
                    }}
                  >
                    /mo
                  </span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0", flex: 1, fontSize: 15 }}>
                  {tier.features.map((f) => {
                    const isSoon = "comingSoon" in f && f.comingSoon;
                    const label = isSoon ? cleanLabel(f.short) : f.short;
                    return (
                      <li
                        key={f.id}
                        style={{
                          padding: "6px 0",
                          opacity: 0.92,
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          lineHeight: 1.45,
                        }}
                      >
                        <span aria-hidden="true" style={{ flexShrink: 0 }}>✓</span>
                        <span style={{ flex: 1 }}>{label}</span>
                        {isSoon && (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 8,
                              letterSpacing: "0.14em",
                              padding: "2px 5px",
                              borderRadius: 4,
                              background: tier.highlight ? C.paper : C.ink,
                              color: tier.highlight ? C.ink : C.paper,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              alignSelf: "center",
                            }}
                          >
                            SOON
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => handlePick(tier)}
                  disabled={loading}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: loading ? "default" : "pointer",
                    background: tier.highlight ? C.paper : C.ink,
                    color: tier.highlight ? C.ink : C.paper,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Opening…" : `Choose ${tier.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p
          style={{
            textAlign: "center",
            margin: "16px 0 0",
            fontSize: 12,
            color: C.inkMute,
          }}
        >
          Cancel anytime.
        </p>
      </div>
    </div>
  );
}
