import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

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
  const [busy, setBusy] = useState<null | "google" | "apple" | "magic">(null);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, send to dashboard.
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

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    setBusy(provider);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      console.error(`[${provider} sign-in]`, result.error);
      setError("Sign-in failed. Please try again.");
      setBusy(null);
      return;
    }
    if (!result.redirected) {
      navigate({ to: "/dashboard" });
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) return;
    setError(null);
    setBusy("magic");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(null);
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
          Pick whichever way is easiest.
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
          <>
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={!!busy}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "14px 16px",
                background: "#fff",
                border: `1.5px solid ${C.ink}`,
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                color: C.ink,
                cursor: busy ? "default" : "pointer",
                opacity: busy && busy !== "google" ? 0.5 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={!!busy}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "14px 16px",
                marginTop: 10,
                background: "#000",
                border: `1.5px solid #000`,
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                color: "#fff",
                cursor: busy ? "default" : "pointer",
                opacity: busy && busy !== "apple" ? 0.5 : 1,
              }}
            >
              <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" fill="#fff">
                <path d="M13.07 9.56c-.02-2.18 1.78-3.23 1.86-3.28-1.02-1.49-2.6-1.69-3.16-1.71-1.34-.13-2.62.79-3.31.79-.69 0-1.74-.77-2.86-.75-1.47.02-2.83.85-3.59 2.16-1.53 2.65-.39 6.58 1.1 8.73.73 1.05 1.6 2.24 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.31-.89-2.34-3.53zM10.92 3.04c.6-.73 1.01-1.74.9-2.74-.87.04-1.93.58-2.55 1.31-.55.64-1.04 1.67-.91 2.66.97.07 1.96-.49 2.56-1.23z"/>
              </svg>
              Continue with Apple
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "26px 0 16px",
                color: C.ink,
                opacity: 0.5,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <div style={{ flex: 1, height: 1, background: C.ink, opacity: 0.2 }} />
              or email me a link
              <div style={{ flex: 1, height: 1, background: C.ink, opacity: 0.2 }} />
            </div>

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
                disabled={!email.includes("@") || !!busy}
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
                {busy === "magic" ? "Sending…" : "Email me a link"}
              </button>
            </form>

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
          </>
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
