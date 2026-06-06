import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
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
  const { openCheckout, checkoutElement } = useStripeCheckout();
  
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
    } else if (search.plan) {
      // Canonical price per plan — Plus is yearly-only ($49.99/yr),
      // Pro is monthly ($11/mo). The `billing` search param is ignored
      // (kept in validateSearch for backward compatibility with old links).
      const priceId =
        search.plan === "plus" ? "plus_yearly" :
        search.plan === "pro" ? "pro_monthly" :
        null;
      if (priceId) {
        const { data: u } = await supabase.auth.getUser();
        await openCheckout({
          priceId,
          customerEmail: u.user?.email ?? email.trim(),
          userId: u.user?.id,
        });
      } else {
        navigate({ to: "/dashboard" });
      }
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

        {step === "email" && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              style={{
                width: "100%",
                padding: "13px 16px",
                background: "transparent",
                color: C.ink,
                border: `1.5px solid ${C.ink}`,
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.5 : 1,
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "0 0 22px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.inkFaint,
              }}
            >
              <span style={{ flex: 1, height: 1, background: C.inkFaint, opacity: 0.4 }} />
              or
              <span style={{ flex: 1, height: 1, background: C.inkFaint, opacity: 0.4 }} />
            </div>
          </>
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
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="8-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
                  if (pasted) {
                    e.preventDefault();
                    setOtp(pasted);
                  }
                }}
                style={{ ...inputStyle, marginBottom: 32, letterSpacing: "0.2em", fontFeatureSettings: '"tnum"' }}
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                    cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={busy || resendCooldown > 0}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: resendCooldown > 0 ? C.inkFaint : C.ink,
                    cursor: resendCooldown > 0 ? "default" : "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>

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
              <div style={{ position: "relative", marginBottom: 32 }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, paddingRight: 56 }}
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: C.inkMute,
                    cursor: "pointer",
                    padding: "8px 4px",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p style={{ marginTop: -22, marginBottom: 24, fontSize: 13, color: C.inkMute, lineHeight: 1.4 }}>
                Use 8+ characters. Mix letters and numbers for a stronger password.
              </p>

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
      {checkoutElement}
    </div>
  );
}
