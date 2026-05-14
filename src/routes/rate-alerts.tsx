import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeGate } from "@/hooks/useUpgradeGate";
import { getPaddleEnvironment } from "@/lib/paddle";
import {
  getRateAlert,
  upsertRateAlert,
  deleteRateAlert,
} from "@/lib/rate-alerts.functions";
import { calcMortgage } from "@/lib/keystone";

export const Route = createFileRoute("/rate-alerts")({
  head: () => ({
    meta: [
      { title: "Rate alerts — Keystone" },
      { name: "description", content: "Get notified when mortgage rates hit your target." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: RateAlertsPage,
});

const C = {
  paper: "#f5efe6",
  ink: "#1a1a1a",
  inkSoft: "#3d3d3d",
  inkMute: "#6b6b6b",
  inkFaint: "#a39888",
  ember: "#c4452d",
  sage: "#527f5c",
  gold: "#c79933",
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function RateAlertsPage() {
  const sub = useSubscription();
  const gate = useUpgradeGate();
  const qc = useQueryClient();
  const fetchAlert = useServerFn(getRateAlert);
  const saveAlert = useServerFn(upsertRateAlert);
  const removeAlert = useServerFn(deleteRateAlert);

  const proLocked = !sub.loading && !sub.isPro;

  const { data, isLoading } = useQuery({
    queryKey: ["rate-alert"],
    queryFn: () => fetchAlert(),
    enabled: !proLocked,
  });

  const [target, setTarget] = useState("6.00");
  const [loan, setLoan] = useState("400000");
  const [emailOn, setEmailOn] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (data?.alert) {
      setTarget(((Number(data.alert.target_rate) || 0) * 100).toFixed(2));
      setLoan(String(Math.round(Number(data.alert.loan_amount) || 0)));
      setEmailOn(Boolean(data.alert.email_notifications));
      setActive(Boolean(data.alert.active));
    }
  }, [data?.alert]);

  const save = useMutation({
    mutationFn: (vars: {
      targetRate: number;
      loanAmount: number;
      active: boolean;
      emailNotifications: boolean;
    }) =>
      saveAlert({
        data: { ...vars, environment: getPaddleEnvironment() },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate-alert"] }),
  });

  const del = useMutation({
    mutationFn: () => removeAlert(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate-alert"] }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = parseFloat(target);
    const l = parseFloat(loan);
    if (!isFinite(t) || t <= 0 || t >= 25) return;
    if (!isFinite(l) || l < 0) return;
    save.mutate({
      targetRate: t / 100,
      loanAmount: l,
      active,
      emailNotifications: emailOn,
    });
  };

  const currentRate = data?.currentRate ?? 0.0685;
  const targetNum = parseFloat(target) / 100 || 0;
  const loanNum = parseFloat(loan) || 0;
  const diff = currentRate - targetNum;
  const hit = data?.alert && diff <= 0;

  // Estimate savings: monthly diff between current rate and target rate
  const monthlyAtCurrent = loanNum > 0 ? calcMortgage(loanNum, 0, currentRate) : 0;
  const monthlyAtTarget = loanNum > 0 ? calcMortgage(loanNum, 0, targetNum || currentRate) : 0;
  const monthlySavings = Math.max(0, monthlyAtCurrent - monthlyAtTarget);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        padding: "28px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 14,
            borderBottom: `1px solid ${C.ink}`,
            marginBottom: 32,
          }}
        >
          <Link
            to="/dashboard"
            style={{
              color: C.inkMute,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            ← Dashboard
          </Link>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.ember,
            }}
          >
            Rate Alerts
          </div>
        </div>

        <h1
          style={{
            fontWeight: 400,
            fontSize: 40,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
          }}
        >
          Watch the rate, not the news
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 17, lineHeight: 1.5, marginBottom: 28 }}>
          We'll let you know when 30-year fixed rates dip to your target.
        </p>

        {proLocked ? (
          <div
            style={{
              border: `1.5px solid ${C.ink}`,
              borderRadius: 12,
              padding: 28,
              textAlign: "center",
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
              Pro feature
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 12px" }}>
              Stop refreshing rate sites
            </h2>
            <p style={{ color: C.inkSoft, marginBottom: 18 }}>
              Set a target rate and we'll watch it for you. One quiet email when the moment arrives.
            </p>
            <button
              type="button"
              onClick={() => gate.openUpgrade("pro", "Rate alerts")}
              style={{
                background: C.ink,
                color: C.paper,
                padding: "14px 22px",
                border: "none",
                borderRadius: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Upgrade to Pro →
            </button>
          </div>
        ) : isLoading ? (
          <p style={{ color: C.inkMute }}>Loading…</p>
        ) : (
          <>
            <div
              style={{
                background: "#fff",
                border: `1px solid ${C.inkFaint}`,
                borderRadius: 12,
                padding: 22,
                marginBottom: 24,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <Stat
                label="Current rate"
                value={`${(currentRate * 100).toFixed(2)}%`}
                hint="30-yr fixed, indicative"
              />
              <Stat
                label={data?.alert ? "Your target" : "—"}
                value={data?.alert ? `${(Number(data.alert.target_rate) * 100).toFixed(2)}%` : "Not set"}
                hint={
                  data?.alert
                    ? hit
                      ? "Target reached — time to call lenders"
                      : `${(diff * 100).toFixed(2)}% to go`
                    : "Set a target below"
                }
                accent={data?.alert ? (hit ? C.sage : C.gold) : undefined}
              />
            </div>

            <form
              onSubmit={submit}
              style={{
                background: "#fff",
                border: `1px solid ${C.inkFaint}`,
                borderRadius: 12,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <Field label="Target rate (%)">
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="20"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Estimated loan amount ($)">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={loan}
                  onChange={(e) => setLoan(e.target.value)}
                  style={inputStyle}
                />
              </Field>

              {monthlySavings > 0 && (
                <div
                  style={{
                    background: C.paper,
                    border: `1px dashed ${C.inkFaint}`,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: C.inkSoft,
                  }}
                >
                  At your target, the monthly P&I drops by about{" "}
                  <strong style={{ color: C.ink }}>{money(monthlySavings)}</strong>{" "}
                  vs. the current rate.
                </div>
              )}

              <Toggle
                label="Email me when it hits"
                value={emailOn}
                onChange={setEmailOn}
              />
              <Toggle
                label="Alert active"
                value={active}
                onChange={setActive}
                hint="Pause without losing your settings"
              />

              {save.isError && (
                <div style={{ color: C.ember, fontSize: 14 }}>
                  Couldn't save. Check your inputs and try again.
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={save.isPending}
                  style={{
                    flex: 1,
                    background: C.ink,
                    color: C.paper,
                    border: "none",
                    padding: "14px 16px",
                    borderRadius: 8,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: save.isPending ? "default" : "pointer",
                    opacity: save.isPending ? 0.6 : 1,
                  }}
                >
                  {save.isPending ? "Saving…" : data?.alert ? "Update alert" : "Create alert"}
                </button>
                {data?.alert && (
                  <button
                    type="button"
                    onClick={() => del.mutate()}
                    disabled={del.isPending}
                    style={{
                      background: "transparent",
                      color: C.ember,
                      border: `1px solid ${C.ember}`,
                      padding: "14px 16px",
                      borderRadius: 8,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>

            <p
              style={{
                marginTop: 18,
                color: C.inkMute,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Indicative rate based on the national 30-year fixed average. Actual quotes vary by lender, credit, and loan type.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: `1.5px solid ${C.ink}`,
  borderRadius: 8,
  fontSize: 16,
  fontFamily: "inherit",
  background: "#fff",
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.inkMute,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.inkMute,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 32, color: accent ?? C.ink, lineHeight: 1.05 }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 12, color: C.inkMute, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <span>
        <span style={{ display: "block", fontSize: 16, color: C.ink }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 12, color: C.inkMute }}>{hint}</span>
        )}
      </span>
      <span
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          background: value ? C.ink : C.inkFaint,
          position: "relative",
          transition: "background 120ms",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: C.paper,
            transition: "left 120ms",
          }}
        />
      </span>
    </button>
  );
}
