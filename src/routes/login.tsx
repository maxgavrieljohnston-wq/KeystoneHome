import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type LoginSearch = { email?: string; mode?: "signin" | "signup" };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
    mode: search.mode === "signup" ? "signup" : "signin",
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
  if (m.includes("invalid login")) return "That email and password don't match.";
  if (m.includes("email not confirmed")) return "Please verify your email first — check your inbox.";
  if (m.includes("user already registered")) return "An account with that email already exists. Try signing in.";
  if (m.includes("password") && m.includes("6")) return "Password must be at least 6 characters.";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("weak")) return "That password has been found in a data breach. Please choose a stronger one.";
  return msg;
}

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/dashboard" });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const validEmail = email.trim().includes("@");
  const validPassword = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const trimmed = email.trim().toLowerCase();
    if (!validEmail) return;

    setBusy(true);
    if (forgotMode) {
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (err) { setError(friendlyError(err.message)); return; }
      setInfo(`We sent a password reset link to ${trimmed}.`);
      return;
    }

    if (!validPassword) {
      setBusy(false);
      setError("Password must be at least 8 characters.");
      return;
    }

    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      setBusy(false);
      if (err) { setError(friendlyError(err.message)); return; }
      navigate({ to: "/dashboard" });
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      setBusy(false);
      if (err) { setError(friendlyError(err.message)); return; }
      if (data.session) {
        navigate({ to: "/dashboard" });
      } else {
        setInfo(`Check your inbox — we sent a verification link to ${trimmed}.`);
      }
    }
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

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 12px",
    background: active ? C.ink : "transparent",
    color: active ? C.paper : C.ink,
    border: `1.5px solid ${C.ink}`,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: "pointer",
  });

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
          — {forgotMode ? "Reset password" : mode === "signin" ? "Welcome back" : "Create account"}
        </div>

        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
          {forgotMode ? "Reset your password." : mode === "signin" ? "Sign in to your plan." : "Create your account."}
        </h1>

        <p style={{ fontSize: 17, lineHeight: 1.45, color: C.inkSoft, margin: "0 0 28px" }}>
          {forgotMode
            ? "Enter your email and we'll send you a link to set a new password."
            : mode === "signin"
              ? "Enter your email and password to continue."
              : "Set a password to save your plans and sign in later."}
        </p>

        {!forgotMode && (
          <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
            <button type="button" onClick={() => { setMode("signin"); setError(null); setInfo(null); }} style={tabStyle(mode === "signin")}>Sign in</button>
            <button type="button" onClick={() => { setMode("signup"); setError(null); setInfo(null); }} style={tabStyle(mode === "signup")}>Create account</button>
          </div>
        )}

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
          {!forgotMode && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
            />
          )}

          <button
            type="submit"
            disabled={busy || !validEmail || (!forgotMode && !validPassword)}
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
              opacity: busy || !validEmail || (!forgotMode && !validPassword) ? 0.5 : 1,
            }}
          >
            {busy ? "Working…" : forgotMode ? "Email me a reset link" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          {error && (
            <div style={{ marginTop: 16, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{ marginTop: 16, padding: 14, border: `1px solid ${C.ink}`, borderRadius: 8, background: "#fff", fontSize: 15, color: C.inkSoft }}>
              {info}
            </div>
          )}
        </form>

        <div style={{ marginTop: 22, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => { setForgotMode((v) => !v); setError(null); setInfo(null); }}
            style={{
              background: "transparent", border: "none", padding: 0,
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: C.ember, cursor: "pointer",
            }}
          >
            {forgotMode ? "← Back to sign in" : "Forgot password?"}
          </button>
        </div>

        {!forgotMode && (
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
        )}
      </div>
    </div>
  );
}
