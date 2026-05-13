import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";

type LoginSearch = {
  email?: string;
  signup?: boolean;
  plan?: string;
  billing?: "monthly" | "yearly";
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
    signup: search.signup === true || search.signup === "true" || search.signup === "1",
    plan: typeof search.plan === "string" ? search.plan : undefined,
    billing: search.billing === "monthly" || search.billing === "yearly" ? search.billing : undefined,
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
  
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  
  // Signup flow steps
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [otp, setOtp] = useState("");
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) navigate({ to: "/dashboard" });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const validEmail = email.trim().includes("@");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validEmail || !password) return;

    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    
    if (err) {
      setError(friendlyError(err.message));
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validEmail) return;

    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    
    if (err) {
      setError(friendlyError(err.message));
    } else {
      setStep("otp");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp) return;

    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setBusy(false);

    if (err) {
      setError(friendlyError(err.message));
    } else {
      setStep("password");
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) return;

    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({
      password,
    });
    setBusy(false);

    if (err) {
      setError(friendlyError(err.message));
    } else {
      navigate({ to: "/dashboard" });
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
        
        {step === "email" && (
          <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
            <button
              type="button"
              onClick={() => setTab("signin")}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: tab === "signin" ? C.ink : C.inkFaint,
                borderBottom: tab === "signin" ? `1px solid ${C.ink}` : "none",
                cursor: "pointer",
                paddingBottom: 4,
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: tab === "signup" ? C.ink : C.inkFaint,
                borderBottom: tab === "signup" ? `1px solid ${C.ink}` : "none",
                cursor: "pointer",
                paddingBottom: 4,
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {tab === "signin" && step === "email" && (
          <div>
            <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
              Welcome back.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.45, color: C.inkSoft, margin: "0 0 28px" }}>
              Sign in to view your homebuying plan.
            </p>

            <form onSubmit={handleSignIn}>
              <input
                type="email"
                inputMode="email"
                placeholder="Username (email)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="username"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, marginBottom: 32 }}
                autoComplete="current-password"
              />

              <button
                type="submit"
                disabled={busy || !validEmail || !password}
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
                  opacity: busy || !validEmail || !password ? 0.5 : 1,
                }}
              >
                {busy ? "Signing in…" : "Sign In"}
              </button>

              {error && (
                <div style={{ marginTop: 16, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  {error}
                </div>
              )}
            </form>
          </div>
        )}

        {tab === "signup" && step === "email" && (
          <div>
            <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
              Create your account.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.45, color: C.inkSoft, margin: "0 0 28px" }}>
              Enter your email. We'll send a code to verify it.
            </p>

            <form onSubmit={handleSendOtp}>
              <input
                type="email"
                inputMode="email"
                placeholder="Username (email)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ ...inputStyle, marginBottom: 32 }}
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
                {busy ? "Sending…" : "Send verification code"}
              </button>

              {error && (
                <div style={{ marginTop: 16, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  {error}
                </div>
              )}
            </form>
          </div>
        )}

        {tab === "signup" && step === "otp" && (
          <div>
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
              — Check your inbox
            </div>
            <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
              Verify your email.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.45, color: C.inkSoft, margin: "0 0 28px" }}>
              We sent a 6-digit code to <strong>{email}</strong>.
            </p>

            <form onSubmit={handleVerifyOtp}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={{ ...inputStyle, marginBottom: 32, letterSpacing: "0.2em" }}
                autoComplete="one-time-code"
              />

              <button
                type="submit"
                disabled={busy || !otp}
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
                  opacity: busy || !otp ? 0.5 : 1,
                }}
              >
                {busy ? "Verifying…" : "Verify code"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError(null);
                }}
                style={{
                  marginTop: 20,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: C.inkMute,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                ← Back to email
              </button>

              {error && (
                <div style={{ marginTop: 16, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textAlign: "center" }}>
                  {error}
                </div>
              )}
            </form>
          </div>
        )}

        {tab === "signup" && step === "password" && (
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: C.inkSoft,
                marginBottom: 16,
              }}
            >
              — Email verified
            </div>
            <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
              Secure your account.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.45, color: C.inkSoft, margin: "0 0 28px" }}>
              Create a password so you can sign in easily next time.
            </p>

            <form onSubmit={handleSetPassword}>
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, marginBottom: 32 }}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={busy || !password}
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
                  opacity: busy || !password ? 0.5 : 1,
                }}
              >
                {busy ? "Saving…" : "Save password"}
              </button>

              {error && (
                <div style={{ marginTop: 16, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textAlign: "center" }}>
                  {error}
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
