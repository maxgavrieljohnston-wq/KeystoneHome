import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { PLUS_FEATURES, PRO_FEATURES, type TierFeature } from "@/lib/tier-features";
import { trackUpgradeEvent } from "@/lib/upgrade-tracking";

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

export type RequiredTier = "plus" | "pro";

// Strip a trailing "(coming soon)" / "(coming-soon)" — SOON badge handles it.
function cleanLabel(label: string): string {
  return label.replace(/\s*\(coming[\s-]?soon\)\s*$/i, "");
}

// Display-only ordering for Pro: shipped features first, "SOON" last.
// Source of truth (tier-features.ts) is untouched.
const PRO_DISPLAY_ORDER = [
  "coach",
  "stress",
  "compare",
  "market",
  "alerts",
  "docs",
  "broker",
  "investing",
];

function orderProFeatures(features: readonly TierFeature[]): TierFeature[] {
  const byId = new Map(features.map((f) => [f.id, f]));
  const ordered: TierFeature[] = [];
  for (const id of PRO_DISPLAY_ORDER) {
    const f = byId.get(id);
    if (f) {
      ordered.push(f);
      byId.delete(id);
    }
  }
  for (const f of byId.values()) ordered.push(f);
  return ordered;
}

// Featured highlights shown above the fold; the rest is collapsed behind
// "Show all features". Order matters — these render top-to-bottom.
const PLUS_HIGHLIGHT_IDS = ["action", "assumptions", "accounts", "tags"];
const PRO_HIGHLIGHT_IDS = ["_plus", "stress", "market", "broker", "investing"];

function splitFeatures(
  features: readonly TierFeature[],
  highlightIds: readonly string[],
): { highlights: TierFeature[]; rest: TierFeature[] } {
  const byId = new Map(features.map((f) => [f.id, f]));
  const highlights: TierFeature[] = [];
  for (const id of highlightIds) {
    const f = byId.get(id);
    if (f) {
      highlights.push(f);
      byId.delete(id);
    }
  }
  return { highlights, rest: Array.from(byId.values()) };
}

export function UpgradeModal({
  open,
  onClose,
  requiredTier,
  featureName: _featureName,
  openedFrom,
}: {
  open: boolean;
  onClose: () => void;
  requiredTier: RequiredTier;
  featureName: string;
  openedFrom?: string;
}) {
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { openCheckout, loading, checkoutElement } = useStripeCheckout();

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? undefined);
      setUserId(data.user?.id ?? undefined);
    });
  }, [open]);

  const tiers = useMemo(
    () => [
      {
        id: "plus" as const,
        name: "Plus",
        priceId: "plus_monthly",
        monthly: 5,
        
        priceFrame: "Less than $0.25 a day",
        urgency: "Every month you wait is compounding you don't get back.",
        cta: "Start Plus",
        features: PLUS_FEATURES,
        highlight: false,
      },
      {
        id: "pro" as const,
        name: "Pro",
        priceId: "pro_monthly",
        monthly: 11,
        
        priceFrame: "One month sooner = years of mortgage saved",
        urgency: "The market won't wait. Neither should your plan.",
        cta: "Start Pro",
        features: [
          { id: "_plus", short: "Everything in Plus", long: "Everything in Plus" } as TierFeature,
          ...orderProFeatures(PRO_FEATURES),
        ],
        highlight: true,
      },
    ],
    [],
  );

  if (!open) return null;

  // If feature requires Pro, hide Plus option.
  const visible = requiredTier === "pro" ? tiers.filter((t) => t.id === "pro") : tiers;
  const showRecommended = visible.length > 1;

  const handlePick = async (tier: typeof tiers[number]) => {
    // Last-click attribution: which surface opened the modal.
    // Fall back to modal_{tier} if opened programmatically with no source.
    const source = openedFrom || `modal_${tier.id}`;
    trackUpgradeEvent({ event_type: "checkout_open", source, tier: tier.id, email });
    await openCheckout({
      priceId: tier.priceId,
      customerEmail: email,
      userId,
      source,
    });
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
      <style>{`
        .km-upgrade-modal { padding: 20px; }
        .km-upgrade-headline { font-size: 26px; }
        .km-upgrade-tiers {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .km-upgrade-card { padding: 16px; }
        @media (min-width: 560px) {
          .km-upgrade-modal { padding: 28px; }
          .km-upgrade-headline { font-size: 30px; }
          .km-upgrade-tiers.km-two { grid-template-columns: 1fr 1fr; gap: 12px; }
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
          maxWidth: 580,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          boxShadow: "0 30px 80px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-start" }}>
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
              flexShrink: 0,
              marginRight: -4,
              marginTop: -4,
            }}
          >
            ×
          </button>
        </div>

        <div className={`km-upgrade-tiers ${visible.length > 1 ? "km-two" : ""}`}>
          {visible.map((tier, idx) => {
            const socialStrip = visible.length > 1 && idx === 1 ? (
              <div
                key="social-strip"
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 12px",
                  border: `1px solid ${C.ember}33`,
                  background: `${C.ember}11`,
                  borderRadius: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: C.inkSoft,
                }}
              >
                <span>★ 2,400+ plans built</span>
                <span style={{ color: C.inkFaint }}>·</span>
                <span style={{ color: C.ember, fontWeight: 600 }}>7-day free trial</span>
                <span style={{ color: C.inkFaint }}>·</span>
                <span>Cancel anytime</span>
              </div>
            ) : null;
            const isPro = tier.id === "pro";
            const recommended = showRecommended && isPro;
            const card = (
              <div
                key={tier.id}
                className="km-upgrade-card"
                style={{
                  position: "relative",
                  border: `${recommended ? 2 : 1.5}px solid ${C.ink}`,
                  borderRadius: 10,
                  background: tier.highlight ? C.ink : "transparent",
                  color: tier.highlight ? C.paper : C.ink,
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: recommended ? `0 0 0 3px ${C.ember}33` : "none",
                }}
              >
                {recommended && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      right: 14,
                      background: C.ember,
                      color: C.paper,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      padding: "4px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Most popular
                  </div>
                )}
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
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    opacity: 0.75,
                    marginTop: 6,
                  }}
                >
                  {tier.priceFrame}
                </div>

                {(() => {
                  const highlightIds = isPro ? PRO_HIGHLIGHT_IDS : PLUS_HIGHLIGHT_IDS;
                  const { highlights, rest } = splitFeatures(tier.features, highlightIds);
                  const isOpen = expanded[tier.id] ?? false;
                  const visibleFeatures = isOpen ? [...highlights, ...rest] : highlights;
                  const renderItem = (f: TierFeature) => {
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
                  };
                  return (
                    <div style={{ margin: "14px 0", flex: 1 }}>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 15 }}>
                        {visibleFeatures.map(renderItem)}
                      </ul>
                      {rest.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((s) => ({ ...s, [tier.id]: !isOpen }))
                          }
                          style={{
                            marginTop: 8,
                            background: "transparent",
                            border: "none",
                            padding: "6px 0",
                            cursor: "pointer",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: tier.highlight ? C.paper : C.ink,
                            opacity: 0.75,
                            textDecoration: "underline",
                            textUnderlineOffset: 3,
                          }}
                        >
                          {isOpen ? "Show less ↑" : `Show ${rest.length} more ↓`}
                        </button>
                      )}
                    </div>
                  );
                })()}

                <p
                  style={{
                    fontStyle: "italic",
                    fontSize: 13,
                    lineHeight: 1.4,
                    textAlign: "center",
                    margin: "0 0 10px",
                    opacity: 0.78,
                  }}
                >
                  {tier.urgency}
                </p>

                <button
                  type="button"
                  onClick={() => handlePick(tier)}
                  disabled={loading}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    padding: "13px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor: loading ? "default" : "pointer",
                    background: tier.highlight ? C.paper : C.ink,
                    color: tier.highlight ? C.ink : C.paper,
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Opening checkout…" : `${tier.cta} →`}
                </button>
              </div>
            );
            return (
              <Fragment key={tier.id}>
                {socialStrip}
                {card}
              </Fragment>
            );
          })}
        </div>

        <p
          style={{
            textAlign: "center",
            margin: "18px 0 0",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: C.inkFaint,
          }}
        >
          Cancel anytime · Secure checkout · Instant access
        </p>
      </div>
      {checkoutElement}
    </div>
  );
}
