import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type LoginSearch = { email?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
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

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) return "Too many requests — please wait a moment and try again.";
  if (m.includes("invalid") && m.includes("email")) return "That doesn't look like a valid email address.";
  return msg;
}

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [email, setEmail] = useState(search.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/dashboard" });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const validEmail = email.trim().includes("@");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(null);
    const trimmed = email.trim().toLowerCase();
    if (!validEmail) return;

    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setBusy(false);
    if (err) { setError(friendlyError(err.message)); return; }
    setSent(trimmed);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1.5px solid ${C.ink}`,
    padding: "12px 0",
    fontSize: 20,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    color: C.ink,
    outline: "none",
    marginBottom: 20,
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

        <div style={{ height: 48 }} />

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
          — Sign in
        </div>

        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
          Get a sign-in link.
        </h1>

        <p style={{ fontSize: 17, lineHeight: 1.45, color: C.inkSoft, margin: "0 0 28px" }}>
          Enter your email and we'll send you a one-tap link to open your plan. No passwords needed.
        </p>

        {sent ? (
          <div style={{ padding: 18, border: `1.5px solid ${C.ink}`, borderRadius: 10, background: "#fff" }}>
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
              — Check your inbox
            </div>
            <div style={{ fontSize: 18, color: C.ink, marginBottom: 8 }}>
              We sent a sign-in link to <strong>{sent}</strong>.
            </div>
            <div style={{ fontSize: 14, color: C.inkSoft }}>
              Tap the link in the email to open your plan. The link expires shortly, so use it soon.
            </div>
            <button
              type="button"
              onClick={() => { setSent(null); }}
              style={{
                marginTop: 16,
                background: "transparent",
                border: "none",
                padding: 0,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.ember,
                cursor: "pointer",
              }}
            >
              Use a different email →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              inputMode="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
            />

            <button
              type="submit"
              disabled={busy || !validEmail}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: C.ink,
                color: C.paper,
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: busy ? "default" : "pointer",
                opacity: busy || !validEmail ? 0.5 : 1,
              }}
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>

            {error && (
              <div style={{ marginTop: 16, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                {error}
              </div>
            )}
          </form>
        )}

        <div
          style={{
            marginTop: 36, paddingTop: 16, borderTop: `1px solid ${C.ink}`,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: C.inkFaint, textAlign: "center",
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
