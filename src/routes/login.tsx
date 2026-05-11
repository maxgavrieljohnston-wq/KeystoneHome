import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Keystone" },
      { name: "description", content: "Sign in to view your homebuying plan." },
    ],
  }),
  component: LoginPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
};

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) {
        navigate({ to: "/dashboard" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) return;
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (err) {
      console.error("[magic-link]", err);
      setError("Couldn't send the email. Please try again.");
      return;
    }
    setMagicSent(true);
  };

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
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
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
          ← Back to home
        </Link>

        <div style={{ height: 64 }} />

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
          — Welcome back
        </div>

        <h1
          style={{
            fontWeight: 400,
            fontSize: 44,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            margin: "0 0 14px",
          }}
        >
          Sign in to your plan.
        </h1>

        <p
          style={{
            fontSize: 18,
            lineHeight: 1.45,
            color: C.inkSoft,
            margin: "0 0 32px",
          }}
        >
          Enter your email and we'll send you a sign-in link.
        </p>

        {magicSent ? (
          <div
            style={{
              padding: 20,
              border: `1.5px solid ${C.ink}`,
              borderRadius: 10,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>Check your inbox.</div>
            <div style={{ color: C.inkSoft, fontSize: 16 }}>
              We sent a sign-in link to <strong>{email}</strong>. Open it on this
              device to continue.
            </div>
            <button
              type="button"
              onClick={() => setMagicSent(false)}
              style={{
                marginTop: 16,
                background: "transparent",
                border: "none",
                padding: 0,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.ember,
                cursor: "pointer",
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink}>
            <input
              type="email"
              inputMode="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: `1.5px solid ${C.ink}`,
                padding: "12px 0",
                fontSize: 22,
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                color: C.ink,
                outline: "none",
                marginBottom: 20,
              }}
            />
            <button
              type="submit"
              disabled={!email.includes("@") || busy}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: C.ink,
                color: C.paper,
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: busy || !email.includes("@") ? "default" : "pointer",
                opacity: !email.includes("@") || busy ? 0.5 : 1,
              }}
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>

            {error && (
              <div
                style={{
                  marginTop: 16,
                  color: C.ember,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}
          </form>
        )}

        <div
          style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: `1px solid ${C.ink}`,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.inkFaint,
            textAlign: "center",
          }}
        >
          New here?{" "}
          <Link to="/" style={{ color: C.ember, textDecoration: "none" }}>
            Build your plan →
          </Link>
        </div>
      </div>
    </div>
  );
}
