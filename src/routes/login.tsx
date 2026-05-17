import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { lovable } from "@/integrations/lovable";

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
  
  const [tab, setTab] = useState<"signin" | "signup">(search.signup ? "signup" : "signin");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const { openCheckout } = usePaddleCheckout();
  
  // Signup flow steps
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Auto-focus OTP input on step change.
  useEffect(() => {
    if (step === "otp") {
      otpInputRef.current?.focus();
    }
  }, [step]);

  // Countdown for resend cooldown.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      setError(friendlyError(result.error.message));
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    navigate({ to: "/dashboard" });
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !validEmail) return;
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
    } else {
      setResendCooldown(45);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setResetSent(false);
    if (!validEmail) {
      setError("Enter your email above first, then tap Forgot password.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
    } else {
      setResetSent(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session && !search.plan) navigate({ to: "/dashboard" });
    });
    return () => { cancelled = true; };
  }, [navigate, search.plan]);

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
    } else if (search.plan && search.billing) {
      const priceId = `${search.plan}_${search.billing}`;
      const { data: u } = await supabase.auth.getUser();
      await openCheckout({
        priceId,
        customerEmail: u.user?.email ?? email.trim(),
        userId: u.user?.id,
      });
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
              onClick={() => {
                if (search.plan) {
                  setTab("signup");
                } else {
                  navigate({ to: "/pricing" });
                }
              }}
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

              {resetSent && (
                <div style={{ marginTop: 16, color: C.inkSoft, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                  Password reset link sent. Check your inbox.
                </div>
              )}

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={busy}
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
                  cursor: busy ? "default" : "pointer",
                  width: "100%",
                  textAlign: "center",
                  textDecoration: "underline",
                }}
              >
                Forgot password?
              </button>
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
              We sent an 8-digit code to <strong>{email}</strong>.
            </p>

            <form onSubmit={handleVerifyOtp}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="8-digit code"
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
              Create password.
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
                {busy ? "Creating…" : "Create password"}
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
