import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Keystone" },
      { name: "description", content: "Choose a new password for your Keystone account." },
    ],
  }),
  component: ResetPasswordPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  ember: "#c4452d",
};

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase auto-processes the recovery hash and creates a session.
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => { sub.data.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 1200);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, padding: "36px 24px 60px", fontFamily: "'Cormorant Garamond', Georgia, serif", color: C.ink }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <Link to="/login" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.inkMute, textDecoration: "none" }}>
          ← Back to sign in
        </Link>
        <div style={{ height: 48 }} />

        <h1 style={{ fontWeight: 400, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
          Set a new password.
        </h1>

        {!ready ? (
          <p style={{ color: C.inkSoft }}>Loading…</p>
        ) : !hasSession ? (
          <p style={{ fontSize: 17, color: C.inkSoft }}>
            This reset link is invalid or has expired. <Link to="/login" style={{ color: C.ember }}>Request a new one</Link>.
          </p>
        ) : done ? (
          <div style={{ padding: 16, border: `1.5px solid ${C.ink}`, borderRadius: 10, background: "#fff" }}>
            Password updated. Taking you to your dashboard…
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: 17, lineHeight: 1.45, color: C.inkSoft, margin: "0 0 24px" }}>
              Choose a strong password (8+ characters).
            </p>
            <input
              type="password" placeholder="New password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1.5px solid ${C.ink}`, padding: "12px 0", fontSize: 20, fontFamily: "'Cormorant Garamond', Georgia, serif", color: C.ink, outline: "none", marginBottom: 20 }}
            />
            <input
              type="password" placeholder="Confirm password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1.5px solid ${C.ink}`, padding: "12px 0", fontSize: 20, fontFamily: "'Cormorant Garamond', Georgia, serif", color: C.ink, outline: "none", marginBottom: 20 }}
            />
            <button
              type="submit" disabled={busy}
              style={{ width: "100%", padding: "14px 16px", background: C.ink, color: C.paper, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}
            >
              {busy ? "Updating…" : "Update password"}
            </button>
            {error && (
              <div style={{ marginTop: 16, color: C.ember, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{error}</div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
