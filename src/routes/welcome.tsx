import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/useSubscription";
import { trackUpgradeEvent } from "@/lib/upgrade-tracking";
import { supabase } from "@/integrations/supabase/client";

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
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pw, setPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  // Detect users who need to set a password (came in via magic link / OAuth
  // without an email+password identity).
  useEffect(() => {
    let cancelled = false;
    if (typeof window !== "undefined" && localStorage.getItem("keystone_pw_set") === "1") {
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const identities = data.user.identities ?? [];
      const hasEmailIdentity = identities.some((i: { provider?: string }) => i.provider === "email");
      if (!hasEmailIdentity) setNeedsPassword(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      setPwError("Use at least 8 characters.");
      return;
    }
    setPwBusy(true);
    setPwError(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) {
      setPwError(error.message);
    } else {
      setPwSaved(true);
      setNeedsPassword(false);
      if (typeof window !== "undefined") localStorage.setItem("keystone_pw_set", "1");
    }
  };

  // Poll briefly: webhook may take a few seconds after checkout.
  useEffect(() => {
    if (sub.isActive) return;
    const t = setInterval(() => {
      // useSubscription has its own realtime + query; nothing to manually do here
    }, 1500);
    return () => clearInterval(t);
  }, [sub.isActive]);

  // Backup client-side attribution event in case the webhook log fails or
  // is delayed. The server-side log (in the Paddle webhook) is authoritative;
  // this fires only when ?checkout=success&src=... is present on the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    const source = params.get("src");
    if (!source) return;
    const tier: "plus" | "pro" =
      sub.tier === "pro" ? "pro" : "plus";
    trackUpgradeEvent({
      event_type: "checkout_success",
      source,
      tier,
      metadata: { via: "welcome_page" },
    });
    // Clean the param so a reload doesn't double-log.
    params.delete("src");
    const next = params.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ""}`;
    window.history.replaceState({}, "", url);
  }, [sub.tier]);

  const tierName = sub.tier === "pro" ? "Pro" : sub.tier === "plus" ? "Plus" : "premium";

  const features = sub.tier === "pro"
    ? [
        "Everything in Plus",
        "Chat with the AI homebuying coach",
        "Compare up to 3 plans side-by-side",
      ]
    : [
        "Save unlimited scenarios (cities, timelines, down payments)",
        "Invest vs. save projection",
        "Monthly action plan — themed PDF, downloadable & shareable",
        "Email reminders & milestones",
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

        {needsPassword && !pwSaved && (
          <form
            onSubmit={handleSavePassword}
            style={{
              border: `1.5px solid ${C.ember}`,
              background: `${C.ember}11`,
              borderRadius: 12,
              padding: 18,
              margin: "0 0 24px",
              textAlign: "left",
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
              One last step
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 6px" }}>
              Set a password to sign in next time.
            </h3>
            <p style={{ fontSize: 14, color: C.inkSoft, margin: "0 0 14px", lineHeight: 1.5 }}>
              You signed in without a password. Add one so you can come straight back.
            </p>
            <input
              type="password"
              placeholder="New password (8+ chars)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: `1.5px solid ${C.ink}`,
                padding: "10px 0",
                fontSize: 18,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                color: C.ink,
                outline: "none",
                marginBottom: 14,
              }}
            />
            <button
              type="submit"
              disabled={pwBusy || pw.length < 8}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: C.ink,
                color: C.paper,
                border: "none",
                borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                cursor: pwBusy || pw.length < 8 ? "default" : "pointer",
                opacity: pwBusy || pw.length < 8 ? 0.5 : 1,
              }}
            >
              {pwBusy ? "Saving…" : "Save password"}
            </button>
            {pwError && (
              <div style={{ marginTop: 10, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                {pwError}
              </div>
            )}
          </form>
        )}

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
